import type { EtsyIntelligenceData } from "@/services/connectors/etsy";
import type { ProviderNormalizer } from "../normalization/interfaces";
import { asProviderSourceKey } from "../types";
import {
  buildSignal,
  entity,
  finalizeBundle,
  mentionClusters,
  normalizeFromEnvelope,
  signalId,
} from "./shared";

const SOURCE = asProviderSourceKey("etsy");

function normalizeEtsy(
  data: EtsyIntelligenceData,
  provenance: import("../types/provider-source").ProviderProvenance,
) {
  const signals = [
    ...data.bestsellers.map((item, index) =>
      buildSignal({
        id: signalId(SOURCE, `bestseller-${index}`),
        category: "commerce",
        label: item.title,
        headline: `${item.title} · ${item.priceRange} · ${item.sales} favorites`,
        value: String(item.sales),
        direction: "up",
        entities: [
          entity("listing", item.title),
          entity("keyword", item.keyword),
          entity("category", item.category),
        ],
        tags: ["marketplace", item.category],
        provenance,
        rawReference: item.keyword,
      }),
    ),
    ...data.printTrends.map((pattern, index) =>
      buildSignal({
        id: signalId(SOURCE, `pattern-${index}`),
        category: "trend",
        label: pattern,
        headline: pattern,
        direction: "up",
        entities: [entity("topic", pattern)],
        tags: ["print", "pattern"],
        provenance,
      }),
    ),
  ];

  const trends = {
    rising: mentionClusters(
      data.keywords.map((term) => ({ term, count: 1 })),
      "keyword",
      provenance,
      SOURCE,
    ),
    stable: mentionClusters(
      data.printTrends.map((term) => ({ term, count: 1 })),
      "graphic",
      provenance,
      SOURCE,
    ),
    declining: [],
    emerging: mentionClusters(
      data.printTrends.map((term) => ({ term, count: 1 })),
      "graphic",
      provenance,
      SOURCE,
    ),
    opportunities: data.keywords.slice(0, 6),
  };

  const market = {
    segments: [...new Set(data.bestsellers.map((b) => b.category))].map(
      (category, index) => ({
        id: signalId(SOURCE, `segment-${index}`),
        label: category,
        channel: "marketplace" as const,
        categories: [category],
        provenance,
      }),
    ),
    movements: [],
    priceBands: data.priceRanges.map((band, index) => ({
      id: signalId(SOURCE, `price-${index}`),
      label: band.category,
      currency: "USD",
      min: band.min,
      max: band.max,
      sweetSpot: band.sweet,
      channel: "marketplace" as const,
      provenance,
    })),
    demandNarratives: [],
  };

  const commercial = {
    products: data.bestsellers.map((item, index) => ({
      id: signalId(SOURCE, `product-${index}`),
      title: item.title,
      category: item.category,
      provenance,
    })),
    demandIndicators: data.bestsellers.map((item, index) => ({
      id: signalId(SOURCE, `demand-${index}`),
      label: item.keyword,
      narrative: `${item.sales} favorites · popularity proxy (not sales)`,
      strength: "moderate" as const,
      provenance,
    })),
    opportunities: [],
    inventoryNarratives: [],
  };

  return finalizeBundle(
    provenance,
    signals,
    trends,
    market,
    commercial,
    { mentions: [], momentum: [], designers: [], culturalSignals: [] },
  );
}

export const etsyNormalizer: ProviderNormalizer = {
  sourceKey: SOURCE,
  normalize(envelope, _context) {
    return normalizeFromEnvelope<EtsyIntelligenceData>(envelope, normalizeEtsy);
  },
};
