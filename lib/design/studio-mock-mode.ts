/**
 * Design Studio mock mode — activates when Supabase / Brain backends are unavailable.
 * Probes without blocking UI; auto-disables when backend recovers.
 */

const PROBE_INTERVAL_MS = 45_000;
const PROBE_TIMEOUT_MS = 6_000;

type MockModeListener = (active: boolean) => void;

let mockModeActive = false;
let probeTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<MockModeListener>();

function isSupabaseOfflineResponse(status: number, body: unknown): boolean {
  if (status !== 503) return false;
  if (!body || typeof body !== "object") return true;
  const error = "error" in body ? String((body as { error?: unknown }).error ?? "") : "";
  return (
    /supabase/i.test(error) ||
    /not configured/i.test(error) ||
    /quota/i.test(error) ||
    /backend/i.test(error)
  );
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
      // non-json still counts as reachable unless 503
    }

    if (isSupabaseOfflineResponse(res.status, body)) {
      return false;
    }

    // 400 = passed Supabase gate (invalid body) — backend online
    // 200 = unlikely with empty body but still online
    return res.status === 400 || res.status === 200 || res.status === 422;
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
export function activateMockModeFromFailure(status: number, body?: unknown): void {
  if (isSupabaseOfflineResponse(status, body)) {
    setMockModeActive(true);
    return;
  }
  if (status >= 500) {
    setMockModeActive(true);
  }
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
      setMockModeActive(true);
    }
    return fallback();
  }
}
