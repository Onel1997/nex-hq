import {
  fetchLiveStockX,
  isStockXLiveConfigured,
} from "./clients/stockx-client";
import {
  aggregateConnectorScores,
  computeConfidence,
  normalizeSignals,
} from "./signal-utils";
import type { ConnectorInput, IntelligenceSignal, SourceIntelligence } from "./types";

export interface StockXProduct {
  productId: string;
  title: string;
  brand: string;
  category: string;
  retailPrice: number | null;
  marketPrice: number | null;
  lastSale: number | null;
  /** Percentage premium over retail when both prices are API-provided. */
  pricePremium: number | null;
  releaseDate: string | null;
  colorway: string | null;
  silhouette: string | null;
  productType: string | null;
  styleId: string | null;
  urlKey: string | null;
}

export interface StockXMention {
  term: string;
  count: number;
}

export interface StockXPremiumBand {
  category: string;
  min: number;
  max: number;
  avgPremium: number;
  currency: string;
}

export interface StockXIntelligenceData {
  products: StockXProduct[];
  risingBrands: StockXMention[];
  trendingSilhouettes: StockXMention[];
  premiumPriceRanges: StockXPremiumBand[];
  colorwayTrends: StockXMention[];
  categoryMovement: StockXMention[];
  resaleDemandSignals: string[];
}

export const EMPTY_STOCKX_DATA: StockXIntelligenceData = {
  products: [],
  risingBrands: [],
  trendingSilhouettes: [],
  premiumPriceRanges: [],
  colorwayTrends: [],
  categoryMovement: [],
  resaleDemandSignals: [],
};

function toSignals(data: StockXIntelligenceData): IntelligenceSignal[] {
  const productSignals = data.products.slice(0, 6).map((product, index) => ({
    id: `stockx-${product.productId}`,
    category: "commerce" as const,
    source: "stockx" as const,
    label: product.brand,
    message: formatProductMessage(product),
    score: Math.min(
      100,
      55 + (product.pricePremium != null ? Math.round(product.pricePremium / 2) : 10),
    ),
    direction:
      product.pricePremium != null && product.pricePremium > 0
        ? ("up" as const)
        : ("stable" as const),
    tags: ["resale", product.category, product.silhouette ?? "product"].filter(
      Boolean,
    ) as string[],
  }));

  const brandSignals = data.risingBrands.slice(0, 3).map((mention, index) => ({
    id: `stockx-brand-${index}`,
    category: "competitor" as const,
    source: "stockx" as const,
    label: "Rising Brand",
    message: `${mention.term} (${mention.count} products in sample)`,
    score: 66 + index * 4,
    direction: "up" as const,
    tags: ["brand", "resale"],
  }));

  const silhouetteSignals = data.trendingSilhouettes
    .slice(0, 3)
    .map((mention, index) => ({
      id: `stockx-silhouette-${index}`,
      category: "trend" as const,
      source: "stockx" as const,
      label: "Trending Silhouette",
      message: `${mention.term} (${mention.count} hits)`,
      score: 70 + index * 4,
      direction: "up" as const,
      tags: ["silhouette", "streetwear"],
    }));

  const demandSignals = data.resaleDemandSignals
    .slice(0, 2)
    .map((signal, index) => ({
      id: `stockx-demand-${index}`,
      category: "consumer" as const,
      source: "stockx" as const,
      label: "Resale Signal",
      message: signal,
      score: 64 + index * 4,
      direction: "up" as const,
      tags: ["demand", "resale"],
    }));

  return [...productSignals, ...brandSignals, ...silhouetteSignals, ...demandSignals];
}

function formatProductMessage(product: StockXProduct): string {
  const parts = [product.title];
  if (product.marketPrice != null) {
    parts.push(`market $${product.marketPrice}`);
  }
  if (product.pricePremium != null) {
    parts.push(`${product.pricePremium > 0 ? "+" : ""}${product.pricePremium}% vs retail`);
  }
  if (product.lastSale != null) {
    parts.push(`last sale $${product.lastSale}`);
  }
  return parts.join(" · ");
}

function buildResult(
  data: StockXIntelligenceData,
  mode: "live" | "simulated",
  simulatedReason?: string,
): SourceIntelligence<StockXIntelligenceData> {
  const rawSignals = toSignals(data);
  const sampleSize =
    data.products.length + data.risingBrands.length + data.trendingSilhouettes.length;
  const confidence = computeConfidence({
    mode,
    sampleSize,
    freshness: mode === "live" ? 0.85 : 0.4,
    dataQuality: mode === "live" ? 0.82 : 0.4,
  });
  const signals = normalizeSignals(rawSignals, confidence);
  const scores = aggregateConnectorScores(
    signals,
    { demand: 0.6, trend: 0.4 },
    confidence,
  );

  return {
    source: "stockx",
    mode,
    loadedAt: new Date().toISOString(),
    signals,
    data,
    simulatedReason,
    scores,
  };
}

/** Scan StockX catalog for streetwear resale market intelligence. */
export async function scanStockX(
  _input: ConnectorInput = {},
): Promise<SourceIntelligence<StockXIntelligenceData>> {
  if (isStockXLiveConfigured()) {
    try {
      const data = await fetchLiveStockX();
      return buildResult(data, "live");
    } catch (error) {
      const reason =
        error instanceof Error
          ? `StockX API failed (${error.message}) — no data fabricated`
          : "StockX API failed — no data fabricated";
      return buildResult(EMPTY_STOCKX_DATA, "simulated", reason);
    }
  }

  return buildResult(
    EMPTY_STOCKX_DATA,
    "simulated",
    "StockX developer credentials not set — requires approved STOCKX_API_KEY + OAuth access token; no marketplace data is fabricated",
  );
}
