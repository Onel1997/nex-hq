import type {
  RedditEngagement,
  RedditIntelligenceData,
  RedditMention,
  RedditThreadSignal,
} from "../reddit";

const OAUTH_URL = "https://www.reddit.com/api/v1/access_token";
const API_BASE = "https://oauth.reddit.com";

/**
 * Communities scanned for streetwear / fashion / graphic-design intelligence.
 * Read-only, application OAuth only — add new public subreddits here to expand
 * coverage; no other change is required.
 */
const SUBREDDITS = [
  "streetwear",
  "streetwearstartup",
  "malefashion",
  "malefashionadvice",
  "graphic_design",
  "fashion",
] as const;

/**
 * Listings collected per subreddit. `top` is fetched across the requested time
 * windows (24h / 7d / 30d); `hot` and `rising` are point-in-time snapshots.
 */
const COLLECTIONS: Array<{
  sort: "hot" | "top" | "rising";
  timeframe: RedditThreadSignal["timeframe"];
  t?: "day" | "week" | "month";
}> = [
  { sort: "hot", timeframe: "all" },
  { sort: "rising", timeframe: "all" },
  { sort: "top", timeframe: "24h", t: "day" },
  { sort: "top", timeframe: "7d", t: "week" },
  { sort: "top", timeframe: "30d", t: "month" },
];

const POSTS_PER_LISTING = 25;

/**
 * Reddit API limitations (documented for the Data Sources Center):
 * - Application-only OAuth (client_credentials): read-only. We never post, vote,
 *   comment, or authenticate as a user — there is no user context or /me access.
 * - Only PUBLIC subreddits are visible. Private, restricted, and quarantined
 *   communities are not accessible and are silently skipped.
 * - Deleted/removed posts and comments are not returned by the API, so they can
 *   never be part of the aggregates.
 * - No user tracking: authors are ignored; nothing is attributed to individuals.
 * - Historical reach is limited — `top` supports fixed windows (hour/day/week/
 *   month/year/all). We collect day/week/month; there is no arbitrary date-range
 *   or full-archive access via the public API.
 * - Rate limits: ~60 requests/min per OAuth client (600/10min). Listings are
 *   cached (revalidate) and capped to a fixed subreddit set to stay well under.
 * - Comment velocity is approximated from a post's age (created_utc); Reddit does
 *   not expose true per-hour comment histograms via listing endpoints.
 */
export const REDDIT_API_LIMITATIONS =
  "Application-only OAuth is read-only (no posting, voting, or user auth). Only public subreddits are visible — private/quarantined communities and deleted posts are never returned. No user tracking. Historical reach is limited to Reddit's fixed top windows (24h/7d/30d); there is no full archive. ~60 req/min rate limit. Comment velocity is approximated from post age, not a true per-hour histogram.";

interface RedditPostData {
  title: string;
  selftext?: string;
  score: number;
  num_comments: number;
  subreddit: string;
  link_flair_text?: string | null;
  created_utc?: number;
  stickied?: boolean;
  over_18?: boolean;
}

interface RedditListingChild {
  kind?: string;
  data: RedditPostData;
}

interface RedditListing {
  data?: { children?: RedditListingChild[] };
}

interface TokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
}

/** Normalized post used for all downstream aggregation (never raw Reddit JSON). */
interface NormalizedPost {
  title: string;
  body: string;
  text: string;
  score: number;
  comments: number;
  subreddit: string;
  flair: string | null;
  createdUtc: number | null;
  sort: "hot" | "top" | "rising";
  timeframe: RedditThreadSignal["timeframe"];
}

// ---------------------------------------------------------------------------
// Lexicons — keyword buckets for the structured extraction step.
// ---------------------------------------------------------------------------

const BRAND_TERMS = [
  "nike",
  "adidas",
  "carhartt",
  "stussy",
  "supreme",
  "arcteryx",
  "arc'teryx",
  "uniqlo",
  "cos",
  "acne",
  "aime leon dore",
  "ald",
  "kith",
  "represent",
  "corteiz",
  "essentials",
  "fear of god",
  "stone island",
  "the north face",
  "new balance",
  "salomon",
  "asics",
  "polo",
  "ralph lauren",
  "levis",
  "levi's",
  "dickies",
  "patagonia",
  "yeezy",
  "jordan",
  "vans",
  "converse",
  "gap",
  "zara",
  "h&m",
  "bape",
  "palace",
];

const COLOR_TERMS = [
  "black",
  "white",
  "off-white",
  "cream",
  "beige",
  "tan",
  "brown",
  "earth tone",
  "earth tones",
  "olive",
  "sage",
  "green",
  "grey",
  "gray",
  "charcoal",
  "navy",
  "blue",
  "burgundy",
  "maroon",
  "red",
  "rust",
  "terracotta",
  "mustard",
  "yellow",
  "pink",
  "purple",
  "washed",
  "faded",
  "stone",
];

const MATERIAL_TERMS = [
  "cotton",
  "heavyweight",
  "fleece",
  "french terry",
  "terry",
  "jersey",
  "denim",
  "corduroy",
  "cord",
  "nylon",
  "polyester",
  "wool",
  "merino",
  "cashmere",
  "linen",
  "leather",
  "suede",
  "twill",
  "canvas",
  "ripstop",
  "gore-tex",
  "gore tex",
  "knit",
  "waffle",
];

const SILHOUETTE_TERMS = [
  "oversized",
  "oversize",
  "boxy",
  "cropped",
  "crop",
  "wide leg",
  "wide-leg",
  "baggy",
  "relaxed",
  "slim",
  "fitted",
  "tapered",
  "straight leg",
  "longline",
  "loose",
  "tailored",
  "drop shoulder",
  "cocoon",
];

const GRAPHIC_TERMS = [
  "embroidery",
  "embroidered",
  "screen print",
  "screenprint",
  "puff print",
  "dtg",
  "dtf",
  "tie dye",
  "tie-dye",
  "acid wash",
  "patchwork",
  "applique",
  "distressed",
  "washed",
  "all-over print",
  "all over print",
  "front print",
  "back print",
  "graphic tee",
  "logo",
  "typography",
  "text print",
  "flames",
  "gothic font",
];

const AESTHETIC_TERMS = [
  "gorpcore",
  "techwear",
  "minimalist",
  "minimal",
  "y2k",
  "vintage",
  "workwear",
  "grunge",
  "opium",
  "avant-garde",
  "normcore",
  "quiet luxury",
  "streetwear",
  "americana",
  "military",
  "utility",
  "skate",
  "prep",
  "old money",
  "cyberpunk",
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
  "been",
  "just",
  "like",
  "need",
  "want",
  "some",
  "would",
  "there",
  "about",
  "which",
  "their",
  "will",
  "into",
  "them",
  "than",
  "then",
  "were",
  "does",
  "should",
  "could",
  "really",
  "looking",
  "anyone",
  "help",
]);

const BUYING_PATTERNS =
  /\b(buy|bought|purchase|worth|price|budget|cop|copping|quality|blank|supplier|vendor)\b/i;
const TREND_PATTERNS =
  /\b(trend|aesthetic|style|fit|silhouette|oversized|capsule|drop|collection|season)\b/i;
const COMPLAINT_PATTERNS =
  /\b(problem|issue|bad|fake|scam|disappoint|fade|shrink|cheap|overpriced|churn)\b/i;
const DEMAND_PATTERNS =
  /\b(hoodie|tee|shirt|cargo|jacket|sneaker|cap|embroidery|heavyweight|wide.?leg|boxy)\b/i;

// ---------------------------------------------------------------------------
// OAuth (application-only / client_credentials — read-only, never a user).
// ---------------------------------------------------------------------------

function userAgent(): string {
  return (
    process.env.REDDIT_USER_AGENT?.trim() ||
    "nexhq-intelligence/1.0 (research studio; read-only)"
  );
}

export function isRedditLiveConfigured(): boolean {
  return Boolean(
    process.env.REDDIT_CLIENT_ID?.trim() &&
      process.env.REDDIT_CLIENT_SECRET?.trim(),
  );
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.REDDIT_CLIENT_ID?.trim();
  const clientSecret = process.env.REDDIT_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not configured");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  const response = await fetch(OAUTH_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent(),
    },
    // Application-only grant: no user, no scopes beyond public read.
    body: "grant_type=client_credentials",
    next: { revalidate: 3000 },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Reddit OAuth ${response.status}: ${body.slice(0, 160) || response.statusText}`,
    );
  }

  const payload = (await response.json()) as TokenResponse;
  if (payload.error || !payload.access_token) {
    throw new Error(
      `Reddit OAuth error: ${payload.error ?? "no access token returned"}`,
    );
  }

  return payload.access_token;
}

async function fetchListing(
  token: string,
  subreddit: string,
  collection: (typeof COLLECTIONS)[number],
): Promise<RedditListingChild[]> {
  const url = new URL(`${API_BASE}/r/${subreddit}/${collection.sort}`);
  url.searchParams.set("limit", String(POSTS_PER_LISTING));
  url.searchParams.set("raw_json", "1");
  if (collection.t) url.searchParams.set("t", collection.t);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": userAgent(),
    },
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(
      `Reddit r/${subreddit}/${collection.sort} ${response.status}`,
    );
  }

  const listing = (await response.json()) as RedditListing;
  return listing.data?.children ?? [];
}

// ---------------------------------------------------------------------------
// Normalization + extraction.
// ---------------------------------------------------------------------------

function normalizeChild(
  child: RedditListingChild,
  collection: (typeof COLLECTIONS)[number],
): NormalizedPost {
  const title = child.data.title?.trim() ?? "";
  const body = child.data.selftext?.trim() ?? "";
  return {
    title,
    body,
    text: `${title} ${body}`.trim(),
    score: child.data.score ?? 0,
    comments: child.data.num_comments ?? 0,
    subreddit: child.data.subreddit ?? "",
    flair: child.data.link_flair_text?.trim() || null,
    createdUtc:
      typeof child.data.created_utc === "number" ? child.data.created_utc : null,
    sort: collection.sort,
    timeframe: collection.timeframe,
  };
}

/** Count how often each lexicon term appears across the sample. */
function countTerms(
  posts: NormalizedPost[],
  terms: string[],
  limit: number,
): RedditMention[] {
  const counts = new Map<string, number>();
  const haystacks = posts.map((post) => post.text.toLowerCase());

  for (const term of terms) {
    const needle = term.toLowerCase();
    let count = 0;
    for (const hay of haystacks) {
      if (hay.includes(needle)) count += 1;
    }
    if (count > 0) counts.set(term, (counts.get(term) ?? 0) + count);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}

function countFlairs(posts: NormalizedPost[], limit: number): RedditMention[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    if (!post.flair) continue;
    counts.set(post.flair, (counts.get(post.flair) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}

function extractKeywords(posts: NormalizedPost[], limit: number): RedditMention[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    const words = post.text.toLowerCase().split(/[^a-z0-9']+/);
    for (const word of new Set(words)) {
      if (word.length < 4) continue;
      if (STOPWORDS.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}

function classifySentiment(text: string): RedditThreadSignal["sentiment"] {
  const lower = text.toLowerCase();
  const negative =
    COMPLAINT_PATTERNS.test(lower) ||
    /\b(don't|dont|avoid|never|worst|terrible|hate)\b/.test(lower);
  const positive =
    /\b(best|love|great|recommend|fire|goat|premium|solid)\b/.test(lower);

  if (negative && !positive) return "negative";
  if (positive && !negative) return "positive";
  return "neutral";
}

function extractInsight(title: string, body: string): string {
  const combined = `${title}. ${body}`.replace(/\s+/g, " ").trim();
  if (combined.length <= 120) return combined;
  return `${combined.slice(0, 117)}...`;
}

function bucketPhrases(
  posts: NormalizedPost[],
  pattern: RegExp,
  limit: number,
): string[] {
  const matches = posts
    .filter((post) => pattern.test(post.text))
    .map((post) => post.title)
    .filter(Boolean);
  return [...new Set(matches)].slice(0, limit);
}

function buildTrends(
  silhouettes: RedditMention[],
  graphics: RedditMention[],
  aesthetics: RedditMention[],
  colors: RedditMention[],
): string[] {
  const parts = [
    ...silhouettes.map((m) => `${m.term} silhouette (${m.count} mentions)`),
    ...aesthetics.map((m) => `${m.term} aesthetic (${m.count} mentions)`),
    ...graphics.map((m) => `${m.term} graphics (${m.count} mentions)`),
    ...colors.map((m) => `${m.term} palette (${m.count} mentions)`),
  ];
  return parts.slice(0, 6);
}

function computeEngagement(posts: NormalizedPost[]): RedditEngagement {
  if (posts.length === 0) {
    return { avgUpvotes: 0, avgComments: 0, commentVelocity: 0, sampleSize: 0 };
  }

  const totalUpvotes = posts.reduce((sum, post) => sum + post.score, 0);
  const totalComments = posts.reduce((sum, post) => sum + post.comments, 0);

  const nowSeconds = Date.now() / 1000;
  const velocities: number[] = [];
  for (const post of posts) {
    if (post.createdUtc == null) continue;
    const ageHours = Math.max(1, (nowSeconds - post.createdUtc) / 3600);
    velocities.push(post.comments / ageHours);
  }

  const commentVelocity =
    velocities.length > 0
      ? velocities.reduce((sum, v) => sum + v, 0) / velocities.length
      : 0;

  return {
    avgUpvotes: Math.round(totalUpvotes / posts.length),
    avgComments: Math.round(totalComments / posts.length),
    commentVelocity: Math.round(commentVelocity * 10) / 10,
    sampleSize: posts.length,
  };
}

function buildThreads(posts: NormalizedPost[], limit: number): RedditThreadSignal[] {
  return [...posts]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((post) => ({
      subreddit: post.subreddit,
      topic: post.title,
      sentiment: classifySentiment(post.text),
      insight: extractInsight(post.title, post.body),
      upvotes: post.score,
      comments: post.comments,
      flair: post.flair,
      sort: post.sort,
      timeframe: post.timeframe,
    }));
}

/** Aggregate normalized posts into structured Reddit intelligence. */
function aggregate(
  posts: NormalizedPost[],
  collectionsUsed: string[],
): RedditIntelligenceData {
  // De-duplicate posts by subreddit+title so multi-listing overlap doesn't
  // double-count engagement; keep the highest-scoring copy.
  const byKey = new Map<string, NormalizedPost>();
  for (const post of posts) {
    const key = `${post.subreddit}::${post.title.toLowerCase()}`;
    const existing = byKey.get(key);
    if (!existing || post.score > existing.score) byKey.set(key, post);
  }
  const unique = [...byKey.values()];

  const colorMentions = countTerms(unique, COLOR_TERMS, 8);
  const materialMentions = countTerms(unique, MATERIAL_TERMS, 8);
  const silhouetteMentions = countTerms(unique, SILHOUETTE_TERMS, 8);
  const graphicTrends = countTerms(unique, GRAPHIC_TERMS, 8);
  const aesthetics = countTerms(unique, AESTHETIC_TERMS, 8);
  const brandMentions = countTerms(unique, BRAND_TERMS, 10);
  const keywords = extractKeywords(unique, 12);
  const flairs = countFlairs(unique, 8);

  const topIdeas = [...unique]
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((post) => post.title)
    .filter(Boolean);

  return {
    subreddits: [...new Set(unique.map((post) => post.subreddit))],
    collections: collectionsUsed,
    purchaseBehavior: bucketPhrases(unique, BUYING_PATTERNS, 4),
    wishes: bucketPhrases(
      unique,
      /\b(wish|want|looking for|need|recommend|suggest)\b/i,
      4,
    ),
    problems: bucketPhrases(unique, COMPLAINT_PATTERNS, 4),
    recommendations: (() => {
      const recs = bucketPhrases(
        unique,
        /\b(recommend|suggest|go with|try|invest in)\b/i,
        4,
      );
      return recs.length > 0 ? recs : bucketPhrases(unique, DEMAND_PATTERNS, 4);
    })(),
    trends: buildTrends(
      silhouetteMentions,
      graphicTrends,
      aesthetics,
      colorMentions,
    ),
    threads: buildThreads(unique, 12),
    flairs,
    keywords,
    brandMentions,
    colorMentions,
    materialMentions,
    silhouetteMentions,
    graphicTrends,
    aesthetics,
    topIdeas,
    engagement: computeEngagement(unique),
  };
}

// ---------------------------------------------------------------------------
// Public API — mirrors the other production connectors.
// ---------------------------------------------------------------------------

/** Cheap health ping — OAuth validation only (acquires an app-only token). */
export async function pingRedditLive(): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
}> {
  if (!isRedditLiveConfigured()) {
    return {
      ok: false,
      latencyMs: 0,
      message: "REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not configured",
    };
  }

  const started = Date.now();
  try {
    await getAccessToken();
    return {
      ok: true,
      latencyMs: Date.now() - started,
      message: "Live · application OAuth token acquired (read-only)",
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message: error instanceof Error ? error.message : "Reddit health ping failed",
    };
  }
}

/** Fetch and aggregate live Reddit community intelligence (read-only). */
export async function fetchLiveReddit(): Promise<RedditIntelligenceData> {
  if (!isRedditLiveConfigured()) {
    throw new Error("Reddit OAuth credentials not configured");
  }

  const token = await getAccessToken();
  const posts: NormalizedPost[] = [];
  const collectionsUsed = new Set<string>();
  const errors: string[] = [];

  for (const subreddit of SUBREDDITS) {
    for (const collection of COLLECTIONS) {
      try {
        const children = await fetchListing(token, subreddit, collection);
        const normalized = children
          .filter((child) => child.data?.title && !child.data.over_18)
          .map((child) => normalizeChild(child, collection));
        if (normalized.length > 0) {
          posts.push(...normalized);
          collectionsUsed.add(
            collection.sort === "top"
              ? `top·${collection.timeframe}`
              : collection.sort,
          );
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "listing failed");
      }
    }
  }

  if (posts.length === 0) {
    throw new Error(
      errors.length > 0
        ? `Reddit API returned no posts — ${errors[0]}`
        : "Reddit API returned no public posts across the monitored communities",
    );
  }

  return aggregate(posts, [...collectionsUsed]);
}
