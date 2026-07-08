import type { DepopIntelligenceData } from "@/services/connectors/depop";
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

const SOURCE = asProviderSourceKey("depop");

function normalizeDepop(
  data: DepopIntelligenceData,
  provenance: import("../types/provider-source").ProviderProvenance,
) {
  const signals = [
    ...data.listings.slice(0, 10).map((listing) =>
      buildSignal({
        id: signalId(SOURCE, String(listing.listingId)),
        category: "commerce",
        label: listing.title,
        headline: `${listing.title} · ${listing.currency}${listing.price} · ${listing.status}`,
        value: String(listing.price),
        direction: "stable",
        entities: [
          entity("listing", listing.title, String(listing.listingId)),
          entity("brand", listing.brand ?? "unknown"),
          entity("category", listing.category),
        ],
        tags: ["resale", listing.category, ...listing.styleTags.slice(0, 2)],
        provenance,
        observedAt: listing.publishedAt ?? provenance.syncedAt,
        rawReference: String(listing.listingId),
      }),
    ),
    ...data.streetwearKeywords.slice(0, 4).map((keyword, index) =>
      buildSignal({
        id: signalId(SOURCE, `keyword-${index}`),
        category: "trend",
        label: keyword.term,
        headline: `${keyword.term} (${keyword.count} hits)`,
        value: String(keyword.count),
        direction: "up",
        entities: [entity("keyword", keyword.term)],
        tags: ["streetwear"],
        provenance,
      }),
    ),
  ];

  const trends = {
    rising: mentionClusters(data.risingStyles, "aesthetic", provenance, SOURCE),
    stable: mentionClusters(data.productTypeTrends, "category", provenance, SOURCE),
    declining: [],
    emerging: mentionClusters(
      data.repeatedTitlePatterns.map((term) => ({ term, count: 1 })),
      "keyword",
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
    priceBands: data.priceBands.map((band, index) => ({
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
    mentions: mapBrandMentions(data.popularBrands, provenance, SOURCE, "streetwear"),
    momentum: data.risingStyles.map((style, index) => ({
      id: signalId(SOURCE, `style-${index}`),
      name: style.term,
      narrative: `${style.count} listings`,
      signalType: "streetwear" as const,
      provenance,
    })),
    designers: [],
    culturalSignals: data.colorTrends.map((c) => c.term),
  };

  return finalizeBundle(provenance, signals, trends, market, commercial, brand);
}

export const depopNormalizer: ProviderNormalizer = {
  sourceKey: SOURCE,
  normalize(envelope, _context) {
    return normalizeFromEnvelope<DepopIntelligenceData>(envelope, normalizeDepop);
  },
};
