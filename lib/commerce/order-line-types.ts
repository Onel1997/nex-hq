/** Client-safe Shopify export row shape (no filesystem imports). */

export type ShopifyFinancialStatus =
  | "paid"
  | "partially_refunded"
  | "refunded"
  | "pending"
  | "authorized"
  | "voided"
  | "unknown";

export interface ShopifyOrderLineRow {
  orderName: string;
  paidAt: string;
  /** @deprecated Use paidAt — kept for existing callers. */
  createdAt: string;
  financialStatus: ShopifyFinancialStatus;
  orderSubtotal: number;
  orderTotal: number;
  lineitemQuantity: number;
  lineitemName: string;
  lineitemPrice: number;
  vendor: string;
  lineRevenue: number;
}

export interface ParsedShopifyOrder {
  orderName: string;
  paidAt: string;
  financialStatus: ShopifyFinancialStatus;
  subtotal: number;
  total: number;
  revenue: number;
  units: number;
  lineItems: ShopifyOrderLineRow[];
}

export interface HistoricalImportDiagnostics {
  rows: number;
  uniqueOrders: number;
  paidOrders: number;
  refundedOrders: number;
  partiallyRefundedOrders: number;
  units: number;
  revenue: number;
}

export interface ParsedShopifyOrdersSummary {
  totalOrders: number;
  totalRevenue: number;
  totalUnits: number;
  averageOrderValue: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
}

export interface ParsedShopifyOrdersExport {
  sourcePath: string;
  rowCount: number;
  orders: ParsedShopifyOrder[];
  lineItems: ShopifyOrderLineRow[];
  currency: string;
  summary: ParsedShopifyOrdersSummary;
  diagnostics: HistoricalImportDiagnostics;
}
