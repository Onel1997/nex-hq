/** Client-safe commerce helpers — no filesystem, env, or server imports. */

export const HISTORICAL_READ_ALL_ORDERS_WARNING =
  "Historical sales data requires Shopify read_all_orders access.";

export type CommerceHistorySourceType =
  | "shopify-orders"
  | "csv-import"
  | "manual-import"
  | "analytics";

export type CommerceHistoricalMode = "active" | "recent-only" | "catalog-only";

export interface CommerceHistoryProviderDescriptor {
  id: string;
  label: string;
  sourceType: CommerceHistorySourceType;
  /** True when the provider has a working loader in this codebase. */
  implemented: boolean;
}

export interface CommerceHistoryAccessStatus {
  hasReadOrders: boolean;
  hasReadAllOrders: boolean;
  tokenScopes: string[];
  appAccessScopes: string[];
}

export interface CommerceHistoricalPlaceholders {
  historicalRevenue: number | "unavailable";
  historicalUnits: number | "unavailable";
  historicalBestseller: string | "unavailable";
}

export interface CommerceHistoricalStatus {
  mode: CommerceHistoricalMode;
  available: boolean;
  source: CommerceHistorySourceType | null;
  warning: string | null;
  placeholders: CommerceHistoricalPlaceholders;
}

export interface CommerceHistoryResolution {
  status: CommerceHistoricalStatus;
  access: CommerceHistoryAccessStatus;
  shouldLoadOrders: boolean;
  debug?: {
    hasReadOrders: boolean;
    hasReadAllOrders: boolean;
    tokenScopes: string[];
    appAccessScopes: string[];
    ordersCount?: number;
    ordersCountFromApi?: number;
  };
}

export function isCommerceHistoryActive(
  historical?: CommerceHistoricalStatus | null,
): boolean {
  return Boolean(historical?.available && historical.mode !== "catalog-only");
}

export function formatHistoricalPlaceholder(
  value: number | "unavailable",
  currency?: string,
): string {
  if (value === "unavailable") return "unavailable";
  if (typeof value === "number" && currency) {
    return `${value.toFixed(value % 1 === 0 ? 0 : 2)} ${currency}`;
  }
  return String(value);
}

export function formatCommerceCurrency(amount: number, currency: string): string {
  return `${amount.toFixed(amount % 1 === 0 ? 0 : 2)} ${currency}`;
}
