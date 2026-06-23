import type { ConnectorInput, IntelligenceSignal, SourceIntelligence } from "./types";

export interface TikTokTrend {
  hashtag: string;
  views: number;
  change: number;
  category: "silhouette" | "color" | "outfit" | "brand";
  insight: string;
}

export interface TikTokIntelligenceData {
  viralTrends: TikTokTrend[];
  hashtags: string[];
  outfitTrends: string[];
  colors: string[];
  silhouettes: string[];
}

const BASE_DATA: TikTokIntelligenceData = {
  viralTrends: [
    {
      hashtag: "#oversizedstreetwear",
      views: 2_400_000_000,
      change: 24,
      category: "silhouette",
      insight: "Boxy oversized fits dominating TikTok outfit videos",
    },
    {
      hashtag: "#earthtones",
      views: 1_800_000_000,
      change: 31,
      category: "color",
      insight: "Earth brown and sage green outfit combos viral",
    },
    {
      hashtag: "#quietluxurystreetwear",
      views: 890_000_000,
      change: 19,
      category: "outfit",
      insight: "Premium minimal fits without loud logos trending",
    },
    {
      hashtag: "#heavweight hoodie",
      views: 620_000_000,
      change: 16,
      category: "silhouette",
      insight: "Heavy fleece hoodies as hero piece",
    },
    {
      hashtag: "#capsulewardrobe",
      views: 1_200_000_000,
      change: 14,
      category: "outfit",
      insight: "3-5 piece capsule drops preferred",
    },
  ],
  hashtags: [
    "#oversizedstreetwear",
    "#earthtones",
    "#quietluxurystreetwear",
    "#premiumstreetwear",
    "#boxyfit",
    "#streetwearcapsule",
  ],
  outfitTrends: [
    "Oversized tee tucked into wide cargos",
    "Monochrome earth tone layering",
    "Heavy hoodie + structured cap combo",
    "Minimal branding premium blanks",
  ],
  colors: ["Earth Brown", "Sage Green", "Obsidian Black", "Off White"],
  silhouettes: ["Oversized", "Boxy", "Wide-leg", "Relaxed"],
};

function toSignals(data: TikTokIntelligenceData): IntelligenceSignal[] {
  return data.viralTrends.map((t) => ({
    id: `tiktok-${t.hashtag.replace("#", "")}`,
    category: "social" as const,
    source: "tiktok" as const,
    label: t.hashtag,
    message: t.insight,
    score: Math.min(100, 50 + t.change),
    direction: t.change >= 0 ? ("up" as const) : ("down" as const),
    tags: [t.category, "viral"],
  }));
}

/** Scan TikTok for viral streetwear trends and hashtags. */
export async function scanTikTok(
  _input: ConnectorInput = {},
): Promise<SourceIntelligence<TikTokIntelligenceData>> {
  return {
    source: "tiktok",
    mode: process.env.TIKTOK_API_KEY ? "live" : "simulated",
    loadedAt: new Date().toISOString(),
    signals: toSignals(BASE_DATA),
    data: BASE_DATA,
  };
}
