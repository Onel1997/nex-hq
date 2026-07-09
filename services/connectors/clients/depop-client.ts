import type {
  DepopIntelligenceData,
  DepopListing,
  DepopMention,
  DepopPriceBand,
} from "../depop";

const DEFAULT_BASE = "https://partnerapi.depop.com";
const STAGING_BASE = "https://partnerapi-staging.depop.com";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_LISTINGS = 200;
const PAGE_LIMIT = 100;

/**
 * Depop Partner Selling API limitations (documented for the Data Sources Center):
 * - Depop has NO public marketplace search/browse API. The official Partner Selling
 *   API (partnerapi.depop.com) is private — access requires Depop partner approval
 *   (contact partners@depop.com). We never scrape depop.com or bypass protections.
 * - Live data is limited to the authenticated seller's own inventory via
 *   GET /api/v1/products/ — NOT global Depop streetwear trends or competitor listings.
 * - Pagination returns max 100 products per request; full sync may require multiple calls.
 * - Size labels require Depop taxonomy resolution — size_id is reported when taxonomy
 *   names are unavailable. Seller location comes from listing address metadata only.
 * - Resale demand signals are inventory proxies (active vs sold counts, freshness) —
 *   not platform-wide sales volume.
 */
export const DEPOP_API_LIMITATIONS =
  "Depop has no public marketplace API — only the private Partner Selling API (partner-approved). Live data is your authenticated seller inventory only, not global Depop trends. No scraping. Size may show as size_id without taxonomy. Demand signals are inventory proxies, not platform sales volume.";

const STREETWEAR_KEYWORDS = [
  "streetwear",
  "vintage",
  "y2k",
  "archive",
  "rare",
  "grail",
  "oversized",
  "boxy",
  "cargo",
  "hoodie",
  "tee",
  "sneaker",
  "jordan",
  "nike",
  "adidas",
  "supreme",
  "stussy",
  "corteiz",
  "represent",
  "gorpcore",
  "techwear",
  "workwear",
  "preloved",
  "deadstock",
];

const SILHOUETTE_TERMS = [
  "oversized",
  "boxy",
  "baggy",
  "wide leg",
  "wide-leg",
  "slim",
  "cropped",
  "relaxed",
  "tailored",
];

const STOPWORDS = new Set([
  "this",
  "that",
  "with",
  "from",
  "have",
  "your",
  "they",
  "will",
  "into",
  "about",
  "size",
  "condition",
  "shipping",
  "depop",
  "item",
  "brand",
  "black",
  "white",
]);

interface DepopAddress {
  country_code?: string;
  state?: string;
}

interface DepopProduct {
  sku?: string | null;
  product_id?: number;
  slug?: string;
  status?: string;
  address?: DepopAddress;
  description?: string;
  price_currency?: string;
  price_amount?: string;
  current_price?: string;
  discount_price?: string;
  department?: string;
  product_type?: string;
  size_set_id?: number;
  size_id?: number;
  condition?: string;
  colour?: string[];
  style?: string[];
  brand?: string;
  attributes?: Record<string, string[]>;
  is_boosted?: boolean;
  source?: string[];
  created_at?: string;
  updated_at?: string;
}

interface ProductsListResponse {
  meta?: { cursor?: string; has_more?: boolean };
  data?: DepopProduct[];
  error?: string;
  message?: string;
}

function apiBase(): string {
  const custom = process.env.DEPOP_API_BASE_URL?.trim();
  if (custom) return custom.replace(/\/$/, "");
  if (process.env.DEPOP_API_ENV?.trim()?.toLowerCase() === "staging") {
    return STAGING_BASE;
  }
  return DEFAULT_BASE;
}

export function isDepopLiveConfigured(): boolean {
  return Boolean(process.env.DEPOP_API_KEY?.trim());
}

function getBearerToken(): string {
  const token = process.env.DEPOP_API_KEY?.trim();
  if (!token) throw new Error("DEPOP_API_KEY not configured");
  return token;
}

async function depopApi<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const token = getBearerToken();
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
        Accept: "application/json",
      },
      signal: controller.signal,
      next: { revalidate: 1200 },
    });

    const text = await response.text();
    let parsed: T & ProductsListResponse;
    try {
      parsed = JSON.parse(text) as T & ProductsListResponse;
    } catch {
      throw new Error(
        `Depop API ${response.status}: ${text.slice(0, 160) || response.statusText}`,
      );
    }

    if (!response.ok) {
      const message = parsed.message ?? parsed.error ?? response.statusText;
      if (response.status === 401) {
        throw new Error(`Depop API unauthorized — check DEPOP_API_KEY (${message})`);
      }
      if (response.status === 403) {
        throw new Error(`Depop API forbidden — partner access required (${message})`);
      }
      throw new Error(`Depop API ${response.status}: ${message}`);
    }

    return parsed;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Depop API timeout after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parsePrice(product: DepopProduct): number {
  const raw =
    product.current_price ?? product.discount_price ?? product.price_amount;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function listingTitle(product: DepopProduct): string {
  const description = product.description?.trim() ?? "";
  const firstLine = description.split("\n")[0]?.trim();
  if (firstLine && firstLine.length > 3) return firstLine.slice(0, 140);
  const brand = product.brand?.trim();
  const type = product.product_type?.trim();
  if (brand && type) return `${brand} ${type}`;
  if (brand) return brand;
  if (type) return type;
  return product.slug ?? `Listing ${product.product_id ?? ""}`.trim();
}

function listingLocation(product: DepopProduct): string | null {
  const country = product.address?.country_code?.trim();
  const state = product.address?.state?.trim();
  if (country && state) return `${state}, ${country}`;
  if (country) return country;
  return null;
}

function freshnessDays(createdAt?: string): number | null {
  if (!createdAt) return null;
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) return null;
  return Math.round((Date.now() - created) / (24 * 60 * 60 * 1000));
}

function mapListing(product: DepopProduct): DepopListing | null {
  const listingId = product.product_id;
  if (!listingId) return null;

  const materials = product.attributes?.material ?? [];
  const size =
    product.size_id != null ? `size_id:${product.size_id}` : null;

  return {
    listingId,
    sku: product.sku ?? null,
    title: listingTitle(product),
    brand: product.brand?.trim() || null,
    price: parsePrice(product),
    currency: product.price_currency ?? "GBP",
    colors: product.colour ?? [],
    materials,
    size,
    category: [product.department, product.product_type]
      .filter(Boolean)
      .join(" / ") || "uncategorized",
    styleTags: product.style ?? [],
    condition: product.condition ?? null,
    status: product.status ?? "unknown",
    location: listingLocation(product),
    publishedAt: product.created_at ?? null,
    freshnessDays: freshnessDays(product.created_at),
  };
}

async function fetchAllProducts(): Promise<DepopProduct[]> {
  const products: DepopProduct[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore && products.length < MAX_LISTINGS) {
    const params: Record<string, string> = {
      limit: String(Math.min(PAGE_LIMIT, MAX_LISTINGS - products.length)),
      sort_by: "id_desc",
    };
    if (cursor) params.cursor = cursor;

    const response = await depopApi<ProductsListResponse>(
      "/api/v1/products/",
      params,
    );
    const batch = response.data ?? [];
    products.push(...batch);

    hasMore = Boolean(response.meta?.has_more && response.meta?.cursor);
    cursor = response.meta?.cursor;
    if (batch.length === 0) break;
  }

  return products;
}

function mentionCounts(
  items: string[],
  limit: number,
): DepopMention[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const term = item.trim().toLowerCase();
    if (!term) continue;
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}

function countInHaystacks(
  haystacks: string[],
  terms: string[],
  limit: number,
): DepopMention[] {
  const counts = new Map<string, number>();
  for (const term of terms) {
    const needle = term.toLowerCase();
    let count = 0;
    for (const hay of haystacks) {
      if (hay.includes(needle)) count += 1;
    }
    if (count > 0) counts.set(term, count);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}

function buildPriceBands(listings: DepopListing[]): DepopPriceBand[] {
  const byCategory = new Map<string, DepopListing[]>();
  for (const listing of listings) {
    const key = listing.category.split(" / ")[0] || listing.category;
    const list = byCategory.get(key) ?? [];
    list.push(listing);
    byCategory.set(key, list);
  }

  const bands: DepopPriceBand[] = [];
  for (const [category, group] of byCategory) {
    const prices = group.map((l) => l.price).filter((p) => p > 0).sort((a, b) => a - b);
    if (prices.length === 0) continue;
    const currency = group[0]?.currency ?? "GBP";
    bands.push({
      category,
      min: Math.round(prices[0]),
      max: Math.round(prices[prices.length - 1]),
      sweet: Math.round(prices[Math.floor(prices.length / 2)]),
      currency,
    });
  }
  return bands.sort((a, b) => b.max - a.max).slice(0, 8);
}

function buildRepeatedTitlePatterns(listings: DepopListing[]): string[] {
  const phrases = new Map<string, number>();
  for (const listing of listings) {
    const words = listing.title
      .toLowerCase()
      .replace(/[^\w\säöüß#]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3);
    for (let i = 0; i < words.length - 1; i++) {
      if (STOPWORDS.has(words[i]) || STOPWORDS.has(words[i + 1])) continue;
      const phrase = `${words[i]} ${words[i + 1]}`;
      phrases.set(phrase, (phrases.get(phrase) ?? 0) + 1);
    }
  }
  return [...phrases.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([phrase, count]) => `"${phrase}" in ${count} titles`);
}

function buildStreetwearKeywords(haystacks: string[]): DepopMention[] {
  const fromLexicon = countInHaystacks(haystacks, STREETWEAR_KEYWORDS, 12);
  const hashtagCounts = new Map<string, number>();
  for (const hay of haystacks) {
    const tags = hay.match(/#[\wäöüß]+/g) ?? [];
    for (const tag of tags) {
      const normalized = tag.slice(1).toLowerCase();
      if (normalized.length < 3) continue;
      hashtagCounts.set(normalized, (hashtagCounts.get(normalized) ?? 0) + 1);
    }
  }
  const fromHashtags = [...hashtagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([term, count]) => ({ term: `#${term}`, count }));

  const merged = new Map<string, number>();
  for (const mention of [...fromLexicon, ...fromHashtags]) {
    merged.set(mention.term, (merged.get(mention.term) ?? 0) + mention.count);
  }
  return [...merged.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .map(([term, count]) => ({ term, count }));
}

function buildRisingStyles(listings: DepopListing[]): DepopMention[] {
  const recent = listings.filter(
    (l) => l.freshnessDays != null && l.freshnessDays <= 14,
  );
  const pool = recent.length >= 3 ? recent : listings;
  const styles = pool.flatMap((l) => l.styleTags);
  return mentionCounts(styles, 10);
}

function buildResaleDemandProxies(
  listings: DepopListing[],
  raw: DepopProduct[],
): string[] {
  const selling = listings.filter((l) =>
    /onsale|selling|active/i.test(l.status),
  ).length;
  const sold = listings.filter((l) => /sold/i.test(l.status)).length;
  const boosted = raw.filter((p) => p.is_boosted).length;
  const proxies: string[] = [];

  if (listings.length > 0) {
    proxies.push(`${selling} active listings · ${sold} sold in inventory sample`);
  }
  if (boosted > 0) {
    proxies.push(`${boosted} boosted listings in partner inventory`);
  }
  const fresh = listings.filter(
    (l) => l.freshnessDays != null && l.freshnessDays <= 7,
  ).length;
  if (fresh > 0) {
    proxies.push(`${fresh} listings added in the last 7 days`);
  }
  const avgFresh =
    listings
      .map((l) => l.freshnessDays)
      .filter((d): d is number => d != null);
  if (avgFresh.length > 0) {
    const avg = Math.round(
      avgFresh.reduce((sum, d) => sum + d, 0) / avgFresh.length,
    );
    proxies.push(`Average listing age: ${avg} days (freshness proxy)`);
  }

  return proxies.slice(0, 5);
}

function aggregate(
  raw: DepopProduct[],
  listings: DepopListing[],
): DepopIntelligenceData {
  const haystacks = listings.map(
    (l) =>
      `${l.title} ${l.brand ?? ""} ${l.styleTags.join(" ")} ${l.colors.join(" ")}`.toLowerCase(),
  );

  return {
    listings,
    risingStyles: buildRisingStyles(listings),
    popularBrands: mentionCounts(
      listings.map((l) => l.brand ?? "").filter(Boolean),
      12,
    ),
    priceBands: buildPriceBands(listings),
    colorTrends: mentionCounts(
      listings.flatMap((l) => l.colors),
      10,
    ),
    silhouetteTrends: countInHaystacks(haystacks, SILHOUETTE_TERMS, 10),
    productTypeTrends: mentionCounts(
      listings.map((l) => l.category),
      10,
    ),
    repeatedTitlePatterns: buildRepeatedTitlePatterns(listings),
    streetwearKeywords: buildStreetwearKeywords(haystacks),
    resaleDemandProxies: buildResaleDemandProxies(listings, raw),
  };
}

/** Cheap health ping — verifies Partner API credentials against GET /api/v1/products. */
export async function pingDepopLive(): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
}> {
  if (!isDepopLiveConfigured()) {
    return {
      ok: false,
      latencyMs: 0,
      message: "DEPOP_API_KEY not configured",
    };
  }

  const started = Date.now();
  try {
    const response = await depopApi<ProductsListResponse>("/api/v1/products/", {
      limit: "1",
    });
    const latencyMs = Date.now() - started;
    const count = response.data?.length ?? 0;
    return {
      ok: true,
      latencyMs,
      message: `Live · Depop Partner API reachable · ${count > 0 ? "inventory accessible" : "authenticated (empty inventory)"}`,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message:
        error instanceof Error ? error.message : "Depop health ping failed",
    };
  }
}

/** Fetch live Depop resale intelligence from the official Partner Selling API. */
export async function fetchLiveDepop(): Promise<DepopIntelligenceData> {
  if (!isDepopLiveConfigured()) {
    throw new Error("DEPOP_API_KEY not configured");
  }

  const raw = await fetchAllProducts();
  const listings = raw
    .map(mapListing)
    .filter((listing): listing is DepopListing => listing != null);

  if (listings.length === 0) {
    throw new Error(
      "Depop Partner API returned no listings — inventory may be empty or credentials lack products_read scope",
    );
  }

  return aggregate(raw, listings);
}
