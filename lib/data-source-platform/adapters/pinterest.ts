import { scanPinterest } from "@/services/connectors/pinterest";
import type { PinterestIntelligenceData } from "@/services/connectors/pinterest";
import { getProviderAuthStatus } from "../auth";
import {
  clearProviderCache,
  getCachedProviderResult,
  setCachedProviderResult,
} from "../cache";
import { summarizePinterest } from "../summarize";
import type {
  DataProviderAdapter,
  ProviderHealth,
  ProviderSyncResult,
} from "../types";

const API_VERSION = "v5";
const CACHE_TTL_MS = 10 * 60 * 1000;

function buildResult(
  data: PinterestIntelligenceData,
  mode: "live" | "simulated",
  error?: string,
): ProviderSyncResult<PinterestIntelligenceData> {
  const { summary, trending } = summarizePinterest(data);
  const auth = getProviderAuthStatus("pinterest");

  return {
    id: "pinterest",
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
    rateLimit: { limit: 1000, remaining: mode === "live" ? 980 : 1000 },
  };
}

export const pinterestAdapter: DataProviderAdapter<PinterestIntelligenceData> = {
  id: "pinterest",
  label: "Pinterest",
  brandColor: "#e60023",
  apiVersion: API_VERSION,
  cacheTtlMs: CACHE_TTL_MS,
  getAuthStatus: () => getProviderAuthStatus("pinterest"),
  async healthCheck(): Promise<ProviderHealth> {
    const auth = getProviderAuthStatus("pinterest");
    if (!auth.configured) {
      return {
        healthy: false,
        message: "PINTEREST_ACCESS_TOKEN not configured",
        checkedAt: new Date().toISOString(),
      };
    }
    const started = Date.now();
    const intel = await scanPinterest();
    return {
      healthy: intel.mode === "live",
      latencyMs: Date.now() - started,
      message:
        intel.mode === "live"
          ? "Pinterest API connected"
          : "Token configured — live client pending",
      checkedAt: new Date().toISOString(),
    };
  },
  async sync(options = {}): Promise<ProviderSyncResult<PinterestIntelligenceData>> {
    if (!options.force) {
      const cached = getCachedProviderResult<PinterestIntelligenceData>(
        "pinterest",
        CACHE_TTL_MS,
      );
      if (cached) return cached;
    }

    try {
      const intel = await scanPinterest();
      const result = buildResult(intel.data, intel.mode);
      setCachedProviderResult("pinterest", result);
      return result;
    } catch (error) {
      const intel = await scanPinterest();
      const result = buildResult(
        intel.data,
        "simulated",
        error instanceof Error ? error.message : "Sync failed",
      );
      return result;
    }
  },
};

export function disconnectPinterest(): void {
  clearProviderCache("pinterest");
}
