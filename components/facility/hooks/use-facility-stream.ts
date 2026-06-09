"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FacilityEvent, FacilitySnapshot } from "@/lib/facility/types";

interface UseFacilityStreamResult {
  data: FacilitySnapshot | null;
  loading: boolean;
  error: string | null;
  connected: boolean;
  refresh: () => Promise<void>;
}

export function useFacilityStream(): UseFacilityStreamResult {
  const [data, setData] = useState<FacilitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const hasSnapshotRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/facility");
      if (!response.ok) throw new Error("Facility refresh failed");
      const snapshot = (await response.json()) as FacilitySnapshot;
      setData(snapshot);
      setError(null);
      hasSnapshotRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    }
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/facility/events");

    source.addEventListener("connected", () => {
      setConnected(true);
      setError(null);
    });

    source.addEventListener("snapshot", (message) => {
      const snapshot = JSON.parse(message.data) as FacilitySnapshot;
      setData(snapshot);
      setLoading(false);
      setConnected(true);
      setError(null);
      hasSnapshotRef.current = true;
    });

    source.addEventListener("facility-event", (message) => {
      const event = JSON.parse(message.data) as FacilityEvent;
      setData((prev) => {
        if (!prev) return prev;
        if (prev.events.some((e) => e.id === event.id)) return prev;
        return {
          ...prev,
          events: [event, ...prev.events].slice(0, 30),
        };
      });
    });

    source.addEventListener("error", (message) => {
      try {
        const payload = JSON.parse((message as MessageEvent).data) as {
          message?: string;
        };
        if (payload.message) setError(payload.message);
      } catch {
        // ignore malformed error payloads
      }
    });

    source.onerror = () => {
      setConnected(false);
      if (!hasSnapshotRef.current) {
        setError("Facility stream disconnected");
      }
    };

    return () => {
      source.close();
    };
  }, []);

  return {
    data,
    loading,
    error,
    connected,
    refresh,
  };
}
