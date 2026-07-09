import type { GrailedIntelligenceData } from "@/services/connectors/grailed";
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

const SOURCE = asProviderSourceKey("grailed");

function normalizeGrailed(
  data: GrailedIntelligenceData,
  provenance: import("../types/provider-source").ProviderProvenance,
) {
  const signals = [
    ...data.listings.slice(0, 10).map((listing) =>
      buildSignal({
        id: signalId(SOURCE, listing.listingId),
        category: "commerce",
        label: listing.title,
        headline: `${listing.designer ?? listing.brand ?? listing.category} · ${listing.title} · ${listing.currency}${listing.price}`,
        value: String(listing.price),
        direction: "stable",
        entities: [
          entity("listing", listing.title, listing.listingId),
          entity("designer", listing.designer ?? listing.brand ?? "unknown"),
          entity("category", listing.category),
        ],
        tags: [
          "designer",
          "resale",
          listing.category,
          listing.condition ?? "unknown",
        ],
        provenance,
        observedAt: listing.publishedAt ?? provenance.syncedAt,
        rawReference: listing.listingId,
      }),
    ),
    ...data.repeatedTitlePatterns.slice(0, 4).map((pattern, index) =>
      buildSignal({
        id: signalId(SOURCE, `pattern-${index}`),
        category: "trend",
        label: pattern,
        headline: pattern,
        direction: "up",
        entities: [entity("keyword", pattern)],
        tags: ["title-pattern"],
        provenance,
      }),
    ),
  ];

  const trends = {
    rising: mentionClusters(
      data.archiveFashionSignals,
      "aesthetic",
      provenance,
      SOURCE,
    ),
    stable: mentionClusters(
      data.silhouetteTrends,
      "silhouette",
      provenance,
      SOURCE,
    ),
    declining: [],
    emerging: mentionClusters(
      data.luxuryStreetwearSignals.map((s) => ({ term: s.term, count: s.count })),
      "aesthetic",
      provenance,
      SOURCE,
    ),
    opportunities: data.repeatedTitlePatterns,
  };

  const market = {
    segments: [...new Set(data.listings.map((l) => l.category))].map(
      (category, index) => ({
        id: signalId(SOURCE, `segment-${index}`),
        label: category,
        channel: "resale" as const,
        categories: [category],
        provenance,
      }),
    ),
    movements: [],
    priceBands: data.designerPriceBands.map((band, index) => ({
      id: signalId(SOURCE, `price-${index}`),
      label: band.category,
      currency: band.currency,
      min: band.min,
      max: band.max,
      sweetSpot: band.sweet,
      channel: "resale" as const,
      provenance,
    })),
    demandNarratives: data.resaleDemandProxies,
  };

  const commercial = {
    products: data.listings.map((listing) => ({
      id: signalId(SOURCE, `product-${listing.listingId}`),
      title: listing.title,
      brand: listing.brand ?? undefined,
      category: listing.category,
      price: listing.price,
      currency: listing.currency,
      status: listing.status,
      provenance,
    })),
    demandIndicators: data.resaleDemandProxies.map((proxy, index) => ({
      id: signalId(SOURCE, `demand-${index}`),
      label: "Resale proxy",
      narrative: proxy,
      strength: "moderate" as const,
      provenance,
    })),
    opportunities: [],
    inventoryNarratives: data.resaleDemandProxies,
  };

  const brand = {
    mentions: mapBrandMentions(
      data.risingDesigners,
      provenance,
      SOURCE,
      "designer",
    ),
    momentum: data.luxuryStreetwearSignals.map((signal, index) => ({
      id: signalId(SOURCE, `luxury-${index}`),
      name: signal.term,
      narrative: `${signal.count} luxury streetwear hits`,
      signalType: "luxury" as const,
      provenance,
    })),
    designers: data.risingDesigners.map((designer, index) => ({
      id: signalId(SOURCE, `designer-${index}`),
      designer: designer.term,
      context: `${designer.count} listings`,
      provenance,
    })),
    culturalSignals: [
      ...data.archiveFashionSignals.map((s) => s.term),
      ...data.materialTrends.map((m) => m.term),
      ...data.colorTrends.map((c) => c.term),
    ],
  };

  return finalizeBundle(provenance, signals, trends, market, commercial, brand);
}

export const grailedNormalizer: ProviderNormalizer = {
  sourceKey: SOURCE,
  normalize(envelope, _context) {
    return normalizeFromEnvelope<GrailedIntelligenceData>(envelope, normalizeGrailed);
  },
};
