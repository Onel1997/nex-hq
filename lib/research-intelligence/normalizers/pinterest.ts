import type { PinterestIntelligenceData } from "@/services/connectors/pinterest";
import type { ProviderNormalizer } from "../normalization/interfaces";
import { asProviderSourceKey } from "../types";
import {
  buildSignal,
  directionFromTrend,
  entity,
  finalizeBundle,
  mentionClusters,
  normalizeFromEnvelope,
  signalId,
} from "./shared";

const SOURCE = asProviderSourceKey("pinterest");

function normalizePinterest(
  data: PinterestIntelligenceData,
  provenance: import("../types/provider-source").ProviderProvenance,
) {
  const signals = [
    ...data.boards.map((board) =>
      buildSignal({
        id: signalId(SOURCE, board.name),
        category: "social",
        label: board.name,
        headline: `${board.aesthetic} · ${board.colors.join(", ")}`,
        value: String(board.saves),
        direction: directionFromTrend(board.trend),
        entities: [
          entity("topic", board.name),
          entity("color", board.colors[0] ?? "palette"),
        ],
        tags: ["moodboard", board.aesthetic, ...board.colors.slice(0, 2)],
        provenance,
        rawReference: board.name,
      }),
    ),
    ...data.outfitTrends.map((trend, index) =>
      buildSignal({
        id: signalId(SOURCE, `outfit-${index}`),
        category: "trend",
        label: trend,
        headline: trend,
        direction: "up",
        entities: [entity("keyword", trend)],
        tags: ["outfit", "search"],
        provenance,
      }),
    ),
    ...data.capsuleTrends.map((capsule, index) =>
      buildSignal({
        id: signalId(SOURCE, `capsule-${index}`),
        category: "trend",
        label: capsule,
        headline: capsule,
        direction: "emerging",
        entities: [entity("topic", capsule)],
        tags: ["capsule"],
        provenance,
      }),
    ),
  ];

  const trends = {
    rising: mentionClusters(
      data.outfitTrends.map((term) => ({ term, count: 1 })),
      "aesthetic",
      provenance,
      SOURCE,
    ),
    stable: mentionClusters(
      data.aesthetics.map((term) => ({ term, count: 1 })),
      "aesthetic",
      provenance,
      SOURCE,
    ),
    declining: [],
    emerging: mentionClusters(
      data.capsuleTrends.map((term) => ({ term, count: 1 })),
      "aesthetic",
      provenance,
      SOURCE,
    ),
    opportunities: data.capsuleTrends,
  };

  const market = {
    segments: [],
    movements: [],
    priceBands: [],
    demandNarratives: data.colorWorlds,
  };

  const brand = {
    mentions: [],
    momentum: [],
    designers: [],
    culturalSignals: data.aesthetics,
  };

  return finalizeBundle(
    provenance,
    signals,
    trends,
    market,
    { products: [], demandIndicators: [], opportunities: [], inventoryNarratives: [] },
    brand,
  );
}

export const pinterestNormalizer: ProviderNormalizer = {
  sourceKey: SOURCE,
  normalize(envelope, _context) {
    return normalizeFromEnvelope<PinterestIntelligenceData>(envelope, normalizePinterest);
  },
};
