"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  parseResearchApiError,
  parseResearchApiResponse,
  parseFusionReportResponse,
  RESEARCH_RUN_STEPS,
  type FusionReportError,
  type ResearchResultV3,
  type ResearchRunError,
  type ResearchRunPhase,
} from "./types";

const STEP_INTERVAL_MS = 1400;
const RESEARCH_RUN_TIMEOUT_MS = 180_000;
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

export function useResearchRun() {
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
    setPhase(RESEARCH_RUN_STEPS[0]?.id ?? "engine");

    for (let index = 1; index < RESEARCH_RUN_STEPS.length; index += 1) {
      await sleep(STEP_INTERVAL_MS);
      if (runIdRef.current !== runId) return;
      setPhase(RESEARCH_RUN_STEPS[index].id);
    }
  }, []);

  const fetchFusionReport = useCallback(async (title: string) => {
    const fusionRes = await fetchWithTimeout(
      `/api/research/fusion-report?title=${encodeURIComponent(title)}&refresh=1`,
      { cache: "no-store" },
      FUSION_REPORT_TIMEOUT_MS,
    );
    const fusionData = (await fusionRes.json()) as Record<string, unknown>;

    if (!fusionRes.ok || !fusionData.ok) {
      const message =
        typeof fusionData.error === "string"
          ? fusionData.error
          : "Fusion report unavailable";
      throw new Error(message);
    }

    const fusionReport = parseFusionReportResponse(fusionData);
    if (!fusionReport) {
      throw new Error("Fusion report unavailable");
    }

    return fusionReport;
  }, []);

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
        const res = await fetchWithTimeout(
          "/api/research/run",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ request: trimmed }),
          },
          RESEARCH_RUN_TIMEOUT_MS,
        );

        const data = (await res.json()) as Record<string, unknown>;

        if (!res.ok) {
          cancelRunAnimation();
          const parsedError = parseResearchApiError(data);
          console.error("[Research Studio] Research API error", {
            status: res.status,
            stage: parsedError.stage,
            missingFields: parsedError.missingFields,
            validationIssues: parsedError.validationIssues,
            response: data,
          });
          if (parsedError.validationIssues?.length) {
            console.table(parsedError.validationIssues);
          }
          setPhase("error");
          setError(parsedError);
          return;
        }

        const parsed = parseResearchApiResponse(data);
        let fusionReport: ResearchResultV3["fusionReport"] = null;
        let nextFusionError: FusionReportError | null = null;

        try {
          fusionReport = await fetchFusionReport(parsed.title);
        } catch (err) {
          nextFusionError = {
            message:
              err instanceof Error ? err.message : "Fusion report unavailable",
          };
        }

        await animation;
        if (runIdRef.current !== runId) return;

        setPhase("complete");
        setResult({ ...parsed, fusionReport });
        setFusionError(nextFusionError);
      } catch (err) {
        cancelRunAnimation();
        setPhase("error");
        if (err && typeof err === "object" && "message" in err) {
          setError(err as ResearchRunError);
        } else {
          setError({
            message: err instanceof Error ? err.message : "Research failed",
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
    const title = result?.title;
    if (!title || fusionRetrying) return;

    setFusionRetrying(true);
    setFusionError(null);

    try {
      const fusionReport = await fetchFusionReport(title);
      setResult((current) =>
        current ? { ...current, fusionReport } : current,
      );
      setFusionError(null);
    } catch (err) {
      setFusionError({
        message:
          err instanceof Error ? err.message : "Fusion report unavailable",
      });
    } finally {
      setFusionRetrying(false);
    }
  }, [fetchFusionReport, fusionRetrying, result?.title]);

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
