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
  const knowledge = baseline.knowledge;
  const pk = baseline.productKnowledge;
  const topCount = ci.topUnits.length;
  const lowStock = pk.inventoryState.lowStock;
  const collectionCount = knowledge.collections.length;
  const productCount = knowledge.products.length;
  const withImages = knowledge.products.filter((p) => p.imageUrl).length;
  const taggedCount = knowledge.products.filter((p) => p.tags.length > 0).length;
  const tagUniverse = new Set(
    knowledge.products.flatMap((p) => p.tags).slice(0, 40),
  );

  const summary = [
    `Live · ${productCount} products · ${collectionCount} collections`,
    topCount > 0
      ? `${topCount} top sellers · ${withImages} with images`
      : `${withImages} products with images`,
    lowStock > 0
      ? `${lowStock} low-stock SKUs · ${taggedCount} tagged products`
      : `Inventory synced · ${taggedCount} tagged · ${tagUniverse.size} unique tags`,
  ];

  const trending = [
    ...ci.topUnits.slice(0, 3).map((u) => u.title),
    ...pk.bestsellerCandidates.slice(0, 2).map((p) => p.title),
  ].filter(Boolean);

  return { summary, trending: trending.slice(0, 4) };
}

export function summarizeGoogleTrends(
  data: GoogleTrendsData,
  mode: "live" | "simulated" = "live",
): {
  summary: string[];
  trending: string[];
} {
  const prefix = mode === "live" ? "Live" : "Simulated";
  const rising = data.topRising.slice(0, 3);
  const topKeyword = data.keywords[0];
  const region = topKeyword?.region ?? "DE";

  const summary = [
    `${prefix} · ${data.keywords.length} keywords · region ${region}`,
    data.seasonalityNote,
  ];

  if (mode === "simulated") {
    summary.push("Static estimates — not live Google Trends data");
  } else if (topKeyword) {
    summary.push(
      `Top: ${topKeyword.keyword} ${topKeyword.change >= 0 ? "+" : ""}${topKeyword.change}% · ${topKeyword.seasonality}`,
    );
  }

  return {
    summary,
    trending:
      rising.length > 0
        ? rising
        : data.keywords.slice(0, 3).map((k) => k.keyword),
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
