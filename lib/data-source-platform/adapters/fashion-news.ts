import { scanFashionNews } from "@/services/connectors/fashion-news";
import type { FashionNewsIntelligenceData } from "@/services/connectors/fashion-news";
import { EMPTY_FASHION_NEWS_DATA } from "@/services/connectors/fashion-news";
import {
  pingFashionNewsLive,
  hasCustomFashionNewsFeeds,
  FASHION_NEWS_API_LIMITATIONS,
} from "@/services/connectors/clients/fashion-news-client";
import { getProviderAuthStatus } from "../auth";
import {
  clearProviderCache,
  getCachedProviderResult,
  setCachedProviderResult,
} from "../cache";
import { summarizeFashionNews } from "../summarize";
import type {
  DataProviderAdapter,
  ProviderHealth,
  ProviderSyncResult,
} from "../types";

export type { FashionNewsIntelligenceData };

const API_VERSION = "rss-v1";
const CACHE_TTL_MS = 30 * 60 * 1000;

function buildResult(
  data: FashionNewsIntelligenceData | null,
  mode: "live" | "simulated",
  options: {
    error?: string;
    simulatedReason?: string;
    status?: ProviderSyncResult["status"];
  } = {},
): ProviderSyncResult<FashionNewsIntelligenceData> {
  // Offline (a configured feed is failing) vs Coming Soon (no custom feed set).
  const status =
    options.status ??
    (mode === "live"
      ? "connected"
      : hasCustomFashionNewsFeeds()
        ? "offline"
        : "disconnected");

  const summaryData = data ?? EMPTY_FASHION_NEWS_DATA;
  const { summary, trending } = summarizeFashionNews(summaryData, mode);

  return {
    id: "fashion_news",
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

export const fashionNewsAdapter: DataProviderAdapter<FashionNewsIntelligenceData> =
  {
    id: "fashion_news",
    label: "Fashion News",
    brandColor: "#a78bfa",
    apiVersion: API_VERSION,
    cacheTtlMs: CACHE_TTL_MS,
    getAuthStatus: () => getProviderAuthStatus("fashion_news"),
    async healthCheck(): Promise<ProviderHealth> {
      const started = Date.now();
      const ping = await pingFashionNewsLive();

      if (ping.ok) {
        return {
          healthy: true,
          latencyMs: ping.latencyMs || Date.now() - started,
          message: ping.message,
          checkedAt: new Date().toISOString(),
        };
      }

      return {
        healthy: false,
        latencyMs: ping.latencyMs || Date.now() - started,
        message: hasCustomFashionNewsFeeds()
          ? `Offline — ${ping.message}`
          : `Coming Soon — default feeds unreachable (${ping.message}). Set FASHION_NEWS_RSS_URL(S) for a dedicated feed.`,
        checkedAt: new Date().toISOString(),
      };
    },
    async sync(options = {}): Promise<ProviderSyncResult<FashionNewsIntelligenceData>> {
      if (!options.force) {
        const cached = getCachedProviderResult<FashionNewsIntelligenceData>(
          "fashion_news",
          CACHE_TTL_MS,
        );
        if (cached) return cached;
      }

      try {
        const intel = await scanFashionNews();
        const result = buildResult(
          intel.mode === "live" ? intel.data : null,
          intel.mode,
          {
            simulatedReason: intel.simulatedReason,
            error: intel.mode === "simulated" ? intel.simulatedReason : undefined,
            status:
              intel.mode === "live"
                ? "connected"
                : hasCustomFashionNewsFeeds()
                  ? "offline"
                  : "disconnected",
          },
        );

        if (intel.mode === "live" && result.summary.length > 0) {
          result.summary.push(FASHION_NEWS_API_LIMITATIONS);
        }

        setCachedProviderResult("fashion_news", result);
        return result;
      } catch (error) {
        return buildResult(null, "simulated", {
          error: error instanceof Error ? error.message : "Sync failed",
          simulatedReason:
            "Fashion News sync error — no articles fabricated when feeds fail",
          status: hasCustomFashionNewsFeeds() ? "offline" : "disconnected",
        });
      }
    },
  };

export function disconnectFashionNews(): void {
  clearProviderCache("fashion_news");
}

/** Manual connection test for Data Sources Center. */
export async function testFashionNewsProvider(): Promise<{
  ok: boolean;
  message: string;
  mode: "live" | "simulated";
  details?: Record<string, string | number>;
}> {
  const ping = await pingFashionNewsLive();
  if (!ping.ok) {
    return {
      ok: false,
      mode: "simulated",
      message: hasCustomFashionNewsFeeds()
        ? `Feed unreachable — ${ping.message}`
        : `Coming Soon — default feeds unreachable (${ping.message}). Set FASHION_NEWS_RSS_URL(S) for a live feed.`,
    };
  }

  const intel = await scanFashionNews();
  if (intel.mode !== "live") {
    return {
      ok: false,
      mode: "simulated",
      message: intel.simulatedReason ?? "Fashion News returned no live articles",
    };
  }

  const data = intel.data;
  return {
    ok: true,
    mode: "live",
    message: `Live · ${data.articles.length} articles · ${data.sources.length} sources · ${data.keywords.length} keyword signals`,
    details: {
      articles: data.articles.length,
      sources: data.sources.length,
      keywords: data.keywords.length,
      brandMentions: data.brandMentions.length,
      repeatedTopics: data.repeatedTopics.length,
      emergingThemes: data.emergingThemes.length,
      latencyMs: ping.latencyMs,
    },
  };
}
