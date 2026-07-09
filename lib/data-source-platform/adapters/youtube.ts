import { scanYouTube } from "@/services/connectors/youtube";
import type { YouTubeIntelligenceData } from "@/services/connectors/youtube";
import { EMPTY_YOUTUBE_DATA } from "@/services/connectors/youtube";
import {
  pingYouTubeLive,
  YOUTUBE_API_LIMITATIONS,
  estimateYouTubeSyncQuota,
} from "@/services/connectors/clients/youtube-client";
import { getProviderAuthStatus } from "../auth";
import {
  clearProviderCache,
  getCachedProviderResult,
  setCachedProviderResult,
} from "../cache";
import { summarizeYouTube } from "../summarize";
import type {
  DataProviderAdapter,
  ProviderHealth,
  ProviderSyncResult,
} from "../types";

export type { YouTubeIntelligenceData };

const API_VERSION = "v3";
const CACHE_TTL_MS = 20 * 60 * 1000;
const DEFAULT_DAILY_QUOTA = 10_000;

function buildResult(
  data: YouTubeIntelligenceData | null,
  mode: "live" | "simulated",
  options: {
    error?: string;
    simulatedReason?: string;
    status?: ProviderSyncResult["status"];
    quotaUnitsUsed?: number;
  } = {},
): ProviderSyncResult<YouTubeIntelligenceData> {
  const auth = getProviderAuthStatus("youtube");
  const status =
    options.status ??
    (mode === "live"
      ? "connected"
      : auth.configured
        ? "offline"
        : "disconnected");

  const summaryData = data ?? EMPTY_YOUTUBE_DATA;
  const { summary, trending } = summarizeYouTube(summaryData, mode);
  const syncQuota = estimateYouTubeSyncQuota();

  return {
    id: "youtube",
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
    rateLimit: {
      limit: DEFAULT_DAILY_QUOTA,
      remaining: Math.max(
        0,
        DEFAULT_DAILY_QUOTA -
          (options.quotaUnitsUsed ?? (mode === "live" ? syncQuota : 0)),
      ),
    },
  };
}

function missingCredentialsResult(): ProviderSyncResult<YouTubeIntelligenceData> {
  const auth = getProviderAuthStatus("youtube");
  return buildResult(null, "simulated", {
    status: "disconnected",
    error: `Missing credentials: ${auth.missingKeys.join(", ")}`,
    simulatedReason:
      "Set YOUTUBE_API_KEY in .env.local — no YouTube data is fabricated without credentials",
  });
}

export const youtubeAdapter: DataProviderAdapter<YouTubeIntelligenceData> = {
  id: "youtube",
  label: "YouTube",
  brandColor: "#ff0000",
  apiVersion: API_VERSION,
  cacheTtlMs: CACHE_TTL_MS,
  getAuthStatus: () => getProviderAuthStatus("youtube"),
  async healthCheck(): Promise<ProviderHealth> {
    const auth = getProviderAuthStatus("youtube");
    const started = Date.now();

    if (!auth.configured) {
      return {
        healthy: false,
        message:
          "Simulated — YOUTUBE_API_KEY not set (YouTube Data API v3 required for live fashion intelligence)",
        checkedAt: new Date().toISOString(),
      };
    }

    const ping = await pingYouTubeLive();
    const quotaNote = ping.quotaUnitsUsed
      ? ` · ~${ping.quotaUnitsUsed} quota units`
      : "";
    return {
      healthy: ping.ok,
      latencyMs: ping.latencyMs || Date.now() - started,
      message: ping.ok
        ? `${ping.message}${quotaNote}`
        : `Offline — ${ping.message}`,
      checkedAt: new Date().toISOString(),
    };
  },
  async sync(options = {}): Promise<ProviderSyncResult<YouTubeIntelligenceData>> {
    const auth = getProviderAuthStatus("youtube");
    if (!auth.configured) {
      return missingCredentialsResult();
    }

    if (!options.force) {
      const cached = getCachedProviderResult<YouTubeIntelligenceData>(
        "youtube",
        CACHE_TTL_MS,
      );
      if (cached) return cached;
    }

    try {
      const intel = await scanYouTube();
      const result = buildResult(
        intel.mode === "live" ? intel.data : null,
        intel.mode,
        {
          simulatedReason: intel.simulatedReason,
          error: intel.mode === "simulated" ? intel.simulatedReason : undefined,
          status: intel.mode === "live" ? "connected" : "offline",
          quotaUnitsUsed:
            intel.mode === "live" ? estimateYouTubeSyncQuota() : undefined,
        },
      );

      if (intel.mode === "live" && result.summary.length > 0) {
        result.summary.push(YOUTUBE_API_LIMITATIONS);
      }

      setCachedProviderResult("youtube", result);
      return result;
    } catch (error) {
      return buildResult(null, "simulated", {
        error: error instanceof Error ? error.message : "Sync failed",
        simulatedReason:
          "YouTube sync error — no data fabricated when the API fails",
        status: "offline",
      });
    }
  },
};

export function disconnectYouTube(): void {
  clearProviderCache("youtube");
}

/** Manual connection test for Data Sources Center. */
export async function testYouTubeProvider(): Promise<{
  ok: boolean;
  message: string;
  mode: "live" | "simulated";
  details?: Record<string, string | number>;
}> {
  const auth = getProviderAuthStatus("youtube");
  if (!auth.configured) {
    return {
      ok: false,
      mode: "simulated",
      message:
        "Simulated — set YOUTUBE_API_KEY for live YouTube fashion intelligence",
    };
  }

  const ping = await pingYouTubeLive();
  if (!ping.ok) {
    return {
      ok: false,
      mode: "simulated",
      message: `Live API unreachable — ${ping.message}`,
    };
  }

  const intel = await scanYouTube();
  if (intel.mode !== "live") {
    return {
      ok: false,
      mode: "simulated",
      message: intel.simulatedReason ?? "YouTube returned no live data",
    };
  }

  const data = intel.data;
  return {
    ok: true,
    mode: "live",
    message: `Live · ${data.videos.length} videos · ${data.trendingTopics.length} topics · ${data.brandMentions.length} brand signals`,
    details: {
      videos: data.videos.length,
      topics: data.trendingTopics.length,
      brands: data.brandMentions.length,
      creators: data.creatorRanking.length,
      avgViews: data.avgViews,
      avgEngagement: data.avgEngagement,
      syncQuotaUnits: estimateYouTubeSyncQuota(),
      latencyMs: ping.latencyMs,
    },
  };
}
