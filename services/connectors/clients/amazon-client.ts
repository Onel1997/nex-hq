import { createHash, createHmac } from "node:crypto";

import type {
  AmazonBestseller,
  AmazonIntelligenceData,
} from "../amazon";

const SERVICE = "ProductAdvertisingAPI";
const TARGET =
  "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems";
const PATH = "/paapi5/searchitems";

/** DE marketplace defaults (override via env). */
const DEFAULT_HOST = "webservices.amazon.de";
const DEFAULT_REGION = "eu-west-1";
const DEFAULT_MARKETPLACE = "www.amazon.de";
const SEARCH_INDEX = "Fashion";

const KEYWORD_GROUPS: Array<{ keyword: string; category: string }> = [
  { keyword: "oversized hoodie streetwear", category: "Hoodies" },
  { keyword: "heavyweight boxy t-shirt", category: "T-Shirts" },
  { keyword: "wide leg cargo pants", category: "Pants" },
  { keyword: "embroidered streetwear cap", category: "Accessories" },
];

const RESOURCES = [
  "ItemInfo.Title",
  "ItemInfo.ByLineInfo",
  "ItemInfo.Classifications",
  "ItemInfo.Features",
  "Offers.Listings.Price",
  "BrowseNodeInfo.WebsiteSalesRank",
  "CustomerReviews.Count",
  "CustomerReviews.StarRating",
];

/**
 * Amazon PA-API v5 limitations (documented for Data Sources Center):
 * - PA-API exposes NO real units-sold or true bestseller ranking of sales.
 *   BrowseNodeInfo.WebsiteSalesRank is a category rank (lower = more popular),
 *   NOT a sales count — used as a "bestseller-like" proxy where present.
 * - CustomerReviews.Count / StarRating are unavailable to most accounts
 *   (gated behind an eligibility/booster program) and are usually empty.
 * - Access requires an approved Amazon Associates account (currently ~10
 *   qualifying sales in the trailing 30 days) or requests are rejected.
 * - PA-API 5.0 is scheduled for deprecation on 2026-05-15 (migrate to Creators API).
 * - Data must be search-driven; there is no bulk trend/discovery feed.
 */
export const AMAZON_API_LIMITATIONS =
  "PA-API exposes no real sales counts — WebsiteSalesRank is a category rank proxy, not units sold. Review count/rating are unavailable to most accounts. Requires an eligible Associates account; PA-API 5.0 deprecates 2026-05-15.";

interface PaApiDisplay {
  DisplayValue?: string;
}

interface PaApiItem {
  ASIN?: string;
  ItemInfo?: {
    Title?: PaApiDisplay;
    ByLineInfo?: { Brand?: PaApiDisplay; Manufacturer?: PaApiDisplay };
    Classifications?: { ProductGroup?: PaApiDisplay; Binding?: PaApiDisplay };
    Features?: { DisplayValues?: string[] };
  };
  Offers?: {
    Listings?: Array<{
      Price?: { Amount?: number; Currency?: string; DisplayAmount?: string };
    }>;
  };
  BrowseNodeInfo?: {
    WebsiteSalesRank?: { SalesRank?: number; ContextFreeName?: string };
  };
  CustomerReviews?: {
    Count?: number;
    StarRating?: { Value?: number };
  };
}

interface SearchItemsResponse {
  SearchResult?: {
    TotalResultCount?: number;
    Items?: PaApiItem[];
  };
  Errors?: Array<{ Code?: string; Message?: string }>;
}

interface AmazonConfig {
  accessKey: string;
  secretKey: string;
  partnerTag: string;
  host: string;
  region: string;
  marketplace: string;
}

export function isAmazonLiveConfigured(): boolean {
  return Boolean(
    process.env.AMAZON_ACCESS_KEY?.trim() &&
      process.env.AMAZON_SECRET_KEY?.trim() &&
      process.env.AMAZON_PARTNER_TAG?.trim(),
  );
}

function getConfig(): AmazonConfig {
  const accessKey = process.env.AMAZON_ACCESS_KEY?.trim();
  const secretKey = process.env.AMAZON_SECRET_KEY?.trim();
  const partnerTag = process.env.AMAZON_PARTNER_TAG?.trim();

  if (!accessKey || !secretKey || !partnerTag) {
    throw new Error("Amazon PA-API credentials missing");
  }

  return {
    accessKey,
    secretKey,
    partnerTag,
    host: process.env.AMAZON_PAAPI_HOST?.trim() || DEFAULT_HOST,
    region: process.env.AMAZON_PAAPI_REGION?.trim() || DEFAULT_REGION,
    marketplace:
      process.env.AMAZON_PAAPI_MARKETPLACE?.trim() || DEFAULT_MARKETPLACE,
  };
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function amzDates(): { amzDate: string; dateStamp: string } {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  return { amzDate, dateStamp };
}

/** Sign and send a PA-API v5 request using AWS Signature Version 4. */
async function signedRequest(
  config: AmazonConfig,
  payload: string,
): Promise<SearchItemsResponse> {
  const { amzDate, dateStamp } = amzDates();
  const contentType = "application/json; charset=utf-8";

  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:${contentType}\n` +
    `host:${config.host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:${TARGET}\n`;
  const signedHeaders =
    "content-encoding;content-type;host;x-amz-date;x-amz-target";
  const payloadHash = sha256Hex(payload);

  const canonicalRequest = [
    "POST",
    PATH,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${config.region}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${config.secretKey}`, dateStamp);
  const kRegion = hmac(kDate, config.region);
  const kService = hmac(kRegion, SERVICE);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign, "utf8")
    .digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`https://${config.host}${PATH}`, {
    method: "POST",
    headers: {
      "content-encoding": "amz-1.0",
      "content-type": contentType,
      host: config.host,
      "x-amz-date": amzDate,
      "x-amz-target": TARGET,
      Authorization: authorization,
    },
    body: payload,
    next: { revalidate: 1200 },
  });

  const text = await response.text();
  let parsed: SearchItemsResponse;
  try {
    parsed = JSON.parse(text) as SearchItemsResponse;
  } catch {
    throw new Error(
      `Amazon PA-API ${response.status}: ${text.slice(0, 160) || response.statusText}`,
    );
  }

  if (!response.ok) {
    const message = parsed.Errors?.[0]?.Message ?? response.statusText;
    throw new Error(`Amazon PA-API ${response.status}: ${message}`);
  }

  if (parsed.Errors && parsed.Errors.length > 0 && !parsed.SearchResult) {
    throw new Error(`Amazon PA-API error: ${parsed.Errors[0].Message}`);
  }

  return parsed;
}

async function searchGroup(
  config: AmazonConfig,
  group: { keyword: string; category: string },
): Promise<{ category: string; keyword: string; items: PaApiItem[] }> {
  const payload = JSON.stringify({
    Keywords: group.keyword,
    PartnerTag: config.partnerTag,
    PartnerType: "Associates",
    Marketplace: config.marketplace,
    SearchIndex: SEARCH_INDEX,
    ItemCount: 10,
    Resources: RESOURCES,
  });

  const response = await signedRequest(config, payload);
  return {
    category: group.category,
    keyword: group.keyword,
    items: response.SearchResult?.Items ?? [],
  };
}

function priceOf(item: PaApiItem): number | null {
  const amount = item.Offers?.Listings?.[0]?.Price?.Amount;
  return typeof amount === "number" ? amount : null;
}

function currencyOf(item: PaApiItem): string {
  const code = item.Offers?.Listings?.[0]?.Price?.Currency;
  if (code === "EUR") return "€";
  if (code === "USD") return "$";
  if (code === "GBP") return "£";
  return code ? `${code} ` : "";
}

interface GroupResult {
  category: string;
  keyword: string;
  items: PaApiItem[];
}

function buildBestsellers(groups: GroupResult[]): AmazonBestseller[] {
  const bestsellers: AmazonBestseller[] = [];

  for (const group of groups) {
    const ranked = [...group.items].filter(
      (item) => item.ItemInfo?.Title?.DisplayValue,
    );
    if (ranked.length === 0) continue;

    // Prefer the lowest sales rank (more popular) when available.
    ranked.sort((a, b) => {
      const ra = a.BrowseNodeInfo?.WebsiteSalesRank?.SalesRank ?? Infinity;
      const rb = b.BrowseNodeInfo?.WebsiteSalesRank?.SalesRank ?? Infinity;
      return ra - rb;
    });

    const top = ranked[0];
    const prices = group.items
      .map(priceOf)
      .filter((price): price is number => price != null);
    const symbol = currencyOf(top);
    const priceRange =
      prices.length > 0
        ? `${symbol}${Math.round(Math.min(...prices))}–${symbol}${Math.round(Math.max(...prices))}`
        : "—";

    bestsellers.push({
      title: top.ItemInfo?.Title?.DisplayValue ?? group.category,
      category:
        top.ItemInfo?.Classifications?.ProductGroup?.DisplayValue ??
        group.category,
      rank: top.BrowseNodeInfo?.WebsiteSalesRank?.SalesRank ?? 0,
      rating: top.CustomerReviews?.StarRating?.Value ?? 0,
      reviews: top.CustomerReviews?.Count ?? 0,
      priceRange,
    });
  }

  return bestsellers;
}

function buildCategories(groups: GroupResult[]): string[] {
  const categories = new Set<string>();
  for (const group of groups) {
    for (const item of group.items) {
      const productGroup = item.ItemInfo?.Classifications?.ProductGroup?.DisplayValue;
      const rankContext = item.BrowseNodeInfo?.WebsiteSalesRank?.ContextFreeName;
      if (productGroup) categories.add(productGroup);
      if (rankContext) categories.add(rankContext);
    }
    if (categories.size < 8) categories.add(group.category);
  }
  return [...categories].slice(0, 8);
}

function buildDemandSignals(groups: GroupResult[]): string[] {
  const wordCounts = new Map<string, number>();
  for (const group of groups) {
    for (const item of group.items) {
      const title = item.ItemInfo?.Title?.DisplayValue ?? "";
      const words = title
        .toLowerCase()
        .split(/[^a-zäöüß]+/)
        .filter((word) => word.length > 3);
      for (const word of new Set(words)) {
        if (/^(with|from|this|that|your|herren|damen|men|women)$/.test(word)) {
          continue;
        }
        wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
      }
    }
  }

  return [...wordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word, count]) => `"${word}" appears across ${count} fashion listings`);
}

function buildReviewInsights(groups: GroupResult[]): string[] {
  const withReviews = groups
    .flatMap((group) => group.items)
    .filter((item) => (item.CustomerReviews?.Count ?? 0) > 0);

  if (withReviews.length === 0) {
    return [
      "Review count & star rating are not exposed by PA-API for this account (eligibility-gated) — treated as unavailable, not estimated",
    ];
  }

  return withReviews.slice(0, 4).map((item) => {
    const rating = item.CustomerReviews?.StarRating?.Value ?? 0;
    const count = item.CustomerReviews?.Count ?? 0;
    const title = item.ItemInfo?.Title?.DisplayValue ?? "Listing";
    return `${title.slice(0, 60)} · ${rating}★ (${count} reviews)`;
  });
}

function mapLiveData(groups: GroupResult[]): AmazonIntelligenceData {
  return {
    bestsellers: buildBestsellers(groups),
    categories: buildCategories(groups),
    demandSignals: buildDemandSignals(groups),
    reviewInsights: buildReviewInsights(groups),
  };
}

/** Cheap health ping — verifies credentials & Associate eligibility. */
export async function pingAmazonLive(): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
}> {
  if (!isAmazonLiveConfigured()) {
    return {
      ok: false,
      latencyMs: 0,
      message:
        "AMAZON_ACCESS_KEY / AMAZON_SECRET_KEY / AMAZON_PARTNER_TAG not configured",
    };
  }

  const config = getConfig();
  const started = Date.now();
  try {
    const payload = JSON.stringify({
      Keywords: "hoodie",
      PartnerTag: config.partnerTag,
      PartnerType: "Associates",
      Marketplace: config.marketplace,
      SearchIndex: SEARCH_INDEX,
      ItemCount: 1,
      Resources: ["ItemInfo.Title"],
    });
    const response = await signedRequest(config, payload);
    const latencyMs = Date.now() - started;
    return {
      ok: true,
      latencyMs,
      message: `Live · PA-API reachable · ${response.SearchResult?.TotalResultCount ?? 0} results match`,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message:
        error instanceof Error ? error.message : "Amazon health ping failed",
    };
  }
}

/** Fetch live Amazon fashion product intelligence via PA-API v5. */
export async function fetchLiveAmazon(): Promise<AmazonIntelligenceData> {
  if (!isAmazonLiveConfigured()) {
    throw new Error("Amazon PA-API credentials not configured");
  }

  const config = getConfig();
  const groups: GroupResult[] = [];
  const errors: string[] = [];

  for (const group of KEYWORD_GROUPS) {
    try {
      groups.push(await searchGroup(config, group));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "search failed");
    }
  }

  const hasData = groups.some((group) => group.items.length > 0);
  if (!hasData) {
    throw new Error(
      errors.length > 0
        ? `Amazon PA-API returned no items — ${errors[0]}`
        : "Amazon PA-API returned no fashion products (check Associate eligibility and marketplace)",
    );
  }

  return mapLiveData(groups);
}
