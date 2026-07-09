import type { AmazonIntelligenceData } from "@/services/connectors/amazon";
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

const SOURCE = asProviderSourceKey("amazon");

function normalizeAmazon(
  data: AmazonIntelligenceData,
  provenance: import("../types/provider-source").ProviderProvenance,
) {
  const signals = [
    ...data.bestsellers.map((item, index) =>
      buildSignal({
        id: signalId(SOURCE, `bestseller-${index}`),
        category: "commerce",
        label: item.title,
        headline: `${item.title} · ${item.priceRange}${item.rank > 0 ? ` · rank #${item.rank}` : ""}`,
        value: item.rank > 0 ? String(item.rank) : undefined,
        direction: "up",
        entities: [
          entity("product", item.title),
          entity("category", item.category),
        ],
        tags: ["marketplace", item.category],
        provenance,
        rawReference: item.category,
      }),
    ),
    ...data.demandSignals.map((signal, index) =>
      buildSignal({
        id: signalId(SOURCE, `demand-${index}`),
        category: "consumer",
        label: "Demand signal",
        headline: signal,
        direction: "up",
        entities: [entity("topic", signal)],
        tags: ["demand"],
        provenance,
      }),
    ),
  ];

  const trends = {
    rising: [],
    stable: [],
    declining: [],
    emerging: mentionClusters(
      data.reviewInsights.map((term) => ({ term, count: 1 })),
      "topic",
      provenance,
      SOURCE,
    ),
    opportunities: data.demandSignals,
  };

  const market = {
    segments: data.categories.map((category, index) => ({
      id: signalId(SOURCE, `segment-${index}`),
      label: category,
      channel: "marketplace" as const,
      categories: [category],
      provenance,
    })),
    movements: [],
    priceBands: [],
    demandNarratives: data.demandSignals,
  };

  const commercial = {
    products: data.bestsellers.map((item, index) => ({
      id: signalId(SOURCE, `product-${index}`),
      title: item.title,
      category: item.category,
      provenance,
    })),
    demandIndicators: data.demandSignals.map((signal, index) => ({
      id: signalId(SOURCE, `indicator-${index}`),
      label: signal,
      narrative: signal,
      strength: "moderate" as const,
      provenance,
    })),
    opportunities: data.reviewInsights.map((insight, index) => ({
      id: signalId(SOURCE, `review-${index}`),
      title: insight,
      rationale: insight,
      tags: ["review-insight"],
      provenance,
    })),
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

export const amazonNormalizer: ProviderNormalizer = {
  sourceKey: SOURCE,
  normalize(envelope, _context) {
    return normalizeFromEnvelope<AmazonIntelligenceData>(envelope, normalizeAmazon);
  },
};
