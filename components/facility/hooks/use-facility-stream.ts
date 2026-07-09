"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FacilityEvent, FacilitySnapshot } from "@/lib/facility/types";
import { isQuotaDegradedResponse } from "@/lib/facility/facility-api";
import { isProviderQuotaError } from "@/lib/facility/provider-errors";

const LOAD_TIMEOUT_MS = 2_000;

interface UseFacilityStreamResult {
  data: FacilitySnapshot | null;
  loading: boolean;
  error: string | null;
  connected: boolean;
  quotaWarning: boolean;
  refresh: () => Promise<void>;
}

async function fetchFacilitySnapshot(): Promise<{
  snapshot: FacilitySnapshot;
  quotaDegraded: boolean;
}> {
  const response = await fetch("/api/facility");
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Facility API error (${response.status})`);
  }
  return {
    snapshot: (await response.json()) as FacilitySnapshot,
    quotaDegraded: isQuotaDegradedResponse(response),
  };
}

/** Live facility snapshot — REST bootstrap first, SSE for updates. Never blocks indefinitely. */
export function useFacilityStream(): UseFacilityStreamResult {
  const [data, setData] = useState<FacilitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [quotaWarning, setQuotaWarning] = useState(false);
  const hasSnapshotRef = useRef(false);
  const loadingReleasedRef = useRef(false);
  const restFallbackAttemptedRef = useRef(false);

  const releaseLoading = useCallback(() => {
    if (loadingReleasedRef.current) return;
    loadingReleasedRef.current = true;
    setLoading(false);
  }, []);

  const applySnapshot = useCallback((snapshot: FacilitySnapshot) => {
    setData(snapshot);
    setError(null);
    setConnected(true);
    hasSnapshotRef.current = true;
    releaseLoading();
  }, [releaseLoading]);

  const refresh = useCallback(async () => {
    try {
      const { snapshot, quotaDegraded } = await fetchFacilitySnapshot();
      applySnapshot(snapshot);
      setQuotaWarning(quotaDegraded);
    } catch (err) {
      if (isProviderQuotaError(err)) {
        setQuotaWarning(true);
      }
      if (!isProviderQuotaError(err)) {
        setError(err instanceof Error ? err.message : "Refresh failed");
      }
    } finally {
      releaseLoading();
    }
  }, [applySnapshot, releaseLoading]);

  useEffect(() => {
    console.log("[NexHQ Load] facility init start");
    let cancelled = false;

    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        releaseLoading();
        console.log("[NexHQ Load] facility init complete (timeout fallback)");
      }
    }, LOAD_TIMEOUT_MS);

    const bootstrap = async () => {
      try {
        const { snapshot, quotaDegraded } = await fetchFacilitySnapshot();
        if (!cancelled) {
          applySnapshot(snapshot);
          setQuotaWarning(quotaDegraded);
          console.log("[NexHQ Load] facility init complete");
        }
      } catch (err) {
        if (!cancelled) {
          if (isProviderQuotaError(err)) {
            setQuotaWarning(true);
          } else {
            setError(err instanceof Error ? err.message : "Failed to load facility");
          }
          releaseLoading();
          console.log("[NexHQ Load] facility init complete (degraded)");
        }
      }
    };

    void bootstrap();

    let source: EventSource | null = null;
    try {
      source = new EventSource("/api/facility/events");

      source.addEventListener("connected", () => {
        if (cancelled) return;
        setConnected(true);
        setError(null);
      });

      source.addEventListener("facility-mode", (message) => {
        if (cancelled) return;
        try {
          const payload = JSON.parse(message.data) as { quotaDegraded?: boolean };
          if (typeof payload.quotaDegraded === "boolean") {
            setQuotaWarning(payload.quotaDegraded);
          }
        } catch {
          /* ignore malformed mode payloads */
        }
      });

      source.addEventListener("snapshot", (message) => {
        if (cancelled) return;
        try {
          const snapshot = JSON.parse(message.data) as FacilitySnapshot;
          applySnapshot(snapshot);
        } catch {
          /* ignore malformed snapshot payloads */
        }
      });

      source.addEventListener("facility-event", (message) => {
        if (cancelled) return;
        try {
          const event = JSON.parse(message.data) as FacilityEvent;
          setData((prev) => {
            if (!prev) return prev;
            if (prev.events.some((e) => e.id === event.id)) return prev;
            return {
              ...prev,
              events: [event, ...prev.events].slice(0, 30),
            };
          });
        } catch {
          /* ignore malformed event payloads */
        }
      });

      source.addEventListener("error", (message) => {
        try {
          const payload = JSON.parse((message as MessageEvent).data) as {
            message?: string;
          };
          if (payload.message) {
            if (isProviderQuotaError(payload.message)) {
              setQuotaWarning(true);
            } else {
              setError(payload.message);
            }
          }
        } catch {
          /* ignore malformed error payloads */
        }
      });

      source.onerror = () => {
        if (cancelled) return;
        setConnected(false);
        if (!hasSnapshotRef.current && !restFallbackAttemptedRef.current) {
          restFallbackAttemptedRef.current = true;
          void refresh();
        } else {
          releaseLoading();
        }
      };
    } catch {
      releaseLoading();
    }

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      source?.close();
    };
  }, [applySnapshot, refresh, releaseLoading]);

  return {
    data,
    loading,
    error,
    connected,
    quotaWarning,
    refresh,
  };
}
