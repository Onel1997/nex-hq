import {
  fetchLiveFashionNews,
  isFashionNewsLiveConfigured,
} from "./clients/fashion-news-client";
import {
  aggregateConnectorScores,
  computeConfidence,
  normalizeSignals,
} from "./signal-utils";
import type { ConnectorInput, IntelligenceSignal, SourceIntelligence } from "./types";

export interface FashionNewsArticle {
  title: string;
  source: string;
  link: string;
  /** ISO publication date, or null when the feed omits/malforms it. */
  publishedAt: string | null;
  categories: string[];
}

/** A term aggregated across the collected articles with its frequency. */
export interface FashionNewsMention {
  term: string;
  count: number;
}

export interface FashionNewsIntelligenceData {
  articles: FashionNewsArticle[];
  sources: string[];
  headlines: string[];
  keywords: FashionNewsMention[];
  brandMentions: FashionNewsMention[];
  colorSignals: FashionNewsMention[];
  materialSignals: FashionNewsMention[];
  silhouetteSignals: FashionNewsMention[];
  categories: FashionNewsMention[];
  /** Topics that appear across multiple articles. */
  repeatedTopics: string[];
  /** Themes concentrated in the most recent articles. */
  emergingThemes: string[];
}

/**
 * Honest empty payload. Fashion News never fabricates articles — when no feed
 * is configured or every feed is unreachable we return this shape so the UI can
 * report Coming Soon / Offline without inventing headlines.
 */
export const EMPTY_FASHION_NEWS_DATA: FashionNewsIntelligenceData = {
  articles: [],
  sources: [],
  headlines: [],
  keywords: [],
  brandMentions: [],
  colorSignals: [],
  materialSignals: [],
  silhouetteSignals: [],
  categories: [],
  repeatedTopics: [],
  emergingThemes: [],
};

function toSignals(data: FashionNewsIntelligenceData): IntelligenceSignal[] {
  const headlineSignals = data.articles.slice(0, 6).map((article, index) => ({
    id: `news-headline-${index}`,
    category: "trend" as const,
    source: "fashion_news" as const,
    label: article.source,
    message: article.title,
    score: 74 - index * 3,
    direction: "up" as const,
    tags: ["headline", ...article.categories.slice(0, 2)],
  }));

  const topicSignals = data.repeatedTopics.slice(0, 3).map((topic, index) => ({
    id: `news-topic-${index}`,
    category: "trend" as const,
    source: "fashion_news" as const,
    label: "Repeated Topic",
    message: `${topic} recurring across coverage`,
    score: 70 + index * 4,
    direction: "up" as const,
    tags: ["trend", "topic"],
  }));

  const themeSignals = data.emergingThemes.slice(0, 3).map((theme, index) => ({
    id: `news-theme-${index}`,
    category: "consumer" as const,
    source: "fashion_news" as const,
    label: "Emerging Theme",
    message: theme,
    score: 66 + index * 4,
    direction: "up" as const,
    tags: ["trend", "emerging"],
  }));

  const brandSignals = data.brandMentions.slice(0, 3).map((mention, index) => ({
    id: `news-brand-${index}`,
    category: "competitor" as const,
    source: "fashion_news" as const,
    label: "Brand in the News",
    message: `${mention.term} (${mention.count} mentions)`,
    score: 62 + index * 4,
    direction: "up" as const,
    tags: ["brand", "competitor"],
  }));

  return [...headlineSignals, ...topicSignals, ...themeSignals, ...brandSignals];
}

function buildResult(
  data: FashionNewsIntelligenceData,
  mode: "live" | "simulated",
  simulatedReason?: string,
): SourceIntelligence<FashionNewsIntelligenceData> {
  const rawSignals = toSignals(data);
  const sampleSize =
    data.articles.length + data.keywords.length + data.repeatedTopics.length;
  const confidence = computeConfidence({
    mode,
    sampleSize,
    freshness: mode === "live" ? 0.8 : 0.4,
    dataQuality: mode === "live" ? 0.82 : 0.4,
  });
  const signals = normalizeSignals(rawSignals, confidence);
  const scores = aggregateConnectorScores(
    signals,
    { trend: 0.6, demand: 0.4 },
    confidence,
  );

  return {
    source: "fashion_news",
    mode,
    loadedAt: new Date().toISOString(),
    signals,
    data,
    simulatedReason,
    scores,
  };
}

/** Scan configured (or default public) fashion RSS feeds for news intelligence. */
export async function scanFashionNews(
  _input: ConnectorInput = {},
): Promise<SourceIntelligence<FashionNewsIntelligenceData>> {
  if (isFashionNewsLiveConfigured()) {
    try {
      const data = await fetchLiveFashionNews();
      return buildResult(data, "live");
    } catch (error) {
      const reason =
        error instanceof Error
          ? `Fashion News feeds unreachable (${error.message}) — no data fabricated`
          : "Fashion News feeds unreachable — no data fabricated";
      return buildResult(EMPTY_FASHION_NEWS_DATA, "simulated", reason);
    }
  }

  return buildResult(
    EMPTY_FASHION_NEWS_DATA,
    "simulated",
    "No fashion RSS feed configured — set FASHION_NEWS_RSS_URL or FASHION_NEWS_RSS_URLS; no news is fabricated without a feed",
  );
}
