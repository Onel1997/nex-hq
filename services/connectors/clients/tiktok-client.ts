import type { TikTokIntelligenceData, TikTokTrend } from "../tiktok";

const OAUTH_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const VIDEO_QUERY_URL = "https://open.tiktokapis.com/v2/research/video/query/";
const REGION = "DE";

/**
 * Fashion/streetwear hashtags queried against the TikTok Research API.
 * The official API has NO global trend-discovery endpoint — we can only query
 * a known set of hashtags and measure their engagement. New hashtags cannot be
 * "discovered" via the official API (see TIKTOK_API_LIMITATIONS).
 */
const FASHION_HASHTAGS = [
  "streetwear",
  "oversizedstreetwear",
  "earthtones",
  "quietluxury",
  "capsulewardrobe",
  "ootd",
];

const COLOR_TERMS: Array<{ match: RegExp; label: string }> = [
  { match: /earth|brown|tan|beige/i, label: "Earth Brown" },
  { match: /sage|olive|green/i, label: "Sage Green" },
  { match: /black|obsidian|noir/i, label: "Obsidian Black" },
  { match: /white|cream|ivory|off.?white/i, label: "Off White" },
  { match: /grey|gray|concrete|charcoal/i, label: "Concrete Grey" },
  { match: /terracotta|rust|clay/i, label: "Terracotta" },
];

const SILHOUETTE_TERMS: Array<{ match: RegExp; label: string }> = [
  { match: /oversized|oversize/i, label: "Oversized" },
  { match: /boxy/i, label: "Boxy" },
  { match: /wide.?leg|baggy|cargo/i, label: "Wide-leg" },
  { match: /relaxed|loose/i, label: "Relaxed" },
  { match: /slim|fitted|tailored/i, label: "Fitted" },
  { match: /cropped|crop/i, label: "Cropped" },
];

/**
 * TikTok API limitations (documented for Data Sources Center):
 * - The official Research API has NO global trending/discovery endpoint.
 *   We can only QUERY a known set of fashion hashtags and aggregate engagement.
 *   Newly-emerging hashtags cannot be discovered via the official API.
 * - Research API access requires an approved research project (academic/non-profit);
 *   commercial use is not permitted and approval can take weeks.
 * - Video data is archived: new videos take up to 48h to be searchable and
 *   counts (views/likes) can lag by up to ~10 days. Growth/velocity is NOT provided.
 * - "change" reflects engagement rate (interactions ÷ views), not trend velocity,
 *   because the API does not expose historical growth in a single query.
 * - Sounds/music surface only as music_id; there is no sound-trend endpoint.
 */
export const TIKTOK_API_LIMITATIONS =
  "Official Research API has no global trend discovery — engagement is aggregated from a fixed fashion hashtag set (new hashtags can't be discovered). Requires approved research access (non-commercial). Data is archived (up to 48h/10d lag). 'change' is engagement rate, not velocity. No sound-trend endpoint.";

interface TikTokVideo {
  id?: string;
  video_description?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  hashtag_names?: string[];
}

interface VideoQueryResponse {
  data?: {
    videos?: TikTokVideo[];
  };
  error?: {
    code?: string;
    message?: string;
  };
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

export function isTikTokLiveConfigured(): boolean {
  return Boolean(
    process.env.TIKTOK_CLIENT_KEY?.trim() &&
      process.env.TIKTOK_CLIENT_SECRET?.trim(),
  );
}

async function getAccessToken(): Promise<string> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim();

  if (!clientKey || !clientSecret) {
    throw new Error("TikTok Research API credentials missing");
  }

  const response = await fetch(OAUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }).toString(),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `TikTok auth failed: ${response.status} ${body.slice(0, 150)}`,
    );
  }

  const payload = (await response.json()) as TokenResponse;
  if (payload.error || !payload.access_token) {
    throw new Error(
      `TikTok auth error: ${payload.error_description ?? payload.error ?? "no access token returned"}`,
    );
  }

  return payload.access_token;
}

function dateStamp(offsetDays: number): string {
  const date = new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

async function queryHashtagVideos(
  token: string,
  hashtag: string,
): Promise<TikTokVideo[]> {
  const fields =
    "id,video_description,view_count,like_count,comment_count,share_count,hashtag_names";

  const response = await fetch(`${VIDEO_QUERY_URL}?fields=${fields}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: {
        and: [
          {
            operation: "EQ",
            field_name: "hashtag_name",
            field_values: [hashtag],
          },
          {
            operation: "IN",
            field_name: "region_code",
            field_values: [REGION],
          },
        ],
      },
      max_count: 100,
      start_date: dateStamp(30),
      end_date: dateStamp(1),
    }),
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(`TikTok video query failed: ${response.status}`);
  }

  const payload = (await response.json()) as VideoQueryResponse;
  if (payload.error?.code && payload.error.code !== "ok") {
    throw new Error(
      `TikTok video query error: ${payload.error.message ?? payload.error.code}`,
    );
  }

  return payload.data?.videos ?? [];
}

interface HashtagAggregate {
  hashtag: string;
  videoCount: number;
  views: number;
  interactions: number;
  descriptions: string[];
  coHashtags: Map<string, number>;
}

function aggregateHashtag(
  hashtag: string,
  videos: TikTokVideo[],
): HashtagAggregate {
  let views = 0;
  let interactions = 0;
  const descriptions: string[] = [];
  const coHashtags = new Map<string, number>();

  for (const video of videos) {
    views += video.view_count ?? 0;
    interactions +=
      (video.like_count ?? 0) +
      (video.comment_count ?? 0) +
      (video.share_count ?? 0);

    if (video.video_description?.trim()) {
      descriptions.push(video.video_description.trim());
    }

    for (const tag of video.hashtag_names ?? []) {
      const normalized = tag.toLowerCase();
      if (normalized === hashtag.toLowerCase()) continue;
      coHashtags.set(normalized, (coHashtags.get(normalized) ?? 0) + 1);
    }
  }

  return {
    hashtag,
    videoCount: videos.length,
    views,
    interactions,
    descriptions,
    coHashtags,
  };
}

function classifyCategory(hashtag: string): TikTokTrend["category"] {
  if (/oversized|boxy|wide|slim|fit|silhouette|cropped/i.test(hashtag)) {
    return "silhouette";
  }
  if (/earth|tone|color|colour|sage|beige|black|white/i.test(hashtag)) {
    return "color";
  }
  if (/luxury|premium|brand|designer/i.test(hashtag)) {
    return "brand";
  }
  return "outfit";
}

function engagementRate(aggregate: HashtagAggregate): number {
  if (aggregate.views === 0) return 0;
  return Math.round((aggregate.interactions / aggregate.views) * 1000) / 10;
}

function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(0)}K`;
  return String(views);
}

function buildTrend(aggregate: HashtagAggregate): TikTokTrend {
  const rate = engagementRate(aggregate);
  return {
    hashtag: `#${aggregate.hashtag}`,
    views: aggregate.views,
    change: rate,
    category: classifyCategory(aggregate.hashtag),
    insight: `${aggregate.videoCount} videos · ${formatViews(aggregate.views)} views · ${rate}% engagement (DE, last 30d)`,
  };
}

function detectTerms(
  descriptions: string[],
  terms: Array<{ match: RegExp; label: string }>,
): string[] {
  const found: string[] = [];
  const joined = descriptions.join(" ");
  for (const term of terms) {
    if (term.match.test(joined) && !found.includes(term.label)) {
      found.push(term.label);
    }
  }
  return found;
}

function mapLiveData(aggregates: HashtagAggregate[]): TikTokIntelligenceData {
  const withVideos = aggregates.filter((aggregate) => aggregate.videoCount > 0);

  const viralTrends = withVideos
    .map(buildTrend)
    .sort((a, b) => b.views - a.views)
    .slice(0, 8);

  const allDescriptions = withVideos.flatMap(
    (aggregate) => aggregate.descriptions,
  );

  const coHashtagCounts = new Map<string, number>();
  for (const aggregate of withVideos) {
    for (const [tag, count] of aggregate.coHashtags) {
      coHashtagCounts.set(tag, (coHashtagCounts.get(tag) ?? 0) + count);
    }
  }

  const queriedHashtags = withVideos.map(
    (aggregate) => `#${aggregate.hashtag}`,
  );
  const emergentHashtags = [...coHashtagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag]) => `#${tag}`);

  const hashtags = [...new Set([...queriedHashtags, ...emergentHashtags])].slice(
    0,
    12,
  );

  const outfitTrends = allDescriptions
    .filter((description) => description.length > 12 && description.length < 140)
    .slice(0, 4)
    .map((description) => description.replace(/\s+/g, " ").trim());

  return {
    viralTrends,
    hashtags,
    outfitTrends,
    colors: detectTerms(allDescriptions, COLOR_TERMS),
    silhouettes: detectTerms(allDescriptions, SILHOUETTE_TERMS),
  };
}

/** Cheap health ping — verifies Research API credentials by acquiring a token. */
export async function pingTikTokLive(): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
}> {
  if (!isTikTokLiveConfigured()) {
    return {
      ok: false,
      latencyMs: 0,
      message: "TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET not configured",
    };
  }

  const started = Date.now();
  try {
    await getAccessToken();
    return {
      ok: true,
      latencyMs: Date.now() - started,
      message: "Live · Research API token acquired",
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message:
        error instanceof Error ? error.message : "TikTok health ping failed",
    };
  }
}

/** Fetch live TikTok fashion hashtag intelligence via the Research API. */
export async function fetchLiveTikTok(): Promise<TikTokIntelligenceData> {
  if (!isTikTokLiveConfigured()) {
    throw new Error("TikTok Research API credentials not configured");
  }

  const token = await getAccessToken();
  const aggregates: HashtagAggregate[] = [];
  const errors: string[] = [];

  for (const hashtag of FASHION_HASHTAGS) {
    try {
      const videos = await queryHashtagVideos(token, hashtag);
      aggregates.push(aggregateHashtag(hashtag, videos));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "query failed");
    }
  }

  const hasData = aggregates.some((aggregate) => aggregate.videoCount > 0);
  if (!hasData) {
    throw new Error(
      errors.length > 0
        ? `TikTok Research API returned no videos — ${errors[0]}`
        : "TikTok Research API returned no fashion hashtag videos (check research project approval and region)",
    );
  }

  return mapLiveData(aggregates);
}
