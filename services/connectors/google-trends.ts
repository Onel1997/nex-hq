import type { MilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import type { ProviderConnectionStatus } from "@/lib/data-source-platform/types";
import {
  fetchLiveGoogleTrends,
  GoogleTrendsApiError,
  isGoogleTrendsLiveConfigured,
} from "./clients/google-trends-client";
import {
  aggregateConnectorScores,
  computeConfidence,
  normalizeSignals,
} from "./signal-utils";
import type { ConnectorInput, IntelligenceSignal, SourceIntelligence } from "./types";

export interface GoogleTrendKeyword {
  keyword: string;
  demand: number;
  change: number;
  seasonality: "rising" | "peak" | "declining" | "stable";
  region: string;
}

export interface GoogleTrendsData {
  keywords: GoogleTrendKeyword[];
  topRising: string[];
  relatedQueries: string[];
  seasonalityNote: string;
  demandScore: number;
  trendDirection: "up" | "down" | "stable";
}

export interface GoogleTrendsScanResult
  extends SourceIntelligence<GoogleTrendsData> {
  providerStatus: ProviderConnectionStatus;
  error?: string;
}

const STREETWEAR_KEYWORDS = [
  { keyword: "oversized hoodie", demand: 82, change: 18, seasonality: "rising" as const },
  { keyword: "earth tone streetwear", demand: 74, change: 22, seasonality: "rising" as const },
  { keyword: "premium streetwear", demand: 68, change: 15, seasonality: "rising" as const },
  { keyword: "boxy tee", demand: 61, change: 12, seasonality: "rising" as const },
  { keyword: "wide leg cargo", demand: 58, change: 14, seasonality: "rising" as const },
  { keyword: "embroidered hoodie", demand: 52, change: 11, seasonality: "rising" as const },
  { keyword: "sage green outfit", demand: 48, change: 9, seasonality: "rising" as const },
  { keyword: "slim fit jeans", demand: 34, change: -8, seasonality: "declining" as const },
  { keyword: "graphic tee loud", demand: 29, change: -6, seasonality: "declining" as const },
];

function toSignals(data: GoogleTrendsData): IntelligenceSignal[] {
  const keywordSignals = data.keywords.slice(0, 8).map((keyword) => ({
    id: `gt-${keyword.keyword.replace(/\s+/g, "-")}`,
    category: "trend" as const,
    source: "google_trends" as const,
    label: keyword.keyword,
    message: `${keyword.keyword}: Nachfrage ${keyword.demand}/100, ${keyword.change >= 0 ? "+" : ""}${keyword.change}% · ${keyword.seasonality} · ${keyword.region}`,
    score: keyword.demand,
    direction: keyword.change >= 0 ? ("up" as const) : ("down" as const),
    tags: ["keyword", keyword.seasonality, keyword.region],
  }));

  const relatedSignals = data.relatedQueries.slice(0, 4).map((query) => ({
    id: `gt-related-${query.replace(/\s+/g, "-")}`,
    category: "trend" as const,
    source: "google_trends" as const,
    label: query,
    message: `Related query: ${query}`,
    score: Math.max(40, data.demandScore - 5),
    direction: data.trendDirection,
    tags: ["related-query", "rising"],
  }));

  const aggregateSignals: IntelligenceSignal[] = [
    {
      id: "gt-demand-score",
      category: "trend",
      source: "google_trends",
      label: "Search demand score",
      message: `Regional search demand score ${data.demandScore}/100`,
      score: data.demandScore,
      direction: data.trendDirection,
      tags: ["demand-score", "aggregate"],
    },
    {
      id: "gt-seasonality",
      category: "trend",
      source: "google_trends",
      label: "Seasonality",
      message: data.seasonalityNote,
      score: data.demandScore,
      direction: data.trendDirection,
      tags: ["seasonality"],
    },
    {
      id: "gt-trend-direction",
      category: "trend",
      source: "google_trends",
      label: "Trend direction",
      message: `Overall keyword direction: ${data.trendDirection}`,
      score: data.demandScore,
      direction: data.trendDirection,
      tags: ["trend-direction"],
    },
  ];

  return [...keywordSignals, ...relatedSignals, ...aggregateSignals];
}

function buildFromBaseline(
  baseline: MilaeneCommerceBaseline | null,
  region: string,
): GoogleTrendsData {
  const dynamicKeywords = [...STREETWEAR_KEYWORDS];

  if (baseline?.commerceIntelligence.topUnits[0]) {
    const top = baseline.commerceIntelligence.topUnits[0].title.toLowerCase();
    if (!dynamicKeywords.some((keyword) => top.includes(keyword.keyword.split(" ")[0]))) {
      dynamicKeywords.unshift({
        keyword: top,
        demand: 78,
        change: 16,
        seasonality: "rising",
      });
    }
  }

  const keywords = dynamicKeywords.map((keyword) => ({ ...keyword, region }));
  const topRising = keywords
    .filter((keyword) => keyword.change > 0)
    .sort((a, b) => b.change - a.change)
    .slice(0, 4)
    .map((keyword) => keyword.keyword);

  const demandScore = Math.round(
    keywords.reduce((sum, keyword) => sum + keyword.demand, 0) /
      Math.max(1, keywords.length),
  );

  return {
    keywords,
    topRising,
    relatedQueries: topRising.slice(0, 4),
    seasonalityNote:
      "SS26: Earth tones und oversized Silhouetten steigen · AW25 Layering stabil",
    demandScore,
    trendDirection: "up",
  };
}

function buildResult(
  data: GoogleTrendsData,
  mode: "live" | "simulated",
  providerStatus: ProviderConnectionStatus,
  options: {
    simulatedReason?: string;
    error?: string;
  } = {},
): GoogleTrendsScanResult {
  const rawSignals = toSignals(data);
  const confidence = computeConfidence({
    mode,
    sampleSize: data.keywords.length,
    freshness: mode === "live" ? 0.9 : 0.65,
    dataQuality: mode === "live" ? 0.9 : 0.8,
  });
  const signals = normalizeSignals(rawSignals, confidence);
  const scores = aggregateConnectorScores(
    signals,
    { demand: 0.6, trend: 0.4 },
    confidence,
  );

  return {
    source: "google_trends",
    mode,
    loadedAt: new Date().toISOString(),
    signals,
    data,
    simulatedReason: options.simulatedReason,
    providerStatus,
    error: options.error,
    scores: {
      ...scores,
      demandScore: data.demandScore,
      trendScore: Math.round(
        data.keywords
          .filter((keyword) => keyword.seasonality === "rising" || keyword.change > 0)
          .reduce((sum, keyword) => sum + keyword.change, 0) /
          Math.max(1, data.keywords.filter((keyword) => keyword.change > 0).length || 1),
      ),
    },
  };
}

export interface GoogleTrendsInput extends ConnectorInput {
  baseline?: MilaeneCommerceBaseline | null;
}

/** Scan Google Trends for demand, seasonality and keyword signals. */
export async function scanGoogleTrends(
  input: GoogleTrendsInput = {},
): Promise<GoogleTrendsScanResult> {
  const region = input.region ?? "DE";
  const extraKeywords =
    input.baseline?.commerceIntelligence.topUnits
      .slice(0, 2)
      .map((unit) => unit.title.toLowerCase()) ?? [];
  const baselineData = buildFromBaseline(input.baseline ?? null, region);

  if (!isGoogleTrendsLiveConfigured()) {
    return buildResult(
      baselineData,
      "simulated",
      "disconnected",
      {
        simulatedReason:
          "GOOGLE_TRENDS_API_KEY not set — static streetwear keyword estimates, not live Google Trends",
      },
    );
  }

  try {
    const data = await fetchLiveGoogleTrends(region, extraKeywords);
    return buildResult(data, "live", "connected");
  } catch (error) {
    if (error instanceof GoogleTrendsApiError) {
      if (error.kind === "auth_error") {
        return buildResult(baselineData, "simulated", "authentication_error", {
          error: error.message,
          simulatedReason:
            "Invalid GOOGLE_TRENDS_API_KEY — using static keyword estimates until credentials are fixed",
        });
      }

      if (error.kind === "missing_key") {
        return buildResult(baselineData, "simulated", "disconnected", {
          simulatedReason: error.message,
        });
      }

      return buildResult(baselineData, "simulated", "offline", {
        error: error.message,
        simulatedReason: `SerpAPI failed (${error.message}) — using static keyword estimates`,
      });
    }

    const message =
      error instanceof Error ? error.message : "SerpAPI request failed";
    return buildResult(baselineData, "simulated", "offline", {
      error: message,
      simulatedReason: `SerpAPI failed (${message}) — using static keyword estimates`,
    });
  }
}
