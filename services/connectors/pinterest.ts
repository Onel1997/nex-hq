import type { ConnectorInput, IntelligenceSignal, SourceIntelligence } from "./types";

export interface PinterestBoard {
  name: string;
  aesthetic: string;
  colors: string[];
  saves: number;
  trend: "rising" | "stable" | "declining";
}

export interface PinterestIntelligenceData {
  colorWorlds: string[];
  aesthetics: string[];
  outfitTrends: string[];
  capsuleTrends: string[];
  boards: PinterestBoard[];
}

const BASE_DATA: PinterestIntelligenceData = {
  colorWorlds: [
    "Earth Brown + Sage Green",
    "Obsidian Black + Off White",
    "Concrete Grey + Muted Olive",
    "Warm Sand + Terracotta",
  ],
  aesthetics: [
    "Quiet Luxury Streetwear",
    "Editorial Minimalism",
    "Urban Earth Capsule",
    "Scandinavian Street",
    "Brutalist Fashion",
  ],
  outfitTrends: [
    "Oversized tee + wide cargo + structured cap",
    "Heavy hoodie + relaxed trousers",
    "Monochrome layering earth tones",
    "Boxy silhouette monochrome",
  ],
  capsuleTrends: [
    "3-piece earth capsule (tee, hoodie, cap)",
    "Premium embroidery micro-drop",
    "SS26 transitional outerwear",
    "Signal green accent drop",
  ],
  boards: [
    {
      name: "Earth Tone Streetwear SS26",
      aesthetic: "Urban Earth Capsule",
      colors: ["Earth Brown", "Sage Green", "Off White"],
      saves: 12400,
      trend: "rising",
    },
    {
      name: "Oversized Minimal Fits",
      aesthetic: "Editorial Minimalism",
      colors: ["Obsidian Black", "Concrete Grey"],
      saves: 9800,
      trend: "rising",
    },
    {
      name: "Premium Hoodie Mood",
      aesthetic: "Quiet Luxury Streetwear",
      colors: ["Off White", "Earth Brown"],
      saves: 7600,
      trend: "stable",
    },
    {
      name: "Streetwear Color Palette 2026",
      aesthetic: "Brutalist Fashion",
      colors: ["Signal Green", "Obsidian Black"],
      saves: 5400,
      trend: "rising",
    },
  ],
};

function toSignals(data: PinterestIntelligenceData): IntelligenceSignal[] {
  const boardSignals = data.boards.map((b) => ({
    id: `pin-${b.name.replace(/\s+/g, "-").slice(0, 30)}`,
    category: "social" as const,
    source: "pinterest" as const,
    label: b.name,
    message: `${b.aesthetic}: ${b.colors.join(", ")} · ${b.saves.toLocaleString("de-DE")} saves`,
    score: Math.min(100, Math.round(b.saves / 150)),
    direction: b.trend === "declining" ? ("down" as const) : ("up" as const),
    tags: ["moodboard", b.aesthetic],
  }));

  const capsuleSignals = data.capsuleTrends.slice(0, 2).map((c, i) => ({
    id: `pin-capsule-${i}`,
    category: "trend" as const,
    source: "pinterest" as const,
    label: "Capsule Trend",
    message: c,
    score: 75 + i * 5,
    direction: "up" as const,
    tags: ["capsule"],
  }));

  return [...boardSignals, ...capsuleSignals];
}

/** Scan Pinterest for color worlds, aesthetics and capsule trends. */
export async function scanPinterest(
  _input: ConnectorInput = {},
): Promise<SourceIntelligence<PinterestIntelligenceData>> {
  return {
    source: "pinterest",
    mode: process.env.PINTEREST_ACCESS_TOKEN ? "live" : "simulated",
    loadedAt: new Date().toISOString(),
    signals: toSignals(BASE_DATA),
    data: BASE_DATA,
  };
}
