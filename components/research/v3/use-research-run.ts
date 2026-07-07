"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  parseResearchApiError,
  parseResearchApiResponse,
  RESEARCH_RUN_STEPS,
  type ResearchResult,
  type ResearchRunError,
  type ResearchRunPhase,
} from "./types";

const STEP_INTERVAL_MS = 2600;

export function useResearchRun() {
  const [request, setRequest] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ResearchRunError | null>(null);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [phase, setPhase] = useState<ResearchRunPhase>("idle");
  const phaseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepIndexRef = useRef(0);

  const clearPhaseTimer = useCallback(() => {
    if (phaseTimerRef.current) {
      clearInterval(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
  }, []);

  const startPhaseAnimation = useCallback(() => {
    clearPhaseTimer();
    stepIndexRef.current = 0;
    setPhase(RESEARCH_RUN_STEPS[0]?.id ?? "connecting");

    phaseTimerRef.current = setInterval(() => {
      stepIndexRef.current += 1;
      if (stepIndexRef.current < RESEARCH_RUN_STEPS.length) {
        setPhase(RESEARCH_RUN_STEPS[stepIndexRef.current].id);
      }
    }, STEP_INTERVAL_MS);
  }, [clearPhaseTimer]);

  const runResearch = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setIsLoading(true);
      setError(null);
      setResult(null);
      startPhaseAnimation();

      try {
        const res = await fetch("/api/research/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request: trimmed }),
        });

        const data = (await res.json()) as Record<string, unknown>;

        if (!res.ok) {
          setPhase("error");
          setError(parseResearchApiError(data));
          return;
        }

        setPhase("complete");
        setResult(parseResearchApiResponse(data));
        setRequest("");
      } catch (err) {
        setPhase("error");
        if (err && typeof err === "object" && "message" in err) {
          setError(err as ResearchRunError);
        } else {
          setError({
            message: err instanceof Error ? err.message : "Research failed",
          });
        }
      } finally {
        clearPhaseTimer();
        setIsLoading(false);
      }
    },
    [clearPhaseTimer, isLoading, startPhaseAnimation],
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setPhase("idle");
  }, []);

  const retry = useCallback(() => {
    const prompt = request.trim();
    if (!prompt) {
      reset();
      return;
    }
    void runResearch(prompt);
  }, [request, reset, runResearch]);

  useEffect(() => {
    return () => clearPhaseTimer();
  }, [clearPhaseTimer]);

  return {
    request,
    setRequest,
    isLoading,
    error,
    result,
    phase,
    runResearch,
    reset,
    retry,
  };
}
