/** Client-safe historical intelligence types (no filesystem or server imports). */

export type {
  CommerceHistoryResponse,
  CommerceHistoryTopCategory,
  CommerceHistoryTopProduct,
} from "@/lib/commerce/history-api-types";

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

export interface HistoricalIntelligenceSummary {
  totalRevenue: number;
  totalUnits: number;
  totalOrders: number;
  averageOrderValue: number;
  currency: string;
  firstSaleDate: string | null;
  lastSaleDate: string | null;
  productsWithSales: number;
  sourcePath: string | null;
  diagnostics?: {
    rows: number;
    uniqueOrders: number;
    paidOrders: number;
    refundedOrders: number;
    partiallyRefundedOrders: number;
    units: number;
    revenue: number;
  };
}

export interface HistoricalIntelligence {
  summary: HistoricalIntelligenceSummary;
  products: HistoricalProductPerformance[];
  byProductKey: Record<string, HistoricalProductPerformance>;
  byCatalogProductId: Record<string, HistoricalProductPerformance>;
  topProducts: HistoricalProductPerformance[];
  topVendors: HistoricalVendorPerformance[];
  topCategories: HistoricalCategoryPerformance[];
  allTimeBestseller: HistoricalProductPerformance | null;
}
