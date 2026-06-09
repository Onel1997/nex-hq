"use client";

import { useCallback, useEffect, useState } from "react";
import type { FacilitySnapshot } from "@/lib/facility/types";

interface UseFacilityDataResult {
  data: FacilitySnapshot | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useFacilityData(pollMs = 30_000): UseFacilityDataResult {
  const [data, setData] = useState<FacilitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch("/api/facility");
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Facility API error (${response.status})`);
      }
      const snapshot = (await response.json()) as FacilitySnapshot;
      setData(snapshot);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load facility");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const interval = setInterval(() => {
      void fetchData();
    }, pollMs);
    return () => clearInterval(interval);
  }, [fetchData, pollMs]);

  return {
    data,
    loading,
    error,
    refresh: fetchData,
  };
}
