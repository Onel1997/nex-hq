"use client";

import type { ResearchBrainSnapshot } from "@/lib/research/research-brain-intelligence";
import { useEffect, useState } from "react";

export function useResearchBrain() {
  const [snapshot, setSnapshot] = useState<ResearchBrainSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/research/intelligence");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load intelligence");
        }
        if (!cancelled) {
          setSnapshot(data.snapshot);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load intelligence");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { snapshot, loading, error };
}
