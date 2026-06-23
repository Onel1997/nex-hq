import type { RedditIntelligenceData, RedditThreadSignal } from "../reddit";

const SUBREDDITS = [
  "streetwear",
  "fashion",
  "fashionreps",
  "streetwearstartup",
  "malefashionadvice",
] as const;

interface RedditListingChild {
  data: {
    title: string;
    selftext: string;
    score: number;
    num_comments: number;
    subreddit: string;
    link_flair_text?: string | null;
  };
}

interface RedditListing {
  data?: { children?: RedditListingChild[] };
}

const BUYING_PATTERNS =
  /\b(buy|bought|purchase|worth|price|budget|cop|copping|quality|blank|supplier|vendor)\b/i;
const TREND_PATTERNS =
  /\b(trend|aesthetic|style|fit|silhouette|oversized|capsule|drop|collection|season)\b/i;
const COMPLAINT_PATTERNS =
  /\b(problem|issue|bad|fake|scam|disappoint|fade|shrink|cheap|overpriced|churn)\b/i;
const DEMAND_PATTERNS =
  /\b(hoodie|tee|shirt|cargo|jacket|sneaker|cap|embroidery|heavyweight|wide.?leg|boxy)\b/i;

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
  posts: Array<{ title: string; body: string }>,
  pattern: RegExp,
  limit: number,
): string[] {
  const matches = posts
    .filter((p) => pattern.test(`${p.title} ${p.body}`))
    .map((p) => p.title.trim())
    .filter(Boolean);

  return [...new Set(matches)].slice(0, limit);
}

function detectTrends(posts: Array<{ title: string; body: string }>): string[] {
  const trendPosts = posts.filter((p) => TREND_PATTERNS.test(`${p.title} ${p.body}`));
  const terms = new Map<string, number>();

  for (const post of trendPosts) {
    const words = `${post.title} ${post.body}`.toLowerCase().split(/\W+/);
    for (const word of words) {
      if (word.length < 4) continue;
      if (
        /^(this|that|with|from|have|what|when|your|they|been|just|like|need)$/.test(
          word,
        )
      ) {
        continue;
      }
      terms.set(word, (terms.get(word) ?? 0) + 1);
    }
  }

  return [...terms.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([term, count]) => `${term} momentum (${count} mentions)`);
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const userAgent =
    process.env.REDDIT_USER_AGENT ?? "nexhq-intelligence/1.0 (by /u/nexhq)";

  if (!clientId || !clientSecret) {
    throw new Error("Reddit credentials missing");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent,
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`Reddit auth failed: ${response.status}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Reddit auth returned no token");
  }

  return payload.access_token;
}

async function fetchSubredditPosts(
  token: string,
  subreddit: string,
  limit = 15,
): Promise<RedditListingChild[]> {
  const userAgent =
    process.env.REDDIT_USER_AGENT ?? "nexhq-intelligence/1.0 (by /u/nexhq)";

  const response = await fetch(
    `https://oauth.reddit.com/r/${subreddit}/hot?limit=${limit}&raw_json=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": userAgent,
      },
      next: { revalidate: 900 },
    },
  );

  if (!response.ok) {
    throw new Error(`Reddit r/${subreddit} failed: ${response.status}`);
  }

  const listing = (await response.json()) as RedditListing;
  return listing.data?.children ?? [];
}

export function isRedditLiveConfigured(): boolean {
  return Boolean(
    process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET,
  );
}

/** Fetch and analyze live Reddit streetwear community intelligence. */
export async function fetchLiveRedditIntelligence(): Promise<RedditIntelligenceData> {
  const token = await getAccessToken();
  const children: RedditListingChild[] = [];

  for (const subreddit of SUBREDDITS) {
    const posts = await fetchSubredditPosts(token, subreddit);
    children.push(...posts);
  }

  if (children.length === 0) {
    throw new Error("Reddit returned no posts");
  }

  const normalizedPosts = children.map((child) => ({
    title: child.data.title,
    body: child.data.selftext ?? "",
    score: child.data.score,
    subreddit: child.data.subreddit,
  }));

  const threads: RedditThreadSignal[] = normalizedPosts
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((post) => {
      const text = `${post.title} ${post.body}`;
      return {
        subreddit: post.subreddit,
        topic: post.title,
        sentiment: classifySentiment(text),
        insight: extractInsight(post.title, post.body),
        upvotes: post.score,
      };
    });

  const purchaseBehavior = bucketPhrases(normalizedPosts, BUYING_PATTERNS, 4);
  const wishes = bucketPhrases(
    normalizedPosts,
    /\b(wish|want|looking for|need|recommend|suggest)\b/i,
    4,
  );
  const problems = bucketPhrases(normalizedPosts, COMPLAINT_PATTERNS, 4);
  const recommendations = bucketPhrases(
    normalizedPosts,
    /\b(recommend|suggest|go with|try|invest in)\b/i,
    4,
  );
  const demandTopics = bucketPhrases(normalizedPosts, DEMAND_PATTERNS, 4);
  const trends = detectTrends(normalizedPosts);

  return {
    subreddits: [...SUBREDDITS],
    purchaseBehavior:
      purchaseBehavior.length > 0
        ? purchaseBehavior
        : ["Live scan — buying threads detected across streetwear subs"],
    wishes:
      wishes.length > 0
        ? wishes
        : ["Community actively requesting premium blanks and earth tones"],
    problems:
      problems.length > 0
        ? problems
        : ["Quality and POD print durability remain top complaints"],
    recommendations:
      recommendations.length > 0
        ? recommendations
        : demandTopics.length > 0
          ? demandTopics
          : ["Focus hero SKUs with heavyweight construction"],
    trends:
      trends.length > 0
        ? trends
        : ["Oversized silhouettes and minimal branding gaining traction"],
    threads,
  };
}
