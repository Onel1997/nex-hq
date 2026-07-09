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

export type GoogleTrendsApiErrorKind =
  | "missing_key"
  | "auth_error"
  | "http_error"
  | "no_data";

export class GoogleTrendsApiError extends Error {
  readonly kind: GoogleTrendsApiErrorKind;

  constructor(kind: GoogleTrendsApiErrorKind, message: string) {
    super(message);
    this.name = "GoogleTrendsApiError";
    this.kind = kind;
  }
}

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
    top?: Array<{ query?: string; value?: number | string }>;
  };
  error?: string;
}

/** Primary env var; SERPAPI_API_KEY is accepted as a SerpAPI-compatible alias. */
export function resolveGoogleTrendsApiKey(): string | undefined {
  return (
    process.env.GOOGLE_TRENDS_API_KEY?.trim() ||
    process.env.SERPAPI_API_KEY?.trim() ||
    undefined
  );
}

export function isGoogleTrendsLiveConfigured(): boolean {
  return Boolean(resolveGoogleTrendsApiKey());
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

function classifySerpApiFailure(
  status: number,
  payload: SerpTrendsResponse | null,
): GoogleTrendsApiError {
  const message = payload?.error?.trim() || `SerpAPI HTTP ${status}`;
  const lower = message.toLowerCase();

  if (
    status === 401 ||
    status === 403 ||
    lower.includes("invalid api key") ||
    lower.includes("unauthorized") ||
    lower.includes("api key")
  ) {
    return new GoogleTrendsApiError("auth_error", message);
  }

  return new GoogleTrendsApiError("http_error", message);
}

async function requestSerpApi(
  params: URLSearchParams,
): Promise<SerpTrendsResponse> {
  const apiKey = resolveGoogleTrendsApiKey();
  if (!apiKey) {
    throw new GoogleTrendsApiError(
      "missing_key",
      "GOOGLE_TRENDS_API_KEY not configured",
    );
  }

  params.set("api_key", apiKey);

  const response = await fetch(
    `https://serpapi.com/search.json?${params.toString()}`,
    { cache: "no-store" },
  );

  let payload: SerpTrendsResponse | null = null;
  try {
    payload = (await response.json()) as SerpTrendsResponse;
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.error) {
    throw classifySerpApiFailure(response.status, payload);
  }

  if (!payload) {
    throw new GoogleTrendsApiError("http_error", `SerpAPI HTTP ${response.status}`);
  }

  return payload;
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

function computeDemandScore(keywords: GoogleTrendKeyword[]): number {
  if (keywords.length === 0) return 0;
  return Math.round(
    keywords.reduce((sum, keyword) => sum + keyword.demand, 0) / keywords.length,
  );
}

function computeTrendDirection(
  keywords: GoogleTrendKeyword[],
): GoogleTrendsData["trendDirection"] {
  const rising = keywords.filter(
    (keyword) => keyword.change > 0 || keyword.seasonality === "rising",
  ).length;
  const declining = keywords.filter(
    (keyword) => keyword.change < 0 || keyword.seasonality === "declining",
  ).length;

  if (rising > declining + 1) return "up";
  if (declining > rising + 1) return "down";
  return "stable";
}

async function fetchKeywordTrend(
  keyword: string,
  region: string,
): Promise<GoogleTrendKeyword | null> {
  const params = new URLSearchParams({
    engine: "google_trends",
    q: keyword,
    data_type: "TIMESERIES",
    geo: geoCode(region),
  });

  try {
    const payload = await requestSerpApi(params);
    const timeline = payload.interest_over_time?.timeline_data ?? [];
    const values = timeline
      .flatMap((point) => point.values ?? [])
      .map((value) => value.extracted_value ?? Number(value.value) ?? 0)
      .filter((value) => Number.isFinite(value));

    if (values.length === 0) return null;

    const demand = Math.round(
      values.slice(-6).reduce((sum, value) => sum + value, 0) /
        Math.min(6, values.length),
    );
    const change = computeChange(values);

    return {
      keyword,
      demand,
      change,
      seasonality: seasonalityFromChange(change),
      region: geoCode(region),
    };
  } catch (error) {
    if (error instanceof GoogleTrendsApiError) throw error;
    return null;
  }
}

async function fetchRelatedQueries(
  seed: string,
  region: string,
): Promise<string[]> {
  const params = new URLSearchParams({
    engine: "google_trends",
    q: seed,
    data_type: "RELATED_QUERIES",
    geo: geoCode(region),
  });

  try {
    const payload = await requestSerpApi(params);
    const rising = (payload.related_queries?.rising ?? [])
      .map((item) => item.query?.trim())
      .filter((query): query is string => Boolean(query));
    const top = (payload.related_queries?.top ?? [])
      .map((item) => item.query?.trim())
      .filter((query): query is string => Boolean(query));

    return [...new Set([...rising, ...top])].slice(0, 8);
  } catch (error) {
    if (error instanceof GoogleTrendsApiError) throw error;
    return [];
  }
}

/** Ping SerpAPI with a single keyword — cheap health check. */
export async function pingGoogleTrendsLive(
  region = REGION,
): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  if (!isGoogleTrendsLiveConfigured()) {
    return {
      ok: false,
      latencyMs: 0,
      message: "GOOGLE_TRENDS_API_KEY not configured",
    };
  }

  const started = Date.now();
  try {
    const result = await fetchKeywordTrend("streetwear", region);
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
  } catch (error) {
    const latencyMs = Date.now() - started;
    if (error instanceof GoogleTrendsApiError) {
      return {
        ok: false,
        latencyMs,
        message: error.message,
      };
    }
    return {
      ok: false,
      latencyMs,
      message: error instanceof Error ? error.message : "Health ping failed",
    };
  }
}

/** Fetch live Google Trends intelligence for Germany streetwear keywords. */
export async function fetchLiveGoogleTrends(
  region = REGION,
  extraKeywords: string[] = [],
): Promise<GoogleTrendsData> {
  if (!isGoogleTrendsLiveConfigured()) {
    throw new GoogleTrendsApiError(
      "missing_key",
      "GOOGLE_TRENDS_API_KEY not configured",
    );
  }

  const keywordsToScan = [
    ...new Set([...ALL_KEYWORDS, ...extraKeywords.map((keyword) => keyword.toLowerCase())]),
  ].slice(0, 10);

  const keywords: GoogleTrendKeyword[] = [];
  let authError: GoogleTrendsApiError | null = null;

  for (const keyword of keywordsToScan) {
    try {
      const result = await fetchKeywordTrend(keyword, region);
      if (result) keywords.push(result);
    } catch (error) {
      if (error instanceof GoogleTrendsApiError && error.kind === "auth_error") {
        authError = error;
        break;
      }
    }
  }

  if (authError) throw authError;

  if (keywords.length === 0) {
    throw new GoogleTrendsApiError(
      "no_data",
      "Google Trends returned no keyword data",
    );
  }

  const relatedQueries = await fetchRelatedQueries("streetwear", region);

  const risingFromKeywords = keywords
    .filter((keyword) => keyword.change > 0)
    .sort((a, b) => b.change - a.change)
    .slice(0, 4)
    .map((keyword) => keyword.keyword);

  const topRising = [...new Set([...risingFromKeywords, ...relatedQueries])].slice(
    0,
    6,
  );

  const demandScore = computeDemandScore(keywords);
  const trendDirection = computeTrendDirection(keywords);

  return {
    keywords,
    topRising,
    relatedQueries,
    seasonalityNote: buildSeasonalityNote(keywords),
    demandScore,
    trendDirection,
  };
}
