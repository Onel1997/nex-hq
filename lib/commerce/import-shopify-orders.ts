import fs from "node:fs/promises";
import path from "node:path";

/** One parsed row from a Shopify orders export (line-item level). */
export interface ShopifyOrderLineRow {
  orderName: string;
  createdAt: string;
  orderTotal: number;
  lineitemQuantity: number;
  lineitemName: string;
  lineitemPrice: number;
  vendor: string;
  lineRevenue: number;
}

export interface ParsedShopifyOrdersExport {
  sourcePath: string;
  rowCount: number;
  lineItems: ShopifyOrderLineRow[];
  currency: string;
}

const COLUMN_ALIASES: Record<keyof Omit<ShopifyOrderLineRow, "lineRevenue">, string[]> = {
  orderName: ["name"],
  createdAt: ["created at", "created_at"],
  orderTotal: ["total"],
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

function parseAmount(value: string): number {
  const cleaned = value.replace(/[^\d.,-]/g, "").replace(",", ".");
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseQuantity(value: string): number {
  const parsed = parseInt(value.trim(), 10);
  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
}

function inferCurrencyFromTotal(raw: string): string {
  if (/€|eur/i.test(raw)) return "EUR";
  if(/\$|usd/i.test(raw)) return "USD";
  if (/£|gbp/i.test(raw)) return "GBP";
  return "EUR";
}

function buildColumnMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as Array<
    [keyof typeof COLUMN_ALIASES, string[]]
  >) {
    const index = findColumnIndex(headers, aliases);
    if (index >= 0) map[field] = index;
  }
  return map;
}

/** Resolve CSV path from env or default data directory locations. */
export async function resolveCommerceHistoryCsvPath(): Promise<string | null> {
  const candidates = [
    process.env.COMMERCE_HISTORY_CSV_PATH?.trim(),
    path.join(process.cwd(), "data/commerce/shopify-orders-export.csv"),
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

/** Parse a Shopify Admin orders export CSV into normalized line-item rows. */
export async function parseShopifyOrdersExport(
  filePath: string,
): Promise<ParsedShopifyOrdersExport> {
  const raw = await fs.readFile(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return {
      sourcePath: filePath,
      rowCount: 0,
      lineItems: [],
      currency: "EUR",
    };
  }

  const headers = parseCsvLine(lines[0] ?? "");
  const columns = buildColumnMap(headers);

  const required = [
    "orderName",
    "createdAt",
    "lineitemQuantity",
    "lineitemName",
    "lineitemPrice",
  ] as const;

  for (const field of required) {
    if (columns[field] === undefined) {
      throw new Error(
        `Shopify orders CSV missing required column for "${field}" in ${filePath}`,
      );
    }
  }

  const lineItems: ShopifyOrderLineRow[] = [];
  let currency = "EUR";

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const lineitemName = cells[columns.lineitemName]?.trim() ?? "";
    if (!lineitemName) continue;

    const quantity = parseQuantity(cells[columns.lineitemQuantity] ?? "0");
    if (quantity <= 0) continue;

    const lineitemPrice = parseAmount(cells[columns.lineitemPrice] ?? "0");
    const orderTotalRaw = columns.orderTotal !== undefined
      ? cells[columns.orderTotal] ?? ""
      : "";
    if (orderTotalRaw) currency = inferCurrencyFromTotal(orderTotalRaw);

    lineItems.push({
      orderName: cells[columns.orderName]?.trim() ?? "",
      createdAt: cells[columns.createdAt]?.trim() ?? "",
      orderTotal: columns.orderTotal !== undefined
        ? parseAmount(cells[columns.orderTotal] ?? "0")
        : lineitemPrice * quantity,
      lineitemQuantity: quantity,
      lineitemName,
      lineitemPrice,
      vendor: columns.vendor !== undefined ? cells[columns.vendor]?.trim() ?? "" : "",
      lineRevenue: Math.round(lineitemPrice * quantity * 100) / 100,
    });
  }

  return {
    sourcePath: filePath,
    rowCount: lineItems.length,
    lineItems,
    currency,
  };
}

export async function loadShopifyOrdersExport(): Promise<ParsedShopifyOrdersExport | null> {
  const filePath = await resolveCommerceHistoryCsvPath();
  if (!filePath) return null;
  return parseShopifyOrdersExport(filePath);
}
