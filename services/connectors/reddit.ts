import {
  fetchLiveReddit,
  isRedditLiveConfigured,
} from "./clients/reddit-client";
import {
  aggregateConnectorScores,
  computeConfidence,
  normalizeSignals,
} from "./signal-utils";
import type { ConnectorInput, IntelligenceSignal, SourceIntelligence } from "./types";

export interface RedditThreadSignal {
  subreddit: string;
  topic: string;
  sentiment: "positive" | "neutral" | "negative";
  insight: string;
  upvotes: number;
  /** Comment count on the source thread (0 when unavailable). */
  comments?: number;
  /** Reddit link flair, when the post carries one. */
  flair?: string | null;
  /** Which listing this thread was collected from. */
  sort?: "hot" | "top" | "rising";
  /** Time window the thread was collected under (top listings only). */
  timeframe?: "24h" | "7d" | "30d" | "all";
}

/** A term aggregated across the collected community sample with its frequency. */
export interface RedditMention {
  term: string;
  count: number;
}

/** Aggregate engagement math derived from the collected sample only. */
export interface RedditEngagement {
  avgUpvotes: number;
  avgComments: number;
  /** Approx comments per hour, averaged across dated posts. */
  commentVelocity: number;
  /** Number of unique posts the aggregates were computed from. */
  sampleSize: number;
}

export interface RedditIntelligenceData {
  subreddits: string[];
  /** Sort + timeframe combinations that were actually collected. */
  collections?: string[];
  purchaseBehavior: string[];
  wishes: string[];
  problems: string[];
  recommendations: string[];
  trends: string[];
  threads: RedditThreadSignal[];
  // Phase 4.6 structured intelligence (empty in simulated/offline mode).
  flairs: RedditMention[];
  keywords: RedditMention[];
  brandMentions: RedditMention[];
  colorMentions: RedditMention[];
  materialMentions: RedditMention[];
  silhouetteMentions: RedditMention[];
  graphicTrends: RedditMention[];
  aesthetics: RedditMention[];
  /** Highest-upvoted post titles (most upvoted ideas). */
  topIdeas: string[];
  engagement: RedditEngagement;
}

/**
 * Honest empty payload. Reddit never fabricates community data — when
 * credentials are missing or the API fails we return this shape so the UI can
 * report Simulated/Offline without inventing engagement or threads.
 */
export const EMPTY_REDDIT_DATA: RedditIntelligenceData = {
  subreddits: [],
  collections: [],
  purchaseBehavior: [],
  wishes: [],
  problems: [],
  recommendations: [],
  trends: [],
  threads: [],
  flairs: [],
  keywords: [],
  brandMentions: [],
  colorMentions: [],
  materialMentions: [],
  silhouetteMentions: [],
  graphicTrends: [],
  aesthetics: [],
  topIdeas: [],
  engagement: {
    avgUpvotes: 0,
    avgComments: 0,
    commentVelocity: 0,
    sampleSize: 0,
  },
};

function toSignals(data: RedditIntelligenceData): IntelligenceSignal[] {
  const threadSignals = data.threads.map((t) => ({
    id: `reddit-${t.subreddit}-${t.topic.slice(0, 20).replace(/\s+/g, "-")}`,
    category: "social" as const,
    source: "reddit" as const,
    label: `r/${t.subreddit}`,
    message: t.insight,
    score: Math.min(100, Math.round(t.upvotes / 15)),
    direction: t.sentiment === "negative" ? ("down" as const) : ("up" as const),
    tags: [t.subreddit, t.sentiment, "buying-behavior"],
  }));

  const complaintSignals = data.problems.slice(0, 2).map((problem, i) => ({
    id: `reddit-complaint-${i}`,
    category: "consumer" as const,
    source: "reddit" as const,
    label: "Community Complaint",
    message: problem,
    score: 62 - i * 4,
    direction: "down" as const,
    tags: ["complaint", "consumer"],
  }));

  const demandSignals = data.recommendations.slice(0, 2).map((rec, i) => ({
    id: `reddit-demand-${i}`,
    category: "consumer" as const,
    source: "reddit" as const,
    label: "Product Demand",
    message: rec,
    score: 72 + i * 4,
    direction: "up" as const,
    tags: ["demand", "product"],
  }));

  const trendSignals = data.trends.slice(0, 3).map((trend, i) => ({
    id: `reddit-trend-${i}`,
    category: "consumer" as const,
    source: "reddit" as const,
    label: "Community Trend",
    message: trend,
    score: 70 + i * 5,
    direction: "up" as const,
    tags: ["trend"],
  }));

  const aestheticSignals = data.aesthetics.slice(0, 2).map((mention, i) => ({
    id: `reddit-aesthetic-${i}`,
    category: "consumer" as const,
    source: "reddit" as const,
    label: "Aesthetic",
    message: `${mention.term} (${mention.count} mentions)`,
    score: 66 + i * 4,
    direction: "up" as const,
    tags: ["trend", "aesthetic"],
  }));

  return [
    ...threadSignals,
    ...complaintSignals,
    ...demandSignals,
    ...trendSignals,
    ...aestheticSignals,
  ];
}

function buildResult(
  data: RedditIntelligenceData,
  mode: "live" | "simulated",
  simulatedReason?: string,
): SourceIntelligence<RedditIntelligenceData> {
  const rawSignals = toSignals(data);
  const confidence = computeConfidence({
    mode,
    sampleSize: data.threads.length + data.trends.length,
    freshness: mode === "live" ? 0.95 : 0.5,
    dataQuality: mode === "live" ? 0.92 : 0.4,
  });
  const signals = normalizeSignals(rawSignals, confidence);
  const scores = aggregateConnectorScores(
    signals,
    { social: 0.7, demand: 0.3 },
    confidence,
  );

  return {
    source: "reddit",
    mode,
    loadedAt: new Date().toISOString(),
    signals,
    data,
    simulatedReason,
    scores,
  };
}

/** Scan Reddit streetwear communities for consumer intelligence. */
export async function scanReddit(
  _input: ConnectorInput = {},
): Promise<SourceIntelligence<RedditIntelligenceData>> {
  if (isRedditLiveConfigured()) {
    try {
      const data = await fetchLiveReddit();
      return buildResult(data, "live");
    } catch (error) {
      const reason =
        error instanceof Error
          ? `Reddit API failed (${error.message}) — no data fabricated`
          : "Reddit API failed — no data fabricated";
      return buildResult(EMPTY_REDDIT_DATA, "simulated", reason);
    }
  }

  return buildResult(
    EMPTY_REDDIT_DATA,
    "simulated",
    "REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not set — no Reddit data is returned without credentials",
  );
}
