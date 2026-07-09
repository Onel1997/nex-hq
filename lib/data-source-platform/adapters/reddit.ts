import { scanReddit } from "@/services/connectors/reddit";
import type { RedditIntelligenceData } from "@/services/connectors/reddit";
import { EMPTY_REDDIT_DATA } from "@/services/connectors/reddit";
import {
  pingRedditLive,
  REDDIT_API_LIMITATIONS,
} from "@/services/connectors/clients/reddit-client";
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
  data: RedditIntelligenceData | null,
  mode: "live" | "simulated",
  options: {
    error?: string;
    simulatedReason?: string;
    status?: ProviderSyncResult["status"];
  } = {},
): ProviderSyncResult<RedditIntelligenceData> {
  const auth = getProviderAuthStatus("reddit");
  const status =
    options.status ??
    (mode === "live"
      ? "connected"
      : auth.configured
        ? "offline"
        : "disconnected");

  const summaryData = data ?? EMPTY_REDDIT_DATA;
  const { summary, trending } = summarizeReddit(summaryData, mode);

  return {
    id: "reddit",
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
    rateLimit: { limit: 60, remaining: mode === "live" ? 55 : 60 },
  };
}

function missingCredentialsResult(): ProviderSyncResult<RedditIntelligenceData> {
  const auth = getProviderAuthStatus("reddit");
  return buildResult(null, "simulated", {
    status: "disconnected",
    error: `Missing credentials: ${auth.missingKeys.join(", ")}`,
    simulatedReason:
      "Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in .env.local — no Reddit data is fabricated without credentials",
  });
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
    const started = Date.now();

    if (!auth.configured) {
      return {
        healthy: false,
        message:
          "Simulated — REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not set (application OAuth required for live communities)",
        checkedAt: new Date().toISOString(),
      };
    }

    const ping = await pingRedditLive();
    return {
      healthy: ping.ok,
      latencyMs: ping.latencyMs || Date.now() - started,
      message: ping.ok ? ping.message : `Offline — ${ping.message}`,
      checkedAt: new Date().toISOString(),
    };
  },
  async sync(options = {}): Promise<ProviderSyncResult<RedditIntelligenceData>> {
    const auth = getProviderAuthStatus("reddit");
    if (!auth.configured) {
      return missingCredentialsResult();
    }

    if (!options.force) {
      const cached = getCachedProviderResult<RedditIntelligenceData>(
        "reddit",
        CACHE_TTL_MS,
      );
      if (cached) return cached;
    }

    try {
      const intel = await scanReddit();
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
        result.summary.push(REDDIT_API_LIMITATIONS);
      }

      setCachedProviderResult("reddit", result);
      return result;
    } catch (error) {
      return buildResult(null, "simulated", {
        error: error instanceof Error ? error.message : "Sync failed",
        simulatedReason:
          "Reddit sync error — no data fabricated when the API fails",
        status: "offline",
      });
    }
  },
};

export function disconnectReddit(): void {
  clearProviderCache("reddit");
}

/** Manual connection test for Data Sources Center. */
export async function testRedditProvider(): Promise<{
  ok: boolean;
  message: string;
  mode: "live" | "simulated";
  details?: Record<string, string | number>;
}> {
  const auth = getProviderAuthStatus("reddit");
  if (!auth.configured) {
    return {
      ok: false,
      mode: "simulated",
      message:
        "Simulated — set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET for live community intelligence",
    };
  }

  const ping = await pingRedditLive();
  if (!ping.ok) {
    return {
      ok: false,
      mode: "simulated",
      message: `Live API unreachable — ${ping.message}`,
    };
  }

  const intel = await scanReddit();
  if (intel.mode !== "live") {
    return {
      ok: false,
      mode: "simulated",
      message: intel.simulatedReason ?? "Reddit returned no live data",
    };
  }

  const data = intel.data;
  return {
    ok: true,
    mode: "live",
    message: `Live · ${data.subreddits.length} communities · ${data.threads.length} threads · ${data.brandMentions.length} brand signals`,
    details: {
      communities: data.subreddits.length,
      threads: data.threads.length,
      keywords: data.keywords.length,
      brandMentions: data.brandMentions.length,
      colorMentions: data.colorMentions.length,
      silhouetteMentions: data.silhouetteMentions.length,
      avgUpvotes: data.engagement.avgUpvotes,
      commentVelocity: data.engagement.commentVelocity,
      latencyMs: ping.latencyMs,
    },
  };
}
