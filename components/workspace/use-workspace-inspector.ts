"use client";

import { useCallback, useEffect, useState } from "react";
import type { AgentId } from "@/lib/constants/agents";
import type { LabInspectorData } from "@/lib/workspace/inspector-types";

export function useWorkspaceInspector(agentId: AgentId | null) {
  const [data, setData] = useState<LabInspectorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInspector = useCallback(async (id: AgentId, signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/workspace/lab/${id}`, { signal });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to load workspace inspector");
      }
      setData((await response.json()) as LabInspectorData);
    } catch (cause) {
      if (signal?.aborted) return;
      setError(cause instanceof Error ? cause.message : "Inspector load failed");
      setData(null);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!agentId) {
      setData(null);
      setError(null);
      return;
    }
    const controller = new AbortController();
    void fetchInspector(agentId, controller.signal);
    return () => controller.abort();
  }, [agentId, fetchInspector]);

  return { data, loading, error, refresh: fetchInspector };
}
