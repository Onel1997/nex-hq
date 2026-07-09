"use client";

import { useCallback, useEffect, useState } from "react";
import type { AgentId } from "@/lib/constants/agents";
import type { LabInspectorData } from "@/lib/facility/types";

export function useLabInspector(agentId: AgentId | null) {
  const [data, setData] = useState<LabInspectorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInspector = useCallback(async (id: AgentId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/facility/lab/${id}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Failed to load lab inspector");
      }
      const inspector = (await response.json()) as LabInspectorData;
      setData(inspector);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inspector load failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!agentId) {
      setData(null);
      setError(null);
      return;
    }
    void fetchInspector(agentId);
  }, [agentId, fetchInspector]);

  return { data, loading, error, refresh: fetchInspector };
}
