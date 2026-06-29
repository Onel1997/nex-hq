import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";

export interface TrendFitAssessment {
  score: number;
  calmLuxuryAligned: boolean;
  quietLuxuryAligned: boolean;
  y2kRisk: boolean;
  fastFashionRisk: boolean;
  notes: string[];
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Fashion relevance without chasing hype trends. */
export function evaluateTrendFit(
  brief: DesignStudioBrief,
  spec: LibraryArtworkSpec,
): TrendFitAssessment {
  const notes: string[] = [];
  const corpus = `${brief.visualConcept} ${brief.designDescription} ${brief.materialEffects}`.toLowerCase();
  let score = 58;

  const calmLuxuryAligned =
    corpus.includes("calm") ||
    corpus.includes("quiet") ||
    corpus.includes("luxury") ||
    corpus.includes("negative space");
  const quietLuxuryAligned =
    calmLuxuryAligned ||
    spec.style.id.includes("minimal") ||
    brief.negativeSpaceRules.toLowerCase().includes("breathing");

  if (quietLuxuryAligned) {
    score += 14;
    notes.push("aligns with calm / quiet luxury streetwear direction");
  }

  const y2kRisk =
    corpus.includes("y2k") || corpus.includes("neon") || corpus.includes("chrome");
  if (y2kRisk) {
    score -= 14;
    notes.push("y2k / neon signals may age quickly for Milaene");
  }

  const fastFashionRisk =
    corpus.includes("trendy") || corpus.includes("viral") || spec.template.id === "technical-blueprint";
  if (fastFashionRisk) {
    score -= 10;
    notes.push("reads closer to fast trend graphic than premium drop");
  }

  if (spec.style.id.includes("editorial") || spec.style.id.includes("fashion")) {
    score += 10;
  }

  if (brief.campaignPotential) {
    score += 6;
    notes.push("campaign potential supports current fashion storytelling");
  }

  return {
    score: clamp(score),
    calmLuxuryAligned,
    quietLuxuryAligned,
    y2kRisk,
    fastFashionRisk,
    notes,
  };
}
