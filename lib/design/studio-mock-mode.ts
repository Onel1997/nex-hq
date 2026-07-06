/**
 * Design Studio mock mode — activates when Supabase / Brain backends are unavailable.
 * Probes without blocking UI; auto-disables when backend recovers.
 */

import { isProviderQuotaError } from "@/lib/facility/provider-errors";

const PROBE_INTERVAL_MS = 45_000;
const PROBE_TIMEOUT_MS = 6_000;

type MockModeListener = (active: boolean) => void;

let mockModeActive = false;
let probeTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<MockModeListener>();

function extractErrorText(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const record = body as Record<string, unknown>;
  return [record.error, record.message]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
}

/** True when an API response indicates Supabase/Brain is offline or over quota. */
export function isBackendOfflineFailure(status: number, body?: unknown): boolean {
  const errorText = extractErrorText(body);

  if (status === 429) return true;

  if (status === 503) {
    return (
      !errorText ||
      /supabase/i.test(errorText) ||
      /not configured/i.test(errorText) ||
      /quota/i.test(errorText) ||
      /backend/i.test(errorText) ||
      isProviderQuotaError(errorText)
    );
  }

  if (status >= 500) {
    return isProviderQuotaError(errorText) || /supabase/i.test(errorText);
  }

  return false;
}

function isNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error) {
    return /fetch failed|network|failed to fetch|load failed/i.test(error.message);
  }
  return false;
}

/** Lightweight probe — 503 on directions route means Supabase gate failed. */
export async function probeDesignBackendHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    const res = await fetch("/api/design/directions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // non-json still counts as reachable unless offline
    }

    return !isBackendOfflineFailure(res.status, body);
  } catch {
    return false;
  }
}

export function getMockModeActive(): boolean {
  return mockModeActive;
}

export function setMockModeActive(active: boolean): void {
  if (mockModeActive === active) return;
  mockModeActive = active;
  for (const listener of listeners) {
    listener(mockModeActive);
  }
}

export function subscribeMockMode(listener: MockModeListener): () => void {
  listeners.add(listener);
  listener(mockModeActive);
  return () => listeners.delete(listener);
}

/** Mark mock mode from a failed API call without waiting for probe. */
export function activateMockModeFromFailure(status: number, body?: unknown): boolean {
  if (!isBackendOfflineFailure(status, body)) return false;
  setMockModeActive(true);
  return true;
}

export function activateMockModeFromNetworkFailure(error: unknown): boolean {
  if (!isNetworkFailure(error)) return false;
  setMockModeActive(true);
  return true;
}

export async function refreshMockModeState(): Promise<boolean> {
  const online = await probeDesignBackendHealth();
  setMockModeActive(!online);
  return online;
}

export function startMockModeProbeLoop(): () => void {
  if (typeof window === "undefined") return () => undefined;

  void refreshMockModeState();

  if (probeTimer) clearInterval(probeTimer);
  probeTimer = setInterval(() => {
    void refreshMockModeState();
  }, PROBE_INTERVAL_MS);

  return () => {
    if (probeTimer) {
      clearInterval(probeTimer);
      probeTimer = null;
    }
  };
}

export async function withMockFallback<T>(
  operation: () => Promise<T>,
  fallback: () => T,
  options?: { activateOnFailure?: boolean },
): Promise<T> {
  if (mockModeActive) {
    return fallback();
  }

  try {
    return await operation();
  } catch (error) {
    if (options?.activateOnFailure !== false) {
      activateMockModeFromNetworkFailure(error);
    }
    if (mockModeActive) {
      return fallback();
    }
    throw error;
  }
}
