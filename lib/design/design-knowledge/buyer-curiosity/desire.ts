import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";

/** Emotional desire — premium fashion feel that triggers purchase impulse. */
export function evaluateDesire(
  brief: DesignStudioBrief,
  spec: LibraryArtworkSpec,
): { score: number; notes: string[] } {
  const notes: string[] = [];
  let score = 46;
  const luxuryStyles = new Set([
    "silent-luxury",
    "minimal-luxury",
    "editorial-fashion",
    "monochrome-luxury",
    "scandinavian-minimal",
  ]);

  if (luxuryStyles.has(spec.style.id)) {
    score += 14;
    notes.push("premium fashion style signal");
  }
  if (brief.materialEffects.toLowerCase().includes("luxury") || brief.materialEffects.toLowerCase().includes("vintage")) {
    score += 10;
  }
  if (spec.typography.some((t) => t.variant === "ghost")) {
    score += 12;
    notes.push("ghost layer adds emotional depth");
  }
  if (spec.style.negativeSpace >= 0.38) {
    score += 10;
    notes.push("premium whitespace increases desire");
  }
  if (brief.campaignPotential?.toLowerCase().includes("scroll") || brief.campaignPotential?.toLowerCase().includes("high")) {
    score += 8;
  }
  if (spec.emotionalDirection && spec.emotionalDirection.confidence >= 70) {
    score += 10;
  }

  const cheapComplexity =
    spec.ornaments.length >= 7 &&
    spec.symbols.length >= 4 &&
    spec.style.negativeSpace < 0.3;
  if (cheapComplexity) {
    score -= 14;
    notes.push("cheap complexity reduces desire");
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), notes };
}
