import {
  type CommerceIntelligence,
  type CommerceProductRecord,
  loadCommerceIntelligenceSafe,
} from "@/lib/shopify/commerce-intelligence";
import type { ShopifyKnowledge } from "@/lib/shopify/types";

export interface ProductPerformanceMetrics {
  productId: string;
  title: string;
  revenue: number;
  unitsSold: number;
  orderCount: number;
  conversionScore: number;
  bestsellerScore: number;
  trendScore: number;
  campaignScore: number;
  profitPotential: number;
  restockPriority: number;
  salesRank: number;
  revenueRank: number;
  launchPotential: number;
  firstSaleDate: string | null;
  lastSaleDate: string | null;
  repeatPurchase: boolean;
  commerceScore: number;
  currency: string;
}

export interface ShopifyPerformanceSummary {
  totalRevenue: number;
  totalUnits: number;
  totalOrders: number;
  averageOrderValue: number;
  currency: string;
  periodDays: number;
  productsWithSales: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
}

export interface ShopifyPerformanceIntelligence {
  products: ProductPerformanceMetrics[];
  byProductId: Record<string, ProductPerformanceMetrics>;
  summary: ShopifyPerformanceSummary;
  topSellers: ProductPerformanceMetrics[];
  mostRevenue: ProductPerformanceMetrics[];
  fastestGrowing: ProductPerformanceMetrics[];
  lowestPerforming: ProductPerformanceMetrics[];
  highestPotential: ProductPerformanceMetrics[];
}

function clampScore(value: number): number {
  return Math.min(99, Math.max(0, Math.round(value)));
}

function computeTrendScore(recentUnits: number, priorUnits: number): number {
  if (recentUnits === 0 && priorUnits === 0) return 40;
  if (priorUnits === 0) return recentUnits > 0 ? 92 : 40;
  const growth = (recentUnits - priorUnits) / priorUnits;
  if (growth >= 1) return 98;
  if (growth >= 0.5) return 90;
  if (growth >= 0.2) return 82;
  if (growth >= 0) return 68;
  if (growth >= -0.2) return 52;
  if (growth >= -0.5) return 35;
  return 18;
}

function computeConversionScore(unitsSold: number, inventory: number): number {
  const denominator = unitsSold + Math.max(inventory, 0);
  if (denominator <= 0) return unitsSold > 0 ? 75 : 0;
  return clampScore((unitsSold / denominator) * 100);
}

function computeCampaignScore(
  revenuePercentile: number,
  trendScore: number,
  orderCount: number,
  maxOrders: number,
): number {
  const orderSignal = maxOrders > 0 ? (orderCount / maxOrders) * 100 : 0;
  return clampScore(revenuePercentile * 0.45 + trendScore * 0.35 + orderSignal * 0.2);
}

function computeProfitPotential(
  revenue: number,
  maxRevenue: number,
  conversionScore: number,
  price: number,
): number {
  const revenueSignal = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0;
  const priceSignal = price >= 55 ? 88 : price >= 45 ? 78 : price >= 35 ? 65 : 50;
  return clampScore(revenueSignal * 0.55 + conversionScore * 0.25 + priceSignal * 0.2);
}

function computeRestockPriority(
  unitsSold: number,
  inventory: number,
  maxUnits: number,
): number {
  if (unitsSold <= 0) return 0;
  const velocity = maxUnits > 0 ? (unitsSold / maxUnits) * 100 : 50;
  const stockPressure =
    inventory <= 0 ? 100 : inventory <= 5 ? 90 : inventory <= 15 ? 70 : 40;
  return clampScore(velocity * 0.55 + stockPressure * 0.45);
}

function computeLaunchPotential(
  trendScore: number,
  profitPotential: number,
  campaignScore: number,
): number {
  return clampScore(trendScore * 0.4 + profitPotential * 0.35 + campaignScore * 0.25);
}

function parseAmount(value: string): number {
  const n = parseFloat(value);
  return Number.isNaN(n) ? 0 : n;
}

function mapCommerceToPerformance(
  commerce: CommerceProductRecord,
  knowledge: ShopifyKnowledge,
  maxRevenue: number,
  maxUnits: number,
  maxOrders: number,
  recentUnits: number,
  priorUnits: number,
): ProductPerformanceMetrics {
  const catalogProduct = knowledge.products.find((p) => p.id === commerce.productId);
  const inventory = catalogProduct?.inventory ?? 0;
  const conversionScore = computeConversionScore(commerce.unitsSold, inventory);
  const trendScore = computeTrendScore(recentUnits, priorUnits);
  const revenuePercentile = commerce.revenueRank > 0
    ? clampScore(100 - ((commerce.revenueRank - 1) / Math.max(commerce.revenueRank, 1)) * 100)
    : 0;
  const campaignScore = computeCampaignScore(
    revenuePercentile,
    trendScore,
    commerce.orderCount,
    maxOrders,
  );
  const profitPotential = computeProfitPotential(
    commerce.revenue,
    maxRevenue,
    conversionScore,
    parseAmount(catalogProduct?.price ?? "0"),
  );

  return {
    productId: commerce.productId,
    title: commerce.title,
    revenue: commerce.revenue,
    unitsSold: commerce.unitsSold,
    orderCount: commerce.orderCount,
    conversionScore,
    bestsellerScore: commerce.commerceScore,
    trendScore,
    campaignScore,
    profitPotential,
    restockPriority: computeRestockPriority(commerce.unitsSold, inventory, maxUnits),
    salesRank: commerce.unitsRank,
    revenueRank: commerce.revenueRank,
    launchPotential: computeLaunchPotential(trendScore, profitPotential, campaignScore),
    firstSaleDate: commerce.firstSaleDate,
    lastSaleDate: commerce.lastSaleDate,
    repeatPurchase: commerce.repeatPurchase,
    commerceScore: commerce.commerceScore,
    currency: commerce.currency,
  };
}

export function buildShopifyPerformanceIntelligence(
  knowledge: ShopifyKnowledge,
  commerce: CommerceIntelligence,
  rollupTrendByProduct?: Map<string, { recentUnits: number; priorUnits: number }>,
): ShopifyPerformanceIntelligence {
  const maxRevenue = Math.max(...commerce.products.map((p) => p.revenue), 0);
  const maxUnits = Math.max(...commerce.products.map((p) => p.unitsSold), 0);
  const maxOrders = Math.max(...commerce.products.map((p) => p.orderCount), 0);

  const products = commerce.products.map((record) => {
    const trend = rollupTrendByProduct?.get(record.productId);
    return mapCommerceToPerformance(
      record,
      knowledge,
      maxRevenue,
      maxUnits,
      maxOrders,
      trend?.recentUnits ?? 0,
      trend?.priorUnits ?? 0,
    );
  });

  const byProductId = Object.fromEntries(products.map((p) => [p.productId, p]));

  return {
    products,
    byProductId,
    summary: {
      totalRevenue: commerce.summary.totalRevenue,
      totalUnits: commerce.summary.totalUnits,
      totalOrders: commerce.summary.totalOrders,
      averageOrderValue: commerce.summary.averageOrderValue,
      currency: commerce.summary.currency,
      periodDays: 0,
      productsWithSales: commerce.summary.productsWithSales,
      firstOrderDate: commerce.summary.firstOrderDate,
      lastOrderDate: commerce.summary.lastOrderDate,
    },
    topSellers: products.slice(0, 5),
    mostRevenue: [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    fastestGrowing: [...products]
      .sort((a, b) => b.trendScore - a.trendScore || b.unitsSold - a.unitsSold)
      .slice(0, 5),
    lowestPerforming: [...products]
      .sort(
        (a, b) =>
          a.bestsellerScore - b.bestsellerScore ||
          a.conversionScore - b.conversionScore,
      )
      .slice(0, 5),
    highestPotential: [...products]
      .sort((a, b) => b.launchPotential - a.launchPotential || b.profitPotential - a.profitPotential)
      .slice(0, 5),
  };
}

export async function fetchShopifyPerformanceIntelligence(
  knowledge: ShopifyKnowledge,
): Promise<ShopifyPerformanceIntelligence> {
  const commerce = await loadCommerceIntelligenceSafe(knowledge);
  return buildShopifyPerformanceIntelligence(knowledge, commerce);
}

export async function loadShopifyPerformanceSafe(
  knowledge: ShopifyKnowledge,
  commerce?: CommerceIntelligence,
): Promise<ShopifyPerformanceIntelligence> {
  try {
    const resolvedCommerce = commerce ?? (await loadCommerceIntelligenceSafe(knowledge));
    return buildShopifyPerformanceIntelligence(knowledge, resolvedCommerce);
  } catch (error) {
    console.warn(
      "[Shopify Performance] Failed to load performance",
      error instanceof Error ? error.message : error,
    );
    return buildShopifyPerformanceIntelligence(
      knowledge,
      await loadCommerceIntelligenceSafe(knowledge),
    );
  }
}

export function emptyShopifyPerformanceIntelligence(
  knowledge: ShopifyKnowledge,
): ShopifyPerformanceIntelligence {
  return buildShopifyPerformanceIntelligence(knowledge, {
    summary: {
      totalRevenue: 0,
      totalUnits: 0,
      totalOrders: 0,
      averageOrderValue: 0,
      currency: knowledge.products[0]?.currency ?? "EUR",
      firstOrderDate: null,
      lastOrderDate: null,
      productsWithSales: 0,
      repeatPurchaseProductCount: 0,
      historicalProductCount: 0,
    },
    products: [],
    byProductId: {},
    topProducts: [],
    topRevenue: [],
    topUnits: [],
    topCollections: [],
    topCategories: [],
    seasonality: [],
    heroProducts: [],
    repeatPurchaseProducts: [],
    allTimeBestseller: null,
    highestRevenueProduct: null,
    mostSoldCategory: null,
    strongestCollection: null,
  });
}

export function formatPerformanceCurrency(
  amount: number,
  currency: string,
): string {
  return `${amount.toFixed(amount % 1 === 0 ? 0 : 2)} ${currency}`;
}

export function getPerformanceForProduct(
  intelligence: ShopifyPerformanceIntelligence,
  productId: string,
): ProductPerformanceMetrics | undefined {
  return intelligence.byProductId[productId];
}

export { loadCommerceIntelligenceSafe };
