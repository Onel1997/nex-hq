import type { MilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import type { AmazonIntelligenceData } from "@/services/connectors/amazon";
import type { EtsyIntelligenceData } from "@/services/connectors/etsy";
import type { GoogleTrendsData } from "@/services/connectors/google-trends";
import type { PinterestIntelligenceData } from "@/services/connectors/pinterest";
import type { RedditIntelligenceData } from "@/services/connectors/reddit";
import type { TikTokIntelligenceData } from "@/services/connectors/tiktok";

export function summarizeShopify(baseline: MilaeneCommerceBaseline): {
  summary: string[];
  trending: string[];
} {
  const ci = baseline.commerceIntelligence;
  const topCount = ci.topUnits.length;
  const lowStock = baseline.productKnowledge.inventoryState.lowStock;
  const collectionCount = baseline.knowledge.collections.length;
  const productCount = baseline.knowledge.products.length;

  const summary = [
    `${productCount} products · ${collectionCount} collections`,
    topCount > 0
      ? `${topCount} top sellers tracked`
      : "Catalog intelligence active",
    lowStock > 0 ? `${lowStock} low-stock SKUs flagged` : "Inventory synced",
  ];

  const trending = [
    ...ci.topUnits.slice(0, 3).map((u) => u.title),
    ...baseline.productKnowledge.bestsellerCandidates
      .slice(0, 2)
      .map((p) => p.title),
  ].filter(Boolean);

  return { summary, trending: trending.slice(0, 4) };
}

export function summarizeGoogleTrends(data: GoogleTrendsData): {
  summary: string[];
  trending: string[];
} {
  const rising = data.topRising.slice(0, 3);
  return {
    summary: [
      `${data.keywords.length} keywords tracked`,
      data.seasonalityNote,
    ],
    trending: rising.length > 0 ? rising : data.keywords.slice(0, 3).map((k) => k.keyword),
  };
}

export function summarizePinterest(data: PinterestIntelligenceData): {
  summary: string[];
  trending: string[];
} {
  const risingBoards = data.boards
    .filter((b) => b.trend === "rising")
    .slice(0, 3);
  return {
    summary: [
      `${data.aesthetics.length} aesthetics monitored`,
      `${data.colorWorlds.length} color worlds active`,
    ],
    trending: [
      ...risingBoards.map((b) => b.aesthetic),
      ...data.capsuleTrends.slice(0, 2),
    ].slice(0, 4),
  };
}

export function summarizeTikTok(data: TikTokIntelligenceData): {
  summary: string[];
  trending: string[];
} {
  const top = data.viralTrends
    .sort((a, b) => b.change - a.change)
    .slice(0, 3);
  return {
    summary: [
      `${data.hashtags.length} hashtags tracked`,
      `${data.silhouettes.length} silhouette trends`,
    ],
    trending: top.map((t) => t.insight),
  };
}

export function summarizeAmazon(data: AmazonIntelligenceData): {
  summary: string[];
  trending: string[];
} {
  return {
    summary: [
      `${data.bestsellers.length} bestsellers scanned`,
      `${data.categories.length} categories tracked`,
    ],
    trending: data.bestsellers.slice(0, 4).map((b) => b.title),
  };
}

export function summarizeEtsy(data: EtsyIntelligenceData): {
  summary: string[];
  trending: string[];
} {
  return {
    summary: [
      `${data.bestsellers.length} bestsellers found`,
      `${data.keywords.length} keywords tracked`,
    ],
    trending: [
      ...data.bestsellers.slice(0, 2).map((b) => b.title),
      ...data.keywords.slice(0, 2),
    ].slice(0, 4),
  };
}

export function summarizeReddit(data: RedditIntelligenceData): {
  summary: string[];
  trending: string[];
} {
  return {
    summary: [
      `${data.subreddits.length} communities monitored`,
      `${data.threads.length} active discussions`,
    ],
    trending: [
      ...data.trends.slice(0, 2),
      ...data.threads.slice(0, 2).map((t) => `r/${t.subreddit}: ${t.topic}`),
    ].slice(0, 4),
  };
}
