import type { YouTubeIntelligenceData } from "@/services/connectors/youtube";
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

const SOURCE = asProviderSourceKey("youtube");

function normalizeYouTube(
  data: YouTubeIntelligenceData,
  provenance: import("../types/provider-source").ProviderProvenance,
) {
  const signals = [
    ...data.videos.slice(0, 10).map((video) =>
      buildSignal({
        id: signalId(SOURCE, video.videoId),
        category: "social",
        label: video.title,
        headline: `${video.channel} · ${video.views.toLocaleString("en-US")} views`,
        value: String(video.views),
        direction: "up",
        entities: [
          entity("creator", video.channel, video.channelId),
          entity("topic", video.category),
        ],
        tags: ["video", video.category, ...video.tags.slice(0, 3)],
        provenance,
        observedAt: video.publishedAt,
        rawReference: video.videoId,
      }),
    ),
    ...data.fastestGrowingTopics.map((topic, index) =>
      buildSignal({
        id: signalId(SOURCE, `growing-${index}`),
        category: "trend",
        label: topic,
        headline: topic,
        direction: "emerging",
        entities: [entity("topic", topic)],
        tags: ["fast-growing"],
        provenance,
      }),
    ),
  ];

  const trends = {
    rising: mentionClusters(data.trendingTopics, "topic", provenance, SOURCE),
    stable: mentionClusters(data.discussedStyles, "aesthetic", provenance, SOURCE),
    declining: [],
    emerging: mentionClusters(
      data.fastestGrowingTopics.map((topic) => ({ term: topic, count: 1 })),
      "topic",
      provenance,
      SOURCE,
    ),
    opportunities: data.repeatedTitles.slice(0, 6),
  };

  const market = {
    segments: data.searchCategories.map((category, index) => ({
      id: signalId(SOURCE, `category-${index}`),
      label: category,
      channel: "social_commerce" as const,
      categories: [category],
      provenance,
    })),
    movements: [],
    priceBands: [],
    demandNarratives: [
      `Avg views ${data.avgViews.toLocaleString("en-US")}`,
      `Avg engagement ${data.avgEngagement}%`,
      data.uploadFrequency,
    ].filter(Boolean),
  };

  const commercial = {
    products: data.productTypes.map((item, index) => ({
      id: signalId(SOURCE, `ptype-${index}`),
      title: item.term,
      category: item.term,
      provenance,
    })),
    demandIndicators: data.trendMetrics.map((metric, index) => ({
      id: signalId(SOURCE, `metric-${index}`),
      label: metric.topic,
      narrative: `momentum ${metric.momentum} · velocity ${metric.velocity} · growth ${metric.growth}`,
      strength: "moderate" as const,
      provenance,
    })),
    opportunities: [],
    inventoryNarratives: data.repeatedThumbnailPatterns,
  };

  const brand = {
    mentions: mapBrandMentions(data.brandMentions, provenance, SOURCE, "mention"),
    momentum: data.creatorRanking.slice(0, 5).map((creator, index) => ({
      id: signalId(SOURCE, `creator-${index}`),
      name: creator.channel,
      narrative: `${creator.videoCount} videos · ${creator.totalViews.toLocaleString("en-US")} total views`,
      signalType: "creator" as const,
      provenance,
    })),
    designers: [],
    culturalSignals: [
      ...data.colorMentions.map((m) => m.term),
      ...data.materialMentions.map((m) => m.term),
      ...data.fitMentions.map((m) => m.term),
      ...data.graphicMentions.map((m) => m.term),
    ],
  };

  return finalizeBundle(provenance, signals, trends, market, commercial, brand);
}

export const youtubeNormalizer: ProviderNormalizer = {
  sourceKey: SOURCE,
  normalize(envelope, _context) {
    return normalizeFromEnvelope<YouTubeIntelligenceData>(envelope, normalizeYouTube);
  },
};
