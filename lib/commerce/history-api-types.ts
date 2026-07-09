/** Client-safe types for `/api/commerce/history` responses. */

export interface CommerceHistoryTopProduct {
  title: string;
  unitsSold: number;
  revenue: number;
  orderCount: number;
  historicalScore: number;
  bestsellerRank: number;
  productKey: string;
}

export interface CommerceHistoryTopCategory {
  category: string;
  unitsSold: number;
  revenue: number;
}

export interface CommerceHistoryResponse {
  revenue: number;
  orders: number;
  units: number;
  currency: string;
  averageOrderValue: number;
  topProducts: CommerceHistoryTopProduct[];
  topCategories: CommerceHistoryTopCategory[];
  firstSale: string | null;
  lastSale: string | null;
  diagnostics?: CommerceHistoryDiagnostics;
}

export interface CommerceHistoryDiagnostics {
  rows: number;
  uniqueOrders: number;
  paidOrders: number;
  refundedOrders: number;
  partiallyRefundedOrders: number;
  units: number;
  revenue: number;
}
