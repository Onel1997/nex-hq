import {
  fetchLiveTikTok,
  isTikTokLiveConfigured,
} from "./clients/tiktok-client";
import {
  aggregateConnectorScores,
  computeConfidence,
  normalizeSignals,
} from "./signal-utils";
import type { ConnectorInput, IntelligenceSignal, SourceIntelligence } from "./types";

export interface TikTokTrend {
  hashtag: string;
  views: number;
  change: number;
  category: "silhouette" | "color" | "outfit" | "brand";
  insight: string;
}

export interface TikTokIntelligenceData {
  viralTrends: TikTokTrend[];
  hashtags: string[];
  outfitTrends: string[];
  colors: string[];
  silhouettes: string[];
}

export const EMPTY_TIKTOK_DATA: TikTokIntelligenceData = {
  viralTrends: [],
  hashtags: [],
  outfitTrends: [],
  colors: [],
  silhouettes: [],
};

function toSignals(data: TikTokIntelligenceData): IntelligenceSignal[] {
  const trendSignals = data.viralTrends.map((trend) => ({
    id: `tiktok-${trend.hashtag.replace("#", "")}`,
    category: "social" as const,
    source: "tiktok" as const,
    label: trend.hashtag,
    message: trend.insight,
    score: Math.min(100, 50 + trend.change),
    direction: trend.change >= 0 ? ("up" as const) : ("down" as const),
    tags: [trend.category, "hashtag"],
  }));

  const silhouetteSignals = data.silhouettes.slice(0, 2).map((silhouette, index) => ({
    id: `tiktok-silhouette-${index}`,
    category: "trend" as const,
    source: "tiktok" as const,
    label: "Silhouette Signal",
    message: `${silhouette} silhouette present in DE fashion videos`,
    score: 68 + index * 4,
    direction: "up" as const,
    tags: ["silhouette"],
  }));

  return [...trendSignals, ...silhouetteSignals];
}

function buildResult(
  data: TikTokIntelligenceData,
  mode: "live" | "simulated",
  simulatedReason?: string,
): SourceIntelligence<TikTokIntelligenceData> {
  const rawSignals = toSignals(data);
  const sampleSize =
    data.viralTrends.length + data.hashtags.length + data.silhouettes.length;
  const confidence = computeConfidence({
    mode,
    sampleSize,
    freshness: mode === "live" ? 0.75 : 0.4,
    dataQuality: mode === "live" ? 0.85 : 0.4,
  });
  const signals = normalizeSignals(rawSignals, confidence);
  const scores = aggregateConnectorScores(
    signals,
    { social: 0.7, trend: 0.3 },
    confidence,
  );

  return {
    source: "tiktok",
    mode,
    loadedAt: new Date().toISOString(),
    signals,
    data,
    simulatedReason,
    scores,
  };
}

/** Scan TikTok for fashion hashtag engagement via the official Research API. */
export async function scanTikTok(
  _input: ConnectorInput = {},
): Promise<SourceIntelligence<TikTokIntelligenceData>> {
  if (isTikTokLiveConfigured()) {
    try {
      const data = await fetchLiveTikTok();
      return buildResult(data, "live");
    } catch (error) {
      const reason =
        error instanceof Error
          ? `TikTok Research API failed (${error.message}) — no data fabricated`
          : "TikTok Research API failed — no data fabricated";
      return buildResult(EMPTY_TIKTOK_DATA, "simulated", reason);
    }
  }

  return buildResult(
    EMPTY_TIKTOK_DATA,
    "simulated",
    "TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET not set — no TikTok data is returned without credentials",
  );
}
