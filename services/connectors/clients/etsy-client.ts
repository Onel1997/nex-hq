import type {
  EtsyBestseller,
  EtsyIntelligenceData,
} from "../etsy";

const API_BASE = "https://openapi.etsy.com/v3/application";

/**
 * Fashion/streetwear keyword groups queried against the Etsy Open API v3
 * `listings/active` endpoint. Each group maps to a display category.
 */
const KEYWORD_GROUPS: Array<{ keyword: string; category: string }> = [
  { keyword: "oversized hoodie streetwear", category: "Hoodies" },
  { keyword: "earth tone graphic tee", category: "T-Shirts" },
  { keyword: "embroidered cap streetwear", category: "Accessories" },
  { keyword: "wide leg cargo pants", category: "Pants" },
  { keyword: "minimalist streetwear", category: "Streetwear" },
];

/**
 * Etsy API limitations (documented for Data Sources Center):
 * - Etsy exposes NO true per-listing sales count or bestseller ranking via the
 *   public API. `sort_on=score` is Etsy's relevance score, not sales rank.
 *   We use `num_favorers` (favorites) as a popularity proxy — clearly labeled,
 *   never presented as real sales.
 * - Public app-level access (x-api-key keystring) covers active listing search
 *   only. Shop receipts/transactions/sales require OAuth 2.0 and are not used.
 * - Results are relevance-ranked search results, not a curated trend feed.
 * - Category is derived from the search keyword group; taxonomy names are not
 *   resolved (would require extra taxonomy calls).
 */
export const ETSY_API_LIMITATIONS =
  "Etsy exposes no real sales count or bestseller ranking via the public API — num_favorers (favorites) is used as a popularity proxy, not sales. Data is relevance-ranked keyword search of active listings; sales/receipts require OAuth and are not accessed.";

interface EtsyPrice {
  amount?: number;
  divisor?: number;
  currency_code?: string;
}

interface EtsyListing {
  listing_id?: number;
  title?: string;
  description?: string;
  price?: EtsyPrice;
  tags?: string[];
  num_favorers?: number;
  who_made?: string;
  taxonomy_id?: number;
}

interface ListingsResponse {
  count?: number;
  results?: EtsyListing[];
  error?: string;
}

export function isEtsyLiveConfigured(): boolean {
  return Boolean(process.env.ETSY_API_KEY?.trim());
}

function getApiKey(): string {
  const key = process.env.ETSY_API_KEY?.trim();
  if (!key) {
    throw new Error("ETSY_API_KEY not configured");
  }
  return key;
}

async function etsyApi<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const key = getApiKey();
  const url = new URL(`${API_BASE}${path}`);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }

  const response = await fetch(url.toString(), {
    headers: {
      "x-api-key": key,
      Accept: "application/json",
    },
    next: { revalidate: 1200 },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Etsy API ${response.status}: ${body.slice(0, 180) || response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

function priceValue(price?: EtsyPrice): number | null {
  if (!price?.amount || !price.divisor) return null;
  return price.amount / price.divisor;
}

function currencySymbol(code?: string): string {
  switch (code) {
    case "EUR":
      return "€";
    case "USD":
      return "$";
    case "GBP":
      return "£";
    default:
      return code ? `${code} ` : "";
  }
}

interface GroupResult {
  category: string;
  keyword: string;
  listings: EtsyListing[];
}

async function fetchGroup(group: {
  keyword: string;
  category: string;
}): Promise<GroupResult> {
  const response = await etsyApi<ListingsResponse>("/listings/active", {
    keywords: group.keyword,
    limit: "25",
    sort_on: "score",
  });

  return {
    category: group.category,
    keyword: group.keyword,
    listings: response.results ?? [],
  };
}

function buildBestsellers(groups: GroupResult[]): EtsyBestseller[] {
  const bestsellers: EtsyBestseller[] = [];

  for (const group of groups) {
    const top = [...group.listings]
      .filter((listing) => listing.title)
      .sort((a, b) => (b.num_favorers ?? 0) - (a.num_favorers ?? 0))[0];

    if (!top) continue;

    const value = priceValue(top.price);
    const symbol = currencySymbol(top.price?.currency_code);
    const groupPrices = group.listings
      .map((listing) => priceValue(listing.price))
      .filter((price): price is number => price != null);

    const priceRange =
      groupPrices.length > 0
        ? `${symbol}${Math.round(Math.min(...groupPrices))}–${symbol}${Math.round(Math.max(...groupPrices))}`
        : value != null
          ? `${symbol}${Math.round(value)}`
          : "—";

    bestsellers.push({
      title: top.title ?? group.category,
      category: group.category,
      priceRange,
      keyword: group.keyword,
      sales: top.num_favorers ?? 0,
    });
  }

  return bestsellers;
}

function buildKeywords(groups: GroupResult[]): string[] {
  const tagCounts = new Map<string, number>();

  for (const group of groups) {
    for (const listing of group.listings) {
      for (const tag of listing.tags ?? []) {
        const normalized = tag.trim().toLowerCase();
        if (normalized.length < 3) continue;
        tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + 1);
      }
    }
  }

  return [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);
}

function buildTitlePatterns(groups: GroupResult[]): string[] {
  const listings = groups.flatMap((group) => group.listings);
  const patterns: string[] = [];

  const handmade = listings.filter(
    (listing) => listing.who_made === "i_did",
  ).length;
  const total = listings.length;

  if (total > 0 && handmade > 0) {
    patterns.push(
      `${Math.round((handmade / total) * 100)}% of listings are seller-made (handmade signal)`,
    );
  }

  const wordCounts = new Map<string, number>();
  for (const listing of listings) {
    const words = (listing.title ?? "")
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((word) => word.length > 3);
    for (const word of new Set(words)) {
      if (
        /^(with|from|this|that|your|shirt|gift|item|made)$/.test(word)
      ) {
        continue;
      }
      wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
    }
  }

  const topTitleWords = [...wordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([word, count]) => `"${word}" in ${count} titles`);

  return [...patterns, ...topTitleWords].slice(0, 5);
}

function buildPriceRanges(
  groups: GroupResult[],
): EtsyIntelligenceData["priceRanges"] {
  const ranges: EtsyIntelligenceData["priceRanges"] = [];

  for (const group of groups) {
    const prices = group.listings
      .map((listing) => priceValue(listing.price))
      .filter((price): price is number => price != null)
      .sort((a, b) => a - b);

    if (prices.length === 0) continue;

    const median = prices[Math.floor(prices.length / 2)];
    ranges.push({
      category: group.category,
      min: Math.round(prices[0]),
      max: Math.round(prices[prices.length - 1]),
      sweet: Math.round(median),
    });
  }

  return ranges;
}

function mapLiveData(groups: GroupResult[]): EtsyIntelligenceData {
  return {
    bestsellers: buildBestsellers(groups),
    keywords: buildKeywords(groups),
    printTrends: buildTitlePatterns(groups),
    priceRanges: buildPriceRanges(groups),
  };
}

/** Cheap health ping — verifies the API key against listings/active. */
export async function pingEtsyLive(): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
}> {
  if (!isEtsyLiveConfigured()) {
    return {
      ok: false,
      latencyMs: 0,
      message: "ETSY_API_KEY not configured",
    };
  }

  const started = Date.now();
  try {
    const response = await etsyApi<ListingsResponse>("/listings/active", {
      keywords: "streetwear",
      limit: "1",
      sort_on: "score",
    });
    const latencyMs = Date.now() - started;
    return {
      ok: true,
      latencyMs,
      message: `Live · Etsy API reachable · ${response.count ?? 0} active listings match`,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message: error instanceof Error ? error.message : "Etsy health ping failed",
    };
  }
}

/** Fetch live Etsy fashion listing intelligence via Open API v3. */
export async function fetchLiveEtsy(): Promise<EtsyIntelligenceData> {
  if (!isEtsyLiveConfigured()) {
    throw new Error("ETSY_API_KEY not configured");
  }

  const groups: GroupResult[] = [];
  const errors: string[] = [];

  for (const group of KEYWORD_GROUPS) {
    try {
      groups.push(await fetchGroup(group));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "query failed");
    }
  }

  const hasData = groups.some((group) => group.listings.length > 0);
  if (!hasData) {
    throw new Error(
      errors.length > 0
        ? `Etsy API returned no listings — ${errors[0]}`
        : "Etsy API returned no active fashion listings",
    );
  }

  return mapLiveData(groups);
}
