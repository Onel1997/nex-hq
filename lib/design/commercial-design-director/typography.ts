import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";
import {
  auditHeroTypography,
  evaluateHeroTypographyMatch,
} from "@/lib/design/design-knowledge/hero-typography";

export interface CommercialTypographyAssessment {
  score: number;
  compositionShare: number;
  scaleCount: number;
  conceptHits: string[];
  scrollStopBoost: number;
  luxuryBoost: number;
  penalties: string[];
  aligned: boolean;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Commercial typography quality — hero editorial artwork, not poster graphics. */
export function evaluateCommercialTypography(spec: LibraryArtworkSpec): CommercialTypographyAssessment {
  const match = evaluateHeroTypographyMatch(spec);
  const audit = auditHeroTypography(spec.typography, spec.layoutZones, spec.brief.role);
  const typeLayers = spec.typography.filter((t) => t.layer === "typography").length;
  const isCoreEssential = spec.brief.role.toLowerCase().includes("core essential");
  const hasHeroLayers = spec.typography.some(
    (t) => t.id.startsWith("hero-type-") || t.id.startsWith("premium-type-"),
  );
  const hasGhost = spec.typography.some((t) => t.variant === "ghost");
  const hasCropped = spec.typography.some((t) => t.variant === "cropped" || t.clipPathId);
  const hasLayered = typeLayers >= 3;

  let score = clamp(match.score * 0.55 + audit.score * 0.35);

  if (hasHeroLayers) score += 8;
  if (hasGhost && hasCropped) score += 10;
  else if (hasGhost || hasCropped) score += 5;
  if (hasLayered) score += 8;
  if (match.scaleCount >= 3) score += 10;
  else if (match.scaleCount >= 2) score += 5;
  if (isCoreEssential) {
    if (hasGhost) score += 8;
    if (spec.typography.some((t) => t.role === "collection-code")) score += 6;
    if (typeLayers >= 1 && spec.typography.filter((t) => t.layer === "decorative").length >= 2) score += 8;
  } else if (match.compositionShare >= 0.55) {
    score += 12;
  } else if (match.compositionShare >= 0.45) {
    score += 6;
  }

  const penalties = match.penalties.filter(
    (p) => !isCoreEssential || (!p.includes("below hero minimum") && !p.includes("hero typography groups")),
  );
  for (const penalty of penalties) {
    if (penalty.includes("single text") || penalty.includes("centered title")) score -= 14;
    else if (penalty.includes("poster") || penalty.includes("equal font")) score -= 10;
    else score -= 5;
  }

  score = clamp(score);

  const scrollStopBoost =
    (hasGhost ? 6 : 0) +
    (hasCropped ? 8 : 0) +
    (isCoreEssential ? 0 : match.compositionShare >= 0.55 ? 10 : 0) +
    (match.scaleCount >= 3 ? 6 : 0) +
    (hasLayered ? 4 : 0);

  const luxuryBoost =
    (hasGhost ? 4 : 0) +
    (spec.typography.some((t) => t.role === "collection-code") ? 5 : 0) +
    (match.conceptHits.includes("museum-label") ? 6 : 0);

  return {
    score,
    compositionShare: match.compositionShare,
    scaleCount: match.scaleCount,
    conceptHits: match.conceptHits,
    scrollStopBoost,
    luxuryBoost,
    penalties: [...match.penalties, ...audit.reasons],
    aligned: match.aligned && audit.passed,
  };
}
