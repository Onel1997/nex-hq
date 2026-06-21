import "server-only";

import type {
  CommerceLabCategoryIntelligence,
  CommerceLabCategoryRow,
  CommerceLabInsight,
  CommerceLabPayload,
  CommerceLabProductIntelligence,
  CommerceLabProductRow,
  CommerceLabRevenueIntelligence,
  CommerceLabSeasonalIntelligence,
  CommerceLabSeasonRow,
  CommerceLabSeasonSummary,
} from "@/lib/commerce/commerce-lab-types";
import type { HistoricalIntelligence } from "@/lib/commerce/historical-intelligence-types";
import type { CommerceIntelligence } from "@/lib/shopify/commerce-intelligence";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const SEASONS: Array<{ name: string; months: number[] }> = [
  { name: "Winter", months: [12, 1, 2] },
  { name: "Spring", months: [3, 4, 5] },
  { name: "Summer", months: [6, 7, 8] },
  { name: "Fall", months: [9, 10, 11] },
];

function toProductRow(
  product: HistoricalIntelligence["products"][number],
): CommerceLabProductRow {
  return {
    title: product.title,
    productKey: product.productKey,
    category: product.category,
    vendor: product.vendor,
    unitsSold: product.unitsSold,
    revenue: product.revenue,
    orderCount: product.orderCount,
    historicalScore: product.historicalScore,
    bestsellerRank: product.bestsellerRank,
    trendScore: product.trendScore,
    firstSale: product.firstSale,
    lastSale: product.lastSale,
  };
}

function computeRevenueGrowth(
  seasonality: CommerceIntelligence["seasonality"],
): { percent: number | null; label: string } {
  if (seasonality.length < 4) {
    return { percent: null, label: "Insufficient data" };
  }

  const sorted = [...seasonality].sort((a, b) => a.month - b.month);
  const firstHalf = sorted.slice(0, 6).reduce((sum, m) => sum + m.revenue, 0);
  const secondHalf = sorted.slice(6).reduce((sum, m) => sum + m.revenue, 0);

  if (firstHalf <= 0 && secondHalf <= 0) {
    return { percent: null, label: "No revenue recorded" };
  }

  if (firstHalf <= 0) {
    return { percent: 100, label: "H2 vs H1 · accelerating" };
  }

  const percent = Math.round(((secondHalf - firstHalf) / firstHalf) * 100);
  const label =
    percent >= 0
      ? `H2 vs H1 · +${percent}%`
      : `H2 vs H1 · ${percent}%`;

  return { percent, label };
}

function buildSeasonRows(
  seasonality: CommerceIntelligence["seasonality"],
): CommerceLabSeasonRow[] {
  return seasonality
    .map((row) => ({
      month: row.month,
      monthLabel: row.monthLabel,
      unitsSold: row.unitsSold,
      revenue: row.revenue,
      orderCount: row.orderCount,
    }))
    .sort((a, b) => a.month - b.month);
}

function buildSeasonSummaries(
  seasonality: CommerceIntelligence["seasonality"],
): CommerceLabSeasonSummary[] {
  return SEASONS.map(({ name, months }) => {
    const rows = seasonality.filter((s) => months.includes(s.month));
    const monthLabels = months.map((m) => MONTH_LABELS[m - 1] ?? "");
    return {
      season: name,
      months: monthLabels,
      unitsSold: rows.reduce((sum, r) => sum + r.unitsSold, 0),
      revenue: rows.reduce((sum, r) => sum + r.revenue, 0),
    };
  });
}

function buildCategoryRows(
  categories: HistoricalIntelligence["topCategories"],
  totalRevenue: number,
): CommerceLabCategoryRow[] {
  return categories.map((cat) => ({
    category: cat.category,
    unitsSold: cat.unitsSold,
    revenue: cat.revenue,
    productCount: cat.productCount,
    rank: cat.rank,
    sharePercent:
      totalRevenue > 0
        ? Math.round((cat.revenue / totalRevenue) * 1000) / 10
        : 0,
  }));
}

function findFastestGrowingCategory(
  products: HistoricalIntelligence["products"],
  categories: CommerceLabCategoryRow[],
): CommerceLabCategoryRow | null {
  if (categories.length === 0) return null;

  const trendByCategory = new Map<string, { total: number; count: number }>();
  for (const product of products) {
    const bucket = trendByCategory.get(product.category) ?? { total: 0, count: 0 };
    bucket.total += product.trendScore;
    bucket.count += 1;
    trendByCategory.set(product.category, bucket);
  }

  let best: CommerceLabCategoryRow | null = null;
  let bestAvg = -1;

  for (const cat of categories) {
    const trend = trendByCategory.get(cat.category);
    const avg = trend && trend.count > 0 ? trend.total / trend.count : 0;
    if (avg > bestAvg) {
      bestAvg = avg;
      best = cat;
    }
  }

  return best;
}

function buildCommerceRecommendations(
  historical: HistoricalIntelligence | null | undefined,
  commerce: CommerceIntelligence,
): CommerceLabInsight[] {
  const insights: CommerceLabInsight[] = [];
  let id = 0;
  const nextId = (category: CommerceLabInsight["category"]) =>
    `${category}-${++id}`;

  const products = historical?.products ?? [];
  const categories = historical?.topCategories ?? commerce.topCategories;

  const oversized = products.filter((p) =>
    /oversized|boxy|relaxed|wide/i.test(`${p.title} ${p.category}`),
  );
  if (oversized.length > 0) {
    const top = [...oversized].sort((a, b) => b.unitsSold - a.unitsSold)[0];
    insights.push({
      id: nextId("commerce"),
      category: "commerce",
      message: `Focus on oversized fits — ${oversized.length} SKUs with strong demand signals.`,
      priority: "high",
      action: top ? `Lead with ${top.title}` : undefined,
    });
  }

  const summerMonths = commerce.seasonality.filter((s) =>
    [5, 6, 7, 8].includes(s.month),
  );
  const summerRevenue = summerMonths.reduce((sum, m) => sum + m.revenue, 0);
  const totalRevenue = commerce.summary.totalRevenue;
  if (totalRevenue > 0 && summerRevenue / totalRevenue >= 0.35) {
    insights.push({
      id: nextId("commerce"),
      category: "commerce",
      message: "Launch summer collections — seasonal data shows peak demand May–Aug.",
      priority: "high",
      action: "Plan lightweight tees and seasonal colorways",
    });
  }

  const weakCategories = categories.filter(
    (c) => c.rank > 3 && c.unitsSold < (categories[0]?.unitsSold ?? 0) * 0.15,
  );
  for (const cat of weakCategories.slice(0, 2)) {
    insights.push({
      id: nextId("commerce"),
      category: "commerce",
      message: `Reduce exposure in ${cat.category} — underperforming vs category leaders.`,
      priority: "medium",
      action: "Audit SKUs before next drop",
    });
  }

  const bestseller = historical?.allTimeBestseller ?? commerce.allTimeBestseller;
  if (bestseller) {
    insights.push({
      id: nextId("commerce"),
      category: "commerce",
      message: `Restock bestseller: ${bestseller.title}.`,
      priority: "high",
      action: "Ensure POD supplier mapping is active",
    });
  }

  const highDemand = [...products]
    .filter((p) => p.trendScore >= 70)
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, 3);
  for (const product of highDemand) {
    insights.push({
      id: nextId("commerce"),
      category: "commerce",
      message: `Increase inventory for ${product.title} — trend score ${product.trendScore}.`,
      priority: "high",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: nextId("commerce"),
      category: "commerce",
      message: "Connect historical order data to unlock commerce recommendations.",
      priority: "low",
    });
  }

  return insights.slice(0, 8);
}

function buildCeoInsights(
  historical: HistoricalIntelligence | null | undefined,
  commerce: CommerceIntelligence,
  categories: CommerceLabCategoryRow[],
): CommerceLabInsight[] {
  const insights: CommerceLabInsight[] = [];
  let id = 0;

  const topCategory = categories[0];
  if (topCategory) {
    insights.push({
      id: `ceo-${++id}`,
      category: "ceo",
      message: `Sell more ${topCategory.category} — ${topCategory.sharePercent}% of revenue, ${topCategory.unitsSold} units.`,
      priority: "high",
      action: "Expand capsule within top category",
    });
  }

  const worst = historical?.products
    ? [...historical.products]
        .filter((p) => p.unitsSold > 0)
        .sort((a, b) => a.unitsSold - b.unitsSold)
        .slice(0, 3)
    : [];
  for (const product of worst) {
    if (product.unitsSold >= 5) continue;
    insights.push({
      id: `ceo-${++id}`,
      category: "ceo",
      message: `Consider discontinuing ${product.title} — only ${product.unitsSold} units sold.`,
      priority: "medium",
    });
  }

  const seasons = buildSeasonSummaries(commerce.seasonality);
  const strongest = [...seasons].sort((a, b) => b.revenue - a.revenue)[0];
  if (strongest && topCategory) {
    insights.push({
      id: `ceo-${++id}`,
      category: "ceo",
      message: `Develop a ${strongest.season} ${topCategory.category} collection — aligns peak season with top category.`,
      priority: "high",
      action: "Brief Design Studio for capsule concept",
    });
  }

  const hero = commerce.heroProducts[0];
  if (hero) {
    insights.push({
      id: `ceo-${++id}`,
      category: "ceo",
      message: `Double down on ${hero.title} — hero product with commerce score ${hero.commerceScore}.`,
      priority: "high",
    });
  }

  return insights.slice(0, 6);
}

function buildDesignInsights(
  historical: HistoricalIntelligence | null | undefined,
  commerce: CommerceIntelligence,
  seasonal: CommerceLabSeasonalIntelligence,
): CommerceLabInsight[] {
  const insights: CommerceLabInsight[] = [];
  let id = 0;

  const categories = historical?.topCategories ?? [];
  const topCat = categories[0]?.category ?? "T-Shirts";

  insights.push({
    id: `design-${++id}`,
    category: "design",
    message: `Color direction: lean into neutral bases with accent graphics for ${topCat}.`,
    priority: "medium",
    action: "Reference bestseller palette from top SKUs",
  });

  const productTypes = [...new Set(categories.map((c) => c.category))].slice(0, 4);
  if (productTypes.length > 0) {
    insights.push({
      id: `design-${++id}`,
      category: "design",
      message: `Product types to prioritize: ${productTypes.join(", ")}.`,
      priority: "high",
    });
  }

  if (seasonal.strongestSeason) {
    insights.push({
      id: `design-${++id}`,
      category: "design",
      message: `Collection idea: "${seasonal.strongestSeason.season} Core" — ${seasonal.strongestSeason.months.join("–")} peak window.`,
      priority: "high",
      action: "Open Design Studio collection brief",
    });
  }

  if (seasonal.suggestedDropWindows.length > 0) {
    insights.push({
      id: `design-${++id}`,
      category: "design",
      message: `Seasonal recommendation: prepare assets 4–6 weeks before ${seasonal.suggestedDropWindows[0]}.`,
      priority: "medium",
    });
  }

  const heavyweight = (historical?.products ?? []).filter((p) =>
    /hoodie|fleece|heavyweight|gsm/i.test(p.title),
  );
  if (heavyweight.length >= 2) {
    insights.push({
      id: `design-${++id}`,
      category: "design",
      message: "Heavyweight fleece and hoodies show sustained demand — explore fabric-forward variants.",
      priority: "medium",
    });
  }

  return insights.slice(0, 6);
}

function buildMarketingInsights(
  commerce: CommerceIntelligence,
  seasonal: CommerceLabSeasonalIntelligence,
): CommerceLabInsight[] {
  const insights: CommerceLabInsight[] = [];
  let id = 0;

  const topMonths = [...commerce.seasonality]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3);

  if (topMonths.length > 0) {
    insights.push({
      id: `marketing-${++id}`,
      category: "marketing",
      message: `Best launch months: ${topMonths.map((m) => m.monthLabel).join(", ")}.`,
      priority: "high",
      action: "Align paid + organic campaigns to these windows",
    });
  }

  if (seasonal.suggestedDropWindows.length >= 2) {
    insights.push({
      id: `marketing-${++id}`,
      category: "marketing",
      message: `Campaign timing: tease ${seasonal.suggestedDropWindows[1]}, launch ${seasonal.suggestedDropWindows[0]}.`,
      priority: "high",
    });
  }

  const promoProducts = commerce.topProducts.slice(0, 3);
  if (promoProducts.length > 0) {
    insights.push({
      id: `marketing-${++id}`,
      category: "marketing",
      message: `Promotion priorities: ${promoProducts.map((p) => p.title).join(" · ")}.`,
      priority: "high",
    });
  }

  if (seasonal.weakestSeason) {
    insights.push({
      id: `marketing-${++id}`,
      category: "marketing",
      message: `${seasonal.weakestSeason.season} is the softest season — run retention campaigns and email win-backs.`,
      priority: "medium",
    });
  }

  const repeat = commerce.repeatPurchaseProducts.slice(0, 2);
  for (const product of repeat) {
    insights.push({
      id: `marketing-${++id}`,
      category: "marketing",
      message: `${product.title} drives repeat purchases — feature in email and retargeting.`,
      priority: "medium",
    });
  }

  return insights.slice(0, 6);
}

function buildProductIntelligence(
  historical: HistoricalIntelligence | null | undefined,
  commerce: CommerceIntelligence,
): CommerceLabProductIntelligence {
  const fromHistorical = historical?.products.map(toProductRow) ?? [];
  const fromCommerce: CommerceLabProductRow[] = commerce.products.map((p) => ({
    title: p.title,
    productKey: p.productId,
    category: p.productType,
    vendor: "",
    unitsSold: p.unitsSold,
    revenue: p.revenue,
    orderCount: p.orderCount,
    historicalScore: p.commerceScore,
    bestsellerRank: p.unitsRank,
    trendScore: 50,
    firstSale: p.firstSaleDate,
    lastSale: p.lastSaleDate,
  }));

  const products =
    fromHistorical.length > 0 ? fromHistorical : fromCommerce;

  const byUnits = [...products].sort((a, b) => b.unitsSold - a.unitsSold);
  const byRevenue = [...products].sort((a, b) => b.revenue - a.revenue);
  const withSales = products.filter((p) => p.unitsSold > 0);

  return {
    bestsellers: byUnits.slice(0, 10),
    worstPerforming: [...withSales]
      .sort((a, b) => a.unitsSold - b.unitsSold)
      .slice(0, 10),
    highestRevenue: byRevenue.slice(0, 10),
    highestVolume: byUnits.slice(0, 10),
    lifetimeRevenue: byRevenue,
  };
}

export function buildCommerceLabPayload(
  commerce: CommerceIntelligence,
  historical?: HistoricalIntelligence | null,
): CommerceLabPayload {
  const summary = commerce.summary;
  const historicalSummary = historical?.summary;
  const growth = computeRevenueGrowth(commerce.seasonality);
  const seasonRows = buildSeasonRows(commerce.seasonality);
  const seasonSummaries = buildSeasonSummaries(commerce.seasonality);
  const strongestSeason =
    [...seasonSummaries].sort((a, b) => b.revenue - a.revenue)[0] ?? null;
  const weakestSeason =
    [...seasonSummaries].sort((a, b) => a.revenue - b.revenue)[0] ?? null;

  const topMonths = [...commerce.seasonality]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3);
  const suggestedDropWindows = topMonths.map((m) => {
    const leadMonth = m.month === 1 ? 12 : m.month - 1;
    return `${MONTH_LABELS[leadMonth - 1]} prep → ${m.monthLabel} drop`;
  });

  const seasonal: CommerceLabSeasonalIntelligence = {
    revenueByMonth: seasonRows,
    unitsByMonth: seasonRows,
    strongestSeason,
    weakestSeason,
    suggestedDropWindows,
  };

  const totalRevenue =
    historicalSummary?.totalRevenue ?? summary.totalRevenue;
  const categorySource = historical?.topCategories ?? commerce.topCategories;
  const categoryRows = buildCategoryRows(
    categorySource.map((c, i) => ({
      ...c,
      rank: "rank" in c ? c.rank : i + 1,
    })),
    totalRevenue,
  );

  const revenue: CommerceLabRevenueIntelligence = {
    totalRevenue,
    totalOrders: historicalSummary?.totalOrders ?? summary.totalOrders,
    paidOrders:
      historicalSummary?.diagnostics?.paidOrders ??
      summary.totalOrders,
    averageOrderValue:
      historicalSummary?.averageOrderValue ?? summary.averageOrderValue,
    firstOrder:
      historicalSummary?.firstSaleDate ?? summary.firstOrderDate,
    latestOrder:
      historicalSummary?.lastSaleDate ?? summary.lastOrderDate,
    revenueGrowthPercent: growth.percent,
    revenueGrowthLabel: growth.label,
    currency: historicalSummary?.currency ?? summary.currency,
    totalUnits: historicalSummary?.totalUnits ?? summary.totalUnits,
  };

  const categories: CommerceLabCategoryIntelligence = {
    revenueByCategory: [...categoryRows].sort((a, b) => b.revenue - a.revenue),
    unitsByCategory: [...categoryRows].sort((a, b) => b.unitsSold - a.unitsSold),
    fastestGrowingCategory: findFastestGrowingCategory(
      historical?.products ?? [],
      categoryRows,
    ),
  };

  const products = buildProductIntelligence(historical, commerce);
  const recommendations = buildCommerceRecommendations(historical, commerce);
  const ceoInsights = buildCeoInsights(historical, commerce, categoryRows);
  const designInsights = buildDesignInsights(historical, commerce, seasonal);
  const marketingInsights = buildMarketingInsights(commerce, seasonal);

  const dataSource =
    historical?.summary.sourcePath ??
    commerce.historical?.source ??
    "catalog";

  return {
    mission:
      "Analyze historical commerce data and deliver actionable insights to CEO Command, Design Studio, Shopify Operations, and Marketing Center.",
    loadedAt: new Date().toISOString(),
    dataSource: typeof dataSource === "string" ? dataSource : "shopify-orders",
    hasHistoricalData: (historicalSummary?.totalOrders ?? summary.totalOrders) > 0,
    revenue,
    products,
    seasonal,
    categories,
    recommendations,
    ceoInsights,
    designInsights,
    marketingInsights,
    integrations: {
      ceoCommand: "/agents/ceo",
      designStudio: "/agents/design",
      shopifyOperations: "/agents/shopify",
      marketingCenter: "/agents/marketing",
    },
    warnings: commerce.warnings ?? [],
  };
}
