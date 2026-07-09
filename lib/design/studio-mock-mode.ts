/**
 * Design Studio mock mode — activates when Supabase / Brain backends are unavailable.
 * Probes without blocking UI; auto-disables when backend recovers.
 */

import { isProviderQuotaError } from "@/lib/facility/provider-errors";

const PROBE_INTERVAL_MS = 45_000;
const PROBE_TIMEOUT_MS = 30_000;
const PROBE_MAX_ATTEMPTS = 2;

type MockModeListener = (active: boolean) => void;

interface ProbeResult {
  online: boolean;
  reason: string;
}

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

function logMockModeTransition(active: boolean, reason: string): void {
  if (typeof window === "undefined") return;
  if (active) {
    console.warn("[Design Studio] Mock mode activated:", reason);
  } else {
    console.info("[Design Studio] Mock mode deactivated:", reason);
  }
}

/** True when an API response indicates Supabase/Brain is offline or over quota. */
export function isBackendOfflineFailure(status: number, body?: unknown): boolean {
  const errorText = extractErrorText(body);

  if (status === 503) {
    // Only infrastructure gates — not OpenAI or other optional providers.
    if (/supabase/i.test(errorText)) return true;
    if (/brain-persistenz|brain persistence/i.test(errorText)) return true;
    if (isProviderQuotaError(errorText) && /supabase|egress/i.test(errorText)) {
      return true;
    }
    return false;
  }

  if (status >= 500) {
    if (/supabase/i.test(errorText)) return true;
    if (isProviderQuotaError(errorText) && /supabase|egress/i.test(errorText)) {
      return true;
    }
    return false;
  }

  return false;
}

function isNetworkFailure(error: unknown): boolean {
  // Timeouts are slow responses, not proof the backend is offline.
  if (error instanceof DOMException && error.name === "AbortError") return false;
  if (error instanceof TypeError) return true;
  if (error instanceof Error) {
    return /fetch failed|network|failed to fetch|load failed/i.test(error.message);
  }
  return false;
}

async function runDesignBackendProbe(attempt = 1): Promise<ProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const res = await fetch("/api/design/from-research", {
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
      // Non-JSON still counts as reachable unless status signals infra outage.
    }

    if (isBackendOfflineFailure(res.status, body)) {
      const detail = extractErrorText(body) || `HTTP ${res.status}`;
      return {
        online: false,
        reason: `health probe /api/design/from-research → ${detail}`,
      };
    }

    // 400 = Supabase gate passed, server reachable (invalid probe body is expected).
    if (res.status === 400) {
      return {
        online: true,
        reason: "health probe ok — Supabase gate passed (400 validation)",
      };
    }

    return {
      online: true,
      reason: `health probe reachable — HTTP ${res.status}`,
    };
  } catch (error) {
    clearTimeout(timeout);

    if (error instanceof DOMException && error.name === "AbortError") {
      if (attempt < PROBE_MAX_ATTEMPTS) {
        return runDesignBackendProbe(attempt + 1);
      }
      return {
        online: true,
        reason: `health probe timeout after ${PROBE_MAX_ATTEMPTS} attempts (treating as online during compile)`,
      };
    }

    if (isNetworkFailure(error)) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        online: false,
        reason: `health probe network failure: ${message}`,
      };
    }

    return {
      online: true,
      reason: `health probe non-fatal error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/** Lightweight probe — 503 on from-research means Supabase gate failed. */
export async function probeDesignBackendHealth(): Promise<boolean> {
  const result = await runDesignBackendProbe();
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    console.debug("[Design Studio] Health probe:", result.reason);
  }
  return result.online;
}

export function getMockModeActive(): boolean {
  return mockModeActive;
}

export function setMockModeActive(active: boolean, reason?: string): void {
  if (mockModeActive === active) return;
  mockModeActive = active;
  logMockModeTransition(active, reason ?? "state change");
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
  const detail = extractErrorText(body) || `HTTP ${status}`;
  setMockModeActive(true, `API failure ${status}: ${detail}`);
  return true;
}

export function activateMockModeFromNetworkFailure(error: unknown): boolean {
  if (!isNetworkFailure(error)) return false;
  const message = error instanceof Error ? error.message : String(error);
  setMockModeActive(true, `network failure: ${message}`);
  return true;
}

export async function refreshMockModeState(): Promise<boolean> {
  const result = await runDesignBackendProbe();
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    console.debug("[Design Studio] Health probe:", result.reason);
  }
  setMockModeActive(!result.online, result.reason);
  return result.online;
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
