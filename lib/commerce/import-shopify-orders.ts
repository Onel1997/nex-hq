import "server-only";

import fs from "fs/promises";
import path from "path";
import type {
  HistoricalImportDiagnostics,
  ParsedShopifyOrder,
  ParsedShopifyOrdersExport,
  ParsedShopifyOrdersSummary,
  ShopifyFinancialStatus,
  ShopifyOrderLineRow,
} from "@/lib/commerce/order-line-types";

export type {
  HistoricalImportDiagnostics,
  ParsedShopifyOrder,
  ParsedShopifyOrdersExport,
  ParsedShopifyOrdersSummary,
  ShopifyFinancialStatus,
  ShopifyOrderLineRow,
} from "@/lib/commerce/order-line-types";

interface ColumnMap {
  name?: number;
  paidAt?: number;
  financialStatus?: number;
  subtotal?: number;
  total?: number;
  refundedAmount?: number;
  lineitemQuantity?: number;
  lineitemName?: number;
  lineitemPrice?: number;
  vendor?: number;
}

interface OrderDraft {
  orderName: string;
  paidAt: string;
  financialStatus: ShopifyFinancialStatus;
  subtotal: number;
  total: number;
  refundedAmount: number;
  lineItems: Array<{
    lineitemName: string;
    lineitemQuantity: number;
    lineitemPrice: number;
    vendor: string;
  }>;
}

const COLUMN_ALIASES: Record<keyof ColumnMap, string[]> = {
  name: ["name"],
  paidAt: ["paid at", "paid_at", "created at", "created_at"],
  financialStatus: ["financial status", "financial_status"],
  subtotal: ["subtotal"],
  total: ["total"],
  refundedAmount: ["refunded amount", "refunded_amount"],
  lineitemQuantity: ["lineitem quantity", "lineitem_quantity"],
  lineitemName: ["lineitem name", "lineitem_name"],
  lineitemPrice: ["lineitem price", "lineitem_price"],
  vendor: ["vendor"],
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  fields.push(current);
  return fields;
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const index = normalized.indexOf(alias);
    if (index >= 0) return index;
  }
  return -1;
}

function parseAmount(value: string | undefined): number {
  if (!value?.trim()) return 0;
  const cleaned = value.replace(/[^\d.,-]/g, "").replace(",", ".");
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseQuantity(value: string | undefined): number {
  if (!value?.trim()) return 0;
  const parsed = parseInt(value.trim(), 10);
  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
}

function inferCurrencyFromTotal(raw: string): string {
  if (/€|eur/i.test(raw)) return "EUR";
  if (/\$|usd/i.test(raw)) return "USD";
  if (/£|gbp/i.test(raw)) return "GBP";
  return "EUR";
}

function buildColumnMap(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as Array<
    [keyof ColumnMap, string[]]
  >) {
    const index = findColumnIndex(headers, aliases);
    if (index >= 0) map[field] = index;
  }
  return map;
}

function cellValue(cells: string[], index: number | undefined): string {
  if (index === undefined) return "";
  return cells[index]?.trim() ?? "";
}

function normalizeFinancialStatus(raw: string): ShopifyFinancialStatus {
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (!normalized) return "unknown";
  if (normalized === "partially_refunded" || normalized === "partially-refunded") {
    return "partially_refunded";
  }
  if (
    normalized === "paid" ||
    normalized === "refunded" ||
    normalized === "pending" ||
    normalized === "authorized" ||
    normalized === "voided"
  ) {
    return normalized;
  }
  return "unknown";
}

function isFullyRefunded(status: ShopifyFinancialStatus): boolean {
  return status === "refunded" || status === "voided";
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function getCell(
  cells: string[],
  columns: ColumnMap,
  field: keyof ColumnMap,
): string {
  return cellValue(cells, columns[field]);
}

function computeOrderNetRevenue(
  draft: OrderDraft,
  hasRefundedAmountColumn: boolean,
): number {
  if (isFullyRefunded(draft.financialStatus)) {
    return 0;
  }

  if (draft.financialStatus === "partially_refunded") {
    if (hasRefundedAmountColumn) {
      return roundMoney(Math.max(0, draft.total - draft.refundedAmount));
    }
    return roundMoney(Math.max(0, draft.total));
  }

  if (draft.financialStatus === "paid") {
    return roundMoney(Math.max(0, draft.total));
  }

  // Other statuses: use order total only — never fall back to line-item prices.
  return roundMoney(Math.max(0, draft.total));
}

function finalizeOrderDraft(
  draft: OrderDraft,
  hasRefundedAmountColumn: boolean,
): ParsedShopifyOrder {
  const grossLineRevenue = draft.lineItems.reduce(
    (sum, item) => sum + item.lineitemPrice * item.lineitemQuantity,
    0,
  );
  const grossUnits = draft.lineItems.reduce(
    (sum, item) => sum + item.lineitemQuantity,
    0,
  );

  const fullyRefunded = isFullyRefunded(draft.financialStatus);
  const orderRevenue = computeOrderNetRevenue(draft, hasRefundedAmountColumn);
  const revenueScale =
    !fullyRefunded && grossLineRevenue > 0 && orderRevenue > 0
      ? orderRevenue / grossLineRevenue
      : 0;

  const lineItems: ShopifyOrderLineRow[] = draft.lineItems.map((item) => {
    const grossRevenue = item.lineitemPrice * item.lineitemQuantity;
    const lineRevenue = roundMoney(grossRevenue * revenueScale);

    return {
      orderName: draft.orderName,
      paidAt: draft.paidAt,
      createdAt: draft.paidAt,
      financialStatus: draft.financialStatus,
      orderSubtotal: draft.subtotal,
      orderTotal: draft.total,
      lineitemQuantity: item.lineitemQuantity,
      lineitemName: item.lineitemName,
      lineitemPrice: item.lineitemPrice,
      vendor: item.vendor,
      lineRevenue,
    };
  });

  const units = fullyRefunded ? 0 : grossUnits;
  const revenue = fullyRefunded
    ? 0
    : roundMoney(
        lineItems.reduce((sum, line) => sum + line.lineRevenue, 0) || orderRevenue,
      );

  return {
    orderName: draft.orderName,
    paidAt: draft.paidAt,
    financialStatus: draft.financialStatus,
    subtotal: draft.subtotal,
    total: draft.total,
    revenue,
    units,
    lineItems,
  };
}

function buildSummary(orders: ParsedShopifyOrder[]): ParsedShopifyOrdersSummary {
  const revenueOrders = orders.filter((order) => order.revenue > 0);
  const totalRevenue = roundMoney(revenueOrders.reduce((sum, order) => sum + order.revenue, 0));
  const totalUnits = revenueOrders.reduce((sum, order) => sum + order.units, 0);
  const totalOrders = revenueOrders.length;

  let firstOrderDate: string | null = null;
  let lastOrderDate: string | null = null;

  for (const order of revenueOrders) {
    if (!order.paidAt) continue;
    const time = new Date(order.paidAt).getTime();
    if (Number.isNaN(time)) continue;
    if (!firstOrderDate || time < new Date(firstOrderDate).getTime()) {
      firstOrderDate = order.paidAt;
    }
    if (!lastOrderDate || time > new Date(lastOrderDate).getTime()) {
      lastOrderDate = order.paidAt;
    }
  }

  return {
    totalOrders,
    totalRevenue,
    totalUnits,
    averageOrderValue:
      totalOrders > 0 ? roundMoney(totalRevenue / totalOrders) : 0,
    firstOrderDate,
    lastOrderDate,
  };
}

function buildDiagnostics(
  rowCount: number,
  orders: ParsedShopifyOrder[],
  summary: ParsedShopifyOrdersSummary,
): HistoricalImportDiagnostics {
  return {
    rows: rowCount,
    uniqueOrders: orders.length,
    paidOrders: orders.filter((order) => order.financialStatus === "paid").length,
    refundedOrders: orders.filter((order) => isFullyRefunded(order.financialStatus)).length,
    partiallyRefundedOrders: orders.filter(
      (order) => order.financialStatus === "partially_refunded",
    ).length,
    units: summary.totalUnits,
    revenue: summary.totalRevenue,
  };
}

function logRevenueByStatus(orders: ParsedShopifyOrder[], currency: string): void {
  const groups = ["paid", "partially_refunded", "refunded", "voided"] as const;
  console.log("Revenue by Financial Status:");
  for (const status of groups) {
    const matching = orders.filter((order) => order.financialStatus === status);
    if (matching.length === 0) continue;
    const revenue = roundMoney(matching.reduce((sum, order) => sum + order.revenue, 0));
    console.log(
      `  ${status.toUpperCase()}: ${matching.length} orders · ${revenue.toFixed(2)} ${currency}`,
    );
  }
}

function logHistoricalImportDiagnostics(
  filePath: string,
  diagnostics: HistoricalImportDiagnostics,
  summary: ParsedShopifyOrdersSummary,
  currency: string,
  orders: ParsedShopifyOrder[],
): void {
  console.log("[Historical Import]");
  console.log(`Source: ${filePath}`);
  console.log(`Rows: ${diagnostics.rows}`);
  console.log(`Unique Orders: ${diagnostics.uniqueOrders}`);
  console.log(`Paid Orders: ${diagnostics.paidOrders}`);
  console.log(`Refunded Orders: ${diagnostics.refundedOrders}`);
  console.log(
    `Partially Refunded Orders: ${diagnostics.partiallyRefundedOrders}`,
  );
  console.log(`Units: ${diagnostics.units}`);
  console.log(`Revenue: ${diagnostics.revenue.toFixed(2)} ${currency}`);
  console.log(`Counting Orders (revenue): ${summary.totalOrders}`);
  console.log(`Average Order Value: ${summary.averageOrderValue.toFixed(2)} ${currency}`);
  console.log(`First Order: ${summary.firstOrderDate ?? "—"}`);
  console.log(`Last Order: ${summary.lastOrderDate ?? "—"}`);
  logRevenueByStatus(orders, currency);
  console.log(`Shopify Dashboard (target): ~5840.00 ${currency}`);
  console.log(
    `Delta vs Dashboard: ${(summary.totalRevenue - 5840).toFixed(2)} ${currency}`,
  );
}

/** Resolve CSV path from env or default data directory locations. */
export async function resolveCommerceHistoryCsvPath(): Promise<string | null> {
  const candidates = [
    process.env.COMMERCE_HISTORY_CSV_PATH?.trim(),
    path.join(process.cwd(), "data/commerce/orders_export_1_2.csv"),
    path.join(process.cwd(), "data/commerce/orders_export.csv"),
    path.join(process.cwd(), "data/commerce/orders-export.csv"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }

  return null;
}

/** Parse a Shopify Admin orders export CSV into grouped, revenue-adjusted orders. */
export async function parseShopifyOrdersExport(
  filePath: string,
): Promise<ParsedShopifyOrdersExport> {
  const raw = await fs.readFile(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    const emptySummary: ParsedShopifyOrdersSummary = {
      totalOrders: 0,
      totalRevenue: 0,
      totalUnits: 0,
      averageOrderValue: 0,
      firstOrderDate: null,
      lastOrderDate: null,
    };

    return {
      sourcePath: filePath,
      rowCount: 0,
      orders: [],
      lineItems: [],
      currency: "EUR",
      summary: emptySummary,
      diagnostics: {
        rows: 0,
        uniqueOrders: 0,
        paidOrders: 0,
        refundedOrders: 0,
        partiallyRefundedOrders: 0,
        units: 0,
        revenue: 0,
      },
    };
  }

  const headers = parseCsvLine(lines[0] ?? "");
  const columns = buildColumnMap(headers);
  const hasRefundedAmountColumn = columns.refundedAmount !== undefined;

  const required: Array<keyof ColumnMap> = [
    "name",
    "lineitemQuantity",
    "lineitemName",
  ];

  for (const field of required) {
    if (columns[field] === undefined) {
      throw new Error(
        `Shopify orders CSV missing required column for "${field}" in ${filePath}`,
      );
    }
  }

  let currency = "EUR";
  const orderMap = new Map<string, OrderDraft>();
  let activeOrderName = "";

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const rowOrderName = getCell(cells, columns, "name");
    if (rowOrderName) activeOrderName = rowOrderName;

    const orderName = rowOrderName || activeOrderName;
    if (!orderName) continue;

    let draft = orderMap.get(orderName);
    if (!draft) {
      draft = {
        orderName,
        paidAt: "",
        financialStatus: "unknown",
        subtotal: 0,
        total: 0,
        refundedAmount: 0,
        lineItems: [],
      };
      orderMap.set(orderName, draft);
    }

    const paidAt = getCell(cells, columns, "paidAt");
    if (paidAt) draft.paidAt = paidAt;

    const financialStatus = getCell(cells, columns, "financialStatus");
    if (financialStatus) {
      draft.financialStatus = normalizeFinancialStatus(financialStatus);
    }

    const subtotal = parseAmount(getCell(cells, columns, "subtotal"));
    if (subtotal > 0) draft.subtotal = subtotal;

    const totalRaw = getCell(cells, columns, "total");
    if (totalRaw !== "") {
      draft.total = parseAmount(totalRaw);
      if (draft.total > 0) currency = inferCurrencyFromTotal(totalRaw);
    }

    const refundedAmount = parseAmount(getCell(cells, columns, "refundedAmount"));
    if (refundedAmount > 0) draft.refundedAmount = refundedAmount;

    const lineitemName = getCell(cells, columns, "lineitemName");
    if (!lineitemName) continue;

    const quantity = parseQuantity(getCell(cells, columns, "lineitemQuantity"));
    if (quantity <= 0) continue;

    const lineitemPrice = parseAmount(getCell(cells, columns, "lineitemPrice"));
    draft.lineItems.push({
      lineitemName,
      lineitemQuantity: quantity,
      lineitemPrice,
      vendor: getCell(cells, columns, "vendor"),
    });
  }

  const orderDrafts = [...orderMap.values()].filter((draft) => draft.lineItems.length > 0);

  const orders = orderDrafts.map((draft) =>
    finalizeOrderDraft(draft, hasRefundedAmountColumn),
  );
  const lineItems = orders.flatMap((order) =>
    isFullyRefunded(order.financialStatus) || order.revenue <= 0
      ? []
      : order.lineItems,
  );
  const summary = buildSummary(orders);
  const diagnostics = buildDiagnostics(lines.length - 1, orders, summary);

  logHistoricalImportDiagnostics(filePath, diagnostics, summary, currency, orders);

  return {
    sourcePath: filePath,
    rowCount: lines.length - 1,
    orders,
    lineItems,
    currency,
    summary,
    diagnostics,
  };
}

export async function loadShopifyOrdersExport(): Promise<ParsedShopifyOrdersExport | null> {
  const filePath = await resolveCommerceHistoryCsvPath();
  if (!filePath) return null;
  return parseShopifyOrdersExport(filePath);
}
