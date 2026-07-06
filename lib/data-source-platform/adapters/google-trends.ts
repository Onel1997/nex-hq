import { scanGoogleTrends } from "@/services/connectors/google-trends";
import type { GoogleTrendsData } from "@/services/connectors/google-trends";
import { getProviderAuthStatus } from "../auth";
import {
  clearProviderCache,
  getCachedProviderResult,
  setCachedProviderResult,
} from "../cache";
import { summarizeGoogleTrends } from "../summarize";
import type {
  DataProviderAdapter,
  ProviderHealth,
  ProviderSyncResult,
} from "../types";

const API_VERSION = "serpapi-v1";
const CACHE_TTL_MS = 15 * 60 * 1000;

function buildResult(
  data: GoogleTrendsData,
  mode: "live" | "simulated",
  error?: string,
): ProviderSyncResult<GoogleTrendsData> {
  const { summary, trending } = summarizeGoogleTrends(data);
  const auth = getProviderAuthStatus("google_trends");
  const status =
    mode === "live"
      ? "connected"
      : auth.configured
        ? "offline"
        : "disconnected";

  return {
    id: "google_trends",
    status,
    mode,
    data,
    summary,
    trending,
    lastSync: new Date().toISOString(),
    lastSuccessfulSync: mode === "live" ? new Date().toISOString() : null,
    cacheAgeMs: 0,
    fromCache: false,
    apiVersion: API_VERSION,
    error,
    rateLimit: { limit: 100, remaining: mode === "live" ? 92 : 100 },
  };
}

export const googleTrendsAdapter: DataProviderAdapter<GoogleTrendsData> = {
  id: "google_trends",
  label: "Google Trends",
  brandColor: "#4285f4",
  apiVersion: API_VERSION,
  cacheTtlMs: CACHE_TTL_MS,
  getAuthStatus: () => getProviderAuthStatus("google_trends"),
  async healthCheck(): Promise<ProviderHealth> {
    const auth = getProviderAuthStatus("google_trends");
    const started = Date.now();
    if (!auth.configured) {
      return {
        healthy: false,
        message: "GOOGLE_TRENDS_API_KEY not configured",
        checkedAt: new Date().toISOString(),
      };
    }
    try {
      const result = await scanGoogleTrends();
      return {
        healthy: result.mode === "live",
        latencyMs: Date.now() - started,
        message:
          result.mode === "live"
            ? "SerpAPI Google Trends reachable"
            : "API configured but returned simulated fallback",
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : "Health check failed",
        checkedAt: new Date().toISOString(),
      };
    }
  },
  async sync(options = {}): Promise<ProviderSyncResult<GoogleTrendsData>> {
    if (!options.force) {
      const cached = getCachedProviderResult<GoogleTrendsData>(
        "google_trends",
        CACHE_TTL_MS,
      );
      if (cached) return cached;
    }

    try {
      const intel = await scanGoogleTrends();
      const result = buildResult(intel.data, intel.mode);
      setCachedProviderResult("google_trends", result);
      return result;
    } catch (error) {
      return buildResult(
        {
          keywords: [],
          topRising: [],
          seasonalityNote: "Unavailable",
        },
        "simulated",
        error instanceof Error ? error.message : "Sync failed",
      );
    }
  },
};

export function disconnectGoogleTrends(): void {
  clearProviderCache("google_trends");
}
