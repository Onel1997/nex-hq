import { scanTikTok } from "@/services/connectors/tiktok";
import type { TikTokIntelligenceData } from "@/services/connectors/tiktok";
import { EMPTY_TIKTOK_DATA } from "@/services/connectors/tiktok";
import {
  pingTikTokLive,
  TIKTOK_API_LIMITATIONS,
} from "@/services/connectors/clients/tiktok-client";
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
  data: TikTokIntelligenceData | null,
  mode: "live" | "simulated",
  options: {
    error?: string;
    simulatedReason?: string;
    status?: ProviderSyncResult["status"];
  } = {},
): ProviderSyncResult<TikTokIntelligenceData> {
  const auth = getProviderAuthStatus("tiktok");
  const status =
    options.status ??
    (mode === "live"
      ? "connected"
      : auth.configured
        ? "offline"
        : "disconnected");

  const summaryData = data ?? EMPTY_TIKTOK_DATA;
  const { summary, trending } = summarizeTikTok(summaryData, mode);

  return {
    id: "tiktok",
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
    error: options.error,
    simulatedReason: options.simulatedReason,
  };
}

function missingCredentialsResult(): ProviderSyncResult<TikTokIntelligenceData> {
  const auth = getProviderAuthStatus("tiktok");
  return buildResult(null, "simulated", {
    status: "disconnected",
    error: `Missing credentials: ${auth.missingKeys.join(", ")}`,
    simulatedReason:
      "Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in .env.local — no TikTok data is fabricated without credentials",
  });
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
    const started = Date.now();

    if (!auth.configured) {
      return {
        healthy: false,
        message:
          "Simulated — TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET not set (Research API required for live hashtag data)",
        checkedAt: new Date().toISOString(),
      };
    }

    const ping = await pingTikTokLive();
    return {
      healthy: ping.ok,
      latencyMs: ping.latencyMs || Date.now() - started,
      message: ping.ok ? ping.message : `Offline — ${ping.message}`,
      checkedAt: new Date().toISOString(),
    };
  },
  async sync(options = {}): Promise<ProviderSyncResult<TikTokIntelligenceData>> {
    const auth = getProviderAuthStatus("tiktok");
    if (!auth.configured) {
      return missingCredentialsResult();
    }

    if (!options.force) {
      const cached = getCachedProviderResult<TikTokIntelligenceData>(
        "tiktok",
        CACHE_TTL_MS,
      );
      if (cached) return cached;
    }

    try {
      const intel = await scanTikTok();
      const result = buildResult(
        intel.mode === "live" ? intel.data : null,
        intel.mode,
        {
          simulatedReason: intel.simulatedReason,
          error: intel.mode === "simulated" ? intel.simulatedReason : undefined,
          status: intel.mode === "live" ? "connected" : "offline",
        },
      );

      if (intel.mode === "live" && result.summary.length > 0) {
        result.summary.push(TIKTOK_API_LIMITATIONS);
      }

      setCachedProviderResult("tiktok", result);
      return result;
    } catch (error) {
      return buildResult(null, "simulated", {
        error: error instanceof Error ? error.message : "Sync failed",
        simulatedReason:
          "TikTok sync error — no data fabricated when the API fails",
        status: "offline",
      });
    }
  },
};

export function disconnectTikTok(): void {
  clearProviderCache("tiktok");
}

/** Manual connection test for Data Sources Center. */
export async function testTikTokProvider(): Promise<{
  ok: boolean;
  message: string;
  mode: "live" | "simulated";
  details?: Record<string, string | number>;
}> {
  const auth = getProviderAuthStatus("tiktok");
  if (!auth.configured) {
    return {
      ok: false,
      mode: "simulated",
      message:
        "Simulated — set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET for live TikTok hashtag engagement",
    };
  }

  const ping = await pingTikTokLive();
  if (!ping.ok) {
    return {
      ok: false,
      mode: "simulated",
      message: `Live API unreachable — ${ping.message}`,
    };
  }

  const intel = await scanTikTok();
  if (intel.mode !== "live") {
    return {
      ok: false,
      mode: "simulated",
      message: intel.simulatedReason ?? "TikTok returned no live data",
    };
  }

  const data = intel.data;
  return {
    ok: true,
    mode: "live",
    message: `Live · ${data.viralTrends.length} hashtags · ${data.hashtags.length} tags tracked · ${data.silhouettes.length} silhouettes`,
    details: {
      hashtags: data.viralTrends.length,
      tagsTracked: data.hashtags.length,
      silhouettes: data.silhouettes.length,
      colors: data.colors.length,
      latencyMs: ping.latencyMs,
    },
  };
}
