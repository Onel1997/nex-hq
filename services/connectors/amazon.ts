import {
  fetchLiveAmazon,
  isAmazonLiveConfigured,
} from "./clients/amazon-client";
import {
  aggregateConnectorScores,
  computeConfidence,
  normalizeSignals,
} from "./signal-utils";
import type { ConnectorInput, IntelligenceSignal, SourceIntelligence } from "./types";

export interface AmazonBestseller {
  title: string;
  category: string;
  /** BrowseNodeInfo.WebsiteSalesRank (category rank proxy) — 0 when unavailable. */
  rank: number;
  /** CustomerReviews.StarRating — 0 when unavailable (eligibility-gated). */
  rating: number;
  /** CustomerReviews.Count — 0 when unavailable (eligibility-gated). */
  reviews: number;
  priceRange: string;
}

export interface AmazonIntelligenceData {
  bestsellers: AmazonBestseller[];
  categories: string[];
  demandSignals: string[];
  reviewInsights: string[];
}

export const EMPTY_AMAZON_DATA: AmazonIntelligenceData = {
  bestsellers: [],
  categories: [],
  demandSignals: [],
  reviewInsights: [],
};

function toSignals(data: AmazonIntelligenceData): IntelligenceSignal[] {
  const bestsellerSignals = data.bestsellers.map((bestseller, index) => {
    const rankLabel =
      bestseller.rank > 0 ? `#${bestseller.rank} ` : "";
    const ratingPart =
      bestseller.reviews > 0
        ? `${bestseller.rating}★ (${bestseller.reviews} reviews) · `
        : "";
    const score =
      bestseller.rank > 0
        ? Math.max(20, Math.min(100, 100 - Math.log10(bestseller.rank + 1) * 15))
        : 70 - index * 3;

    return {
      id: `amazon-${bestseller.category.replace(/\s+/g, "-")}-${index}`,
      category: "commerce" as const,
      source: "amazon" as const,
      label: `${rankLabel}${bestseller.category}`,
      message: `${bestseller.title} · ${ratingPart}${bestseller.priceRange}`,
      score: Math.round(score),
      direction: "up" as const,
      tags: ["popular", bestseller.category],
    };
  });

  const demandSignals = data.demandSignals.slice(0, 2).map((signal, index) => ({
    id: `amazon-demand-${index}`,
    category: "consumer" as const,
    source: "amazon" as const,
    label: "Demand Signal",
    message: signal,
    score: 70 + index * 4,
    direction: "up" as const,
    tags: ["demand", "keyword"],
  }));

  return [...bestsellerSignals, ...demandSignals];
}

function buildResult(
  data: AmazonIntelligenceData,
  mode: "live" | "simulated",
  simulatedReason?: string,
): SourceIntelligence<AmazonIntelligenceData> {
  const rawSignals = toSignals(data);
  const sampleSize =
    data.bestsellers.length + data.categories.length + data.demandSignals.length;
  const confidence = computeConfidence({
    mode,
    sampleSize,
    freshness: mode === "live" ? 0.85 : 0.4,
    dataQuality: mode === "live" ? 0.82 : 0.4,
  });
  const signals = normalizeSignals(rawSignals, confidence);
  const scores = aggregateConnectorScores(
    signals,
    { demand: 0.7, trend: 0.3 },
    confidence,
  );

  return {
    source: "amazon",
    mode,
    loadedAt: new Date().toISOString(),
    signals,
    data,
    simulatedReason,
    scores,
  };
}

/** Scan Amazon for fashion products, categories, pricing and demand signals. */
export async function scanAmazon(
  _input: ConnectorInput = {},
): Promise<SourceIntelligence<AmazonIntelligenceData>> {
  if (isAmazonLiveConfigured()) {
    try {
      const data = await fetchLiveAmazon();
      return buildResult(data, "live");
    } catch (error) {
      const reason =
        error instanceof Error
          ? `Amazon PA-API failed (${error.message}) — no data fabricated`
          : "Amazon PA-API failed — no data fabricated";
      return buildResult(EMPTY_AMAZON_DATA, "simulated", reason);
    }
  }

  return buildResult(
    EMPTY_AMAZON_DATA,
    "simulated",
    "Amazon PA-API credentials not set — no Amazon data is returned without credentials",
  );
}
