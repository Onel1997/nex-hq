import type {
  FashionNewsArticle,
  FashionNewsIntelligenceData,
  FashionNewsMention,
} from "../fashion-news";

interface FeedSource {
  name: string;
  url: string;
}

/**
 * Default public RSS feeds used when no custom feed is configured. RSS only —
 * no HTML scraping, no paywall bypass. Unreachable feeds are skipped silently.
 */
const DEFAULT_FEEDS: FeedSource[] = [
  { name: "Hypebeast", url: "https://hypebeast.com/feed" },
  { name: "Highsnobiety", url: "https://www.highsnobiety.com/feed/" },
  { name: "Vogue Business", url: "https://www.voguebusiness.com/feed" },
  { name: "FashionUnited", url: "https://fashionunited.uk/rss/news" },
];

const MAX_ARTICLES = 40;
const PER_FEED_TIMEOUT_MS = 8000;

/**
 * Fashion News (RSS) limitations (documented for the Data Sources Center):
 * - RSS depends entirely on publisher availability — feeds can be moved,
 *   throttled, or taken offline without notice, and are skipped when unreachable.
 * - Many outlets expose only a title, link, date, and a short snippet in RSS —
 *   NOT the full article body. We aggregate metadata/snippets only.
 * - Paywalled sources provide only headline metadata; full text is never fetched,
 *   scraped, or bypassed.
 * - RSS is NOT real-time — feeds update on each publisher's own schedule, so
 *   freshness lags the actual publication time.
 * - Categories/tags are only present when the publisher includes them; absence is
 *   reported honestly, never inferred as empty coverage.
 */
export const FASHION_NEWS_API_LIMITATIONS =
  "RSS depends on publisher availability — unreachable feeds are skipped. Most outlets expose only title/link/date and a short snippet (not full articles); paywalled sources provide metadata only and are never scraped or bypassed. RSS is not real-time — it updates on the publisher's schedule. Tags appear only when the publisher includes them.";

// ---------------------------------------------------------------------------
// Lexicons for the structured extraction step.
// ---------------------------------------------------------------------------

const FASHION_KEYWORDS = [
  "streetwear",
  "sneaker",
  "sneakers",
  "collab",
  "collaboration",
  "drop",
  "capsule",
  "collection",
  "runway",
  "campaign",
  "launch",
  "release",
  "limited edition",
  "sustainable",
  "resale",
  "archive",
  "vintage",
  "denim",
  "footwear",
  "accessories",
  "menswear",
  "womenswear",
  "couture",
  "luxury",
  "fashion week",
];

const BRAND_TERMS = [
  "nike",
  "adidas",
  "new balance",
  "asics",
  "salomon",
  "carhartt",
  "stussy",
  "supreme",
  "palace",
  "corteiz",
  "aime leon dore",
  "kith",
  "represent",
  "essentials",
  "fear of god",
  "stone island",
  "arc'teryx",
  "the north face",
  "uniqlo",
  "cos",
  "acne studios",
  "jacquemus",
  "bottega veneta",
  "prada",
  "miu miu",
  "gucci",
  "balenciaga",
  "louis vuitton",
  "dior",
  "loewe",
  "bape",
  "yeezy",
  "jordan",
  "vans",
  "converse",
  "levi's",
  "ralph lauren",
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
  "metallic",
  "washed",
];

const MATERIAL_TERMS = [
  "cotton",
  "fleece",
  "denim",
  "corduroy",
  "nylon",
  "leather",
  "suede",
  "wool",
  "cashmere",
  "linen",
  "gore-tex",
  "knit",
  "mesh",
  "canvas",
  "recycled",
  "organic cotton",
];

const SILHOUETTE_TERMS = [
  "oversized",
  "boxy",
  "cropped",
  "wide leg",
  "wide-leg",
  "baggy",
  "relaxed",
  "slim",
  "tailored",
  "longline",
  "utility",
  "cargo",
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
  "here",
  "just",
  "like",
  "more",
  "most",
  "some",
  "over",
  "after",
  "before",
  "how",
  "new",
  "the",
  "and",
  "for",
  "are",
  "was",
  "why",
  "who",
  "her",
  "his",
  "its",
  "our",
  "out",
  "now",
  "gets",
  "get",
  "why",
]);

// ---------------------------------------------------------------------------
// Feed configuration.
// ---------------------------------------------------------------------------

/** Parse FASHION_NEWS_RSS_URL / FASHION_NEWS_RSS_URLS into feed sources. */
function getCustomFeeds(): FeedSource[] {
  const raw = [
    process.env.FASHION_NEWS_RSS_URLS ?? "",
    process.env.FASHION_NEWS_RSS_URL ?? "",
  ]
    .join(",")
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter((entry) => /^https?:\/\//i.test(entry));

  const unique = [...new Set(raw)];
  return unique.map((url) => ({ name: hostLabel(url), url }));
}

export function hasCustomFashionNewsFeeds(): boolean {
  return getCustomFeeds().length > 0;
}

/** Active feeds: custom env feeds if present, otherwise default public feeds. */
function getActiveFeeds(): FeedSource[] {
  const custom = getCustomFeeds();
  return custom.length > 0 ? custom : DEFAULT_FEEDS;
}

export function isFashionNewsLiveConfigured(): boolean {
  return getActiveFeeds().length > 0;
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "RSS Feed";
  }
}

// ---------------------------------------------------------------------------
// Dependency-free RSS / Atom parsing (parses fetched XML, never scrapes HTML).
// ---------------------------------------------------------------------------

function decodeEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstTag(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(block);
  return match ? decodeEntities(match[1]) : null;
}

function allTags(block: string, tag: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  let match: RegExpExecArray | null;
  while ((match = regex.exec(block)) !== null) {
    const value = decodeEntities(match[1]);
    if (value) results.push(value);
  }
  return results;
}

function extractLink(block: string): string {
  // RSS: <link>url</link>. Atom: <link href="url" .../>.
  const rssLink = firstTag(block, "link");
  if (rssLink && /^https?:\/\//i.test(rssLink)) return rssLink;

  const atom = /<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i.exec(block);
  if (atom) return atom[1];

  const guid = firstTag(block, "guid");
  if (guid && /^https?:\/\//i.test(guid)) return guid;

  return "";
}

function extractCategories(block: string): string[] {
  const textCats = allTags(block, "category");
  const termCats: string[] = [];
  const regex = /<category[^>]*\bterm=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(block)) !== null) {
    termCats.push(decodeEntities(match[1]));
  }
  return [...new Set([...textCats, ...termCats])]
    .map((c) => c.trim())
    .filter((c) => c.length > 0 && c.length < 40)
    .slice(0, 6);
}

function parseDate(block: string): string | null {
  const raw =
    firstTag(block, "pubDate") ??
    firstTag(block, "dc:date") ??
    firstTag(block, "published") ??
    firstTag(block, "updated");
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function feedTitle(xml: string, fallback: string): string {
  const headEnd = xml.search(/<item\b|<entry\b/i);
  const head = headEnd > 0 ? xml.slice(0, headEnd) : xml;
  const title =
    firstTag(head, "title") ?? firstTag(xml, "title") ?? fallback;
  return title.length > 0 ? title : fallback;
}

interface ParsedArticle extends FashionNewsArticle {
  snippet: string;
}

function parseFeed(xml: string, source: FeedSource): ParsedArticle[] {
  const sourceName = feedTitle(xml, source.name) || source.name;
  const blocks: string[] = [];

  const itemRegex = /<item\b[\s\S]*?<\/item>/gi;
  const entryRegex = /<entry\b[\s\S]*?<\/entry>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) blocks.push(match[0]);
  if (blocks.length === 0) {
    while ((match = entryRegex.exec(xml)) !== null) blocks.push(match[0]);
  }

  const articles: ParsedArticle[] = [];
  for (const block of blocks) {
    const title = firstTag(block, "title");
    if (!title) continue;
    const snippet =
      firstTag(block, "description") ??
      firstTag(block, "summary") ??
      firstTag(block, "content:encoded") ??
      firstTag(block, "content") ??
      "";

    articles.push({
      title,
      source: sourceName,
      link: extractLink(block),
      publishedAt: parseDate(block),
      categories: extractCategories(block),
      snippet,
    });
  }

  return articles;
}

async function fetchFeed(source: FeedSource): Promise<ParsedArticle[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PER_FEED_TIMEOUT_MS);

  try {
    const response = await fetch(source.url, {
      headers: {
        "User-Agent": "nexhq-intelligence/1.0 (research studio; RSS reader)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      signal: controller.signal,
      next: { revalidate: 1800 },
    });

    if (!response.ok) {
      throw new Error(`${hostLabel(source.url)} ${response.status}`);
    }

    const xml = await response.text();
    if (!/<rss|<feed|<item\b|<entry\b/i.test(xml)) {
      throw new Error(`${hostLabel(source.url)} did not return an RSS/Atom feed`);
    }

    return parseFeed(xml, source);
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Aggregation.
// ---------------------------------------------------------------------------

function countTerms(
  haystacks: string[],
  terms: string[],
  limit: number,
): FashionNewsMention[] {
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
    const words = hay.split(/[^a-z0-9']+/);
    for (const word of new Set(words)) {
      if (word.length < 4) continue;
      if (STOPWORDS.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return counts;
}

function aggregate(articles: ParsedArticle[]): FashionNewsIntelligenceData {
  // De-duplicate by link (fallback to title) — feeds/mirrors can overlap.
  const byKey = new Map<string, ParsedArticle>();
  for (const article of articles) {
    const key = (article.link || article.title).toLowerCase();
    if (!byKey.has(key)) byKey.set(key, article);
  }
  const unique = [...byKey.values()];

  // Sort newest first; undated articles keep feed order at the end.
  unique.sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });

  const haystacks = unique.map((a) => `${a.title} ${a.snippet}`.toLowerCase());
  const titleHaystacks = unique.map((a) => a.title.toLowerCase());

  const keywords = countTerms(haystacks, FASHION_KEYWORDS, 12);
  const brandMentions = countTerms(haystacks, BRAND_TERMS, 10);
  const colorSignals = countTerms(haystacks, COLOR_TERMS, 8);
  const materialSignals = countTerms(haystacks, MATERIAL_TERMS, 8);
  const silhouetteSignals = countTerms(haystacks, SILHOUETTE_TERMS, 8);

  const categoryCounts = new Map<string, number>();
  for (const article of unique) {
    for (const category of article.categories) {
      const key = category.toLowerCase();
      categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1);
    }
  }
  const categories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([term, count]) => ({ term, count }));

  // Repeated topics: title tokens appearing across multiple articles.
  const repeatedTopics = [...tokenCounts(titleHaystacks).entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([term]) => term);

  // Emerging themes: tokens concentrated in the most recent quarter of articles
  // that are not already dominant across the full sample.
  const recentCount = Math.max(3, Math.ceil(unique.length / 4));
  const recentHaystacks = unique
    .slice(0, recentCount)
    .map((a) => `${a.title} ${a.snippet}`.toLowerCase());
  const recentTokens = tokenCounts(recentHaystacks);
  const overallTokens = tokenCounts(haystacks);
  const emergingThemes = [...recentTokens.entries()]
    .filter(([token, recent]) => {
      const overall = overallTokens.get(token) ?? 0;
      return recent >= 2 && recent / Math.max(1, overall) >= 0.6;
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([token, count]) => `${token} gaining coverage (${count} recent articles)`);

  const sources = [...new Set(unique.map((a) => a.source))];

  return {
    articles: unique.slice(0, MAX_ARTICLES).map((a) => ({
      title: a.title,
      source: a.source,
      link: a.link,
      publishedAt: a.publishedAt,
      categories: a.categories,
    })),
    sources,
    headlines: unique.slice(0, 10).map((a) => a.title),
    keywords,
    brandMentions,
    colorSignals,
    materialSignals,
    silhouetteSignals,
    categories,
    repeatedTopics,
    emergingThemes,
  };
}

// ---------------------------------------------------------------------------
// Public API — mirrors the other production connectors.
// ---------------------------------------------------------------------------

/** Cheap health ping — verifies the first active feed is reachable & valid RSS. */
export async function pingFashionNewsLive(): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
}> {
  const feeds = getActiveFeeds();
  if (feeds.length === 0) {
    return {
      ok: false,
      latencyMs: 0,
      message: "No fashion RSS feed configured",
    };
  }

  const started = Date.now();
  try {
    const articles = await fetchFeed(feeds[0]);
    const latencyMs = Date.now() - started;
    if (articles.length === 0) {
      return {
        ok: false,
        latencyMs,
        message: `${hostLabel(feeds[0].url)} reachable but returned no articles`,
      };
    }
    return {
      ok: true,
      latencyMs,
      message: `Live · ${hostLabel(feeds[0].url)} reachable · ${articles.length} articles`,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      message:
        error instanceof Error ? error.message : "Fashion News health ping failed",
    };
  }
}

/** Fetch and aggregate live fashion news from configured/default RSS feeds. */
export async function fetchLiveFashionNews(): Promise<FashionNewsIntelligenceData> {
  const feeds = getActiveFeeds();
  if (feeds.length === 0) {
    throw new Error("No fashion RSS feed configured");
  }

  const collected: ParsedArticle[] = [];
  const errors: string[] = [];

  const settled = await Promise.allSettled(feeds.map((feed) => fetchFeed(feed)));
  settled.forEach((outcome, index) => {
    if (outcome.status === "fulfilled") {
      collected.push(...outcome.value);
    } else {
      const reason =
        outcome.reason instanceof Error
          ? outcome.reason.message
          : `${hostLabel(feeds[index].url)} failed`;
      errors.push(reason);
    }
  });

  if (collected.length === 0) {
    throw new Error(
      errors.length > 0
        ? `No articles from any feed — ${errors[0]}`
        : "No articles returned from the configured fashion RSS feeds",
    );
  }

  return aggregate(collected);
}
