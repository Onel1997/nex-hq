import type {
  GrailedIntelligenceData,
  GrailedListing,
  GrailedMention,
  GrailedPriceBand,
} from "../grailed";

const REQUEST_TIMEOUT_MS = 12_000;
const MAX_LISTINGS = 200;
const PAGE_LIMIT = 100;

/**
 * Grailed API limitations (documented for the Data Sources Center):
 * - Grailed has NO open public marketplace API. There is no official catalog search,
 *   browse, or trend endpoint for third-party developers. We never scrape grailed.com,
 *   use unofficial Algolia/GraphQL endpoints, or bypass anti-bot protections.
 * - Live mode requires approved partner credentials: GRAILED_API_KEY + GRAILED_API_BASE_URL
 *   pointing to an official Grailed-issued API base when available. Without both, status
 *   is Coming Soon and no resale data is returned.
 * - When a partner API is configured, data is limited to the authenticated seller's own
 *   inventory via GET /api/v1/listings — NOT global Grailed marketplace trends.
 * - Demand proxies (watchers, offers, sold counts) appear only when the API returns them.
 *   We never estimate sales volume or platform-wide demand.
 * - Rate limits depend on Grailed partner agreement — this client paginates conservatively.
 */
export const GRAILED_API_LIMITATIONS =
  "Grailed has no open public API — partner approval + GRAILED_API_KEY + GRAILED_API_BASE_URL required. Live data is your authenticated seller inventory only, not global Grailed trends. No scraping. Demand/sales signals only when the API provides them.";

const ARCHIVE_FASHION_TERMS = [
  "archive",
  "archival",
  "deadstock",
  "vintage",
  "runway",
  "grail",
  "museum",
  "rare",
  "sample",
  "prototype",
  "fw",
  "ss",
  "collection",
  "season",
  "heritage",
  "antique",
  "collectible",
];

const LUXURY_STREETWEAR_TERMS = [
  "raf simons",
  "margiela",
  "balenciaga",
  "vetements",
  "chrome hearts",
  "supreme",
  "kapital",
  "visvim",
  "stone island",
  "acronym",
  "undercover",
  "comme des garcons",
  "saint laurent",
  "bottega",
  "prada",
  "dior",
  "louis vuitton",
  "gucci",
  "fear of god",
  "rick owens",
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
  "double breasted",
  "bomber",
  "parka",
  "blazer",
  "trouser",
  "cargo",
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
  "grailed",
  "item",
  "brand",
  "black",
  "white",
  "menswear",
  "womenswear",
]);

interface GrailedAddress {
  country?: string;
  country_code?: string;
  state?: string;
  city?: string;
}

interface GrailedRawListing {
  id?: string | number;
  listing_id?: string | number;
  slug?: string;
  title?: string;
  name?: string;
  description?: string;
  brand?: string;
  designer?: string;
  designer_name?: string;
  category?: string;
  department?: string;
  product_type?: string;
  price?: number | string;
  price_amount?: number | string;
  price_cents?: number;
  currency?: string;
  size?: string;
  condition?: string;
  color?: string | string[];
  colours?: string[];
  colors?: string[];
  material?: string | string[];
  materials?: string[];
  status?: string;
  state?: string;
  location?: string | GrailedAddress;
  address?: GrailedAddress;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
  watchers_count?: number;
  offers_count?: number;
  favorite_count?: number;
  sold?: boolean;
}

interface ListingsResponse {
  data?: GrailedRawListing[];
  listings?: GrailedRawListing[];
  meta?: { cursor?: string; has_more?: boolean; next_cursor?: string };
  pagination?: { cursor?: string; has_more?: boolean; next_cursor?: string };
  error?: string;
  message?: string;
}

export function isGrailedLiveConfigured(): boolean {
  const apiKey = process.env.GRAILED_API_KEY?.trim();
  const baseUrl = process.env.GRAILED_API_BASE_URL?.trim();
  return Boolean(apiKey && baseUrl);
}

function apiBase(): string {
  const base = process.env.GRAILED_API_BASE_URL?.trim();
  if (!base) throw new Error("GRAILED_API_BASE_URL not configured");
  return base.replace(/\/$/, "");
}

function getBearerToken(): string {
  const token = process.env.GRAILED_API_KEY?.trim();
  if (!token) throw new Error("GRAILED_API_KEY not configured");
  return token;
}

async function grailedApi<T>(
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
    let parsed: T & ListingsResponse;
    try {
      parsed = JSON.parse(text) as T & ListingsResponse;
    } catch {
      throw new Error(
        `Grailed API ${response.status}: ${text.slice(0, 160) || response.statusText}`,
      );
    }

    if (!response.ok) {
      const message = parsed.message ?? parsed.error ?? response.statusText;
      if (response.status === 401) {
        throw new Error(`Grailed API unauthorized — check GRAILED_API_KEY (${message})`);
      }
      if (response.status === 403) {
        throw new Error(`Grailed API forbidden — partner access required (${message})`);
      }
      if (response.status === 404) {
        throw new Error(
          `Grailed API endpoint not found — verify GRAILED_API_BASE_URL is an official partner base (${message})`,
        );
      }
      throw new Error(`Grailed API ${response.status}: ${message}`);
    }

    return parsed;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Grailed API timeout after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parsePrice(raw: GrailedRawListing): number {
  if (raw.price_cents != null) {
    const cents = Number(raw.price_cents);
    if (Number.isFinite(cents)) return Math.round(cents / 100);
  }
  const value = Number(raw.price ?? raw.price_amount);
  return Number.isFinite(value) ? value : 0;
}

function normalizeColors(raw: GrailedRawListing): string[] {
  if (Array.isArray(raw.colors)) return raw.colors.filter(Boolean);
  if (Array.isArray(raw.colours)) return raw.colours.filter(Boolean);
  if (typeof raw.color === "string" && raw.color.trim()) return [raw.color.trim()];
  if (Array.isArray(raw.color)) return raw.color.filter(Boolean);
  return [];
}

function normalizeMaterials(raw: GrailedRawListing): string[] {
  if (Array.isArray(raw.materials)) return raw.materials.filter(Boolean);
  if (typeof raw.material === "string" && raw.material.trim()) {
    return [raw.material.trim()];
  }
  if (Array.isArray(raw.material)) return raw.material.filter(Boolean);
  return [];
}

function listingTitle(raw: GrailedRawListing): string {
  const title = raw.title?.trim() ?? raw.name?.trim();
  if (title && title.length > 3) return title.slice(0, 160);
  const designer = raw.designer_name?.trim() ?? raw.designer?.trim();
  const type = raw.product_type?.trim();
  if (designer && type) return `${designer} ${type}`;
  if (designer) return designer;
  if (type) return type;
  return raw.slug ?? `Listing ${raw.id ?? raw.listing_id ?? ""}`.trim();
}

function listingLocation(raw: GrailedRawListing): string | null {
  if (typeof raw.location === "string" && raw.location.trim()) {
    return raw.location.trim();
  }
  const addr =
    typeof raw.location === "object" ? raw.location : raw.address;
  if (!addr) return null;
  const country = addr.country_code?.trim() ?? addr.country?.trim();
  const state = addr.state?.trim();
  const city = addr.city?.trim();
  if (city && state && country) return `${city}, ${state}, ${country}`;
  if (state && country) return `${state}, ${country}`;
  if (country) return country;
  return null;
}

function freshnessDays(publishedAt?: string): number | null {
  if (!publishedAt) return null;
  const published = Date.parse(publishedAt);
  if (Number.isNaN(published)) return null;
  return Math.round((Date.now() - published) / (24 * 60 * 60 * 1000));
}

function buildDemandProxy(raw: GrailedRawListing): string | null {
  const parts: string[] = [];
  if (raw.watchers_count != null && raw.watchers_count > 0) {
    parts.push(`${raw.watchers_count} watchers`);
  }
  if (raw.offers_count != null && raw.offers_count > 0) {
    parts.push(`${raw.offers_count} offers`);
  }
  if (raw.favorite_count != null && raw.favorite_count > 0) {
    parts.push(`${raw.favorite_count} favorites`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function mapListing(raw: GrailedRawListing): GrailedListing | null {
  const listingId = String(raw.id ?? raw.listing_id ?? "").trim();
  if (!listingId) return null;

  const designer = raw.designer_name?.trim() || raw.designer?.trim() || null;
  const brand = raw.brand?.trim() || designer;
  const category =
    [raw.department, raw.category, raw.product_type].filter(Boolean).join(" / ") ||
    "uncategorized";

  return {
    listingId,
    title: listingTitle(raw),
    brand,
    designer,
    category,
    price: parsePrice(raw),
    currency: raw.currency?.trim() || "USD",
    size: raw.size?.trim() || null,
    condition: raw.condition?.trim() || null,
    colors: normalizeColors(raw),
    materials: normalizeMaterials(raw),
    productType: raw.product_type?.trim() || null,
    status: raw.status?.trim() || raw.state?.trim() || (raw.sold ? "sold" : "active"),
    location: listingLocation(raw),
    publishedAt: raw.published_at ?? raw.created_at ?? null,
    freshnessDays: freshnessDays(raw.published_at ?? raw.created_at),
    demandProxy: buildDemandProxy(raw),
  };
}

async function fetchAllListings(): Promise<GrailedRawListing[]> {
  const listings: GrailedRawListing[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore && listings.length < MAX_LISTINGS) {
    const params: Record<string, string> = {
      limit: String(Math.min(PAGE_LIMIT, MAX_LISTINGS - listings.length)),
    };
    if (cursor) params.cursor = cursor;

    const response = await grailedApi<ListingsResponse>("/api/v1/listings", params);
    const batch = response.data ?? response.listings ?? [];
    listings.push(...batch);

    const meta = response.meta ?? response.pagination;
    hasMore = Boolean(meta?.has_more && (meta?.cursor ?? meta?.next_cursor));
    cursor = meta?.cursor ?? meta?.next_cursor;
    if (batch.length === 0) break;
  }

  return listings;
}

function mentionCounts(items: string[], limit: number): GrailedMention[] {
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
): GrailedMention[] {
  const counts = new Map<string, number>();
  for (const term of terms) {
    const needle = term.toLowerCase();
    let count = 0;
    for (const haystack of haystacks) {
      if (haystack.includes(needle)) count += 1;
    }
    if (count > 0) counts.set(term, count);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}

function buildPriceBands(listings: GrailedListing[]): GrailedPriceBand[] {
  const byCategory = new Map<string, GrailedListing[]>();
  for (const listing of listings) {
    const key = listing.category.split(" / ")[0] || "all";
    const bucket = byCategory.get(key) ?? [];
    bucket.push(listing);
    byCategory.set(key, bucket);
  }

  const bands: GrailedPriceBand[] = [];
  for (const [category, items] of byCategory) {
    const prices = items.map((l) => l.price).filter((p) => p > 0);
    if (prices.length === 0) continue;
    prices.sort((a, b) => a - b);
    const min = prices[0];
    const max = prices[prices.length - 1];
    const sweet = prices[Math.floor(prices.length / 2)];
    bands.push({
      category,
      min,
      max,
      sweet,
      currency: items[0]?.currency ?? "USD",
    });
  }

  return bands.sort((a, b) => b.sweet - a.sweet).slice(0, 8);
}

function buildRepeatedTitlePatterns(listings: GrailedListing[]): string[] {
  const tokens = new Map<string, number>();
  for (const listing of listings) {
    const words = listing.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w));
    for (const word of words) {
      tokens.set(word, (tokens.get(word) ?? 0) + 1);
    }
  }
  return [...tokens.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([term, count]) => `${term} (${count}×)`);
}

function buildRisingDesigners(listings: GrailedListing[]): GrailedMention[] {
  const recent = listings.filter(
    (l) => l.freshnessDays != null && l.freshnessDays <= 21,
  );
  const pool = recent.length >= 3 ? recent : listings;
  return mentionCounts(
    pool.map((l) => l.designer ?? l.brand ?? "").filter(Boolean),
    12,
  );
}

function buildResaleDemandProxies(
  listings: GrailedListing[],
  raw: GrailedRawListing[],
): string[] {
  const active = listings.filter((l) => !/sold/i.test(l.status)).length;
  const sold = listings.filter((l) => /sold/i.test(l.status)).length;
  const withWatchers = raw.filter(
    (r) => r.watchers_count != null && r.watchers_count > 0,
  ).length;
  const withOffers = raw.filter(
    (r) => r.offers_count != null && r.offers_count > 0,
  ).length;
  const proxies: string[] = [];

  if (listings.length > 0) {
    proxies.push(`${active} active listings · ${sold} sold in inventory sample`);
  }
  if (withWatchers > 0) {
    proxies.push(`${withWatchers} listings with API-reported watchers`);
  }
  if (withOffers > 0) {
    proxies.push(`${withOffers} listings with API-reported offers`);
  }
  const fresh = listings.filter(
    (l) => l.freshnessDays != null && l.freshnessDays <= 7,
  ).length;
  if (fresh > 0) {
    proxies.push(`${fresh} listings published in the last 7 days`);
  }
  const listingProxies = listings
    .map((l) => l.demandProxy)
    .filter((p): p is string => Boolean(p));
  if (listingProxies.length > 0) {
    proxies.push(listingProxies[0]);
  }

  return proxies.slice(0, 5);
}

function aggregate(
  raw: GrailedRawListing[],
  listings: GrailedListing[],
): GrailedIntelligenceData {
  const haystacks = listings.map(
    (l) =>
      `${l.title} ${l.brand ?? ""} ${l.designer ?? ""} ${l.colors.join(" ")} ${l.materials.join(" ")}`.toLowerCase(),
  );

  return {
    listings,
    risingDesigners: buildRisingDesigners(listings),
    archiveFashionSignals: countInHaystacks(haystacks, ARCHIVE_FASHION_TERMS, 10),
    luxuryStreetwearSignals: countInHaystacks(
      haystacks,
      LUXURY_STREETWEAR_TERMS,
      10,
    ),
    designerPriceBands: buildPriceBands(listings),
    colorTrends: mentionCounts(listings.flatMap((l) => l.colors), 10),
    silhouetteTrends: countInHaystacks(haystacks, SILHOUETTE_TERMS, 10),
    materialTrends: mentionCounts(listings.flatMap((l) => l.materials), 10),
    repeatedTitlePatterns: buildRepeatedTitlePatterns(listings),
    resaleDemandProxies: buildResaleDemandProxies(listings, raw),
  };
}

/** Cheap health ping — verifies partner API credentials against GET /api/v1/listings. */
export async function pingGrailedLive(): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
}> {
  if (!isGrailedLiveConfigured()) {
    return {
      ok: false,
      latencyMs: 0,
      message: "GRAILED_API_KEY and GRAILED_API_BASE_URL not configured",
    };
  }

  const started = Date.now();
  try {
    const response = await grailedApi<ListingsResponse>("/api/v1/listings", {
      limit: "1",
    });
    const latencyMs = Date.now() - started;
    const count = (response.data ?? response.listings ?? []).length;
    return {
      ok: true,
      latencyMs,
      message: `Live · Grailed partner API reachable · ${count > 0 ? "inventory accessible" : "authenticated (empty inventory)"}`,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message:
        error instanceof Error ? error.message : "Grailed health ping failed",
    };
  }
}

/** Fetch live Grailed resale intelligence from an official partner API when configured. */
export async function fetchLiveGrailed(): Promise<GrailedIntelligenceData> {
  if (!isGrailedLiveConfigured()) {
    throw new Error(
      "Grailed partner API not configured — set GRAILED_API_KEY + GRAILED_API_BASE_URL",
    );
  }

  const raw = await fetchAllListings();
  const listings = raw
    .map(mapListing)
    .filter((listing): listing is GrailedListing => listing != null);

  if (listings.length === 0 && raw.length === 0) {
    return {
      listings: [],
      risingDesigners: [],
      archiveFashionSignals: [],
      luxuryStreetwearSignals: [],
      designerPriceBands: [],
      colorTrends: [],
      silhouetteTrends: [],
      materialTrends: [],
      repeatedTitlePatterns: [],
      resaleDemandProxies: [],
    };
  }

  return aggregate(raw, listings);
}
