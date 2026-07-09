"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  parseResearchApiResponse,
  RESEARCH_RUN_STEPS,
  type ResearchResult,
  type ResearchRunPhase,
} from "./types";

const RECENT_MISSIONS_KEY = "nexhq-research-recent-missions";
const PINNED_RESEARCH_KEY = "nexhq-research-pinned";
const MAX_RECENT = 12;

export interface RecentMission {
  id: string;
  prompt: string;
  title?: string;
  reportId?: string;
  createdAt: string;
}

function loadRecentMissions(): RecentMission[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_MISSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentMission[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecentMission(entry: RecentMission) {
  const existing = loadRecentMissions().filter((m) => m.prompt !== entry.prompt);
  const next = [entry, ...existing].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_MISSIONS_KEY, JSON.stringify(next));
  return next;
}

export function loadPinnedResearch(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PINNED_RESEARCH_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function togglePinnedResearch(reportId: string): string[] {
  const current = loadPinnedResearch();
  const next = current.includes(reportId)
    ? current.filter((id) => id !== reportId)
    : [...current, reportId];
  localStorage.setItem(PINNED_RESEARCH_KEY, JSON.stringify(next));
  return next;
}

export function useResearchStudio() {
  const [request, setRequest] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [phase, setPhase] = useState<ResearchRunPhase>("idle");
  const [recentMissions, setRecentMissions] = useState<RecentMission[]>([]);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const phaseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepIndexRef = useRef(0);

  useEffect(() => {
    setRecentMissions(loadRecentMissions());
    setPinnedIds(loadPinnedResearch());
  }, []);

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
    }, 2800);
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

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? "Research failed");
        }

        const parsed = parseResearchApiResponse(data);
        setPhase("complete");
        setResult(parsed);
        setRequest("");

        const mission: RecentMission = {
          id: crypto.randomUUID(),
          prompt: trimmed,
          title: parsed.title,
          reportId: parsed.reportId,
          createdAt: new Date().toISOString(),
        };
        setRecentMissions(saveRecentMission(mission));
      } catch (err) {
        setPhase("error");
        setError(err instanceof Error ? err.message : "Research failed");
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

  const togglePin = useCallback((reportId: string) => {
    setPinnedIds(togglePinnedResearch(reportId));
  }, []);

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
    recentMissions,
    pinnedIds,
    runResearch,
    reset,
    togglePin,
  };
}
