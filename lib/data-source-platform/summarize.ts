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

export function summarizePinterest(
  data: PinterestIntelligenceData,
  mode: "live" | "simulated" = "live",
): {
  summary: string[];
  trending: string[];
} {
  const prefix = mode === "live" ? "Live" : "Simulated";
  const risingBoards = data.boards
    .filter((board) => board.trend === "rising")
    .slice(0, 3);

  const summary = [
    `${prefix} · ${data.outfitTrends.length} trending keywords · ${data.boards.length} boards`,
    `${data.aesthetics.length} aesthetics · ${data.colorWorlds.length} color worlds`,
  ];

  if (mode === "simulated") {
    summary.push("No live Pinterest data — credentials missing or API unreachable");
  } else if (data.outfitTrends[0]) {
    summary.push(`Top trend: ${data.outfitTrends[0]}`);
  }

  return {
    summary,
    trending: [
      ...data.outfitTrends.slice(0, 2),
      ...risingBoards.map((board) => board.aesthetic),
      ...data.capsuleTrends.slice(0, 1),
    ].slice(0, 4),
  };
}

export function summarizeTikTok(
  data: TikTokIntelligenceData,
  mode: "live" | "simulated" = "live",
): {
  summary: string[];
  trending: string[];
} {
  const prefix = mode === "live" ? "Live" : "Simulated";
  const top = [...data.viralTrends]
    .sort((a, b) => b.views - a.views)
    .slice(0, 3);

  const summary = [
    `${prefix} · ${data.viralTrends.length} hashtags · ${data.hashtags.length} tags tracked`,
    `${data.silhouettes.length} silhouettes · ${data.colors.length} color signals`,
  ];

  if (mode === "simulated") {
    summary.push("No live TikTok data — credentials missing or API unreachable");
  } else if (top[0]) {
    summary.push(`Top: ${top[0].hashtag} · ${top[0].insight}`);
  }

  return {
    summary,
    trending:
      top.length > 0
        ? top.map((trend) => trend.insight)
        : data.hashtags.slice(0, 3),
  };
}

export function summarizeAmazon(
  data: AmazonIntelligenceData,
  mode: "live" | "simulated" = "live",
): {
  summary: string[];
  trending: string[];
} {
  const prefix = mode === "live" ? "Live" : "Simulated";
  const ranked = data.bestsellers.filter((bestseller) => bestseller.rank > 0);

  const summary = [
    `${prefix} · ${data.bestsellers.length} products · ${data.categories.length} categories`,
    ranked.length > 0
      ? `${ranked.length} with sales-rank · rank is a proxy, not sales`
      : `${data.demandSignals.length} demand signals · no sales data via API`,
  ];

  if (mode === "simulated") {
    summary.push("No live Amazon data — credentials missing or API unreachable");
  } else if (data.bestsellers[0]) {
    summary.push(`Top: ${data.bestsellers[0].title} (${data.bestsellers[0].priceRange})`);
  }

  return {
    summary,
    trending: data.bestsellers.slice(0, 4).map((bestseller) => bestseller.title),
  };
}

export function summarizeEtsy(
  data: EtsyIntelligenceData,
  mode: "live" | "simulated" = "live",
): {
  summary: string[];
  trending: string[];
} {
  const prefix = mode === "live" ? "Live" : "Simulated";
  const summary = [
    `${prefix} · ${data.bestsellers.length} popular listings · ${data.keywords.length} keywords`,
    `${data.priceRanges.length} price bands · favorites-ranked (no true sales data)`,
  ];

  if (mode === "simulated") {
    summary.push("No live Etsy data — credentials missing or API unreachable");
  } else if (data.bestsellers[0]) {
    summary.push(
      `Top: ${data.bestsellers[0].title} (${data.bestsellers[0].priceRange})`,
    );
  }

  return {
    summary,
    trending: [
      ...data.bestsellers.slice(0, 2).map((bestseller) => bestseller.title),
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
