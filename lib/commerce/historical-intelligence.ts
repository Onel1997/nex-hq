import "server-only";

import type { CommerceHistoryResponse } from "@/lib/commerce/history-api-types";
import {
  loadShopifyOrdersExport,
  parseShopifyOrdersExport,
  resolveCommerceHistoryCsvPath,
  type ParsedShopifyOrdersExport,
} from "@/lib/commerce/import-shopify-orders";
import type {
  HistoricalIntelligence,
  HistoricalProductPerformance,
} from "@/lib/commerce/historical-intelligence-types";
import {
  buildHistoricalCategoryPerformance,
  buildHistoricalProductPerformance,
  buildHistoricalVendorPerformance,
  matchHistoricalProduct,
} from "@/lib/commerce/product-performance";
import type { CommerceOrderRollup } from "@/lib/shopify/commerce-intelligence";
import type { ShopifyKnowledge, ShopifyKnowledgeProduct } from "@/lib/shopify/types";

export type {
  HistoricalCategoryPerformance,
  HistoricalIntelligence,
  HistoricalIntelligenceSummary,
  HistoricalProductPerformance,
  HistoricalVendorPerformance,
} from "@/lib/commerce/historical-intelligence-types";

let cachedIntelligence: HistoricalIntelligence | null = null;
let cachedSourcePath: string | null = null;

function buildMonthlyOrders(
  lineItems: ParsedShopifyOrdersExport["lineItems"],
): CommerceOrderRollup["monthlyOrders"] {
  const monthly = new Map<number, { units: number; revenue: number; orders: number }>();
  const ordersByMonth = new Map<number, Set<string>>();

  for (const line of lineItems) {
    const date = new Date(line.paidAt || line.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const month = date.getUTCMonth() + 1;
    const bucket = monthly.get(month) ?? { units: 0, revenue: 0, orders: 0 };
    bucket.units += line.lineitemQuantity;
    bucket.revenue += line.lineRevenue;
    monthly.set(month, bucket);

    const orderSet = ordersByMonth.get(month) ?? new Set<string>();
    if (line.orderName) orderSet.add(line.orderName);
    ordersByMonth.set(month, orderSet);
  }

  for (const [month, orderSet] of ordersByMonth) {
    const bucket = monthly.get(month);
    if (bucket) bucket.orders = orderSet.size;
  }

  return monthly;
}

function matchCatalogProductId(
  catalog: ShopifyKnowledgeProduct[],
  lineitemName: string,
): string {
  const matched = matchHistoricalProduct(
    lineitemName,
    catalog.map((p) => ({
      productKey: p.id,
      title: p.title,
      vendor: "",
      category: p.productType,
      unitsSold: 0,
      revenue: 0,
      orderCount: 0,
      firstSale: null,
      lastSale: null,
      bestsellerRank: 0,
      trendScore: 0,
      historicalScore: 0,
    })),
  );

  if (matched) {
    const catalogProduct = catalog.find(
      (p) =>
        p.title.trim().toLowerCase() === matched.title.trim().toLowerCase() ||
        p.title.toLowerCase().includes(matched.title.toLowerCase()) ||
        matched.title.toLowerCase().includes(p.title.toLowerCase()),
    );
    if (catalogProduct) return catalogProduct.id;
  }

  for (const product of catalog) {
    const a = product.title.toLowerCase();
    const b = lineitemName.toLowerCase();
    if (a === b || a.includes(b) || b.includes(a)) return product.id;
  }

  return `import:${lineitemName.trim().toLowerCase().replace(/\s+/g, "-")}`;
}

/** Convert parsed export + catalog into a CommerceOrderRollup for existing intelligence builders. */
export function historicalIntelligenceToRollup(
  intelligence: HistoricalIntelligence,
  knowledge: ShopifyKnowledge,
): CommerceOrderRollup {
  const productAggregates = new Map<
    string,
    {
      productId: string;
      title: string;
      productType: string;
      collections: Set<string>;
      revenue: number;
      unitsSold: number;
      orderIds: Set<string>;
      firstSaleDate: string | null;
      lastSaleDate: string | null;
      recentUnits: number;
      priorUnits: number;
    }
  >();

  const mappedKeys = new Set<string>();

  for (const [catalogId, product] of Object.entries(intelligence.byCatalogProductId)) {
    mappedKeys.add(product.productKey);
    const catalogProduct = knowledge.products.find((p) => p.id === catalogId);
    productAggregates.set(catalogId, {
      productId: catalogId,
      title: catalogProduct?.title ?? product.title,
      productType: catalogProduct?.productType ?? product.category,
      collections: new Set(catalogProduct?.collections ?? []),
      revenue: product.revenue,
      unitsSold: product.unitsSold,
      orderIds: new Set(
        Array.from({ length: product.orderCount }, (_, i) => `import-order-${product.productKey}-${i}`),
      ),
      firstSaleDate: product.firstSale,
      lastSaleDate: product.lastSale,
      recentUnits: 0,
      priorUnits: 0,
    });
  }

  for (const product of intelligence.products) {
    if (mappedKeys.has(product.productKey)) continue;
    const productId = matchCatalogProductId(knowledge.products, product.title);
    if (productAggregates.has(productId)) continue;

    productAggregates.set(productId, {
      productId,
      title: product.title,
      productType: product.category,
      collections: new Set<string>(),
      revenue: product.revenue,
      unitsSold: product.unitsSold,
      orderIds: new Set(
        Array.from({ length: product.orderCount }, (_, i) => `import-order-${product.productKey}-${i}`),
      ),
      firstSaleDate: product.firstSale,
      lastSaleDate: product.lastSale,
      recentUnits: 0,
      priorUnits: 0,
    });
  }

  return {
    productAggregates,
    orderCount: intelligence.summary.totalOrders,
    totalRevenue: intelligence.summary.totalRevenue,
    totalUnits: intelligence.summary.totalUnits,
    currency: intelligence.summary.currency,
    firstOrderDate: intelligence.summary.firstSaleDate,
    lastOrderDate: intelligence.summary.lastSaleDate,
    monthlyOrders: new Map(),
  };
}

export function buildHistoricalIntelligenceFromExport(
  parsed: ParsedShopifyOrdersExport,
  knowledge?: ShopifyKnowledge,
): HistoricalIntelligence {
  const products = buildHistoricalProductPerformance(parsed.lineItems);
  const topVendors = buildHistoricalVendorPerformance(products);
  const topCategories = buildHistoricalCategoryPerformance(products);
  const { summary, diagnostics } = parsed;

  const byProductKey = Object.fromEntries(products.map((p) => [p.productKey, p]));
  const byCatalogProductId: Record<string, HistoricalProductPerformance> = {};
  const usedHistoricalKeys = new Set<string>();

  if (knowledge) {
    for (const catalogProduct of knowledge.products) {
      const available = products.filter((p) => !usedHistoricalKeys.has(p.productKey));
      const matched = matchHistoricalProduct(catalogProduct.title, available);
      if (!matched) continue;
      byCatalogProductId[catalogProduct.id] = matched;
      usedHistoricalKeys.add(matched.productKey);
    }
  }

  return {
    summary: {
      totalRevenue: summary.totalRevenue,
      totalUnits: summary.totalUnits,
      totalOrders: summary.totalOrders,
      averageOrderValue: summary.averageOrderValue,
      currency: parsed.currency,
      firstSaleDate: summary.firstOrderDate,
      lastSaleDate: summary.lastOrderDate,
      productsWithSales: products.length,
      sourcePath: parsed.sourcePath,
      diagnostics,
    },
    products,
    byProductKey,
    byCatalogProductId,
    topProducts: products.slice(0, 20),
    topVendors,
    topCategories,
    allTimeBestseller: products[0] ?? null,
  };
}

export async function loadHistoricalIntelligence(
  knowledge?: ShopifyKnowledge,
): Promise<HistoricalIntelligence | null> {
  const sourcePath = await resolveCommerceHistoryCsvPath();
  if (!sourcePath) return null;

  if (cachedIntelligence && cachedSourcePath === sourcePath) {
    if (knowledge && Object.keys(cachedIntelligence.byCatalogProductId).length === 0) {
      cachedIntelligence = buildHistoricalIntelligenceFromExport(
        await parseShopifyOrdersExport(sourcePath),
        knowledge,
      );
    }
    return cachedIntelligence;
  }

  const parsed = await loadShopifyOrdersExport();
  if (!parsed || parsed.summary.totalOrders === 0) return null;

  cachedSourcePath = sourcePath;
  cachedIntelligence = buildHistoricalIntelligenceFromExport(parsed, knowledge);
  return cachedIntelligence;
}

export async function loadHistoricalIntelligenceRollup(
  knowledge: ShopifyKnowledge,
): Promise<{ intelligence: HistoricalIntelligence; rollup: CommerceOrderRollup } | null> {
  const intelligence = await loadHistoricalIntelligence(knowledge);
  if (!intelligence || intelligence.summary.totalOrders === 0) return null;

  const parsed = await parseShopifyOrdersExport(intelligence.summary.sourcePath!);
  const rollup = historicalIntelligenceToRollup(intelligence, knowledge);
  rollup.monthlyOrders = buildMonthlyOrders(parsed.lineItems);

  return { intelligence, rollup };
}

/** Format historical sales for CEO / agent prompts. */
export function formatHistoricalIntelligencePrompt(
  intelligence: HistoricalIntelligence,
): string {
  const topProducts = intelligence.topProducts
    .slice(0, 12)
    .map(
      (p) =>
        `- ${p.title}: ${p.unitsSold} units · ${p.revenue.toFixed(2)} ${intelligence.summary.currency} · historical score ${p.historicalScore} · rank #${p.bestsellerRank}`,
    )
    .join("\n");

  const topCategories = intelligence.topCategories
    .slice(0, 8)
    .map(
      (c) =>
        `- ${c.category}: ${c.unitsSold} units · ${c.revenue.toFixed(2)} ${intelligence.summary.currency}`,
    )
    .join("\n");

  const topVendors = intelligence.topVendors
    .slice(0, 6)
    .map((v) => `- ${v.vendor}: ${v.unitsSold} units · rank #${v.rank}`)
    .join("\n");

  return [
    "## HISTORICAL COMMERCE (SHOPIFY EXPORT — HIGHEST PRIORITY)",
    "",
    "PRIORITY RULE: Historical export sales OVERRIDE live catalog assumptions.",
    "",
    `Total revenue: ${intelligence.summary.totalRevenue.toFixed(2)} ${intelligence.summary.currency}`,
    `Units sold: ${intelligence.summary.totalUnits}`,
    `Orders: ${intelligence.summary.totalOrders}`,
    `Average order value: ${intelligence.summary.averageOrderValue.toFixed(2)} ${intelligence.summary.currency}`,
    `First sale: ${intelligence.summary.firstSaleDate ?? "—"}`,
    `Last sale: ${intelligence.summary.lastSaleDate ?? "—"}`,
    `Source: ${intelligence.summary.sourcePath ?? "csv-import"}`,
    "",
    "### All-time bestsellers",
    topProducts || "- (none)",
    "",
    "### Strongest categories",
    topCategories || "- (none)",
    "",
    "### Top vendors",
    topVendors || "- (none)",
    "",
    "CEO RULES:",
    "- Recommend future collections anchored on proven historical bestsellers",
    "- Prioritize categories with highest unit volume in export data",
    "- Do NOT let inactive catalog status downgrade historically strong SKUs",
  ].join("\n");
}

export function clearHistoricalIntelligenceCache(): void {
  cachedIntelligence = null;
  cachedSourcePath = null;
}

/** Build the `/api/commerce/history` response from loaded intelligence. */
export function buildCommerceHistoryResponse(
  intelligence: HistoricalIntelligence,
): CommerceHistoryResponse {
  return {
    revenue: intelligence.summary.totalRevenue,
    orders: intelligence.summary.totalOrders,
    units: intelligence.summary.totalUnits,
    currency: intelligence.summary.currency,
    averageOrderValue: intelligence.summary.averageOrderValue,
    topProducts: intelligence.topProducts.map((product) => ({
      title: product.title,
      unitsSold: product.unitsSold,
      revenue: product.revenue,
      orderCount: product.orderCount,
      historicalScore: product.historicalScore,
      bestsellerRank: product.bestsellerRank,
      productKey: product.productKey,
    })),
    topCategories: intelligence.topCategories.map((category) => ({
      category: category.category,
      unitsSold: category.unitsSold,
      revenue: category.revenue,
    })),
    firstSale: intelligence.summary.firstSaleDate,
    lastSale: intelligence.summary.lastSaleDate,
    diagnostics: intelligence.summary.diagnostics,
  };
}

export async function loadCommerceHistoryResponse(
  knowledge?: ShopifyKnowledge,
): Promise<CommerceHistoryResponse | null> {
  const intelligence = await loadHistoricalIntelligence(knowledge);
  if (!intelligence || intelligence.summary.totalOrders === 0) return null;
  return buildCommerceHistoryResponse(intelligence);
}

export { matchHistoricalProduct, resolveCommerceHistoryCsvPath };
