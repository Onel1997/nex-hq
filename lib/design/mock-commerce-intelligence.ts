/**
 * Client-safe mock commerce intelligence for Design Studio mock mode.
 * Static demo data only — no server-only, Shopify SDK, env, fetch, or Node APIs.
 */

import type {
  CommerceCategoryRecord,
  CommerceCollectionRecord,
  CommerceIntelligence,
  CommerceProductRecord,
  CommerceSeasonalityRecord,
} from "@/lib/shopify/commerce-intelligence-types";

const MOCK_CURRENCY = "EUR";

const MOCK_HOODIE: CommerceProductRecord = {
  productId: "mock-hoodie-1",
  title: "Faith Oversized Hoodie",
  productType: "Hoodie",
  collections: ["Essentials", "Quiet Ascent"],
  revenue: 7120,
  unitsSold: 80,
  orderCount: 74,
  firstSaleDate: "2024-09-12",
  lastSaleDate: "2026-03-18",
  unitsRank: 1,
  revenueRank: 1,
  commerceScore: 92,
  repeatPurchase: true,
  inActiveCatalog: true,
  currency: MOCK_CURRENCY,
};

const MOCK_TEE: CommerceProductRecord = {
  productId: "mock-tee-1",
  title: "Calm Essential Tee",
  productType: "T-Shirt",
  collections: ["Essentials"],
  revenue: 4410,
  unitsSold: 90,
  orderCount: 82,
  firstSaleDate: "2024-08-01",
  lastSaleDate: "2026-03-20",
  unitsRank: 2,
  revenueRank: 2,
  commerceScore: 86,
  repeatPurchase: true,
  inActiveCatalog: true,
  currency: MOCK_CURRENCY,
};

const MOCK_PRODUCTS: CommerceProductRecord[] = [MOCK_HOODIE, MOCK_TEE];

const MOCK_TOP_CATEGORIES: CommerceCategoryRecord[] = [
  {
    category: "Hoodie",
    unitsSold: 80,
    revenue: 7120,
    productCount: 1,
    rank: 1,
  },
  {
    category: "T-Shirt",
    unitsSold: 90,
    revenue: 4410,
    productCount: 1,
    rank: 2,
  },
];

const MOCK_TOP_COLLECTIONS: CommerceCollectionRecord[] = [
  {
    title: "Essentials",
    unitsSold: 170,
    revenue: 11530,
    productCount: 2,
    rank: 1,
  },
  {
    title: "Quiet Ascent",
    unitsSold: 80,
    revenue: 7120,
    productCount: 1,
    rank: 2,
  },
];

const MOCK_SEASONALITY: CommerceSeasonalityRecord[] = [
  { month: 1, monthLabel: "Jan", unitsSold: 18, revenue: 1420, orderCount: 16 },
  { month: 2, monthLabel: "Feb", unitsSold: 14, revenue: 1105, orderCount: 13 },
  { month: 3, monthLabel: "Mar", unitsSold: 22, revenue: 1890, orderCount: 20 },
  { month: 4, monthLabel: "Apr", unitsSold: 16, revenue: 1280, orderCount: 15 },
  { month: 5, monthLabel: "May", unitsSold: 12, revenue: 960, orderCount: 11 },
  { month: 6, monthLabel: "Jun", unitsSold: 10, revenue: 820, orderCount: 9 },
  { month: 7, monthLabel: "Jul", unitsSold: 8, revenue: 640, orderCount: 8 },
  { month: 8, monthLabel: "Aug", unitsSold: 11, revenue: 905, orderCount: 10 },
  { month: 9, monthLabel: "Sep", unitsSold: 15, revenue: 1210, orderCount: 14 },
  { month: 10, monthLabel: "Oct", unitsSold: 19, revenue: 1540, orderCount: 17 },
  { month: 11, monthLabel: "Nov", unitsSold: 24, revenue: 1980, orderCount: 22 },
  { month: 12, monthLabel: "Dec", unitsSold: 21, revenue: 1680, orderCount: 19 },
];

function indexProducts(
  products: CommerceProductRecord[],
): Record<string, CommerceProductRecord> {
  return Object.fromEntries(products.map((product) => [product.productId, product]));
}

/** Static demo commerce intelligence for Design Studio mock mode. */
export const MOCK_COMMERCE_INTELLIGENCE: CommerceIntelligence = {
  summary: {
    totalRevenue: 11530,
    totalUnits: 170,
    totalOrders: 156,
    averageOrderValue: 73.91,
    currency: MOCK_CURRENCY,
    firstOrderDate: "2024-08-01",
    lastOrderDate: "2026-03-20",
    productsWithSales: 2,
    repeatPurchaseProductCount: 2,
    historicalProductCount: 0,
  },
  products: MOCK_PRODUCTS,
  byProductId: indexProducts(MOCK_PRODUCTS),
  topProducts: MOCK_PRODUCTS,
  topRevenue: MOCK_PRODUCTS,
  topUnits: [...MOCK_PRODUCTS].sort((a, b) => b.unitsSold - a.unitsSold),
  topCollections: MOCK_TOP_COLLECTIONS,
  topCategories: MOCK_TOP_CATEGORIES,
  seasonality: MOCK_SEASONALITY,
  heroProducts: [MOCK_HOODIE],
  repeatPurchaseProducts: MOCK_PRODUCTS,
  allTimeBestseller: MOCK_TEE,
  highestRevenueProduct: MOCK_HOODIE,
  mostSoldCategory: MOCK_TOP_CATEGORIES[0] ?? null,
  strongestCollection: MOCK_TOP_COLLECTIONS[0] ?? null,
  historical: {
    mode: "recent-only",
    available: true,
    source: "csv-import",
    warning: null,
    placeholders: {
      historicalRevenue: 11530,
      historicalUnits: 170,
      historicalBestseller: "Calm Essential Tee",
    },
  },
  warnings: ["Mock mode — demo commerce data only"],
};

export function getMockCommerceIntelligence(): CommerceIntelligence {
  return MOCK_COMMERCE_INTELLIGENCE;
}
