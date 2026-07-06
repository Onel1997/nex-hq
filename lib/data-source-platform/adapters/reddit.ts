import { scanReddit } from "@/services/connectors/reddit";
import type { RedditIntelligenceData } from "@/services/connectors/reddit";
import { getProviderAuthStatus } from "../auth";
import {
  clearProviderCache,
  getCachedProviderResult,
  setCachedProviderResult,
} from "../cache";
import { summarizeReddit } from "../summarize";
import type {
  DataProviderAdapter,
  ProviderHealth,
  ProviderSyncResult,
} from "../types";

const API_VERSION = "oauth-v1";
const CACHE_TTL_MS = 10 * 60 * 1000;

function buildResult(
  data: RedditIntelligenceData,
  mode: "live" | "simulated",
  error?: string,
): ProviderSyncResult<RedditIntelligenceData> {
  const { summary, trending } = summarizeReddit(data);
  const auth = getProviderAuthStatus("reddit");

  return {
    id: "reddit",
    status:
      mode === "live"
        ? "connected"
        : auth.configured
          ? "offline"
          : "disconnected",
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
    rateLimit: { limit: 60, remaining: mode === "live" ? 55 : 60 },
  };
}

export const redditAdapter: DataProviderAdapter<RedditIntelligenceData> = {
  id: "reddit",
  label: "Reddit",
  brandColor: "#ff4500",
  apiVersion: API_VERSION,
  cacheTtlMs: CACHE_TTL_MS,
  getAuthStatus: () => getProviderAuthStatus("reddit"),
  async healthCheck(): Promise<ProviderHealth> {
    const auth = getProviderAuthStatus("reddit");
    if (!auth.configured) {
      return {
        healthy: false,
        message: "Reddit OAuth credentials not configured",
        checkedAt: new Date().toISOString(),
      };
    }
    const started = Date.now();
    try {
      const intel = await scanReddit();
      return {
        healthy: intel.mode === "live",
        latencyMs: Date.now() - started,
        message:
          intel.mode === "live"
            ? "Reddit API connected"
            : "Credentials configured but live fetch failed",
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
  async sync(options = {}): Promise<ProviderSyncResult<RedditIntelligenceData>> {
    if (!options.force) {
      const cached = getCachedProviderResult<RedditIntelligenceData>(
        "reddit",
        CACHE_TTL_MS,
      );
      if (cached) return cached;
    }

    try {
      const intel = await scanReddit();
      const result = buildResult(intel.data, intel.mode);
      setCachedProviderResult("reddit", result);
      return result;
    } catch (error) {
      const intel = await scanReddit();
      return buildResult(
        intel.data,
        "simulated",
        error instanceof Error ? error.message : "Sync failed",
      );
    }
  },
};

export function disconnectReddit(): void {
  clearProviderCache("reddit");
}
