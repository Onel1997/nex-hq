import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";
import type { CommercialScoreBreakdown } from "@/lib/design/commercial-design-director/commercial-score";
import {
  evaluateDailyRotation,
  evaluateDistanceReadability,
  evaluateLuxuryRestraint,
  evaluatePrintDensity,
  evaluateWearabilityCompositionMatch,
  resolvePlacementProfile,
} from "@/lib/design/design-knowledge/wearability";

export interface WearabilityAssessment {
  score: number;
  weeklyWearable: boolean;
  feelsPremiumAfterWears: boolean;
  agesWell: boolean;
  compositionMatch: number;
  wearabilityAligned: boolean;
  placement: string;
  notes: string[];
}

/** Commercial Director wearability evaluation — apparel designer lens. */
export function evaluateWearability(
  brief: DesignStudioBrief,
  spec: LibraryArtworkSpec,
  commercialScore: CommercialScoreBreakdown,
): WearabilityAssessment {
  const notes: string[] = [];
  const placement = spec.wearabilityDirection?.placement ?? resolvePlacementProfile(brief);
  const match = evaluateWearabilityCompositionMatch(spec);
  const rotation = evaluateDailyRotation(brief, spec);
  const density = evaluatePrintDensity(spec, placement);
  const restraint = evaluateLuxuryRestraint(spec, placement);
  const distance = evaluateDistanceReadability(spec, placement);

  let score =
    commercialScore.wearability * 0.35 +
    match.score * 0.25 +
    rotation.score * 0.2 +
    restraint.score * 0.12 +
    distance.score * 0.08;

  const weeklyWearable = rotation.weeklyWearable && match.weeklyWearable;
  const feelsPremiumAfterWears = restraint.feelsExpensive && match.feelsPremium;
  const agesWell = match.agesWell && !density.isPosterLike;

  if (weeklyWearable) notes.push("would become part of weekly wardrobe rotation");
  else notes.push("not yet weekly-rotation ready — check density and outfit pairing");

  if (feelsPremiumAfterWears) notes.push("premium restraint should hold after multiple wears");
  else notes.push("luxury perception may fade — reduce ornament density");

  if (agesWell) notes.push("composition should age well across collections");
  if (density.isPosterLike) notes.push("poster composition — shift to garment-scale artwork");
  if (!distance.readableAtDistance) notes.push("weak silhouette at 2–3 meter viewing distance");

  if (spec.wearabilityDirection) {
    notes.push(`apparel lens: ${spec.wearabilityDirection.apparelLens} @ ${placement.id}`);
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    weeklyWearable,
    feelsPremiumAfterWears,
    agesWell,
    compositionMatch: match.score,
    wearabilityAligned: match.aligned,
    placement: placement.id,
    notes,
  };
}
