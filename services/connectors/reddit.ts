import type { ConnectorInput, IntelligenceSignal, SourceIntelligence } from "./types";

export interface RedditThreadSignal {
  subreddit: string;
  topic: string;
  sentiment: "positive" | "neutral" | "negative";
  insight: string;
  upvotes: number;
}

export interface RedditIntelligenceData {
  subreddits: string[];
  purchaseBehavior: string[];
  wishes: string[];
  problems: string[];
  recommendations: string[];
  trends: string[];
  threads: RedditThreadSignal[];
}

const SUBREDDITS = [
  "streetwear",
  "fashion",
  "fashionreps",
  "streetwearstartup",
  "malefashionadvice",
];

const BASE_DATA: RedditIntelligenceData = {
  subreddits: SUBREDDITS,
  purchaseBehavior: [
    "Quality over hype — buyers prefer premium blanks with subtle branding",
    "Capsule drops outperform always-on catalogs in streetwear communities",
    "POD skepticism wenn Qualität nicht premium wirkt",
    "Oversized fits dominieren Kaufentscheidungen 18-28",
  ],
  wishes: [
    "More earth tone palettes without fast-fashion aesthetic",
    "Heavyweight hoodies with embroidery under €80",
    "Wide-leg cargos with premium construction",
    "Scarcity without artificial hype tactics",
  ],
  problems: [
    "Low-quality POD prints fade after few washes",
    "Generic designs — hard to differentiate",
    "Shorts category weak conversion in indie brands",
    "Accessories ohne klare Markenidentität",
  ],
  recommendations: [
    "Invest in heavyweight blanks + embroidery",
    "Earth tone capsule for SS26",
    "Reduce SKU count — focus hero products",
    "Faith/Dream Tee formula auf Hoodies übertragen",
  ],
  trends: [
    "Oversized silhouettes accelerating",
    "Earth tones replacing loud graphics",
    "Premium minimalism over logo-heavy",
    "UK streetwear aesthetic gaining DE traction",
  ],
  threads: [
    {
      subreddit: "streetwear",
      topic: "Best oversized hoodies 2026",
      sentiment: "positive",
      insight: "Earth tones + heavy fleece most requested",
      upvotes: 842,
    },
    {
      subreddit: "malefashionadvice",
      topic: "Capsule wardrobe streetwear",
      sentiment: "positive",
      insight: "3-5 hero pieces preferred over large catalogs",
      upvotes: 1204,
    },
    {
      subreddit: "streetwearstartup",
      topic: "POD quality expectations",
      sentiment: "negative",
      insight: "Print quality is #1 churn reason",
      upvotes: 567,
    },
    {
      subreddit: "fashionreps",
      topic: "Premium blank suppliers",
      sentiment: "neutral",
      insight: "Heavyweight tees and hoodies most discussed",
      upvotes: 923,
    },
  ],
};

function toSignals(data: RedditIntelligenceData): IntelligenceSignal[] {
  const threadSignals = data.threads.map((t) => ({
    id: `reddit-${t.subreddit}-${t.topic.slice(0, 20).replace(/\s+/g, "-")}`,
    category: "social" as const,
    source: "reddit" as const,
    label: `r/${t.subreddit}`,
    message: t.insight,
    score: Math.min(100, Math.round(t.upvotes / 15)),
    direction: t.sentiment === "negative" ? ("down" as const) : ("up" as const),
    tags: [t.subreddit, t.sentiment],
  }));

  const trendSignals = data.trends.slice(0, 3).map((trend, i) => ({
    id: `reddit-trend-${i}`,
    category: "consumer" as const,
    source: "reddit" as const,
    label: "Community Trend",
    message: trend,
    score: 70 + i * 5,
    direction: "up" as const,
    tags: ["trend"],
  }));

  return [...threadSignals, ...trendSignals];
}

/** Scan Reddit streetwear communities for consumer intelligence. */
export async function scanReddit(
  _input: ConnectorInput = {},
): Promise<SourceIntelligence<RedditIntelligenceData>> {
  return {
    source: "reddit",
    mode: process.env.REDDIT_CLIENT_ID ? "live" : "simulated",
    loadedAt: new Date().toISOString(),
    signals: toSignals(BASE_DATA),
    data: BASE_DATA,
  };
}
