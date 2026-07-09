import {
  fetchLiveDepop,
  isDepopLiveConfigured,
} from "./clients/depop-client";
import {
  aggregateConnectorScores,
  computeConfidence,
  normalizeSignals,
} from "./signal-utils";
import type { ConnectorInput, IntelligenceSignal, SourceIntelligence } from "./types";

export interface DepopListing {
  listingId: number;
  sku: string | null;
  title: string;
  brand: string | null;
  price: number;
  currency: string;
  colors: string[];
  materials: string[];
  size: string | null;
  category: string;
  styleTags: string[];
  condition: string | null;
  status: string;
  location: string | null;
  publishedAt: string | null;
  /** Days since listing was created (freshness proxy). */
  freshnessDays: number | null;
}

export interface DepopMention {
  term: string;
  count: number;
}

export interface DepopPriceBand {
  category: string;
  min: number;
  max: number;
  sweet: number;
  currency: string;
}

export interface DepopIntelligenceData {
  listings: DepopListing[];
  risingStyles: DepopMention[];
  popularBrands: DepopMention[];
  priceBands: DepopPriceBand[];
  colorTrends: DepopMention[];
  silhouetteTrends: DepopMention[];
  productTypeTrends: DepopMention[];
  repeatedTitlePatterns: string[];
  streetwearKeywords: DepopMention[];
  resaleDemandProxies: string[];
}

export const EMPTY_DEPOP_DATA: DepopIntelligenceData = {
  listings: [],
  risingStyles: [],
  popularBrands: [],
  priceBands: [],
  colorTrends: [],
  silhouetteTrends: [],
  productTypeTrends: [],
  repeatedTitlePatterns: [],
  streetwearKeywords: [],
  resaleDemandProxies: [],
};

function toSignals(data: DepopIntelligenceData): IntelligenceSignal[] {
  const listingSignals = data.listings.slice(0, 6).map((listing, index) => ({
    id: `depop-${listing.listingId}`,
    category: "commerce" as const,
    source: "depop" as const,
    label: listing.brand ?? listing.category,
    message: `${listing.title} · ${listing.currency}${listing.price} · ${listing.status}`,
    score: 70 - index * 3,
    direction: "up" as const,
    tags: ["resale", listing.category, ...listing.styleTags.slice(0, 2)],
  }));

  const brandSignals = data.popularBrands.slice(0, 3).map((mention, index) => ({
    id: `depop-brand-${index}`,
    category: "competitor" as const,
    source: "depop" as const,
    label: "Resale Brand",
    message: `${mention.term} (${mention.count} listings)`,
    score: 64 + index * 4,
    direction: "up" as const,
    tags: ["brand", "resale"],
  }));

  const styleSignals = data.risingStyles.slice(0, 3).map((mention, index) => ({
    id: `depop-style-${index}`,
    category: "trend" as const,
    source: "depop" as const,
    label: "Rising Style",
    message: `${mention.term} (${mention.count} listings)`,
    score: 68 + index * 4,
    direction: "up" as const,
    tags: ["style", "streetwear"],
  }));

  const priceSignals = data.priceBands.slice(0, 2).map((band, index) => ({
    id: `depop-price-${index}`,
    category: "commerce" as const,
    source: "depop" as const,
    label: `${band.category} price band`,
    message: `${band.category}: sweet spot ${band.currency}${band.sweet} (${band.currency}${band.min}–${band.currency}${band.max})`,
    score: 60 + index * 4,
    direction: "stable" as const,
    tags: ["pricing", band.category],
  }));

  return [...listingSignals, ...brandSignals, ...styleSignals, ...priceSignals];
}

function buildResult(
  data: DepopIntelligenceData,
  mode: "live" | "simulated",
  simulatedReason?: string,
): SourceIntelligence<DepopIntelligenceData> {
  const rawSignals = toSignals(data);
  const sampleSize =
    data.listings.length +
    data.popularBrands.length +
    data.streetwearKeywords.length;
  const confidence = computeConfidence({
    mode,
    sampleSize,
    freshness: mode === "live" ? 0.82 : 0.4,
    dataQuality: mode === "live" ? 0.8 : 0.4,
  });
  const signals = normalizeSignals(rawSignals, confidence);
  const scores = aggregateConnectorScores(
    signals,
    { demand: 0.55, trend: 0.45 },
    confidence,
  );

  return {
    source: "depop",
    mode,
    loadedAt: new Date().toISOString(),
    signals,
    data,
    simulatedReason,
    scores,
  };
}

/** Scan Depop partner inventory for streetwear resale intelligence. */
export async function scanDepop(
  _input: ConnectorInput = {},
): Promise<SourceIntelligence<DepopIntelligenceData>> {
  if (isDepopLiveConfigured()) {
    try {
      const data = await fetchLiveDepop();
      return buildResult(data, "live");
    } catch (error) {
      const reason =
        error instanceof Error
          ? `Depop API failed (${error.message}) — no data fabricated`
          : "Depop API failed — no data fabricated";
      return buildResult(EMPTY_DEPOP_DATA, "simulated", reason);
    }
  }

  return buildResult(
    EMPTY_DEPOP_DATA,
    "simulated",
    "DEPOP_API_KEY not set — Depop Partner Selling API requires approved partner credentials; no resale data is fabricated",
  );
}
