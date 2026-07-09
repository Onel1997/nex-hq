/** Client-safe commerce intelligence types — no server-only, SDK, or env access. */

import type { HistoricalIntelligence } from "@/lib/commerce/historical-intelligence-types";
import type { CommerceHistoricalStatus } from "@/lib/shopify/commerce-shared";

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
  debug?: CommerceIntelligenceDebug;
  loadError?: string | null;
  warnings?: string[];
  historical?: CommerceHistoricalStatus;
  import?: HistoricalIntelligence | null;
}

export interface InternalProductAggregate {
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
