import {
  fetchLiveYouTube,
  isYouTubeLiveConfigured,
} from "./clients/youtube-client";
import {
  aggregateConnectorScores,
  computeConfidence,
  normalizeSignals,
} from "./signal-utils";
import type { ConnectorInput, IntelligenceSignal, SourceIntelligence } from "./types";

export interface YouTubeVideo {
  videoId: string;
  title: string;
  channel: string;
  channelId: string;
  publishedAt: string;
  views: number;
  likes: number;
  comments: number;
  duration: string;
  thumbnailUrl: string;
  tags: string[];
  /** Curated search topic this video was collected under. */
  category: string;
  description: string;
  language: string | null;
}

export interface YouTubeMention {
  term: string;
  count: number;
}

export interface YouTubeCreatorRank {
  channel: string;
  channelId: string;
  videoCount: number;
  totalViews: number;
  avgViews: number;
  avgEngagement: number;
}

export interface YouTubeTrendMetric {
  topic: string;
  momentum: number;
  velocity: number;
  growth: number;
  consistency: number;
  saturation: number;
  competition: number;
  longevity: number;
  seasonality: string;
}

export interface YouTubeIntelligenceData {
  videos: YouTubeVideo[];
  searchCategories: string[];
  trendingTopics: YouTubeMention[];
  discussedStyles: YouTubeMention[];
  brandMentions: YouTubeMention[];
  colorMentions: YouTubeMention[];
  materialMentions: YouTubeMention[];
  fitMentions: YouTubeMention[];
  graphicMentions: YouTubeMention[];
  keywords: YouTubeMention[];
  fastestGrowingTopics: string[];
  creatorRanking: YouTubeCreatorRank[];
  uploadFrequency: string;
  avgViews: number;
  avgEngagement: number;
  repeatedTitles: string[];
  repeatedThumbnailPatterns: string[];
  fashionVocabulary: YouTubeMention[];
  productTypes: YouTubeMention[];
  discussedCollections: YouTubeMention[];
  trendMetrics: YouTubeTrendMetric[];
}

export const EMPTY_YOUTUBE_DATA: YouTubeIntelligenceData = {
  videos: [],
  searchCategories: [],
  trendingTopics: [],
  discussedStyles: [],
  brandMentions: [],
  colorMentions: [],
  materialMentions: [],
  fitMentions: [],
  graphicMentions: [],
  keywords: [],
  fastestGrowingTopics: [],
  creatorRanking: [],
  uploadFrequency: "—",
  avgViews: 0,
  avgEngagement: 0,
  repeatedTitles: [],
  repeatedThumbnailPatterns: [],
  fashionVocabulary: [],
  productTypes: [],
  discussedCollections: [],
  trendMetrics: [],
};

function toSignals(data: YouTubeIntelligenceData): IntelligenceSignal[] {
  const videoSignals = data.videos.slice(0, 6).map((video, index) => ({
    id: `yt-${video.videoId}`,
    category: "social" as const,
    source: "youtube" as const,
    label: video.channel,
    message: `${video.title} · ${video.views.toLocaleString("de-DE")} views`,
    score: Math.min(100, Math.round(Math.log10(Math.max(10, video.views)) * 12)),
    direction: "up" as const,
    tags: [video.category, "video"],
  }));

  const topicSignals = data.trendingTopics.slice(0, 3).map((mention, index) => ({
    id: `yt-topic-${index}`,
    category: "trend" as const,
    source: "youtube" as const,
    label: "Trending Topic",
    message: `${mention.term} (${mention.count} videos)`,
    score: 72 + index * 4,
    direction: "up" as const,
    tags: ["trend", "topic"],
  }));

  const brandSignals = data.brandMentions.slice(0, 3).map((mention, index) => ({
    id: `yt-brand-${index}`,
    category: "competitor" as const,
    source: "youtube" as const,
    label: "Brand on YouTube",
    message: `${mention.term} (${mention.count} mentions)`,
    score: 64 + index * 4,
    direction: "up" as const,
    tags: ["brand", "competitor"],
  }));

  const growthSignals = data.fastestGrowingTopics
    .slice(0, 2)
    .map((topic, index) => ({
      id: `yt-growth-${index}`,
      category: "trend" as const,
      source: "youtube" as const,
      label: "Fastest Growing",
      message: topic,
      score: 78 - index * 4,
      direction: "up" as const,
      tags: ["growth", "momentum"],
    }));

  const creatorSignals = data.creatorRanking.slice(0, 2).map((creator, index) => ({
    id: `yt-creator-${index}`,
    category: "social" as const,
    source: "youtube" as const,
    label: "Top Creator",
    message: `${creator.channel} · ${creator.avgViews.toLocaleString("de-DE")} avg views`,
    score: 68 + index * 4,
    direction: "up" as const,
    tags: ["creator", "channel"],
  }));

  return [
    ...videoSignals,
    ...topicSignals,
    ...brandSignals,
    ...growthSignals,
    ...creatorSignals,
  ];
}

function buildResult(
  data: YouTubeIntelligenceData,
  mode: "live" | "simulated",
  simulatedReason?: string,
): SourceIntelligence<YouTubeIntelligenceData> {
  const rawSignals = toSignals(data);
  const sampleSize =
    data.videos.length + data.trendingTopics.length + data.brandMentions.length;
  const confidence = computeConfidence({
    mode,
    sampleSize,
    freshness: mode === "live" ? 0.88 : 0.4,
    dataQuality: mode === "live" ? 0.86 : 0.4,
  });
  const signals = normalizeSignals(rawSignals, confidence);
  const scores = aggregateConnectorScores(
    signals,
    { social: 0.55, trend: 0.45 },
    confidence,
  );

  return {
    source: "youtube",
    mode,
    loadedAt: new Date().toISOString(),
    signals,
    data,
    simulatedReason,
    scores,
  };
}

/** Scan YouTube fashion video intelligence via the official Data API v3. */
export async function scanYouTube(
  _input: ConnectorInput = {},
): Promise<SourceIntelligence<YouTubeIntelligenceData>> {
  if (isYouTubeLiveConfigured()) {
    try {
      const data = await fetchLiveYouTube();
      return buildResult(data, "live");
    } catch (error) {
      const reason =
        error instanceof Error
          ? `YouTube API failed (${error.message}) — no data fabricated`
          : "YouTube API failed — no data fabricated";
      return buildResult(EMPTY_YOUTUBE_DATA, "simulated", reason);
    }
  }

  return buildResult(
    EMPTY_YOUTUBE_DATA,
    "simulated",
    "YOUTUBE_API_KEY not set — no YouTube data is returned without credentials",
  );
}
