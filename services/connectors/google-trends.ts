import type { MilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import {
  fetchLiveGoogleTrends,
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
  seasonalityNote: string;
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
  return data.keywords.slice(0, 8).map((k) => ({
    id: `gt-${k.keyword.replace(/\s+/g, "-")}`,
    category: "trend" as const,
    source: "google_trends" as const,
    label: k.keyword,
    message: `${k.keyword}: Nachfrage ${k.demand}/100, ${k.change >= 0 ? "+" : ""}${k.change}% · ${k.seasonality} · ${k.region}`,
    score: k.demand,
    direction: k.change >= 0 ? ("up" as const) : ("down" as const),
    tags: ["keyword", k.seasonality, k.region],
  }));
}

function buildFromBaseline(
  baseline: MilaeneCommerceBaseline | null,
  region: string,
): GoogleTrendsData {
  const dynamicKeywords = [...STREETWEAR_KEYWORDS];

  if (baseline?.commerceIntelligence.topUnits[0]) {
    const top = baseline.commerceIntelligence.topUnits[0].title.toLowerCase();
    if (!dynamicKeywords.some((k) => top.includes(k.keyword.split(" ")[0]))) {
      dynamicKeywords.unshift({
        keyword: top,
        demand: 78,
        change: 16,
        seasonality: "rising",
      });
    }
  }

  return {
    keywords: dynamicKeywords.map((k) => ({ ...k, region })),
    topRising: dynamicKeywords
      .filter((k) => k.change > 0)
      .sort((a, b) => b.change - a.change)
      .slice(0, 4)
      .map((k) => k.keyword),
    seasonalityNote:
      "SS26: Earth tones und oversized Silhouetten steigen · AW25 Layering stabil",
  };
}

function buildResult(
  data: GoogleTrendsData,
  mode: "live" | "simulated",
): SourceIntelligence<GoogleTrendsData> {
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
    scores: {
      ...scores,
      demandScore: Math.round(
        data.keywords.reduce((sum, k) => sum + k.demand, 0) /
          Math.max(1, data.keywords.length),
      ),
      trendScore: Math.round(
        data.keywords
          .filter((k) => k.seasonality === "rising" || k.change > 0)
          .reduce((sum, k) => sum + k.change, 0) /
          Math.max(1, data.keywords.filter((k) => k.change > 0).length || 1),
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
): Promise<SourceIntelligence<GoogleTrendsData>> {
  const region = input.region ?? "DE";
  const extraKeywords =
    input.baseline?.commerceIntelligence.topUnits
      .slice(0, 2)
      .map((u) => u.title.toLowerCase()) ?? [];

  if (isGoogleTrendsLiveConfigured()) {
    try {
      const data = await fetchLiveGoogleTrends(region, extraKeywords);
      return buildResult(data, "live");
    } catch {
      return buildResult(buildFromBaseline(input.baseline ?? null, region), "simulated");
    }
  }

  return buildResult(buildFromBaseline(input.baseline ?? null, region), "simulated");
}
