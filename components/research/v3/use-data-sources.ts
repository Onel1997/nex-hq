"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DataSourcePlatformSnapshot,
  DataSourceSettingsSnapshot,
} from "./data-source-types";

const POLL_INTERVAL_MS = 60_000;

type ProviderAction = "health" | "test" | "disconnect" | "refresh" | "reconnect";

interface UseDataSourcesOptions {
  autoRefresh?: boolean;
}

interface ProviderActionResult {
  ok?: boolean;
  error?: string;
  health?: { healthy: boolean; message?: string; latencyMs?: number };
  provider?: unknown;
}

export function useDataSources(options: UseDataSourcesOptions = {}) {
  const { autoRefresh = true } = options;
  const [snapshot, setSnapshot] = useState<DataSourcePlatformSnapshot | null>(
    null,
  );
  const [settings, setSettings] =
    useState<DataSourceSettingsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const fetchSources = useCallback(async (force = false) => {
    try {
      const url = force
        ? "/api/research/sources?refresh=1"
        : "/api/research/sources";
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      if (!mounted.current) return;
      if (!data.ok) {
        setError(data.error ?? "Failed to load sources");
        return;
      }
      setSnapshot(data.snapshot);
      setError(null);
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : "Failed to load sources");
    }
  }, []);

  const loadSettings = useCallback(async (force = false) => {
    try {
      const url = force
        ? "/api/research/sources/settings?refresh=1"
        : "/api/research/sources/settings";
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      if (!mounted.current) return;
      if (data.ok) setSettings(data.settings);
    } catch {
      /* optional */
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/research/sources", { method: "POST" });
      const data = await res.json();
      if (!mounted.current) return;
      if (data.ok) {
        setSnapshot(data.snapshot);
        setError(null);
        await loadSettings(true);
      } else {
        setError(data.error ?? "Refresh failed");
      }
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, [loadSettings]);

  const refreshProvider = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/research/sources/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "refresh" }),
        });
        if (!mounted.current) return;
        await fetchSources(true);
      } catch {
        /* isolated failure */
      }
    },
    [fetchSources],
  );

  const runProviderAction = useCallback(
    async (id: string, action: ProviderAction): Promise<ProviderActionResult> => {
      const apiAction = action === "reconnect" ? "refresh" : action;
      const res = await fetch(`/api/research/sources/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: apiAction }),
      });
      const data = await res.json();

      if (
        apiAction === "refresh" ||
        apiAction === "test" ||
        apiAction === "disconnect"
      ) {
        await Promise.all([fetchSources(true), loadSettings(true)]);
      }

      if (apiAction === "health") {
        return {
          ok: data.ok,
          error: data.error,
          health: data.health,
        };
      }

      return {
        ok: data.ok,
        error: data.error,
        health: data.health,
        provider: data.provider,
      };
    },
    [fetchSources, loadSettings],
  );

  const openDataSourcesCenter = useCallback(async () => {
    setSettingsLoading(true);
    await loadSettings(true);
    if (mounted.current) setSettingsLoading(false);
  }, [loadSettings]);

  const refreshDataSourcesCenter = useCallback(async () => {
    setSettingsLoading(true);
    await refreshAll();
    if (mounted.current) setSettingsLoading(false);
  }, [refreshAll]);

  useEffect(() => {
    mounted.current = true;
    void (async () => {
      setLoading(true);
      await fetchSources();
      if (mounted.current) setLoading(false);
    })();
    return () => {
      mounted.current = false;
    };
  }, [fetchSources]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      void fetchSources();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchSources]);

  return {
    snapshot,
    settings,
    loading,
    refreshing,
    settingsLoading,
    error,
    refreshAll,
    refreshProvider,
    loadSettings,
    openDataSourcesCenter,
    refreshDataSourcesCenter,
    runProviderAction,
  };
}
