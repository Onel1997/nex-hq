import type {
  StockXIntelligenceData,
  StockXMention,
  StockXPremiumBand,
  StockXProduct,
} from "../stockx";

const DEFAULT_API_BASE = "https://api.stockx.com/v2";
const TOKEN_URL = "https://accounts.stockx.com/oauth/token";
const REQUEST_TIMEOUT_MS = 12_000;
const RATE_LIMIT_MS = 1_100;
const PAGE_SIZE = 10;
const MAX_PRODUCTS = 80;

/**
 * Curated streetwear / resale catalog searches (official catalog/search only).
 * Rate-limited to ~1 req/sec per StockX developer policy.
 */
const SEARCH_QUERIES: Array<{ category: string; query: string }> = [
  { category: "Sneakers", query: "jordan 1" },
  { category: "Sneakers", query: "nike dunk" },
  { category: "Sneakers", query: "new balance 550" },
  { category: "Sneakers", query: "adidas samba" },
  { category: "Streetwear", query: "supreme" },
  { category: "Streetwear", query: "corteiz" },
  { category: "Streetwear", query: "fear of god essentials" },
  { category: "Streetwear", query: "represent" },
  { category: "Streetwear", query: "stussy" },
  { category: "Streetwear", query: "travis scott" },
  { category: "Apparel", query: "yeezy hoodie" },
  { category: "Apparel", query: "chrome hearts" },
];

const SILHOUETTE_PATTERNS: Array<{ match: RegExp; label: string }> = [
  { match: /\bdunk\b/i, label: "Dunk" },
  { match: /\bjordan\s*1\b|\baj1\b/i, label: "Air Jordan 1" },
  { match: /\bair\s*max\b/i, label: "Air Max" },
  { match: /\b550\b|\b990\b|\b2002r\b/i, label: "New Balance" },
  { match: /\bsamba\b|\bgazelle\b/i, label: "Adidas Classic" },
  { match: /\byeezy\b|\b350\b|\b700\b/i, label: "Yeezy" },
  { match: /\bhoodie\b/i, label: "Hoodie" },
  { match: /\bcargo\b/i, label: "Cargo" },
  { match: /\btee\b|t-shirt/i, label: "Tee" },
];

/**
 * StockX API limitations (documented for the Data Sources Center):
 * - StockX has NO open public marketplace API. The official Developer API
 *   (developer.stockx.com) requires application approval and OAuth2 — we never
 *   scrape stockx.com or use unofficial GraphQL/private endpoints.
 * - Authentication requires STOCKX_API_KEY (x-api-key) plus a Bearer access token
 *   from the OAuth authorization-code flow (or refresh token). No token = no live data.
 * - Catalog search returns product metadata from approved endpoints only. Retail price,
 *   market price, and last-sale fields may be null when the API omits them — never
 *   estimated or fabricated.
 * - Default rate limits: ~25,000 requests/day and ~1 request/second. This provider
 *   spaces catalog searches accordingly.
 * - Market-wide trend claims are based on the curated search sample only — not
 *   StockX's full marketplace analytics unless the API explicitly provides them.
 */
export const STOCKX_API_LIMITATIONS =
  "StockX has no open public API — developer approval + OAuth (API key + access token) required. We never scrape stockx.com. Retail/market/last-sale prices appear only when the API returns them (often null). ~25k req/day, ~1 req/sec. Trends are catalog-search samples, not full marketplace analytics.";

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface CatalogSearchResponse {
  products?: Array<Record<string, unknown>>;
  pagination?: {
    pageNumber?: number;
    pageSize?: number;
    hasNextPage?: boolean;
    total?: number;
  };
  message?: string;
  error?: string;
}

function apiBase(): string {
  return (
    process.env.STOCKX_API_BASE_URL?.trim().replace(/\/$/, "") || DEFAULT_API_BASE
  );
}

export function isStockXLiveConfigured(): boolean {
  const apiKey = process.env.STOCKX_API_KEY?.trim();
  const accessToken = process.env.STOCKX_ACCESS_TOKEN?.trim();
  const refreshToken = process.env.STOCKX_REFRESH_TOKEN?.trim();
  const clientId = process.env.STOCKX_CLIENT_ID?.trim();
  const clientSecret = process.env.STOCKX_CLIENT_SECRET?.trim();

  if (!apiKey) return false;
  if (accessToken) return true;
  return Boolean(refreshToken && clientId && clientSecret);
}

function getApiKey(): string {
  const key = process.env.STOCKX_API_KEY?.trim();
  if (!key) throw new Error("STOCKX_API_KEY not configured");
  return key;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function refreshAccessToken(): Promise<string> {
  const clientId = process.env.STOCKX_CLIENT_ID?.trim();
  const clientSecret = process.env.STOCKX_CLIENT_SECRET?.trim();
  const refreshToken = process.env.STOCKX_REFRESH_TOKEN?.trim();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("StockX OAuth refresh credentials incomplete");
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }).toString(),
  });

  const payload = (await response.json()) as TokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(
      `StockX token refresh failed: ${payload.error_description ?? payload.error ?? response.statusText}`,
    );
  }

  return payload.access_token;
}

async function getAccessToken(): Promise<string> {
  const direct = process.env.STOCKX_ACCESS_TOKEN?.trim();
  if (direct) return direct;
  return refreshAccessToken();
}

async function stockxApi<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const token = await getAccessToken();
  const apiKey = getApiKey();
  const url = new URL(`${apiBase()}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-api-key": apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
      next: { revalidate: 1200 },
    });

    const text = await response.text();
    let parsed: T & CatalogSearchResponse;
    try {
      parsed = JSON.parse(text) as T & CatalogSearchResponse;
    } catch {
      throw new Error(
        `StockX API ${response.status}: ${text.slice(0, 160) || response.statusText}`,
      );
    }

    if (!response.ok) {
      const message = parsed.message ?? parsed.error ?? response.statusText;
      if (response.status === 401) {
        throw new Error(`StockX API unauthorized — check OAuth token (${message})`);
      }
      if (response.status === 403) {
        throw new Error(`StockX API forbidden — developer access required (${message})`);
      }
      if (response.status === 429) {
        throw new Error(`StockX API rate limited — ~1 req/sec, 25k/day (${message})`);
      }
      throw new Error(`StockX API ${response.status}: ${message}`);
    }

    return parsed;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`StockX API timeout after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = asNumber(obj[key]);
    if (value != null) return value;
  }
  return null;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function detectSilhouette(title: string): string | null {
  for (const pattern of SILHOUETTE_PATTERNS) {
    if (pattern.match.test(title)) return pattern.label;
  }
  return null;
}

function computePremium(
  retail: number | null,
  market: number | null,
): number | null {
  if (retail == null || market == null || retail <= 0) return null;
  return Math.round(((market - retail) / retail) * 100);
}

function mapProduct(
  raw: Record<string, unknown>,
  searchCategory: string,
): StockXProduct | null {
  const productId =
    pickString(raw, ["productId", "product_id", "id"]) ??
    pickString(raw, ["urlKey", "url_key"]);
  const title = pickString(raw, ["title", "name"]);
  if (!productId || !title) return null;

  const brand = pickString(raw, ["brand"]) ?? "Unknown";
  const retailPrice = pickNumber(raw, [
    "retailPrice",
    "retail_price",
    "msrp",
  ]);
  const marketPrice = pickNumber(raw, [
    "lowestAsk",
    "lowest_ask",
    "marketPrice",
    "market_price",
    "lowestAskAmount",
  ]);
  const lastSale = pickNumber(raw, [
    "lastSale",
    "last_sale",
    "lastSaleAmount",
    "lastSalePrice",
  ]);

  const market = marketPrice ?? lastSale;

  return {
    productId,
    title,
    brand,
    category:
      pickString(raw, ["productCategory", "category", "product_type"]) ??
      searchCategory,
    retailPrice,
    marketPrice: marketPrice ?? null,
    lastSale,
    pricePremium: computePremium(retailPrice, market),
    releaseDate: pickString(raw, ["releaseDate", "release_date"]),
    colorway: pickString(raw, ["colorway", "color"]),
    silhouette: detectSilhouette(title),
    productType:
      pickString(raw, ["productType", "product_type", "model"]) ?? searchCategory,
    styleId: pickString(raw, ["styleId", "style_id", "sku"]),
    urlKey: pickString(raw, ["urlKey", "url_key", "slug"]),
  };
}

async function searchCatalog(
  query: string,
  category: string,
): Promise<StockXProduct[]> {
  const response = await stockxApi<CatalogSearchResponse>("/catalog/search", {
    query,
    pageNumber: "1",
    pageSize: String(PAGE_SIZE),
  });

  return (response.products ?? [])
    .map((item) => mapProduct(item, category))
    .filter((product): product is StockXProduct => product != null);
}

function mentionCounts(items: string[], limit: number): StockXMention[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const term = item.trim();
    if (!term) continue;
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}

function buildPremiumBands(products: StockXProduct[]): StockXPremiumBand[] {
  const byCategory = new Map<string, StockXProduct[]>();
  for (const product of products) {
    const list = byCategory.get(product.category) ?? [];
    list.push(product);
    byCategory.set(product.category, list);
  }

  const bands: StockXPremiumBand[] = [];
  for (const [category, group] of byCategory) {
    const premiums = group
      .map((p) => p.pricePremium)
      .filter((p): p is number => p != null);
    const markets = group
      .map((p) => p.marketPrice ?? p.lastSale)
      .filter((p): p is number => p != null);
    if (markets.length === 0) continue;

    bands.push({
      category,
      min: Math.round(Math.min(...markets)),
      max: Math.round(Math.max(...markets)),
      avgPremium:
        premiums.length > 0
          ? Math.round(premiums.reduce((sum, p) => sum + p, 0) / premiums.length)
          : 0,
      currency: "USD",
    });
  }

  return bands.sort((a, b) => b.max - a.max).slice(0, 8);
}

function buildResaleDemandSignals(products: StockXProduct[]): string[] {
  const signals: string[] = [];
  const withMarket = products.filter(
    (p) => p.marketPrice != null || p.lastSale != null,
  ).length;
  const withPremium = products.filter(
    (p) => p.pricePremium != null && p.pricePremium > 0,
  ).length;
  const withRetail = products.filter((p) => p.retailPrice != null).length;

  if (products.length > 0) {
    signals.push(
      `${withMarket}/${products.length} products expose market or last-sale price via API`,
    );
  }
  if (withPremium > 0) {
    signals.push(`${withPremium} products trading above retail in sample`);
  }
  if (withRetail < products.length) {
    signals.push(
      `${products.length - withRetail} products missing retail price (API returned null — not estimated)`,
    );
  }

  const recent = products.filter((p) => {
    if (!p.releaseDate) return false;
    const age = Date.now() - Date.parse(p.releaseDate);
    return Number.isFinite(age) && age < 180 * 24 * 60 * 60 * 1000;
  }).length;
  if (recent > 0) {
    signals.push(`${recent} products released within the last 6 months in sample`);
  }

  return signals.slice(0, 5);
}

function aggregate(products: StockXProduct[]): StockXIntelligenceData {
  const unique = new Map<string, StockXProduct>();
  for (const product of products) {
    const key = product.styleId ?? product.productId;
    if (!unique.has(key)) unique.set(key, product);
  }
  const list = [...unique.values()].slice(0, MAX_PRODUCTS);

  return {
    products: list,
    risingBrands: mentionCounts(
      list.map((p) => p.brand),
      12,
    ),
    trendingSilhouettes: mentionCounts(
      list.map((p) => p.silhouette ?? "").filter(Boolean),
      10,
    ),
    premiumPriceRanges: buildPremiumBands(list),
    colorwayTrends: mentionCounts(
      list.map((p) => p.colorway ?? "").filter(Boolean),
      10,
    ),
    categoryMovement: mentionCounts(
      list.map((p) => p.category),
      10,
    ),
    resaleDemandSignals: buildResaleDemandSignals(list),
  };
}

/** Cheap health ping — one catalog search against the official API. */
export async function pingStockXLive(): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
}> {
  if (!isStockXLiveConfigured()) {
    return {
      ok: false,
      latencyMs: 0,
      message:
        "STOCKX_API_KEY + OAuth token not configured (developer approval required)",
    };
  }

  const started = Date.now();
  try {
    const products = await searchCatalog("nike dunk", "Sneakers");
    const latencyMs = Date.now() - started;
    return {
      ok: true,
      latencyMs,
      message: `Live · StockX catalog API reachable · ${products.length} product(s) in health query`,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message:
        error instanceof Error ? error.message : "StockX health ping failed",
    };
  }
}

/** Fetch live StockX resale intelligence via the official Developer API. */
export async function fetchLiveStockX(): Promise<StockXIntelligenceData> {
  if (!isStockXLiveConfigured()) {
    throw new Error("StockX developer credentials not configured");
  }

  const collected: StockXProduct[] = [];
  const errors: string[] = [];

  for (const { category, query } of SEARCH_QUERIES) {
    try {
      collected.push(...(await searchCatalog(query, category)));
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : `${query} search failed`,
      );
    }
    await sleep(RATE_LIMIT_MS);
  }

  if (collected.length === 0) {
    throw new Error(
      errors.length > 0
        ? `StockX API returned no products — ${errors[0]}`
        : "StockX API returned no catalog products for the streetwear query set",
    );
  }

  return aggregate(collected);
}
