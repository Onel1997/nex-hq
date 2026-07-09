import type { GoogleTrendKeyword, GoogleTrendsData } from "../google-trends";

const REGION = "DE";

const STREETWEAR_KEYWORDS = [
  "oversized hoodie",
  "earth tone streetwear",
  "premium streetwear",
  "boxy tee",
  "wide leg cargo",
  "embroidered hoodie",
];

const COLOR_KEYWORDS = [
  "earth tone fashion",
  "sage green outfit",
  "obsidian black streetwear",
  "concrete grey fashion",
];

const SILHOUETTE_KEYWORDS = [
  "oversized fit",
  "boxy silhouette",
  "wide leg pants",
  "relaxed fit tee",
];

const SEASONAL_KEYWORDS = [
  "spring streetwear",
  "winter layering fashion",
  "summer capsule wardrobe",
];

const ALL_KEYWORDS = [
  ...STREETWEAR_KEYWORDS,
  ...COLOR_KEYWORDS,
  ...SILHOUETTE_KEYWORDS,
  ...SEASONAL_KEYWORDS,
];

interface SerpTimelinePoint {
  date?: string;
  timestamp?: string;
  values?: Array<{
    query?: string;
    value?: string;
    extracted_value?: number;
  }>;
}

interface SerpTrendsResponse {
  interest_over_time?: {
    timeline_data?: SerpTimelinePoint[];
  };
  related_queries?: {
    rising?: Array<{ query?: string; value?: number | string }>;
  };
  error?: string;
}

function geoCode(region: string): string {
  const normalized = region.toUpperCase();
  if (normalized === "GERMANY" || normalized === "DE") return "DE";
  return normalized.length === 2 ? normalized : "DE";
}

function seasonalityFromChange(change: number): GoogleTrendKeyword["seasonality"] {
  if (change >= 15) return "rising";
  if (change >= 5) return "peak";
  if (change <= -8) return "declining";
  return "stable";
}

function computeChange(values: number[]): number {
  if (values.length < 4) return 0;
  const recent = values.slice(-4);
  const prior = values.slice(-8, -4);
  if (prior.length === 0) return 0;

  const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
  const priorAvg = prior.reduce((s, v) => s + v, 0) / prior.length;
  if (priorAvg === 0) return recentAvg > 0 ? 12 : 0;
  return Math.round(((recentAvg - priorAvg) / priorAvg) * 100);
}

function buildSeasonalityNote(keywords: GoogleTrendKeyword[]): string {
  const rising = keywords.filter((k) => k.seasonality === "rising");
  const declining = keywords.filter((k) => k.seasonality === "declining");

  const risingLabels = rising.slice(0, 3).map((k) => k.keyword);
  const decliningLabels = declining.slice(0, 2).map((k) => k.keyword);

  const parts: string[] = [];
  if (risingLabels.length > 0) {
    parts.push(`Steigend in DE: ${risingLabels.join(", ")}`);
  }
  if (decliningLabels.length > 0) {
    parts.push(`Rückläufig: ${decliningLabels.join(", ")}`);
  }
  if (parts.length === 0) {
    return "DE streetwear demand stabil — Saisonalität beobachten";
  }
  return parts.join(" · ");
}

export function isGoogleTrendsLiveConfigured(): boolean {
  return Boolean(process.env.GOOGLE_TRENDS_API_KEY);
}

async function fetchKeywordTrend(
  keyword: string,
  region: string,
  apiKey: string,
): Promise<GoogleTrendKeyword | null> {
  const params = new URLSearchParams({
    engine: "google_trends",
    q: keyword,
    data_type: "TIMESERIES",
    geo: geoCode(region),
    api_key: apiKey,
  });

  const response = await fetch(
    `https://serpapi.com/search.json?${params.toString()}`,
    { next: { revalidate: 3600 } },
  );

  if (!response.ok) return null;

  const payload = (await response.json()) as SerpTrendsResponse;
  if (payload.error) return null;

  const timeline = payload.interest_over_time?.timeline_data ?? [];
  const values = timeline
    .flatMap((point) => point.values ?? [])
    .map((v) => v.extracted_value ?? Number(v.value) ?? 0)
    .filter((v) => Number.isFinite(v));

  if (values.length === 0) return null;

  const demand = Math.round(
    values.slice(-6).reduce((s, v) => s + v, 0) / Math.min(6, values.length),
  );
  const change = computeChange(values);

  return {
    keyword,
    demand,
    change,
    seasonality: seasonalityFromChange(change),
    region: geoCode(region),
  };
}

async function fetchRisingQueries(
  seed: string,
  region: string,
  apiKey: string,
): Promise<string[]> {
  const params = new URLSearchParams({
    engine: "google_trends",
    q: seed,
    data_type: "RELATED_QUERIES",
    geo: geoCode(region),
    api_key: apiKey,
  });

  const response = await fetch(
    `https://serpapi.com/search.json?${params.toString()}`,
    { next: { revalidate: 3600 } },
  );

  if (!response.ok) return [];

  const payload = (await response.json()) as SerpTrendsResponse;
  return (payload.related_queries?.rising ?? [])
    .map((item) => item.query?.trim())
    .filter((q): q is string => Boolean(q))
    .slice(0, 6);
}

/** Ping SerpAPI with a single keyword — cheap health check. */
export async function pingGoogleTrendsLive(
  region = REGION,
): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  const apiKey = process.env.GOOGLE_TRENDS_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      latencyMs: 0,
      message: "GOOGLE_TRENDS_API_KEY not configured",
    };
  }

  const started = Date.now();
  const result = await fetchKeywordTrend("streetwear", region, apiKey);
  const latencyMs = Date.now() - started;

  if (!result) {
    return {
      ok: false,
      latencyMs,
      message: "SerpAPI returned no trend data for health ping",
    };
  }

  return {
    ok: true,
    latencyMs,
    message: `Live · ${result.keyword} demand ${result.demand}/100 in ${result.region}`,
  };
}

/** Fetch live Google Trends intelligence for Germany streetwear keywords. */
export async function fetchLiveGoogleTrends(
  region = REGION,
  extraKeywords: string[] = [],
): Promise<GoogleTrendsData> {
  const apiKey = process.env.GOOGLE_TRENDS_API_KEY;
  if (!apiKey) {
    throw new Error("Google Trends API key missing");
  }

  const keywordsToScan = [
    ...new Set([...ALL_KEYWORDS, ...extraKeywords.map((k) => k.toLowerCase())]),
  ].slice(0, 10);

  const results = await Promise.all(
    keywordsToScan.map((keyword) => fetchKeywordTrend(keyword, region, apiKey)),
  );

  const keywords = results.filter((k): k is GoogleTrendKeyword => k != null);

  if (keywords.length === 0) {
    throw new Error("Google Trends returned no keyword data");
  }

  const risingFromApi = await fetchRisingQueries(
    "streetwear",
    region,
    apiKey,
  );

  const topRising = [
    ...keywords
      .filter((k) => k.change > 0)
      .sort((a, b) => b.change - a.change)
      .slice(0, 4)
      .map((k) => k.keyword),
    ...risingFromApi,
  ].slice(0, 6);

  return {
    keywords,
    topRising: [...new Set(topRising)],
    seasonalityNote: buildSeasonalityNote(keywords),
  };
}
