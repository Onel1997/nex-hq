import type { TikTokIntelligenceData } from "@/services/connectors/tiktok";
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

const SOURCE = asProviderSourceKey("tiktok");

function normalizeTikTok(
  data: TikTokIntelligenceData,
  provenance: import("../types/provider-source").ProviderProvenance,
) {
  const signals = [
    ...data.viralTrends.map((trend) =>
      buildSignal({
        id: signalId(SOURCE, trend.hashtag),
        category: "social",
        label: trend.hashtag,
        headline: trend.insight,
        value: String(trend.views),
        direction: directionFromChange(trend.change),
        entities: [
          entity("hashtag", trend.hashtag, String(trend.views)),
          entity("topic", trend.category),
        ],
        tags: [trend.category, "hashtag"],
        provenance,
        rawReference: trend.hashtag,
      }),
    ),
    ...data.silhouettes.map((silhouette, index) =>
      buildSignal({
        id: signalId(SOURCE, `silhouette-${index}`),
        category: "trend",
        label: silhouette,
        headline: `${silhouette} silhouette signal`,
        direction: "up",
        entities: [entity("silhouette", silhouette)],
        tags: ["silhouette"],
        provenance,
      }),
    ),
  ];

  const trends = {
    rising: mentionClusters(
      data.hashtags.map((term) => ({ term, count: 1 })),
      "keyword",
      provenance,
      SOURCE,
    ),
    stable: mentionClusters(
      data.outfitTrends.map((term) => ({ term, count: 1 })),
      "aesthetic",
      provenance,
      SOURCE,
    ),
    declining: [],
    emerging: mentionClusters(
      data.outfitTrends.map((term) => ({ term, count: 1 })),
      "aesthetic",
      provenance,
      SOURCE,
    ),
    opportunities: data.hashtags.slice(0, 6),
  };

  const market = {
    segments: [],
    movements: [],
    priceBands: [],
    demandNarratives: data.colors.map((color) => `Color signal · ${color}`),
  };

  return finalizeBundle(
    provenance,
    signals,
    trends,
    market,
    { products: [], demandIndicators: [], opportunities: [], inventoryNarratives: [] },
    { mentions: [], momentum: [], designers: [], culturalSignals: data.colors },
  );
}

export const tiktokNormalizer: ProviderNormalizer = {
  sourceKey: SOURCE,
  normalize(envelope, _context) {
    return normalizeFromEnvelope<TikTokIntelligenceData>(envelope, normalizeTikTok);
  },
};
