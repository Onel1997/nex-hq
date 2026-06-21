import type { ShopifyOrderLineRow } from "@/lib/commerce/import-shopify-orders";

export interface HistoricalProductPerformance {
  productKey: string;
  title: string;
  vendor: string;
  category: string;
  unitsSold: number;
  revenue: number;
  orderCount: number;
  firstSale: string | null;
  lastSale: string | null;
  bestsellerRank: number;
  trendScore: number;
  /** 0–99 score for Design Studio — derived from units + revenue rank. */
  historicalScore: number;
}

export interface HistoricalVendorPerformance {
  vendor: string;
  unitsSold: number;
  revenue: number;
  productCount: number;
  rank: number;
}

export interface HistoricalCategoryPerformance {
  category: string;
  unitsSold: number;
  revenue: number;
  productCount: number;
  rank: number;
}

const RECENT_WINDOW_DAYS = 90;
const PRIOR_WINDOW_DAYS = 90;

function normalizeKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeCategory(vendor: string, title: string): string {
  const haystack = `${vendor} ${title}`.toLowerCase();
  if (/hoodie|hooded/.test(haystack)) return "Hoodies";
  if (/tee|t-shirt|tshirt|shirt/.test(haystack)) return "T-Shirts";
  if (/beanie|knit hat/.test(haystack)) return "Beanies";
  if (/cap|hat|bucket/.test(haystack)) return "Accessories";
  if (/sweatshirt|crewneck/.test(haystack)) return "Sweatshirts";
  if (/shorts|pants|jogger/.test(haystack)) return "Bottoms";
  return vendor.trim() || "Uncategorized";
}

function parseDate(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function updateDateBounds(
  current: string | null,
  candidate: string,
  mode: "min" | "max",
): string {
  if (!current) return candidate;
  const currentTime = new Date(current).getTime();
  const candidateTime = new Date(candidate).getTime();
  if (mode === "min") return candidateTime < currentTime ? candidate : current;
  return candidateTime > currentTime ? candidate : current;
}

function classifyWindow(
  createdAt: string,
  recentCutoff: Date,
  priorCutoff: Date,
): "recent" | "prior" | "older" {
  const created = parseDate(createdAt);
  if (!created) return "older";
  if (created >= recentCutoff) return "recent";
  if (created >= priorCutoff) return "prior";
  return "older";
}

function clampScore(value: number): number {
  return Math.min(99, Math.max(0, Math.round(value)));
}

function percentileRank(value: number, values: number[]): number {
  if (values.length === 0 || value <= 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = sorted.filter((v) => v <= value).length;
  return Math.round((rank / sorted.length) * 100);
}

function computeTrendScore(recentUnits: number, priorUnits: number): number {
  if (recentUnits === 0 && priorUnits === 0) return 50;
  if (priorUnits === 0) return recentUnits > 0 ? 88 : 50;
  const growth = (recentUnits - priorUnits) / priorUnits;
  if (growth >= 1) return 96;
  if (growth >= 0.5) return 90;
  if (growth >= 0.2) return 82;
  if (growth >= 0) return 68;
  if (growth >= -0.2) return 52;
  if (growth >= -0.5) return 35;
  return 18;
}

function computeHistoricalScore(
  unitsSold: number,
  revenue: number,
  unitValues: number[],
  revenueValues: number[],
): number {
  const unitsPercentile = percentileRank(unitsSold, unitValues);
  const revenuePercentile = percentileRank(revenue, revenueValues);
  return clampScore(unitsPercentile * 0.6 + revenuePercentile * 0.4);
}

interface InternalAggregate {
  productKey: string;
  title: string;
  vendor: string;
  category: string;
  unitsSold: number;
  revenue: number;
  orderNames: Set<string>;
  firstSale: string | null;
  lastSale: string | null;
  recentUnits: number;
  priorUnits: number;
}

/** Aggregate Shopify export line items into historical product performance records. */
export function buildHistoricalProductPerformance(
  lineItems: ShopifyOrderLineRow[],
): HistoricalProductPerformance[] {
  const recentCutoff = new Date();
  recentCutoff.setUTCDate(recentCutoff.getUTCDate() - RECENT_WINDOW_DAYS);
  const priorCutoff = new Date();
  priorCutoff.setUTCDate(
    priorCutoff.getUTCDate() - RECENT_WINDOW_DAYS - PRIOR_WINDOW_DAYS,
  );

  const aggregates = new Map<string, InternalAggregate>();

  for (const line of lineItems) {
    const productKey = normalizeKey(line.lineitemName);
    const category = normalizeCategory(line.vendor, line.lineitemName);
    const window = classifyWindow(line.createdAt, recentCutoff, priorCutoff);

    const existing = aggregates.get(productKey) ?? {
      productKey,
      title: line.lineitemName.trim(),
      vendor: line.vendor.trim(),
      category,
      unitsSold: 0,
      revenue: 0,
      orderNames: new Set<string>(),
      firstSale: null,
      lastSale: null,
      recentUnits: 0,
      priorUnits: 0,
    };

    existing.unitsSold += line.lineitemQuantity;
    existing.revenue += line.lineRevenue;
    if (line.orderName) existing.orderNames.add(line.orderName);
    existing.firstSale = updateDateBounds(existing.firstSale, line.createdAt, "min");
    existing.lastSale = updateDateBounds(existing.lastSale, line.createdAt, "max");
    if (line.vendor && !existing.vendor) existing.vendor = line.vendor.trim();
    if (window === "recent") existing.recentUnits += line.lineitemQuantity;
    if (window === "prior") existing.priorUnits += line.lineitemQuantity;

    aggregates.set(productKey, existing);
  }

  const rows = [...aggregates.values()].sort(
    (a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue,
  );

  const unitValues = rows.map((row) => row.unitsSold);
  const revenueValues = rows.map((row) => row.revenue);

  return rows.map((row, index) => ({
    productKey: row.productKey,
    title: row.title,
    vendor: row.vendor,
    category: row.category,
    unitsSold: row.unitsSold,
    revenue: Math.round(row.revenue * 100) / 100,
    orderCount: row.orderNames.size,
    firstSale: row.firstSale,
    lastSale: row.lastSale,
    bestsellerRank: index + 1,
    trendScore: computeTrendScore(row.recentUnits, row.priorUnits),
    historicalScore: computeHistoricalScore(
      row.unitsSold,
      row.revenue,
      unitValues,
      revenueValues,
    ),
  }));
}

export function buildHistoricalVendorPerformance(
  products: HistoricalProductPerformance[],
): HistoricalVendorPerformance[] {
  const map = new Map<string, HistoricalVendorPerformance>();

  for (const product of products) {
    const vendor = product.vendor.trim() || "Unknown";
    const existing = map.get(vendor) ?? {
      vendor,
      unitsSold: 0,
      revenue: 0,
      productCount: 0,
      rank: 0,
    };
    existing.unitsSold += product.unitsSold;
    existing.revenue += product.revenue;
    existing.productCount += 1;
    map.set(vendor, existing);
  }

  return [...map.values()]
    .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export function buildHistoricalCategoryPerformance(
  products: HistoricalProductPerformance[],
): HistoricalCategoryPerformance[] {
  const map = new Map<string, HistoricalCategoryPerformance>();

  for (const product of products) {
    const existing = map.get(product.category) ?? {
      category: product.category,
      unitsSold: 0,
      revenue: 0,
      productCount: 0,
      rank: 0,
    };
    existing.unitsSold += product.unitsSold;
    existing.revenue += product.revenue;
    existing.productCount += 1;
    map.set(product.category, existing);
  }

  return [...map.values()]
    .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export function normalizeProductTitle(title: string): string {
  return normalizeKey(title);
}

const GENERIC_PRODUCT_TOKENS = new Set([
  "tee",
  "tshirt",
  "shirt",
  "oversized",
  "milaene",
  "the",
  "and",
  "top",
  "unisex",
]);

function distinctiveTokens(text: string): string[] {
  return normalizeKey(text)
    .split(" ")
    .filter((token) => token.length > 2 && !GENERIC_PRODUCT_TOKENS.has(token));
}

/** Match a catalog product title to historical export line-item performance. */
export function matchHistoricalProduct(
  catalogTitle: string,
  products: HistoricalProductPerformance[],
): HistoricalProductPerformance | null {
  const normalized = normalizeKey(catalogTitle);
  if (!normalized) return null;

  const exact = products.find((p) => normalizeKey(p.title) === normalized);
  if (exact) return exact;

  const contains = products.find((p) => {
    const key = normalizeKey(p.title);
    return key.includes(normalized) || normalized.includes(key);
  });
  if (contains) return contains;

  const catalogDistinctive = distinctiveTokens(catalogTitle);
  if (catalogDistinctive.length === 0) return null;

  let best: HistoricalProductPerformance | null = null;
  let bestScore = 0;

  for (const product of products) {
    const productDistinctive = distinctiveTokens(product.title);
    if (productDistinctive.length === 0) continue;

    const overlap = catalogDistinctive.filter((token) =>
      productDistinctive.includes(token),
    );
    if (overlap.length === 0) continue;

    const score =
      overlap.length / Math.max(catalogDistinctive.length, productDistinctive.length);
    if (score > bestScore) {
      bestScore = score;
      best = product;
    }
  }

  return bestScore >= 0.5 ? best : null;
}
