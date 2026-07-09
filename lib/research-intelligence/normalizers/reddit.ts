import type { RedditIntelligenceData } from "@/services/connectors/reddit";
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

const SOURCE = asProviderSourceKey("reddit");

function sentimentDirection(
  sentiment: RedditIntelligenceData["threads"][number]["sentiment"],
): import("../types/signals").SignalDirection {
  if (sentiment === "positive") return "up";
  if (sentiment === "negative") return "down";
  return "stable";
}

function normalizeReddit(
  data: RedditIntelligenceData,
  provenance: import("../types/provider-source").ProviderProvenance,
) {
  const signals = [
    ...data.threads.map((thread, index) =>
      buildSignal({
        id: signalId(SOURCE, `thread-${index}`),
        category: "consumer",
        label: thread.topic,
        headline: `${thread.subreddit} · ${thread.insight}`,
        value: String(thread.upvotes),
        direction: sentimentDirection(thread.sentiment),
        entities: [
          entity("topic", thread.topic),
          entity("keyword", thread.subreddit),
        ],
        tags: [
          thread.subreddit,
          thread.sentiment,
          thread.sort ?? "hot",
        ].filter(Boolean) as string[],
        provenance,
        rawReference: thread.subreddit,
      }),
    ),
    ...data.topIdeas.map((idea, index) =>
      buildSignal({
        id: signalId(SOURCE, `idea-${index}`),
        category: "cultural",
        label: idea,
        headline: idea,
        direction: "up",
        entities: [entity("topic", idea)],
        tags: ["community", "top-idea"],
        provenance,
      }),
    ),
  ];

  const trends = {
    rising: mentionClusters(data.keywords, "keyword", provenance, SOURCE),
    stable: mentionClusters(data.aesthetics, "aesthetic", provenance, SOURCE),
    declining: [],
    emerging: mentionClusters(
      data.trends.map((term) => ({ term, count: 1 })),
      "topic",
      provenance,
      SOURCE,
    ),
    opportunities: data.recommendations,
  };

  if (data.silhouetteMentions.length > 0) {
    trends.rising.push(
      ...mentionClusters(data.silhouetteMentions, "silhouette", provenance, SOURCE),
    );
  }

  const market = {
    segments: data.subreddits.map((subreddit, index) => ({
      id: signalId(SOURCE, `sub-${index}`),
      label: subreddit,
      channel: "social_commerce" as const,
      categories: [subreddit],
      provenance,
    })),
    movements: [],
    priceBands: [],
    demandNarratives: data.purchaseBehavior,
  };

  const commercial = {
    products: [],
    demandIndicators: [
      ...data.wishes.map((wish, index) => ({
        id: signalId(SOURCE, `wish-${index}`),
        label: wish,
        narrative: wish,
        strength: "moderate" as const,
        provenance,
      })),
      ...data.problems.map((problem, index) => ({
        id: signalId(SOURCE, `problem-${index}`),
        label: problem,
        narrative: problem,
        strength: "weak" as const,
        provenance,
      })),
    ],
    opportunities: data.recommendations.map((rec, index) => ({
      id: signalId(SOURCE, `rec-${index}`),
      title: rec,
      rationale: rec,
      tags: ["community-recommendation"],
      provenance,
    })),
    inventoryNarratives: data.purchaseBehavior,
  };

  const brand = {
    mentions: mapBrandMentions(data.brandMentions, provenance, SOURCE, "mention"),
    momentum: data.brandMentions.slice(0, 5).map((mention, index) => ({
      id: signalId(SOURCE, `momentum-${index}`),
      name: mention.term,
      narrative: `${mention.count} community mentions`,
      signalType: "streetwear" as const,
      provenance,
    })),
    designers: [],
    culturalSignals: [
      ...data.colorMentions.map((m) => m.term),
      ...data.materialMentions.map((m) => m.term),
      ...data.graphicTrends.map((m) => m.term),
    ],
  };

  return finalizeBundle(provenance, signals, trends, market, commercial, brand);
}

export const redditNormalizer: ProviderNormalizer = {
  sourceKey: SOURCE,
  normalize(envelope, _context) {
    return normalizeFromEnvelope<RedditIntelligenceData>(envelope, normalizeReddit);
  },
};
