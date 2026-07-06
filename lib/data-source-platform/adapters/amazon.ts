import { scanAmazon } from "@/services/connectors/amazon";
import type { AmazonIntelligenceData } from "@/services/connectors/amazon";
import { getProviderAuthStatus } from "../auth";
import {
  clearProviderCache,
  getCachedProviderResult,
  setCachedProviderResult,
} from "../cache";
import { summarizeAmazon } from "../summarize";
import type {
  DataProviderAdapter,
  ProviderHealth,
  ProviderSyncResult,
} from "../types";

const API_VERSION = "pa-api-v5";
const CACHE_TTL_MS = 20 * 60 * 1000;

function buildResult(
  data: AmazonIntelligenceData,
  mode: "live" | "simulated",
  error?: string,
): ProviderSyncResult<AmazonIntelligenceData> {
  const { summary, trending } = summarizeAmazon(data);
  const auth = getProviderAuthStatus("amazon");

  return {
    id: "amazon",
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
    rateLimit: { limit: 8640, remaining: mode === "live" ? 8600 : 8640 },
  };
}

export const amazonAdapter: DataProviderAdapter<AmazonIntelligenceData> = {
  id: "amazon",
  label: "Amazon",
  brandColor: "#ff9900",
  apiVersion: API_VERSION,
  cacheTtlMs: CACHE_TTL_MS,
  getAuthStatus: () => getProviderAuthStatus("amazon"),
  async healthCheck(): Promise<ProviderHealth> {
    const auth = getProviderAuthStatus("amazon");
    if (!auth.configured) {
      return {
        healthy: false,
        message: "AMAZON_API_KEY not configured",
        checkedAt: new Date().toISOString(),
      };
    }
    const started = Date.now();
    const intel = await scanAmazon();
    return {
      healthy: intel.mode === "live",
      latencyMs: Date.now() - started,
      message:
        intel.mode === "live"
          ? "Amazon API connected"
          : "API key configured — live client pending",
      checkedAt: new Date().toISOString(),
    };
  },
  async sync(options = {}): Promise<ProviderSyncResult<AmazonIntelligenceData>> {
    if (!options.force) {
      const cached = getCachedProviderResult<AmazonIntelligenceData>(
        "amazon",
        CACHE_TTL_MS,
      );
      if (cached) return cached;
    }

    try {
      const intel = await scanAmazon();
      const result = buildResult(intel.data, intel.mode);
      setCachedProviderResult("amazon", result);
      return result;
    } catch (error) {
      const intel = await scanAmazon();
      return buildResult(
        intel.data,
        "simulated",
        error instanceof Error ? error.message : "Sync failed",
      );
    }
  },
};

export function disconnectAmazon(): void {
  clearProviderCache("amazon");
}
