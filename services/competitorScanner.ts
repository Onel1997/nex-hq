import { MILAENE_DNA } from "@/services/milaene-dna";

export type CompetitorStatus = "watching" | "tracked" | "analyzing" | "stable";

export interface CompetitorIntel {
  name: string;
  status: CompetitorStatus;
  positioning: string;
  styleDirection: string;
  growth: string;
  newCollections: string;
  marketMovement: string;
  trendChange: string;
  signal: string;
}

const WATCHLIST: CompetitorIntel[] = [
  {
    name: "Corteiz",
    status: "watching",
    positioning: "Underground hype streetwear — scarcity-driven drops",
    styleDirection: "Oversized, bold graphics, UK street culture",
    growth: "+18% oversized demand",
    newCollections: "2 neue Drops erkannt",
    marketMovement: "Capsule frequency steigt",
    trendChange: "+18% oversized demand",
    signal: "2 neue Drops",
  },
  {
    name: "Represent",
    status: "tracked",
    positioning: "Premium British streetwear — elevated basics",
    styleDirection: "Minimal luxury, structured silhouettes",
    growth: "+12% premium positioning",
    newCollections: "Neue Capsule launched",
    marketMovement: "Premium segment expansion",
    trendChange: "+12% premium positioning",
    signal: "Neue Kollektion erkannt",
  },
  {
    name: "Fear of God",
    status: "analyzing",
    positioning: "Luxury streetwear — elevated essentials",
    styleDirection: "Relaxed luxury, muted palette",
    growth: "Luxury segment shift",
    newCollections: "Essentials line refresh",
    marketMovement: "Preisanpassung beobachtet",
    trendChange: "Luxury segment shift",
    signal: "Preisanpassung beobachtet",
  },
  {
    name: "Essentials",
    status: "stable",
    positioning: "Accessible premium basics — volume play",
    styleDirection: "Minimal, neutral, oversized basics",
    growth: "Stable market share",
    newCollections: "Seasonal color refresh",
    marketMovement: "Volume konstant",
    trendChange: "Stable market share",
    signal: "Volume konstant",
  },
  {
    name: "Cole Buxton",
    status: "watching",
    positioning: "UK premium streetwear — editorial quality",
    styleDirection: "Boxy fits, earth tones, craftsmanship",
    growth: "+9% UK streetwear growth",
    newCollections: "Capsule drop frequency rising",
    marketMovement: "Earth tone alignment — DNA match",
    trendChange: "+9% UK streetwear growth",
    signal: "Capsule drop frequency rising",
  },
];

export interface CompetitorScannerInput {
  brainCompetitors?: Array<{ name: string; notes?: string }>;
}

/** Track competitor watchlist with positioning and market movement analysis. */
export function scanCompetitors(input: CompetitorScannerInput = {}): CompetitorIntel[] {
  const { brainCompetitors } = input;

  if (!brainCompetitors?.length) {
    return WATCHLIST;
  }

  return WATCHLIST.map((competitor) => {
    const brainMatch = brainCompetitors.find(
      (c) => c.name.toLowerCase() === competitor.name.toLowerCase(),
    );
    if (!brainMatch?.notes) return competitor;

    return {
      ...competitor,
      signal: brainMatch.notes.slice(0, 80),
      marketMovement: `Brain signal: ${brainMatch.notes.slice(0, 60)}`,
    };
  });
}

/** How well a competitor's style direction overlaps with Milaene DNA. */
export function scoreCompetitorThreat(competitor: CompetitorIntel): number {
  const style = competitor.styleDirection.toLowerCase();
  let score = 50;

  if (MILAENE_DNA.silhouettes.some((s) => style.includes(s))) score += 15;
  if (/premium|editorial|minimal/.test(style)) score += 10;
  if (/earth|obsidian|muted/.test(style)) score += 8;
  if (competitor.status === "watching") score += 5;

  return Math.min(100, score);
}
