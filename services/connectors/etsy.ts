import {
  fetchLiveEtsy,
  isEtsyLiveConfigured,
} from "./clients/etsy-client";
import {
  aggregateConnectorScores,
  computeConfidence,
  normalizeSignals,
} from "./signal-utils";
import type { ConnectorInput, IntelligenceSignal, SourceIntelligence } from "./types";

export interface EtsyBestseller {
  title: string;
  category: string;
  priceRange: string;
  keyword: string;
  /** Favorites count (num_favorers) — popularity proxy, NOT real sales. */
  sales: number;
}

export interface EtsyIntelligenceData {
  bestsellers: EtsyBestseller[];
  keywords: string[];
  printTrends: string[];
  priceRanges: Array<{ category: string; min: number; max: number; sweet: number }>;
}

export const EMPTY_ETSY_DATA: EtsyIntelligenceData = {
  bestsellers: [],
  keywords: [],
  printTrends: [],
  priceRanges: [],
};

function toSignals(data: EtsyIntelligenceData): IntelligenceSignal[] {
  const bestsellerSignals = data.bestsellers.map((bestseller) => ({
    id: `etsy-${bestseller.keyword.replace(/\s+/g, "-")}`,
    category: "commerce" as const,
    source: "etsy" as const,
    label: bestseller.title,
    message: `${bestseller.category} · ${bestseller.priceRange} · ${bestseller.sales.toLocaleString("de-DE")} favorites · "${bestseller.keyword}"`,
    score: Math.min(100, Math.round(bestseller.sales / 30)),
    direction: "up" as const,
    tags: ["popular", bestseller.category],
  }));

  const printSignals = data.printTrends.slice(0, 2).map((pattern, index) => ({
    id: `etsy-pattern-${index}`,
    category: "trend" as const,
    source: "etsy" as const,
    label: "Listing Pattern",
    message: pattern,
    score: 66 + index * 4,
    direction: "up" as const,
    tags: ["listing", "pattern"],
  }));

  const priceSignals = data.priceRanges.slice(0, 2).map((range, index) => ({
    id: `etsy-price-${index}`,
    category: "commerce" as const,
    source: "etsy" as const,
    label: `${range.category} price band`,
    message: `${range.category}: sweet spot ${range.sweet} (range ${range.min}–${range.max})`,
    score: 60 + index * 4,
    direction: "stable" as const,
    tags: ["pricing", range.category],
  }));

  return [...bestsellerSignals, ...printSignals, ...priceSignals];
}

function buildResult(
  data: EtsyIntelligenceData,
  mode: "live" | "simulated",
  simulatedReason?: string,
): SourceIntelligence<EtsyIntelligenceData> {
  const rawSignals = toSignals(data);
  const sampleSize =
    data.bestsellers.length + data.keywords.length + data.priceRanges.length;
  const confidence = computeConfidence({
    mode,
    sampleSize,
    freshness: mode === "live" ? 0.85 : 0.4,
    dataQuality: mode === "live" ? 0.8 : 0.4,
  });
  const signals = normalizeSignals(rawSignals, confidence);
  const scores = aggregateConnectorScores(
    signals,
    { demand: 0.7, trend: 0.3 },
    confidence,
  );

  return {
    source: "etsy",
    mode,
    loadedAt: new Date().toISOString(),
    data,
    signals,
    simulatedReason,
    scores,
  };
}

/** Scan Etsy for fashion listings, keywords, pricing and popularity signals. */
export async function scanEtsy(
  _input: ConnectorInput = {},
): Promise<SourceIntelligence<EtsyIntelligenceData>> {
  if (isEtsyLiveConfigured()) {
    try {
      const data = await fetchLiveEtsy();
      return buildResult(data, "live");
    } catch (error) {
      const reason =
        error instanceof Error
          ? `Etsy API failed (${error.message}) — no data fabricated`
          : "Etsy API failed — no data fabricated";
      return buildResult(EMPTY_ETSY_DATA, "simulated", reason);
    }
  }

  return buildResult(
    EMPTY_ETSY_DATA,
    "simulated",
    "ETSY_API_KEY not set — no Etsy data is returned without credentials",
  );
}
