import { scanEtsy } from "@/services/connectors/etsy";
import type { EtsyIntelligenceData } from "@/services/connectors/etsy";
import { getProviderAuthStatus } from "../auth";
import {
  clearProviderCache,
  getCachedProviderResult,
  setCachedProviderResult,
} from "../cache";
import { summarizeEtsy } from "../summarize";
import type {
  DataProviderAdapter,
  ProviderHealth,
  ProviderSyncResult,
} from "../types";

const API_VERSION = "v3";
const CACHE_TTL_MS = 20 * 60 * 1000;

function buildResult(
  data: EtsyIntelligenceData,
  mode: "live" | "simulated",
  error?: string,
): ProviderSyncResult<EtsyIntelligenceData> {
  const { summary, trending } = summarizeEtsy(data);
  const auth = getProviderAuthStatus("etsy");

  return {
    id: "etsy",
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
    rateLimit: { limit: 10000, remaining: mode === "live" ? 9950 : 10000 },
  };
}

export const etsyAdapter: DataProviderAdapter<EtsyIntelligenceData> = {
  id: "etsy",
  label: "Etsy",
  brandColor: "#f56400",
  apiVersion: API_VERSION,
  cacheTtlMs: CACHE_TTL_MS,
  getAuthStatus: () => getProviderAuthStatus("etsy"),
  async healthCheck(): Promise<ProviderHealth> {
    const auth = getProviderAuthStatus("etsy");
    if (!auth.configured) {
      return {
        healthy: false,
        message: "ETSY_API_KEY not configured",
        checkedAt: new Date().toISOString(),
      };
    }
    const started = Date.now();
    const intel = await scanEtsy();
    return {
      healthy: intel.mode === "live",
      latencyMs: Date.now() - started,
      message:
        intel.mode === "live"
          ? "Etsy API connected"
          : "API key configured — live client pending",
      checkedAt: new Date().toISOString(),
    };
  },
  async sync(options = {}): Promise<ProviderSyncResult<EtsyIntelligenceData>> {
    if (!options.force) {
      const cached = getCachedProviderResult<EtsyIntelligenceData>(
        "etsy",
        CACHE_TTL_MS,
      );
      if (cached) return cached;
    }

    try {
      const intel = await scanEtsy();
      const result = buildResult(intel.data, intel.mode);
      setCachedProviderResult("etsy", result);
      return result;
    } catch (error) {
      const intel = await scanEtsy();
      return buildResult(
        intel.data,
        "simulated",
        error instanceof Error ? error.message : "Sync failed",
      );
    }
  },
};

export function disconnectEtsy(): void {
  clearProviderCache("etsy");
}
