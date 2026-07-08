import type {
  YouTubeCreatorRank,
  YouTubeIntelligenceData,
  YouTubeMention,
  YouTubeTrendMetric,
  YouTubeVideo,
} from "../youtube";

const API_BASE = "https://www.googleapis.com/youtube/v3";
const REGION = "DE";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESULTS_PER_TOPIC = 12;
const MAX_VIDEOS = 120;

/** Quota cost reference (YouTube Data API v3 default daily budget: 10,000 units). */
const QUOTA_SEARCH_COST = 100;
const QUOTA_VIDEOS_LIST_COST = 1;

/**
 * Curated fashion search topics — bilingual EN + DE query strings per category.
 * Each topic triggers one search.list call (100 quota units).
 */
const SEARCH_TOPICS: Array<{ category: string; query: string }> = [
  { category: "Streetwear", query: "streetwear fashion streetwear deutsch" },
  {
    category: "Oversized Fashion",
    query: "oversized fashion oversize mode streetwear",
  },
  {
    category: "Luxury Streetwear",
    query: "luxury streetwear designer streetwear luxus mode",
  },
  {
    category: "Outfit Inspiration",
    query: "outfit inspiration outfit ideen fashion ootd",
  },
  { category: "Fashion Haul", query: "fashion haul clothing haul mode haul" },
  {
    category: "Minimal Fashion",
    query: "minimal fashion minimalist style minimalistische mode",
  },
  {
    category: "Capsule Wardrobe",
    query: "capsule wardrobe capsule wardrobe deutsch",
  },
  {
    category: "Fashion Trends",
    query: "fashion trends 2026 modetrends streetwear trends",
  },
  {
    category: "Designer Fashion",
    query: "designer fashion luxury fashion designer mode",
  },
  {
    category: "Summer Fashion",
    query: "summer fashion sommer mode streetwear summer outfits",
  },
  {
    category: "Winter Fashion",
    query: "winter fashion winter mode layering streetwear winter",
  },
  { category: "Y2K", query: "y2k fashion y2k style y2k mode streetwear" },
  { category: "Gorpcore", query: "gorpcore techwear outdoor fashion gorpcore style" },
  { category: "Techwear", query: "techwear fashion tech wear cyberpunk fashion" },
  { category: "Denim", query: "denim fashion jeans style denim streetwear" },
  {
    category: "Graphic Tees",
    query: "graphic tee fashion graphic t-shirt streetwear tee",
  },
  {
    category: "Hoodie Collection",
    query: "hoodie collection oversized hoodie streetwear hoodie",
  },
  {
    category: "Fashion Essentials",
    query: "fashion essentials wardrobe essentials mode basics streetwear",
  },
];

/**
 * YouTube Data API v3 limitations (documented for the Data Sources Center):
 * - Default quota is 10,000 units/day per Google Cloud project. Each search.list
 *   costs 100 units; videos.list costs 1 unit per call. Full sync uses ~1,800+
 *   units — monitor quota in Google Cloud Console.
 * - search.list returns relevance-ranked results for a query — NOT YouTube's
 *   global Trending feed. Coverage is limited to the curated topic set.
 * - likeCount may be hidden when creators disable likes — reported as 0, never
 *   estimated. Comment text is never fetched; only commentCount metadata.
 * - Trend momentum/velocity/growth/saturation are computed from the collected
 *   sample only — not YouTube's internal analytics.
 * - Thumbnail "patterns" are title/format heuristics (HAUL, LOOKBOOK, GRWM, etc.)
 *   — not computer-vision analysis of thumbnail images.
 * - German + English coverage depends on search ranking in region DE; not all
 *   creators tag language metadata.
 */
export const YOUTUBE_API_LIMITATIONS =
  "YouTube Data API v3 has a default 10,000 units/day quota — each topic search costs 100 units. Results are query-ranked search samples, not global Trending. Hidden likes show as 0. Trend metrics are sample-derived estimates. Thumbnail patterns are title/format heuristics, not image analysis. DE region bias.";

const KNOWN_BRANDS = [
  "represent",
  "represent clo",
  "corteiz",
  "fear of god",
  "essentials",
  "fear of god essentials",
  "stussy",
  "stüssy",
  "cole buxton",
  "broken planet",
  "nike",
  "adidas",
  "new balance",
  "chrome hearts",
  "denim tears",
  "supreme",
  "palace",
  "kith",
  "aime leon dore",
  "stone island",
  "carhartt",
  "arc'teryx",
  "arcteryx",
  "uniqlo",
  "jacquemus",
  "balenciaga",
  "gucci",
  "prada",
  "dior",
  "loewe",
  "yeezy",
  "jordan",
  "salomon",
  "asics",
  "vans",
  "converse",
  "levi's",
  "levis",
  "ralph lauren",
  "north face",
  "patagonia",
  "bape",
  "off-white",
  "off white",
  "amiri",
  "rhude",
  "cp company",
];

const STYLE_TERMS = [
  "streetwear",
  "gorpcore",
  "techwear",
  "y2k",
  "minimalist",
  "minimal",
  "luxury",
  "vintage",
  "workwear",
  "grunge",
  "opium",
  "quiet luxury",
  "old money",
  "skate",
  "prep",
  "avant-garde",
  "utility",
  "americana",
  "archive",
  "normcore",
];

const COLOR_TERMS = [
  "black",
  "white",
  "off-white",
  "cream",
  "beige",
  "brown",
  "earth tone",
  "olive",
  "sage",
  "green",
  "grey",
  "gray",
  "charcoal",
  "navy",
  "blue",
  "burgundy",
  "red",
  "rust",
  "terracotta",
  "mustard",
  "pink",
  "purple",
  "washed",
  "faded",
];

const MATERIAL_TERMS = [
  "cotton",
  "heavyweight",
  "fleece",
  "denim",
  "leather",
  "suede",
  "nylon",
  "wool",
  "linen",
  "gore-tex",
  "canvas",
  "corduroy",
  "mesh",
  "knit",
  "french terry",
];

const FIT_TERMS = [
  "oversized",
  "oversize",
  "boxy",
  "cropped",
  "wide leg",
  "wide-leg",
  "baggy",
  "relaxed",
  "slim",
  "fitted",
  "tailored",
  "loose",
  "tapered",
  "longline",
];

const GRAPHIC_TERMS = [
  "graphic tee",
  "embroidery",
  "screen print",
  "puff print",
  "logo",
  "typography",
  "all-over print",
  "distressed",
  "patchwork",
  "tie dye",
  "acid wash",
];

const PRODUCT_TERMS = [
  "hoodie",
  "sweatshirt",
  "tee",
  "t-shirt",
  "cargo",
  "pants",
  "jeans",
  "jacket",
  "coat",
  "sneaker",
  "sneakers",
  "trainer",
  "cap",
  "hat",
  "beanie",
  "shorts",
  "vest",
  "shirt",
  "blazer",
  "boot",
];

const COLLECTION_TERMS = [
  "capsule",
  "collection",
  "drop",
  "release",
  "collab",
  "collaboration",
  "season",
  "ss26",
  "fw26",
  "lookbook",
  "essentials drop",
];

const THUMBNAIL_FORMAT_PATTERNS: Array<{ match: RegExp; label: string }> = [
  { match: /\bhaul\b/i, label: "HAUL thumbnail format" },
  { match: /\blookbook\b/i, label: "LOOKBOOK format" },
  { match: /\bgrwm\b|get ready with me/i, label: "GRWM format" },
  { match: /\bootd\b|outfit of the day/i, label: "OOTD format" },
  { match: /\btry.?on\b/i, label: "Try-on format" },
  { match: /\btier\s*list\b/i, label: "Tier list format" },
  { match: /\btop\s*\d+/i, label: "Top-N list format" },
  { match: /\bunboxing\b/i, label: "Unboxing format" },
];

const STOPWORDS = new Set([
  "this",
  "that",
  "with",
  "from",
  "have",
  "what",
  "when",
  "your",
  "they",
  "will",
  "into",
  "about",
  "which",
  "their",
  "there",
  "just",
  "like",
  "more",
  "most",
  "some",
  "over",
  "after",
  "before",
  "video",
  "fashion",
  "style",
  "2024",
  "2025",
  "2026",
]);

interface ApiErrorBody {
  error?: {
    message?: string;
    errors?: Array<{ reason?: string; message?: string }>;
  };
}

interface SearchItem {
  id?: { videoId?: string };
}

interface SearchListResponse extends ApiErrorBody {
  items?: SearchItem[];
  pageInfo?: { totalResults?: number };
}

interface VideoItem {
  id?: string;
  snippet?: {
    title?: string;
    channelTitle?: string;
    channelId?: string;
    publishedAt?: string;
    description?: string;
    tags?: string[];
    defaultLanguage?: string;
    defaultAudioLanguage?: string;
    categoryId?: string;
    thumbnails?: {
      high?: { url?: string };
      medium?: { url?: string };
      default?: { url?: string };
    };
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  contentDetails?: { duration?: string };
}

interface VideosListResponse extends ApiErrorBody {
  items?: VideoItem[];
}

interface CollectedVideo extends YouTubeVideo {
  haystack: string;
}

export function isYouTubeLiveConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY?.trim());
}

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) throw new Error("YOUTUBE_API_KEY not configured");
  return key;
}

async function youtubeApi<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const key = getApiKey();
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("key", key);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      next: { revalidate: 1200 },
    });

    const text = await response.text();
    let parsed: T & ApiErrorBody;
    try {
      parsed = JSON.parse(text) as T & ApiErrorBody;
    } catch {
      throw new Error(
        `YouTube API ${response.status}: ${text.slice(0, 160) || response.statusText}`,
      );
    }

    if (!response.ok) {
      const reason = parsed.error?.errors?.[0]?.reason;
      const message = parsed.error?.message ?? response.statusText;
      if (response.status === 403 && reason === "quotaExceeded") {
        throw new Error("YouTube API quota exceeded — check Google Cloud quota");
      }
      throw new Error(`YouTube API ${response.status}: ${message}`);
    }

    if (parsed.error?.message) {
      throw new Error(`YouTube API error: ${parsed.error.message}`);
    }

    return parsed;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`YouTube API timeout after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function searchTopic(
  topic: (typeof SEARCH_TOPICS)[number],
): Promise<string[]> {
  const response = await youtubeApi<SearchListResponse>("/search", {
    part: "snippet",
    type: "video",
    q: topic.query,
    maxResults: String(MAX_RESULTS_PER_TOPIC),
    regionCode: REGION,
    relevanceLanguage: "de",
    safeSearch: "none",
  });

  return (response.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((id): id is string => Boolean(id));
}

async function fetchVideoDetails(ids: string[]): Promise<VideoItem[]> {
  if (ids.length === 0) return [];

  const response = await youtubeApi<VideosListResponse>("/videos", {
    part: "snippet,statistics,contentDetails",
    id: ids.join(","),
    maxResults: String(Math.min(50, ids.length)),
  });

  return response.items ?? [];
}

function parseCount(value?: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function videoLanguage(snippet: VideoItem["snippet"]): string | null {
  return (
    snippet?.defaultAudioLanguage?.trim() ||
    snippet?.defaultLanguage?.trim() ||
    null
  );
}

function mapVideo(
  item: VideoItem,
  categoryByVideoId: Map<string, string>,
): CollectedVideo | null {
  const videoId = item.id;
  const snippet = item.snippet;
  if (!videoId || !snippet?.title) return null;

  const title = snippet.title.trim();
  const description = snippet.description?.trim() ?? "";
  const tags = snippet.tags ?? [];
  const category = categoryByVideoId.get(videoId) ?? "Fashion";

  const video: CollectedVideo = {
    videoId,
    title,
    channel: snippet.channelTitle?.trim() ?? "Unknown",
    channelId: snippet.channelId ?? "",
    publishedAt: snippet.publishedAt ?? new Date().toISOString(),
    views: parseCount(item.statistics?.viewCount),
    likes: parseCount(item.statistics?.likeCount),
    comments: parseCount(item.statistics?.commentCount),
    duration: item.contentDetails?.duration ?? "PT0S",
    thumbnailUrl:
      snippet.thumbnails?.high?.url ??
      snippet.thumbnails?.medium?.url ??
      snippet.thumbnails?.default?.url ??
      "",
    tags,
    category,
    description,
    language: videoLanguage(snippet),
    haystack: `${title} ${description} ${tags.join(" ")}`.toLowerCase(),
  };

  return video;
}

function countTerms(
  haystacks: string[],
  terms: string[],
  limit: number,
): YouTubeMention[] {
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

function tokenCounts(haystacks: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const hay of haystacks) {
    const words = hay.split(/[^a-z0-9äöüß']+/);
    for (const word of new Set(words)) {
      if (word.length < 4) continue;
      if (STOPWORDS.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return counts;
}

function discoverBrands(videos: CollectedVideo[]): YouTubeMention[] {
  const haystacks = videos.map((v) => v.haystack);
  const known = countTerms(haystacks, KNOWN_BRANDS, 20);
  const knownSet = new Set(known.map((b) => b.term.toLowerCase()));

  const dynamic = new Map<string, number>();
  const brandLike = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g;
  for (const video of videos) {
    const text = `${video.title} ${video.description} ${video.tags.join(" ")}`.replace(
      /#[\wäöüß]+/gi,
      (tag) => tag.slice(1),
    );
    let match: RegExpExecArray | null;
    while ((match = brandLike.exec(text)) !== null) {
      const term = match[1].trim();
      if (term.length < 3) continue;
      const lower = term.toLowerCase();
      if (STOPWORDS.has(lower)) continue;
      if (knownSet.has(lower)) continue;
      dynamic.set(lower, (dynamic.get(lower) ?? 0) + 1);
    }
  }

  const discovered = [...dynamic.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([term, count]) => ({ term, count }));

  return [...known, ...discovered]
    .sort((a, b) => b.count - a.count)
    .slice(0, 16);
}

function viewsPerDay(video: CollectedVideo): number {
  const ageMs = Date.now() - Date.parse(video.publishedAt);
  const ageDays = Math.max(1, ageMs / (24 * 60 * 60 * 1000));
  return video.views / ageDays;
}

function engagementRate(video: CollectedVideo): number {
  if (video.views === 0) return 0;
  return ((video.likes + video.comments) / video.views) * 100;
}

function buildCreatorRanking(videos: CollectedVideo[]): YouTubeCreatorRank[] {
  const byChannel = new Map<string, CollectedVideo[]>();
  for (const video of videos) {
    const key = video.channelId || video.channel;
    const list = byChannel.get(key) ?? [];
    list.push(video);
    byChannel.set(key, list);
  }

  return [...byChannel.values()]
    .map((channelVideos) => {
      const totalViews = channelVideos.reduce((sum, v) => sum + v.views, 0);
      const avgViews = Math.round(totalViews / channelVideos.length);
      const avgEngagement =
        Math.round(
          (channelVideos.reduce((sum, v) => sum + engagementRate(v), 0) /
            channelVideos.length) *
            10,
        ) / 10;
      const sample = channelVideos[0];
      return {
        channel: sample.channel,
        channelId: sample.channelId,
        videoCount: channelVideos.length,
        totalViews,
        avgViews,
        avgEngagement,
      };
    })
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, 12);
}

function buildTrendMetrics(videos: CollectedVideo[]): YouTubeTrendMetric[] {
  const byCategory = new Map<string, CollectedVideo[]>();
  for (const video of videos) {
    const list = byCategory.get(video.category) ?? [];
    list.push(video);
    byCategory.set(video.category, list);
  }

  const total = videos.length;
  const metrics: YouTubeTrendMetric[] = [];

  for (const [topic, topicVideos] of byCategory) {
    if (topicVideos.length === 0) continue;

    const velocities = topicVideos.map(viewsPerDay);
    const avgVelocity =
      velocities.reduce((sum, v) => sum + v, 0) / velocities.length;

    const ages = topicVideos.map(
      (v) => (Date.now() - Date.parse(v.publishedAt)) / (24 * 60 * 60 * 1000),
    );
    const medianAge = [...ages].sort((a, b) => a - b)[
      Math.floor(ages.length / 2)
    ];

    const recent = topicVideos.filter(
      (v) => Date.now() - Date.parse(v.publishedAt) < 14 * 24 * 60 * 60 * 1000,
    );
    const older = topicVideos.filter(
      (v) => Date.now() - Date.parse(v.publishedAt) >= 14 * 24 * 60 * 60 * 1000,
    );
    const recentAvg =
      recent.length > 0
        ? recent.reduce((sum, v) => sum + viewsPerDay(v), 0) / recent.length
        : 0;
    const olderAvg =
      older.length > 0
        ? older.reduce((sum, v) => sum + viewsPerDay(v), 0) / older.length
        : recentAvg;
    const growth =
      olderAvg > 0
        ? Math.round(((recentAvg - olderAvg) / olderAvg) * 100)
        : recent.length > 0
          ? 12
          : 0;

    const uniqueChannels = new Set(topicVideos.map((v) => v.channelId || v.channel))
      .size;
    const saturation = Math.round((topicVideos.length / Math.max(1, total)) * 100);
    const competition = Math.round(
      (uniqueChannels / Math.max(1, topicVideos.length)) * 100,
    );
    const consistency = Math.min(
      100,
      Math.round((uniqueChannels / Math.max(1, topicVideos.length)) * 100),
    );
    const momentum = Math.min(
      100,
      Math.round(Math.log10(Math.max(10, avgVelocity)) * 22 + growth * 0.3),
    );

    const summerHits = topicVideos.filter((v) =>
      /\b(summer|sommer|ss\d{2})\b/i.test(v.haystack),
    ).length;
    const winterHits = topicVideos.filter((v) =>
      /\b(winter|fw\d{2}|layering)\b/i.test(v.haystack),
    ).length;
    let seasonality = "year-round";
    if (summerHits > winterHits * 1.5) seasonality = "summer-weighted";
    else if (winterHits > summerHits * 1.5) seasonality = "winter-weighted";

    metrics.push({
      topic,
      momentum,
      velocity: Math.round(avgVelocity),
      growth,
      consistency,
      saturation,
      competition,
      longevity: Math.round(medianAge),
      seasonality,
    });
  }

  return metrics.sort((a, b) => b.momentum - a.momentum);
}

function buildRepeatedTitles(videos: CollectedVideo[]): string[] {
  const phrases = new Map<string, number>();
  for (const video of videos) {
    const normalized = video.title
      .toLowerCase()
      .replace(/[^\w\säöüß]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const words = normalized.split(" ").filter((w) => w.length > 3);
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = `${words[i]} ${words[i + 1]}`;
      if (STOPWORDS.has(words[i]) || STOPWORDS.has(words[i + 1])) continue;
      phrases.set(phrase, (phrases.get(phrase) ?? 0) + 1);
    }
  }
  return [...phrases.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([phrase, count]) => `"${phrase}" in ${count} titles`);
}

function buildThumbnailPatterns(videos: CollectedVideo[]): string[] {
  const counts = new Map<string, number>();
  for (const video of videos) {
    const text = `${video.title} ${video.tags.join(" ")}`;
    for (const pattern of THUMBNAIL_FORMAT_PATTERNS) {
      if (pattern.match.test(text)) {
        counts.set(pattern.label, (counts.get(pattern.label) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, count]) => `${label} (${count} videos)`);
}

function buildUploadFrequency(videos: CollectedVideo[]): string {
  if (videos.length < 2) return "—";
  const dates = videos
    .map((v) => Date.parse(v.publishedAt))
    .filter((t) => Number.isFinite(t));
  if (dates.length < 2) return "—";
  const spanDays = Math.max(
    1,
    (Math.max(...dates) - Math.min(...dates)) / (24 * 60 * 60 * 1000),
  );
  const perDay = videos.length / spanDays;
  return `${Math.round(perDay * 10) / 10} videos/day across ${Math.round(spanDays)}d sample`;
}

function aggregate(videos: CollectedVideo[]): YouTubeIntelligenceData {
  const haystacks = videos.map((v) => v.haystack);
  const trendMetrics = buildTrendMetrics(videos);

  const fastestGrowingTopics = [...trendMetrics]
    .sort((a, b) => b.growth - a.growth)
    .slice(0, 6)
    .filter((m) => m.growth > 0)
    .map((m) => `${m.topic} (+${m.growth}% view velocity vs older sample)`);

  const avgViews =
    videos.length > 0
      ? Math.round(videos.reduce((sum, v) => sum + v.views, 0) / videos.length)
      : 0;
  const avgEngagement =
    videos.length > 0
      ? Math.round(
          (videos.reduce((sum, v) => sum + engagementRate(v), 0) /
            videos.length) *
            10,
        ) / 10
      : 0;

  const topicCounts = new Map<string, number>();
  for (const video of videos) {
    topicCounts.set(video.category, (topicCounts.get(video.category) ?? 0) + 1);
  }
  const trendingTopics = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([term, count]) => ({ term, count }));

  return {
    videos: videos.slice(0, MAX_VIDEOS).map((v) => ({
      videoId: v.videoId,
      title: v.title,
      channel: v.channel,
      channelId: v.channelId,
      publishedAt: v.publishedAt,
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      duration: v.duration,
      thumbnailUrl: v.thumbnailUrl,
      tags: v.tags,
      category: v.category,
      description: v.description,
      language: v.language,
    })),
    searchCategories: [...new Set(videos.map((v) => v.category))],
    trendingTopics,
    discussedStyles: countTerms(haystacks, STYLE_TERMS, 10),
    brandMentions: discoverBrands(videos),
    colorMentions: countTerms(haystacks, COLOR_TERMS, 10),
    materialMentions: countTerms(haystacks, MATERIAL_TERMS, 10),
    fitMentions: countTerms(haystacks, FIT_TERMS, 10),
    graphicMentions: countTerms(haystacks, GRAPHIC_TERMS, 10),
    keywords: [...tokenCounts(haystacks).entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14)
      .map(([term, count]) => ({ term, count })),
    fastestGrowingTopics,
    creatorRanking: buildCreatorRanking(videos),
    uploadFrequency: buildUploadFrequency(videos),
    avgViews,
    avgEngagement,
    repeatedTitles: buildRepeatedTitles(videos),
    repeatedThumbnailPatterns: buildThumbnailPatterns(videos),
    fashionVocabulary: [...tokenCounts(haystacks).entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([term, count]) => ({ term, count })),
    productTypes: countTerms(haystacks, PRODUCT_TERMS, 12),
    discussedCollections: countTerms(haystacks, COLLECTION_TERMS, 10),
    trendMetrics,
  };
}

async function collectVideos(): Promise<CollectedVideo[]> {
  const categoryByVideoId = new Map<string, string>();
  const videoIdSet = new Set<string>();
  const errors: string[] = [];

  for (const topic of SEARCH_TOPICS) {
    try {
      const ids = await searchTopic(topic);
      for (const id of ids) {
        if (!videoIdSet.has(id)) {
          videoIdSet.add(id);
          categoryByVideoId.set(id, topic.category);
        }
      }
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : `${topic.category} search failed`,
      );
    }
  }

  const allIds = [...videoIdSet].slice(0, MAX_VIDEOS);
  if (allIds.length === 0) {
    throw new Error(
      errors.length > 0
        ? `YouTube API returned no videos — ${errors[0]}`
        : "YouTube API returned no fashion videos for the curated topic set",
    );
  }

  const items: VideoItem[] = [];
  for (let i = 0; i < allIds.length; i += 50) {
    const chunk = allIds.slice(i, i + 50);
    try {
      items.push(...(await fetchVideoDetails(chunk)));
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : "videos.list failed",
      );
    }
  }

  const videos = items
    .map((item) => mapVideo(item, categoryByVideoId))
    .filter((v): v is CollectedVideo => v != null);

  if (videos.length === 0) {
    throw new Error(
      errors.length > 0
        ? `YouTube API returned no video details — ${errors[0]}`
        : "YouTube API returned no parseable fashion videos",
    );
  }

  return videos;
}

/** Cheap health ping — one lightweight search.list call with quota note. */
export async function pingYouTubeLive(): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
  quotaUnitsUsed?: number;
}> {
  if (!isYouTubeLiveConfigured()) {
    return {
      ok: false,
      latencyMs: 0,
      message: "YOUTUBE_API_KEY not configured",
      quotaUnitsUsed: 0,
    };
  }

  const started = Date.now();
  try {
    const response = await youtubeApi<SearchListResponse>("/search", {
      part: "snippet",
      type: "video",
      q: "streetwear fashion",
      maxResults: "1",
      regionCode: REGION,
    });
    const latencyMs = Date.now() - started;
    const count = response.pageInfo?.totalResults ?? response.items?.length ?? 0;
    return {
      ok: true,
      latencyMs,
      message: `Live · YouTube Data API v3 reachable · ~${count.toLocaleString("de-DE")} results for health query`,
      quotaUnitsUsed: QUOTA_SEARCH_COST,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message:
        error instanceof Error ? error.message : "YouTube health ping failed",
      quotaUnitsUsed: QUOTA_SEARCH_COST,
    };
  }
}

/** Fetch and aggregate live YouTube fashion intelligence via Data API v3. */
export async function fetchLiveYouTube(): Promise<YouTubeIntelligenceData> {
  if (!isYouTubeLiveConfigured()) {
    throw new Error("YOUTUBE_API_KEY not configured");
  }

  const videos = await collectVideos();
  return aggregate(videos);
}

/** Estimated quota units for a full sync (for adapter rate-limit display). */
export function estimateYouTubeSyncQuota(): number {
  const searchCost = SEARCH_TOPICS.length * QUOTA_SEARCH_COST;
  const videoCalls = Math.ceil(
    (SEARCH_TOPICS.length * MAX_RESULTS_PER_TOPIC) / 50,
  );
  return searchCost + videoCalls * QUOTA_VIDEOS_LIST_COST;
}
