import type { StockXIntelligenceData } from "@/services/connectors/stockx";
import type { ProviderNormalizer } from "../normalization/interfaces";
import { asProviderSourceKey } from "../types";
import {
  buildSignal,
  entity,
  finalizeBundle,
  mapBrandMentions,
  mentionClusters,
  normalizeFromEnvelope,
  signalId,
} from "./shared";

const SOURCE = asProviderSourceKey("stockx");

function normalizeStockX(
  data: StockXIntelligenceData,
  provenance: import("../types/provider-source").ProviderProvenance,
) {
  const signals = [
    ...data.products.slice(0, 10).map((product) => {
      const priceNote =
        product.marketPrice != null
          ? `market $${product.marketPrice}`
          : product.retailPrice != null
            ? `retail $${product.retailPrice}`
            : "price pending";
      return buildSignal({
        id: signalId(SOURCE, product.productId),
        category: "commerce",
        label: product.title,
        headline: `${product.brand} · ${product.title} · ${priceNote}`,
        value:
          product.marketPrice != null
            ? String(product.marketPrice)
            : product.retailPrice != null
              ? String(product.retailPrice)
              : undefined,
        direction:
          product.pricePremium != null && product.pricePremium > 0 ? "up" : "stable",
        entities: [
          entity("product", product.title, product.productId),
          entity("brand", product.brand),
          entity("category", product.category),
        ],
        tags: ["resale", product.category, product.silhouette ?? "sneaker"].filter(
          Boolean,
        ) as string[],
        provenance,
        observedAt: product.releaseDate ?? provenance.syncedAt,
        rawReference: product.urlKey ?? product.productId,
      });
    }),
    ...data.resaleDemandSignals.map((signal, index) =>
      buildSignal({
        id: signalId(SOURCE, `demand-${index}`),
        category: "consumer",
        label: "Resale signal",
        headline: signal,
        direction: "up",
        entities: [entity("topic", signal)],
        tags: ["demand"],
        provenance,
      }),
    ),
  ];

  const trends = {
    rising: mentionClusters(
      data.trendingSilhouettes,
      "silhouette",
      provenance,
      SOURCE,
    ),
    stable: mentionClusters(data.colorwayTrends, "color", provenance, SOURCE),
    declining: [],
    emerging: mentionClusters(
      data.colorwayTrends.map((c) => ({ term: c.term, count: c.count })),
      "color",
      provenance,
      SOURCE,
    ),
    opportunities: data.resaleDemandSignals,
  };

  if (data.categoryMovement.length > 0) {
    trends.stable.push(
      ...mentionClusters(data.categoryMovement, "category", provenance, SOURCE),
    );
  }

  const market = {
    segments: [...new Set(data.products.map((p) => p.category))].map(
      (category, index) => ({
        id: signalId(SOURCE, `segment-${index}`),
        label: category,
        channel: "resale" as const,
        categories: [category],
        provenance,
      }),
    ),
    movements: [],
    priceBands: data.premiumPriceRanges.map((band, index) => ({
      id: signalId(SOURCE, `premium-${index}`),
      label: band.category,
      currency: band.currency,
      min: band.min,
      max: band.max,
      sweetSpot: band.avgPremium,
      channel: "resale" as const,
      provenance,
    })),
    demandNarratives: data.resaleDemandSignals,
  };

  const commercial = {
    products: data.products.map((product) => ({
      id: signalId(SOURCE, `commercial-${product.productId}`),
      title: product.title,
      brand: product.brand,
      category: product.category,
      price: product.marketPrice ?? product.retailPrice ?? undefined,
      currency: "USD",
      status: product.marketPrice != null ? "market" : "catalog",
      provenance,
    })),
    demandIndicators: data.resaleDemandSignals.map((signal, index) => ({
      id: signalId(SOURCE, `indicator-${index}`),
      label: signal,
      narrative: signal,
      strength: "moderate" as const,
      provenance,
    })),
    opportunities: [],
    inventoryNarratives: [],
  };

  const brand = {
    mentions: mapBrandMentions(data.risingBrands, provenance, SOURCE, "streetwear"),
    momentum: data.trendingSilhouettes.map((silhouette, index) => ({
      id: signalId(SOURCE, `silhouette-${index}`),
      name: silhouette.term,
      narrative: `${silhouette.count} catalog hits`,
      signalType: "streetwear" as const,
      provenance,
    })),
    designers: [],
    culturalSignals: data.colorwayTrends.map((c) => c.term),
  };

  return finalizeBundle(provenance, signals, trends, market, commercial, brand);
}

export const stockxNormalizer: ProviderNormalizer = {
  sourceKey: SOURCE,
  normalize(envelope, _context) {
    return normalizeFromEnvelope<StockXIntelligenceData>(envelope, normalizeStockX);
  },
};
