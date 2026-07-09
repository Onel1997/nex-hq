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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  const animateSteps = useCallback(async (runId: number) => {
    setPhase(RESEARCH_RUN_STEPS[0]?.id ?? "engine");

    for (let index = 1; index < RESEARCH_RUN_STEPS.length; index += 1) {
      await sleep(STEP_INTERVAL_MS);
      if (runIdRef.current !== runId) return;
      setPhase(RESEARCH_RUN_STEPS[index].id);
    }
  }, []);

  const fetchFusionReport = useCallback(async (title: string) => {
    const fusionRes = await fetch(
      `/api/research/fusion-report?title=${encodeURIComponent(title)}&refresh=1`,
      { cache: "no-store" },
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

  const runResearch = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const runId = runIdRef.current + 1;
      runIdRef.current = runId;

      setIsLoading(true);
      setError(null);
      setFusionError(null);
      setResult(null);
      setLastPrompt(trimmed);

      const animation = animateSteps(runId);

      try {
        const res = await fetch("/api/research/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request: trimmed }),
        });

        const data = (await res.json()) as Record<string, unknown>;

        if (!res.ok) {
          runIdRef.current += 1;
          setPhase("error");
          setError(parseResearchApiError(data));
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
        runIdRef.current += 1;
        setPhase("error");
        if (err && typeof err === "object" && "message" in err) {
          setError(err as ResearchRunError);
        } else {
          setError({
            message: err instanceof Error ? err.message : "Research failed",
          });
        }
      } finally {
        if (runIdRef.current === runId) {
          setIsLoading(false);
        }
      }
    },
    [animateSteps, fetchFusionReport, isLoading],
  );

  const reset = useCallback(() => {
    runIdRef.current += 1;
    setResult(null);
    setError(null);
    setFusionError(null);
    setFusionRetrying(false);
    setPhase("idle");
    setRequest("");
    setLastPrompt("");
  }, []);

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
      runIdRef.current += 1;
    };
  }, []);

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
