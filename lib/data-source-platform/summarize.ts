import type { MilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";
import type { AmazonIntelligenceData } from "@/services/connectors/amazon";
import type { EtsyIntelligenceData } from "@/services/connectors/etsy";
import type { DepopIntelligenceData } from "@/services/connectors/depop";
import type { GrailedIntelligenceData } from "@/services/connectors/grailed";
import type { StockXIntelligenceData } from "@/services/connectors/stockx";
import type { FashionNewsIntelligenceData } from "@/services/connectors/fashion-news";
import type { YouTubeIntelligenceData } from "@/services/connectors/youtube";
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
  } else {
    if (topKeyword) {
      summary.push(
        `Top: ${topKeyword.keyword} ${topKeyword.change >= 0 ? "+" : ""}${topKeyword.change}% · ${topKeyword.seasonality}`,
      );
    }
    summary.push(
      `Demand ${data.demandScore}/100 · direction ${data.trendDirection} · ${data.relatedQueries.length} related queries`,
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

export function summarizeDepop(
  data: DepopIntelligenceData,
  mode: "live" | "simulated" = "live",
): {
  summary: string[];
  trending: string[];
} {
  const prefix = mode === "live" ? "Live" : "Simulated";

  const summary = [
    `${prefix} · ${data.listings.length} listings · ${data.popularBrands.length} brands`,
    `${data.priceBands.length} price bands · ${data.risingStyles.length} rising styles · partner inventory only`,
  ];

  if (mode === "simulated") {
    summary.push(
      "No live Depop data — partner API credentials missing or unreachable",
    );
  } else if (data.listings[0]) {
    summary.push(
      `Top: ${data.listings[0].brand ?? data.listings[0].category} — ${data.listings[0].title}`,
    );
  }

  return {
    summary,
    trending: [
      ...data.risingStyles.slice(0, 2).map((s) => s.term),
      ...data.popularBrands.slice(0, 1).map((b) => b.term),
      ...data.streetwearKeywords.slice(0, 1).map((k) => k.term),
    ]
      .filter(Boolean)
      .slice(0, 4),
  };
}

export function summarizeStockX(
  data: StockXIntelligenceData,
  mode: "live" | "simulated" = "live",
): {
  summary: string[];
  trending: string[];
} {
  const prefix = mode === "live" ? "Live" : "Simulated";
  const withMarket = data.products.filter((p) => p.marketPrice != null).length;
  const withPremium = data.products.filter((p) => p.pricePremium != null).length;

  const summary = [
    `${prefix} · ${data.products.length} products · ${data.risingBrands.length} brands`,
    `${data.trendingSilhouettes.length} silhouettes · ${data.premiumPriceRanges.length} premium bands · ${withMarket} with market price`,
  ];

  if (mode === "simulated") {
    summary.push(
      "No live StockX data — developer API credentials missing or unreachable",
    );
  } else if (data.products[0]) {
    const top = data.products[0];
    const priceNote =
      top.marketPrice != null
        ? `market $${top.marketPrice}`
        : top.retailPrice != null
          ? `retail $${top.retailPrice}`
          : "price pending";
    summary.push(`Top: ${top.brand} — ${top.title} (${priceNote})`);
  }

  if (mode === "live" && withPremium > 0) {
    summary.push(`${withPremium} products with API-reported premium over retail`);
  }

  return {
    summary,
    trending: [
      ...data.risingBrands.slice(0, 2).map((b) => b.term),
      ...data.trendingSilhouettes.slice(0, 1).map((s) => s.term),
      ...data.colorwayTrends.slice(0, 1).map((c) => c.term),
    ]
      .filter(Boolean)
      .slice(0, 4),
  };
}

export function summarizeGrailed(
  data: GrailedIntelligenceData,
  mode: "live" | "simulated" = "live",
): {
  summary: string[];
  trending: string[];
} {
  const prefix = mode === "live" ? "Live" : "Simulated";
  const withDemand = data.listings.filter((l) => l.demandProxy != null).length;

  const summary = [
    `${prefix} · ${data.listings.length} listings · ${data.risingDesigners.length} designers`,
    `${data.archiveFashionSignals.length} archive signals · ${data.luxuryStreetwearSignals.length} luxury streetwear · ${data.designerPriceBands.length} price bands`,
  ];

  if (mode === "simulated") {
    summary.push(
      "No live Grailed data — no open public API; partner credentials missing or unreachable",
    );
  } else if (data.listings[0]) {
    const top = data.listings[0];
    summary.push(
      `Top: ${top.designer ?? top.brand ?? top.category} — ${top.title} (${top.currency}${top.price})`,
    );
  }

  if (mode === "live" && withDemand > 0) {
    summary.push(`${withDemand} listings with API-reported demand proxies`);
  }

  return {
    summary,
    trending: [
      ...data.risingDesigners.slice(0, 2).map((d) => d.term),
      ...data.archiveFashionSignals.slice(0, 1).map((s) => s.term),
      ...data.luxuryStreetwearSignals.slice(0, 1).map((s) => s.term),
    ]
      .filter(Boolean)
      .slice(0, 4),
  };
}

export function summarizeYouTube(
  data: YouTubeIntelligenceData,
  mode: "live" | "simulated" = "live",
): {
  summary: string[];
  trending: string[];
} {
  const prefix = mode === "live" ? "Live" : "Simulated";

  const summary = [
    `${prefix} · ${data.videos.length} videos · ${data.searchCategories.length} topic categories`,
    `${data.brandMentions.length} brands · ${data.creatorRanking.length} creators · ${data.avgEngagement}% avg engagement`,
  ];

  if (mode === "simulated") {
    summary.push("No live YouTube data — credentials missing or API unreachable");
  } else if (data.videos[0]) {
    summary.push(
      `Top: ${data.videos[0].channel} — ${data.videos[0].title} (${data.avgViews.toLocaleString("de-DE")} avg views)`,
    );
  }

  return {
    summary,
    trending: [
      ...data.fastestGrowingTopics.slice(0, 2),
      ...data.trendingTopics.slice(0, 1).map((t) => t.term),
      ...data.videos.slice(0, 1).map((v) => v.title),
    ]
      .filter(Boolean)
      .slice(0, 4),
  };
}

export function summarizeFashionNews(
  data: FashionNewsIntelligenceData,
  mode: "live" | "simulated" = "live",
): {
  summary: string[];
  trending: string[];
} {
  const prefix = mode === "live" ? "Live" : "Simulated";

  const summary = [
    `${prefix} · ${data.articles.length} articles · ${data.sources.length} sources`,
    `${data.keywords.length} keyword · ${data.brandMentions.length} brand · ${data.emergingThemes.length} emerging-theme signals`,
  ];

  if (mode === "simulated") {
    summary.push(
      "No live fashion news — no feed configured or feeds unreachable",
    );
  } else if (data.articles[0]) {
    summary.push(`Top: ${data.articles[0].source} — ${data.articles[0].title}`);
  }

  return {
    summary,
    trending: [
      ...data.headlines.slice(0, 2),
      ...data.repeatedTopics.slice(0, 1),
      ...data.emergingThemes.slice(0, 1),
    ]
      .filter(Boolean)
      .slice(0, 4),
  };
}

export function summarizeReddit(
  data: RedditIntelligenceData,
  mode: "live" | "simulated" = "live",
): {
  summary: string[];
  trending: string[];
} {
  const prefix = mode === "live" ? "Live" : "Simulated";
  const engagement = data.engagement;

  const summary = [
    `${prefix} · ${data.subreddits.length} communities · ${data.threads.length} discussions`,
    `${data.brandMentions.length} brand · ${data.colorMentions.length} color · ${data.silhouetteMentions.length} silhouette signals`,
  ];

  if (mode === "simulated") {
    summary.push("No live Reddit data — credentials missing or API unreachable");
  } else if (engagement.sampleSize > 0) {
    summary.push(
      `Avg ${engagement.avgUpvotes} upvotes · ${engagement.avgComments} comments · velocity ${engagement.commentVelocity}/h across ${engagement.sampleSize} posts`,
    );
  }

  return {
    summary,
    trending: [
      ...data.trends.slice(0, 2),
      ...data.threads.slice(0, 2).map((t) => `r/${t.subreddit}: ${t.topic}`),
    ].slice(0, 4),
  };
}
