import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";

export type OutfitPairing = "black-jeans" | "blue-denim" | "cargos" | "shorts" | "oversized-silhouette";

export interface DailyRotationAssessment {
  score: number;
  weeklyWearable: boolean;
  outfitCompatibility: Record<OutfitPairing, number>;
  versatility: number;
  dominatesOutfit: boolean;
  notes: string[];
}

const OUTFIT_KEYWORDS: Record<OutfitPairing, string[]> = {
  "black-jeans": ["minimal", "monochrome", "black", "quiet", "subtle", "luxury"],
  "blue-denim": ["vintage", "washed", "editorial", "stone", "neutral", "classic"],
  cargos: ["utility", "streetwear", "technical", "oversized", "urban"],
  shorts: ["summer", "light", "micro", "small", "emblem", "minimal"],
  "oversized-silhouette": ["oversized", "statement", "bold", "editorial", "layered"],
};

function pairingScore(spec: LibraryArtworkSpec, brief: DesignStudioBrief, pairing: OutfitPairing): number {
  const text = `${brief.visualConcept} ${spec.style.id} ${spec.template.id} ${brief.color}`.toLowerCase();
  const keywords = OUTFIT_KEYWORDS[pairing];
  let score = 58;

  for (const kw of keywords) {
    if (text.includes(kw)) score += 4;
  }

  if (pairing === "black-jeans" && spec.colors.ink !== spec.colors.secondary) score += 6;
  if (pairing === "oversized-silhouette" && spec.layout.id.includes("oversized")) score += 12;
  if (pairing === "shorts" && spec.layout.id.includes("micro")) score += 14;
  if (pairing === "shorts" && spec.layout.id.includes("chest")) score += 10;
  if (pairing === "black-jeans" && spec.template.id.includes("minimal")) score += 10;
  if (pairing === "cargos" && spec.style.id.includes("streetwear")) score += 10;

  const density = spec.symbols.length + spec.ornaments.length;
  if (pairing === "shorts" && density > 6) score -= 12;
  if (pairing === "black-jeans" && density <= 5) score += 8;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Would someone wear this weekly? Outfit compatibility across premium streetwear pairings. */
export function evaluateDailyRotation(
  brief: DesignStudioBrief,
  spec: LibraryArtworkSpec,
): DailyRotationAssessment {
  const notes: string[] = [];
  const outfitCompatibility = {
    "black-jeans": pairingScore(spec, brief, "black-jeans"),
    "blue-denim": pairingScore(spec, brief, "blue-denim"),
    cargos: pairingScore(spec, brief, "cargos"),
    shorts: pairingScore(spec, brief, "shorts"),
    "oversized-silhouette": pairingScore(spec, brief, "oversized-silhouette"),
  };

  const values = Object.values(outfitCompatibility);
  const versatility = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const strongPairings = values.filter((v) => v >= 72).length;

  const density = spec.symbols.length + spec.ornaments.length + spec.typography.length;
  const dominatesOutfit =
    density >= 12 ||
    (spec.template.id === "editorial-poster" && spec.layout.id.includes("chest"));

  let score = versatility;
  if (strongPairings >= 3) score += 10;
  if (strongPairings >= 4) score += 6;
  if (dominatesOutfit) {
    score -= 18;
    notes.push("print dominates outfit — limits daily rotation");
  }
  if (spec.style.negativeSpace >= 0.38 && density <= 8) {
    score += 8;
    notes.push("breathing room supports weekly wardrobe rotation");
  }

  const role = brief.role.toLowerCase();
  if (role.includes("core essential") && density <= 6) score += 10;
  if (role.includes("statement") && spec.layout.id.includes("oversized")) score += 6;

  const weeklyWearable = score >= 70 && strongPairings >= 2 && !dominatesOutfit;

  if (!weeklyWearable) notes.push("not yet confident for weekly wardrobe rotation");

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    weeklyWearable,
    outfitCompatibility,
    versatility,
    dominatesOutfit,
    notes,
  };
}
