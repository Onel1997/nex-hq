import type { GoogleTrendsData } from "@/services/connectors/google-trends";
import type { ProviderNormalizer } from "../normalization/interfaces";
import { asProviderSourceKey } from "../types";
import {
  buildSignal,
  directionFromChange,
  entity,
  finalizeBundle,
  mentionClusters,
  normalizeFromEnvelope,
  signalId,
} from "./shared";

const SOURCE = asProviderSourceKey("google_trends");

function normalizeGoogleTrends(
  data: GoogleTrendsData,
  provenance: import("../types/provider-source").ProviderProvenance,
) {
  const signals = data.keywords.map((keyword) =>
    buildSignal({
      id: signalId(SOURCE, keyword.keyword),
      category: "trend",
      label: keyword.keyword,
      headline: `${keyword.keyword} · demand ${keyword.demand} · ${keyword.change >= 0 ? "+" : ""}${keyword.change}%`,
      value: String(keyword.demand),
      direction: directionFromChange(keyword.change),
      entities: [
        entity("keyword", keyword.keyword, String(keyword.demand)),
        entity("topic", keyword.region),
      ],
      tags: ["keyword", keyword.seasonality, keyword.region],
      provenance,
    }),
  );

  const risingKeywords = data.keywords.filter((k) => k.change > 0);
  const decliningKeywords = data.keywords.filter((k) => k.change < 0);

  const risingClusters = mentionClusters(
    risingKeywords.map((k) => ({ term: k.keyword, count: k.demand })),
    "keyword",
    provenance,
    SOURCE,
    "seasonal",
  );

  const trends = {
    rising: risingClusters,
    stable: mentionClusters(
      data.keywords
        .filter((k) => k.seasonality === "stable" || k.seasonality === "peak")
        .map((k) => ({ term: k.keyword, count: k.demand })),
      "keyword",
      provenance,
      SOURCE,
      "seasonal",
    ),
    declining: mentionClusters(
      decliningKeywords.map((k) => ({ term: k.keyword, count: k.demand })),
      "keyword",
      provenance,
      SOURCE,
      "seasonal",
    ),
    emerging: mentionClusters(
      data.topRising.map((term) => ({ term, count: 1 })),
      "keyword",
      provenance,
      SOURCE,
      "immediate",
    ),
    opportunities: data.topRising,
  };

  const market = {
    segments: [],
    movements: [],
    priceBands: [],
    demandNarratives: data.seasonalityNote ? [data.seasonalityNote] : [],
  };

  return finalizeBundle(
    provenance,
    signals,
    trends,
    market,
    { products: [], demandIndicators: [], opportunities: [], inventoryNarratives: [] },
    { mentions: [], momentum: [], designers: [], culturalSignals: [] },
  );
}

export const googleTrendsNormalizer: ProviderNormalizer = {
  sourceKey: SOURCE,
  normalize(envelope, _context) {
    return normalizeFromEnvelope<GoogleTrendsData>(envelope, normalizeGoogleTrends);
  },
};
