import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";
import { evaluateHeroTypographyMatch } from "@/lib/design/design-knowledge/hero-typography";

/** Instagram, Pinterest, moodboards, campaign photography, lookbook compatibility. */
export function evaluateSocialShareability(
  brief: DesignStudioBrief,
  spec: LibraryArtworkSpec,
): { score: number; notes: string[]; penalties: string[] } {
  const notes: string[] = [];
  const penalties: string[] = [];
  let score = 48;
  const heroMatch = evaluateHeroTypographyMatch(spec);
  const titleWords = brief.title.split(/\s+/).filter(Boolean).length;
  const oversized =
    spec.layout.id.includes("oversized") ||
    spec.wearabilityDirection?.placement.id === "oversized-back";

  if (oversized) {
    score += 12;
    notes.push("oversized scale reads in Instagram feed");
  }
  if (titleWords >= 2 && titleWords <= 4) {
    score += 10;
    notes.push("title length works for social caption overlay");
  }
  if (heroMatch.compositionShare >= 0.5) {
    score += 14;
    notes.push("typography-dominant — strong feed thumbnail");
  }
  if (spec.typography.some((t) => t.variant === "cropped" || t.variant === "ghost")) {
    score += 12;
    notes.push("editorial crop/ghost — Pinterest moodboard ready");
  }
  if (spec.style.id.includes("editorial") || spec.style.id.includes("fashion")) {
    score += 8;
    notes.push("lookbook-compatible editorial fashion feel");
  }
  if (brief.campaignPotential?.toLowerCase().includes("campaign") || brief.campaignPotential?.toLowerCase().includes("social")) {
    score += 8;
  }

  if (spec.layout.balance === "symmetric" && heroMatch.conceptHits.length < 2) {
    penalties.push("symmetric safe layout — weak social scroll-stop");
    score -= 12;
  }
  if (spec.symbols.length <= 1 && spec.typography.length <= 1) {
    penalties.push("too minimal for campaign photography impact");
    score -= 10;
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    notes,
    penalties,
  };
}
