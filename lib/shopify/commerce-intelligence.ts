import {
  fetchShopifyTokenMetadata,
  getShopifyAppAccessScopes,
  shopifyGraphQL,
  type ShopifyGraphQLResponse,
} from "@/lib/shopify/client";
import {
  commerceHistoryProvider,
  HISTORICAL_READ_ALL_ORDERS_WARNING,
  type CommerceHistoricalStatus,
} from "@/lib/shopify/commerce-history-provider";
import type { HistoricalIntelligence } from "@/lib/commerce/historical-intelligence";

export type { CommerceHistoricalStatus } from "@/lib/shopify/commerce-history-provider";
export {
  commerceHistoryProvider,
  HISTORICAL_READ_ALL_ORDERS_WARNING,
  isCommerceHistoryActive,
  formatHistoricalPlaceholder,
} from "@/lib/shopify/commerce-history-provider";

const RECENT_WINDOW_DAYS = 30;
const PRIOR_WINDOW_DAYS = 30;

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

export interface CommerceProductRecord {
  productId: string;
  title: string;
  productType: string;
  collections: string[];
  revenue: number;
  unitsSold: number;
  orderCount: number;
  firstSaleDate: string | null;
  lastSaleDate: string | null;
  unitsRank: number;
  revenueRank: number;
  commerceScore: number;
  repeatPurchase: boolean;
  inActiveCatalog: boolean;
  currency: string;
}

export interface CommerceCategoryRecord {
  category: string;
  unitsSold: number;
  revenue: number;
  productCount: number;
  rank: number;
}

export interface CommerceCollectionRecord {
  title: string;
  unitsSold: number;
  revenue: number;
  productCount: number;
  rank: number;
}

export interface CommerceSeasonalityRecord {
  month: number;
  monthLabel: string;
  unitsSold: number;
  revenue: number;
  orderCount: number;
}

export interface CommerceIntelligenceSummary {
  totalRevenue: number;
  totalUnits: number;
  totalOrders: number;
  averageOrderValue: number;
  currency: string;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  productsWithSales: number;
  repeatPurchaseProductCount: number;
  historicalProductCount: number;
}

export interface CommerceIntelligenceDebug {
  ordersCount: number;
  lineItemsCount: number;
  totalRevenue: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  tokenScopes: string[];
  appAccessScopes: string[];
  hasReadOrders: boolean;
  hasReadAllOrders: boolean;
  ordersCountFromApi: number | null;
  rawOrdersResponse?: unknown;
}

export interface CommerceIntelligence {
  summary: CommerceIntelligenceSummary;
  products: CommerceProductRecord[];
  byProductId: Record<string, CommerceProductRecord>;
  topProducts: CommerceProductRecord[];
  topRevenue: CommerceProductRecord[];
  topUnits: CommerceProductRecord[];
  topCollections: CommerceCollectionRecord[];
  topCategories: CommerceCategoryRecord[];
  seasonality: CommerceSeasonalityRecord[];
  heroProducts: CommerceProductRecord[];
  repeatPurchaseProducts: CommerceProductRecord[];
  allTimeBestseller: CommerceProductRecord | null;
  highestRevenueProduct: CommerceProductRecord | null;
  mostSoldCategory: CommerceCategoryRecord | null;
  strongestCollection: CommerceCollectionRecord | null;
  /** Temporary debug output for Shopify orders integration. */
  debug?: CommerceIntelligenceDebug;
  /** Load-time error surfaced in the Commerce Intelligence panel. */
  loadError?: string | null;
  /** Non-fatal warnings (e.g. missing read_all_orders scope). */
  warnings?: string[];
  /** Historical commerce mode — catalog-only when Shopify history unavailable. */
  historical?: CommerceHistoricalStatus;
  /** Parsed Shopify export intelligence when CSV import is active. */
  import?: HistoricalIntelligence | null;
}

export interface CommerceOrderRollup {
  productAggregates: Map<string, InternalProductAggregate>;
  orderCount: number;
  totalRevenue: number;
  totalUnits: number;
  currency: string;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  monthlyOrders: Map<number, { units: number; revenue: number; orders: number }>;
}

interface InternalProductAggregate {
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

interface OrdersPageData {
  orders: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: Array<{
      node: {
        id: string;
        createdAt: string;
        lineItems: {
          pageInfo: { hasNextPage: boolean };
          edges: Array<{
            node: {
              quantity: number;
              originalTotalSet: {
                shopMoney: { amount: string; currencyCode: string };
              };
              product: {
                id: string;
                title: string;
                productType: string;
                collections: {
                  edges: Array<{ node: { title: string } }>;
                };
              } | null;
            };
          }>;
        };
      };
    }>;
  };
}

const ORDERS_PROBE_QUERY = `
  query ShopifyOrdersProbe {
    ordersCount {
      count
      precision
    }
    orders(first: 50, sortKey: CREATED_AT, reverse: true) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          createdAt
          lineItems(first: 100) {
            edges {
              node {
                quantity
                originalTotalSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                product {
                  id
                }
              }
            }
          }
        }
      }
    }
  }
`;

interface OrdersProbeData {
  ordersCount: { count: number; precision: string };
  orders: OrdersPageData["orders"];
}

const ORDERS_PAGE_QUERY = `
  query ShopifyAllOrdersPage($cursor: String) {
    orders(first: 100, after: $cursor, sortKey: CREATED_AT, reverse: true) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          createdAt
          lineItems(first: 100) {
            pageInfo {
              hasNextPage
            }
            edges {
              node {
                quantity
                originalTotalSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                product {
                  id
                  title
                  productType
                  collections(first: 10) {
                    edges {
                      node {
                        title
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

function parseAmount(value: string): number {
  const n = parseFloat(value);
  return Number.isNaN(n) ? 0 : n;
}

function clampScore(value: number): number {
  return Math.min(99, Math.max(0, Math.round(value)));
}

function percentileRank(value: number, values: number[]): number {
  if (values.length === 0) return 0;
  if (value <= 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = sorted.filter((v) => v <= value).length;
  return Math.round((rank / sorted.length) * 100);
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

function classifyOrderWindow(
  createdAt: string,
  recentCutoff: Date,
  priorCutoff: Date,
): "recent" | "prior" | "older" {
  const created = new Date(createdAt);
  if (created >= recentCutoff) return "recent";
  if (created >= priorCutoff) return "prior";
  return "older";
}

function normalizeCategory(productType: string, title: string): string {
  const haystack = `${productType} ${title}`.toLowerCase();
  if (/hoodie|hooded/.test(haystack)) return "Hoodies";
  if (/tee|t-shirt|tshirt|shirt/.test(haystack)) return "T-Shirts";
  if (/beanie|knit hat/.test(haystack)) return "Beanies";
  if (/cap|hat/.test(haystack)) return "Accessories";
  if (/sweatshirt|crewneck/.test(haystack)) return "Sweatshirts";
  return productType.trim() || "Uncategorized";
}

function summarizeOrdersProbe(
  orders: OrdersPageData["orders"] | undefined,
): Pick<
  CommerceIntelligenceDebug,
  "ordersCount" | "lineItemsCount" | "totalRevenue" | "firstOrderDate" | "lastOrderDate"
> {
  const edges = orders?.edges ?? [];
  let lineItemsCount = 0;
  let totalRevenue = 0;
  let firstOrderDate: string | null = null;
  let lastOrderDate: string | null = null;

  for (const edge of edges) {
    firstOrderDate = updateDateBounds(firstOrderDate, edge.node.createdAt, "min");
    lastOrderDate = updateDateBounds(lastOrderDate, edge.node.createdAt, "max");

    for (const lineEdge of edge.node.lineItems.edges) {
      lineItemsCount += 1;
      totalRevenue += parseAmount(lineEdge.node.originalTotalSet.shopMoney.amount);
    }
  }

  return {
    ordersCount: edges.length,
    lineItemsCount,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    firstOrderDate,
    lastOrderDate,
  };
}

/** Probe Shopify orders access — logs orders(first: 50) and scope metadata. */
export async function probeShopifyOrdersAccess(): Promise<CommerceIntelligenceDebug> {
  const [tokenMetadata, appAccessScopes] = await Promise.all([
    fetchShopifyTokenMetadata(),
    getShopifyAppAccessScopes().catch(() => [] as string[]),
  ]);

  const tokenScopes = tokenMetadata.scopes;
  const hasReadOrders =
    tokenScopes.includes("read_orders") || appAccessScopes.includes("read_orders");
  const hasReadAllOrders =
    tokenScopes.includes("read_all_orders") ||
    appAccessScopes.includes("read_all_orders");

  console.log("[Commerce Intelligence] Token scopes:", tokenScopes.join(", ") || "(none)");
  console.log("[Commerce Intelligence] App access scopes:", appAccessScopes.join(", ") || "(none)");
  console.log("[Commerce Intelligence] read_orders:", hasReadOrders);
  console.log("[Commerce Intelligence] read_all_orders:", hasReadAllOrders);

  let rawOrdersResponse: ShopifyGraphQLResponse<OrdersProbeData> | null = null;
  let probeError: string | null = null;

  try {
    rawOrdersResponse = await shopifyGraphQL<OrdersProbeData>(ORDERS_PROBE_QUERY);
    console.log(
      "[Commerce Intelligence] orders(first: 50) response:",
      JSON.stringify(rawOrdersResponse, null, 2),
    );
  } catch (error) {
    probeError =
      error instanceof Error ? error.message : "Shopify orders probe failed";
    console.error("[Commerce Intelligence] orders(first: 50) error:", probeError, error);
  }

  const summary = summarizeOrdersProbe(rawOrdersResponse?.data?.orders);
  const ordersCountFromApi = rawOrdersResponse?.data?.ordersCount?.count ?? null;

  console.log("[Commerce Intelligence] Probe summary:", {
    ordersCount: summary.ordersCount,
    lineItemsCount: summary.lineItemsCount,
    totalRevenue: summary.totalRevenue,
    firstOrderDate: summary.firstOrderDate,
    lastOrderDate: summary.lastOrderDate,
    ordersCountFromApi,
  });

  if (summary.ordersCount === 0 && rawOrdersResponse) {
    console.log(
      "[Commerce Intelligence] No orders returned — exact API response:",
      JSON.stringify(rawOrdersResponse, null, 2),
    );
  }

  if (probeError) {
    return {
      ...summary,
      tokenScopes,
      appAccessScopes,
      hasReadOrders,
      hasReadAllOrders,
      ordersCountFromApi,
      rawOrdersResponse: probeError,
    };
  }

  return {
    ...summary,
    tokenScopes,
    appAccessScopes,
    hasReadOrders,
    hasReadAllOrders,
    ordersCountFromApi,
    rawOrdersResponse: summary.ordersCount === 0 ? rawOrdersResponse : undefined,
  };
}

function buildCommerceWarnings(
  debug: CommerceIntelligenceDebug,
  historical?: CommerceHistoricalStatus,
): string[] {
  const warnings: string[] = [];

  if (historical?.warning) {
    warnings.push(historical.warning);
  }

  if (!debug.hasReadOrders) {
    warnings.push(
      "Missing read_orders scope — add it to the NexHQ Shopify app and reinstall.",
    );
  }

  if (
    debug.hasReadOrders &&
    !debug.hasReadAllOrders &&
    debug.ordersCount === 0 &&
    !historical?.warning
  ) {
    warnings.push(HISTORICAL_READ_ALL_ORDERS_WARNING);
  }

  if (debug.ordersCount === 0 && debug.ordersCountFromApi === 0 && debug.hasReadAllOrders) {
    warnings.push(
      "Shopify ordersCount is 0 — the store may have no orders accessible to this app, or sales may live on a different store domain.",
    );
  }

  return [...new Set(warnings)];
}

/** Fetch complete Shopify order history and roll up line-item performance. */
export async function fetchCommerceOrderRollup(): Promise<CommerceOrderRollup> {
  const productAggregates = new Map<string, InternalProductAggregate>();
  const monthlyOrders = new Map<number, { units: number; revenue: number; orders: number }>();

  const recentCutoff = new Date();
  recentCutoff.setUTCDate(recentCutoff.getUTCDate() - RECENT_WINDOW_DAYS);
  const priorCutoff = new Date();
  priorCutoff.setUTCDate(priorCutoff.getUTCDate() - RECENT_WINDOW_DAYS - PRIOR_WINDOW_DAYS);

  let cursor: string | null = null;
  let hasNextPage = true;
  let orderCount = 0;
  let totalRevenue = 0;
  let totalUnits = 0;
  let currency = "EUR";
  let firstOrderDate: string | null = null;
  let lastOrderDate: string | null = null;

  while (hasNextPage) {
    const result: ShopifyGraphQLResponse<OrdersPageData> =
      await shopifyGraphQL<OrdersPageData>(
        ORDERS_PAGE_QUERY,
        cursor ? { cursor } : {},
      );

    const page = result.data?.orders;
    if (!page) break;

    for (const edge of page.edges) {
      const order = edge.node;
      orderCount += 1;
      firstOrderDate = updateDateBounds(firstOrderDate, order.createdAt, "min");
      lastOrderDate = updateDateBounds(lastOrderDate, order.createdAt, "max");

      const month = new Date(order.createdAt).getUTCMonth() + 1;
      const monthBucket = monthlyOrders.get(month) ?? { units: 0, revenue: 0, orders: 0 };
      monthBucket.orders += 1;

      const window = classifyOrderWindow(order.createdAt, recentCutoff, priorCutoff);
      let orderRevenue = 0;

      for (const lineEdge of order.lineItems.edges) {
        const line = lineEdge.node;
        const product = line.product;
        if (!product?.id) continue;

        const quantity = line.quantity ?? 0;
        if (quantity <= 0) continue;

        const lineRevenue = parseAmount(line.originalTotalSet.shopMoney.amount);
        currency = line.originalTotalSet.shopMoney.currencyCode || currency;
        orderRevenue += lineRevenue;
        totalRevenue += lineRevenue;
        totalUnits += quantity;
        monthBucket.units += quantity;
        monthBucket.revenue += lineRevenue;

        const collections = product.collections.edges.map((c) => c.node.title);
        const existing = productAggregates.get(product.id) ?? {
          productId: product.id,
          title: product.title,
          productType: product.productType?.trim() || normalizeCategory("", product.title),
          collections: new Set<string>(),
          revenue: 0,
          unitsSold: 0,
          orderIds: new Set<string>(),
          firstSaleDate: null,
          lastSaleDate: null,
          recentUnits: 0,
          priorUnits: 0,
        };

        for (const collection of collections) existing.collections.add(collection);
        existing.title = product.title;
        if (product.productType) existing.productType = product.productType;
        existing.revenue += lineRevenue;
        existing.unitsSold += quantity;
        existing.orderIds.add(order.id);
        existing.firstSaleDate = updateDateBounds(
          existing.firstSaleDate,
          order.createdAt,
          "min",
        );
        existing.lastSaleDate = updateDateBounds(
          existing.lastSaleDate,
          order.createdAt,
          "max",
        );
        if (window === "recent") existing.recentUnits += quantity;
        if (window === "prior") existing.priorUnits += quantity;

        productAggregates.set(product.id, existing);
      }

      monthBucket.revenue += orderRevenue;
      monthlyOrders.set(month, monthBucket);
    }

    hasNextPage = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor;
  }

  return {
    productAggregates,
    orderCount,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalUnits,
    currency,
    firstOrderDate,
    lastOrderDate,
    monthlyOrders,
  };
}

/** Alias for buildCommerceIntelligence — verifies orders rollup is applied. */
export function calculateCommerceIntelligence(
  knowledge: ShopifyKnowledge,
  rollup: CommerceOrderRollup,
  options?: {
    debug?: CommerceIntelligenceDebug;
    loadError?: string | null;
    warnings?: string[];
    historical?: CommerceHistoricalStatus;
    import?: HistoricalIntelligence | null;
  },
): CommerceIntelligence {
  return buildCommerceIntelligence(knowledge, rollup, options);
}

export function buildCommerceIntelligence(
  knowledge: ShopifyKnowledge,
  rollup: CommerceOrderRollup,
  options?: {
    debug?: CommerceIntelligenceDebug;
    loadError?: string | null;
    warnings?: string[];
    historical?: CommerceHistoricalStatus;
    import?: HistoricalIntelligence | null;
  },
): CommerceIntelligence {
  const catalogById = new Map(knowledge.products.map((p) => [p.id, p]));
  const activeIds = new Set(
    knowledge.products.filter((p) => p.status === "ACTIVE").map((p) => p.id),
  );

  const productRows = [...rollup.productAggregates.values()].map((aggregate) => {
    const catalogProduct = catalogById.get(aggregate.productId);
    const productType =
      catalogProduct?.productType ||
      aggregate.productType ||
      normalizeCategory("", aggregate.title);
    const collections = [
      ...new Set([
        ...aggregate.collections,
        ...(catalogProduct?.collections ?? []),
      ]),
    ];

    return {
      aggregate,
      productType,
      collections,
      inActiveCatalog: activeIds.has(aggregate.productId),
      title: catalogProduct?.title ?? aggregate.title,
    };
  });

  const unitValues = productRows.map((row) => row.aggregate.unitsSold);
  const revenueValues = productRows.map((row) => row.aggregate.revenue);

  const products: CommerceProductRecord[] = productRows
    .map((row) => {
      const { aggregate } = row;
      const unitsRank =
        [...productRows]
          .sort((a, b) => b.aggregate.unitsSold - a.aggregate.unitsSold)
          .findIndex((item) => item.aggregate.productId === aggregate.productId) + 1;
      const revenueRank =
        [...productRows]
          .sort((a, b) => b.aggregate.revenue - a.aggregate.revenue)
          .findIndex((item) => item.aggregate.productId === aggregate.productId) + 1;
      const unitsPercentile = percentileRank(aggregate.unitsSold, unitValues);
      const revenuePercentile = percentileRank(aggregate.revenue, revenueValues);
      const commerceScore = clampScore(unitsPercentile * 0.55 + revenuePercentile * 0.45);

      return {
        productId: aggregate.productId,
        title: row.title,
        productType: row.productType,
        collections: row.collections,
        revenue: Math.round(aggregate.revenue * 100) / 100,
        unitsSold: aggregate.unitsSold,
        orderCount: aggregate.orderIds.size,
        firstSaleDate: aggregate.firstSaleDate,
        lastSaleDate: aggregate.lastSaleDate,
        unitsRank: unitsRank || productRows.length,
        revenueRank: revenueRank || productRows.length,
        commerceScore,
        repeatPurchase: aggregate.orderIds.size >= 2,
        inActiveCatalog: row.inActiveCatalog,
        currency: rollup.currency,
      };
    })
    .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue);

  const byProductId = Object.fromEntries(products.map((p) => [p.productId, p]));

  const categoryMap = new Map<string, CommerceCategoryRecord>();
  for (const product of products) {
    const category = normalizeCategory(product.productType, product.title);
    const existing = categoryMap.get(category) ?? {
      category,
      unitsSold: 0,
      revenue: 0,
      productCount: 0,
      rank: 0,
    };
    existing.unitsSold += product.unitsSold;
    existing.revenue += product.revenue;
    existing.productCount += 1;
    categoryMap.set(category, existing);
  }

  const topCategories = [...categoryMap.values()]
    .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const collectionMap = new Map<string, CommerceCollectionRecord>();
  for (const product of products) {
    for (const collection of product.collections) {
      const existing = collectionMap.get(collection) ?? {
        title: collection,
        unitsSold: 0,
        revenue: 0,
        productCount: 0,
        rank: 0,
      };
      existing.unitsSold += product.unitsSold;
      existing.revenue += product.revenue;
      existing.productCount += 1;
      collectionMap.set(collection, existing);
    }
  }

  const topCollections = [...collectionMap.values()]
    .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const seasonality: CommerceSeasonalityRecord[] = MONTH_LABELS.map((monthLabel, index) => {
    const month = index + 1;
    const bucket = rollup.monthlyOrders.get(month) ?? { units: 0, revenue: 0, orders: 0 };
    return {
      month,
      monthLabel,
      unitsSold: bucket.units,
      revenue: Math.round(bucket.revenue * 100) / 100,
      orderCount: bucket.orders,
    };
  }).sort((a, b) => b.unitsSold - a.unitsSold);

  const repeatPurchaseProducts = products
    .filter((p) => p.repeatPurchase)
    .sort((a, b) => b.orderCount - a.orderCount || b.unitsSold - a.unitsSold)
    .slice(0, 8);

  const topUnits = [...products].slice(0, 8);
  const topRevenue = [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  const heroProducts = [...products]
    .sort((a, b) => b.commerceScore - a.commerceScore || b.unitsSold - a.unitsSold)
    .slice(0, 8);
  const topProducts = topUnits;

  const averageOrderValue =
    rollup.orderCount > 0
      ? Math.round((rollup.totalRevenue / rollup.orderCount) * 100) / 100
      : 0;

  return {
    summary: {
      totalRevenue: rollup.totalRevenue,
      totalUnits: rollup.totalUnits,
      totalOrders: rollup.orderCount,
      averageOrderValue,
      currency: rollup.currency,
      firstOrderDate: rollup.firstOrderDate,
      lastOrderDate: rollup.lastOrderDate,
      productsWithSales: products.length,
      repeatPurchaseProductCount: repeatPurchaseProducts.length,
      historicalProductCount: products.filter((p) => !p.inActiveCatalog).length,
    },
    products,
    byProductId,
    topProducts,
    topRevenue,
    topUnits,
    topCollections: topCollections.slice(0, 8),
    topCategories,
    seasonality,
    heroProducts,
    repeatPurchaseProducts,
    allTimeBestseller: topUnits[0] ?? null,
    highestRevenueProduct: topRevenue[0] ?? null,
    mostSoldCategory: topCategories[0] ?? null,
    strongestCollection: topCollections[0] ?? null,
    debug: options?.debug,
    loadError: options?.loadError ?? null,
    warnings: options?.warnings,
    historical: options?.historical,
    import: options?.import ?? null,
  };
}

export async function fetchCommerceIntelligence(
  knowledge: ShopifyKnowledge,
): Promise<CommerceIntelligence> {
  const resolution = await commerceHistoryProvider.resolve(knowledge);
  const debug = resolution.debug ?? (await probeShopifyOrdersAccess());
  const { rollup, status } = await commerceHistoryProvider.loadRollup(
    knowledge,
    resolution,
  );
  const warnings = buildCommerceWarnings(debug, status);

  return calculateCommerceIntelligence(knowledge, rollup, {
    debug,
    warnings,
    historical: status,
  });
}

export async function loadCommerceIntelligenceSafe(
  knowledge: ShopifyKnowledge,
): Promise<CommerceIntelligence> {
  const currency = knowledge.products[0]?.currency ?? "EUR";
  const emptyRollup: CommerceOrderRollup = {
    productAggregates: new Map(),
    orderCount: 0,
    totalRevenue: 0,
    totalUnits: 0,
    currency,
    firstOrderDate: null,
    lastOrderDate: null,
    monthlyOrders: new Map(),
  };

  try {
    const resolution = await commerceHistoryProvider.resolve(knowledge);
    const debug = resolution.debug;

    let historicalImport: HistoricalIntelligence | null = null;
    if (resolution.status.source === "csv-import") {
      const { loadHistoricalIntelligence } = await import(
        "@/lib/commerce/historical-intelligence"
      );
      historicalImport = await loadHistoricalIntelligence(knowledge);
    }

    if (!resolution.shouldLoadOrders) {
      const warnings = debug
        ? buildCommerceWarnings(debug, resolution.status)
        : resolution.status.warning
          ? [resolution.status.warning]
          : [];

      return calculateCommerceIntelligence(knowledge, emptyRollup, {
        debug,
        warnings,
        historical: resolution.status,
        import: historicalImport,
      });
    }

    const { rollup, status } = await commerceHistoryProvider.loadRollup(
      knowledge,
      resolution,
    );
    const warnings = debug
      ? buildCommerceWarnings(debug, status)
      : status.warning
        ? [status.warning]
        : [];

    return calculateCommerceIntelligence(knowledge, rollup, {
      debug,
      warnings,
      historical: status,
      import: historicalImport,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load order history";
    console.warn("[Commerce Intelligence] Failed to load order history", message, error);

    return calculateCommerceIntelligence(knowledge, emptyRollup, {
      loadError: message,
      warnings: [HISTORICAL_READ_ALL_ORDERS_WARNING],
      historical: {
        mode: "catalog-only",
        available: false,
        source: null,
        warning: message,
        placeholders: {
          historicalRevenue: "unavailable",
          historicalUnits: "unavailable",
          historicalBestseller: "unavailable",
        },
      },
    });
  }
}

export function mergeHistoricalProducts(
  knowledge: ShopifyKnowledge,
  commerce: CommerceIntelligence,
): ShopifyKnowledgeProduct[] {
  const merged = new Map(knowledge.products.map((p) => [p.id, p]));

  for (const record of commerce.products) {
    if (merged.has(record.productId)) continue;
    merged.set(record.productId, {
      id: record.productId,
      title: record.title,
      handle: record.productId.split("/").pop() ?? record.productId,
      status: "ARCHIVED",
      productType: record.productType,
      price: "0",
      currency: record.currency,
      inventory: 0,
      collections: record.collections,
      tags: ["historical-sales"],
      colors: [],
      materials: [],
    });
  }

  return [...merged.values()];
}

export function getCommerceAggregateForProduct(
  rollup: CommerceOrderRollup,
  productId: string,
): InternalProductAggregate | undefined {
  return rollup.productAggregates.get(productId);
}

export type { InternalProductAggregate };

export function formatCommerceCurrency(amount: number, currency: string): string {
  return `${amount.toFixed(amount % 1 === 0 ? 0 : 2)} ${currency}`;
}
