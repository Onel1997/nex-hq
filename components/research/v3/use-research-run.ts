"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n";
import { getResearchRunSteps, getStudioErrorMessages } from "@/lib/i18n/data/research-studio";
import {
  parseFusionReportResponse,
  type FusionReportError,
  type ResearchResultV3,
  type ResearchRunError,
  type ResearchRunPhase,
} from "./types";

const STEP_INTERVAL_MS = 900;
const FUSION_REPORT_TIMEOUT_MS = 120_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(
        `Request timed out after ${Math.round(timeoutMs / 1000)} seconds`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function detectModes(prompt: string): {
  mode: string;
  providerMode: string;
} {
  const lower = prompt.toLowerCase();
  if (/kollektion|collection|kapsel|capsule/.test(lower)) {
    return { mode: "collection_creator", providerMode: "creative_only" };
  }
  if (/full intelligence|trend_intelligence|voller provider/.test(lower)) {
    return { mode: "trend_intelligence", providerMode: "full_intelligence" };
  }
  if (/shopify assisted|shopify-assisted/.test(lower)) {
    return { mode: "weekly_design_ideas", providerMode: "shopify_assisted" };
  }
  return { mode: "weekly_design_ideas", providerMode: "creative_only" };
}

export function useResearchRun() {
  const locale = useLocale();
  const studioErrors = getStudioErrorMessages(locale);
  const [request, setRequest] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ResearchRunError | null>(null);
  const [fusionError, setFusionError] = useState<FusionReportError | null>(null);
  const [fusionRetrying, setFusionRetrying] = useState(false);
  const [result, setResult] = useState<ResearchResultV3 | null>(null);
  const [phase, setPhase] = useState<ResearchRunPhase>("idle");
  const runIdRef = useRef(0);
  const activeLoadingRunRef = useRef(0);

  const cancelRunAnimation = useCallback(() => {
    runIdRef.current += 1;
  }, []);

  const animateSteps = useCallback(async (runId: number) => {
    const steps = getResearchRunSteps(locale);
    setPhase(steps[0]?.id ?? "engine");

    for (let index = 1; index < steps.length; index += 1) {
      await sleep(STEP_INTERVAL_MS);
      if (runIdRef.current !== runId) return;
      setPhase(steps[index].id);
    }
  }, [locale]);

  const fetchFusionReport = useCallback(async (title: string) => {
    const { mode, providerMode } = detectModes(title);
    const fusionRes = await fetchWithTimeout(
      `/api/research/fusion-report?title=${encodeURIComponent(title)}&refresh=1&mode=${encodeURIComponent(mode)}&providerMode=${encodeURIComponent(providerMode)}`,
      { cache: "no-store" },
      FUSION_REPORT_TIMEOUT_MS,
    );
    const fusionData = (await fusionRes.json()) as Record<string, unknown>;

    if (!fusionRes.ok || !fusionData.ok) {
      const message =
        typeof fusionData.error === "string"
          ? fusionData.error
          : studioErrors.fusionUnavailable;
      throw new Error(message);
    }

    const fusionReport = parseFusionReportResponse(fusionData);
    if (!fusionReport) {
      throw new Error(studioErrors.fusionUnavailable);
    }

    return fusionReport;
  }, [studioErrors.fusionUnavailable]);

  const finishLoadingRun = useCallback((runId: number) => {
    if (activeLoadingRunRef.current === runId) {
      activeLoadingRunRef.current = 0;
      setIsLoading(false);
    }
  }, []);

  const runResearch = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      activeLoadingRunRef.current = runId;

      setIsLoading(true);
      setError(null);
      setFusionError(null);
      setResult(null);
      setLastPrompt(trimmed);

      const animation = animateSteps(runId);

      try {
        // Creative Research default: fusion/creative pipeline only — no paid provider agent run.
        const fusionReport = await fetchFusionReport(trimmed);

        await animation;
        if (runIdRef.current !== runId) return;

        setPhase("complete");
        setResult({
          outputKind: "research",
          reportId: `creative-${fusionReport.generatedAt}`,
          title: fusionReport.title || trimmed,
          executiveSummary:
            fusionReport.executiveSummary ??
            fusionReport.creativeResearch?.creativeDirectionSummary ??
            trimmed,
          keyFindings:
            fusionReport.creativeResearch?.designIdeas.map((idea) => idea.primaryPhrase) ??
            [],
          opportunities: [],
          recommendations: [fusionReport.creativeResearch?.nextStep].filter(
            (value): value is string => Boolean(value),
          ),
          confidence: fusionReport.overallConfidence,
          savedDomains: [],
          fusionReport,
        });
        setFusionError(null);
      } catch (err) {
        cancelRunAnimation();
        setPhase("error");
        if (err && typeof err === "object" && "message" in err) {
          setError(err as ResearchRunError);
        } else {
          setError({
            message: err instanceof Error ? err.message : studioErrors.researchFailed,
          });
        }
      } finally {
        finishLoadingRun(runId);
      }
    },
    [
      animateSteps,
      cancelRunAnimation,
      fetchFusionReport,
      finishLoadingRun,
      isLoading,
      studioErrors.researchFailed,
    ],
  );

  const reset = useCallback(() => {
    cancelRunAnimation();
    activeLoadingRunRef.current = 0;
    setIsLoading(false);
    setResult(null);
    setError(null);
    setFusionError(null);
    setFusionRetrying(false);
    setPhase("idle");
    setRequest("");
    setLastPrompt("");
  }, [cancelRunAnimation]);

  const retry = useCallback(() => {
    const prompt = lastPrompt.trim();
    if (!prompt) {
      reset();
      return;
    }
    void runResearch(prompt);
  }, [lastPrompt, reset, runResearch]);

  const retryFusionReport = useCallback(async () => {
    const title = result?.title ?? lastPrompt;
    if (!title || fusionRetrying) return;

    setFusionRetrying(true);
    setFusionError(null);

    try {
      const fusionReport = await fetchFusionReport(title);
      setResult((current) =>
        current
          ? { ...current, fusionReport, title: fusionReport.title || current.title }
          : {
              outputKind: "research",
              reportId: `creative-${fusionReport.generatedAt}`,
              title: fusionReport.title || title,
              executiveSummary: fusionReport.executiveSummary ?? "",
              keyFindings: [],
              opportunities: [],
              recommendations: [],
              savedDomains: [],
              fusionReport,
            },
      );
      setFusionError(null);
    } catch (err) {
      setFusionError({
        message:
          err instanceof Error ? err.message : studioErrors.fusionUnavailable,
      });
    } finally {
      setFusionRetrying(false);
    }
  }, [
    fetchFusionReport,
    fusionRetrying,
    lastPrompt,
    result?.title,
    studioErrors.fusionUnavailable,
  ]);

  useEffect(() => {
    return () => {
      cancelRunAnimation();
      activeLoadingRunRef.current = 0;
    };
  }, [cancelRunAnimation]);

  return {
    request,
    setRequest,
    isLoading,
    error,
    fusionError,
    fusionRetrying,
    result,
    phase,
    runResearch,
    reset,
    retry,
    retryFusionReport,
  };
}
