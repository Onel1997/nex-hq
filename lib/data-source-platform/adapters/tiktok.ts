import { scanTikTok } from "@/services/connectors/tiktok";
import type { TikTokIntelligenceData } from "@/services/connectors/tiktok";
import { getProviderAuthStatus } from "../auth";
import {
  clearProviderCache,
  getCachedProviderResult,
  setCachedProviderResult,
} from "../cache";
import { summarizeTikTok } from "../summarize";
import type {
  DataProviderAdapter,
  ProviderHealth,
  ProviderSyncResult,
} from "../types";

const API_VERSION = "research-v2";
const CACHE_TTL_MS = 10 * 60 * 1000;

function buildResult(
  data: TikTokIntelligenceData,
  mode: "live" | "simulated",
  error?: string,
): ProviderSyncResult<TikTokIntelligenceData> {
  const { summary, trending } = summarizeTikTok(data);
  const auth = getProviderAuthStatus("tiktok");

  return {
    id: "tiktok",
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
    rateLimit: { limit: 500, remaining: mode === "live" ? 480 : 500 },
  };
}

export const tiktokAdapter: DataProviderAdapter<TikTokIntelligenceData> = {
  id: "tiktok",
  label: "TikTok",
  brandColor: "#00f2ea",
  apiVersion: API_VERSION,
  cacheTtlMs: CACHE_TTL_MS,
  getAuthStatus: () => getProviderAuthStatus("tiktok"),
  async healthCheck(): Promise<ProviderHealth> {
    const auth = getProviderAuthStatus("tiktok");
    if (!auth.configured) {
      return {
        healthy: false,
        message: "TIKTOK_API_KEY not configured",
        checkedAt: new Date().toISOString(),
      };
    }
    const started = Date.now();
    const intel = await scanTikTok();
    return {
      healthy: intel.mode === "live",
      latencyMs: Date.now() - started,
      message:
        intel.mode === "live"
          ? "TikTok API connected"
          : "API key configured — live client pending",
      checkedAt: new Date().toISOString(),
    };
  },
  async sync(options = {}): Promise<ProviderSyncResult<TikTokIntelligenceData>> {
    if (!options.force) {
      const cached = getCachedProviderResult<TikTokIntelligenceData>(
        "tiktok",
        CACHE_TTL_MS,
      );
      if (cached) return cached;
    }

    try {
      const intel = await scanTikTok();
      const result = buildResult(intel.data, intel.mode);
      setCachedProviderResult("tiktok", result);
      return result;
    } catch (error) {
      const intel = await scanTikTok();
      return buildResult(
        intel.data,
        "simulated",
        error instanceof Error ? error.message : "Sync failed",
      );
    }
  },
};

export function disconnectTikTok(): void {
  clearProviderCache("tiktok");
}
