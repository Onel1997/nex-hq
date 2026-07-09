export type {
  GarmentPlacement,
  PlacementProfile,
} from "@/lib/design/design-knowledge/wearability/placement";
export {
  getPlacementProfile,
  resolvePlacementProfile,
} from "@/lib/design/design-knowledge/wearability/placement";

export type {
  PrintDensityAssessment,
} from "@/lib/design/design-knowledge/wearability/print-density";
export {
  evaluatePrintDensity,
  getDensityCap,
} from "@/lib/design/design-knowledge/wearability/print-density";

export type {
  LuxuryRestraintAssessment,
} from "@/lib/design/design-knowledge/wearability/luxury-restraint";
export {
  applyLuxuryRestraint,
  evaluateLuxuryRestraint,
} from "@/lib/design/design-knowledge/wearability/luxury-restraint";

export type {
  DistanceReadabilityAssessment,
} from "@/lib/design/design-knowledge/wearability/distance-readability";
export { evaluateDistanceReadability } from "@/lib/design/design-knowledge/wearability/distance-readability";

export type {
  DailyRotationAssessment,
  OutfitPairing,
} from "@/lib/design/design-knowledge/wearability/daily-rotation";
export { evaluateDailyRotation } from "@/lib/design/design-knowledge/wearability/daily-rotation";

export type {
  WearabilityPrinciple,
  WearabilityPrincipleId,
} from "@/lib/design/design-knowledge/wearability/wearability-library";
export {
  getWearabilityPrinciple,
  principlesForPlacement,
  WEARABILITY_PRINCIPLES,
} from "@/lib/design/design-knowledge/wearability/wearability-library";

export type { WearabilityDirectorDecision } from "@/lib/design/design-knowledge/wearability/wearability-selector";
export { decideWearabilityDirection } from "@/lib/design/design-knowledge/wearability/wearability-selector";

export type {
  WearabilityCompositionMatch,
  WearabilityCompositionWeights,
} from "@/lib/design/design-knowledge/wearability/wearability-rules";
export {
  applyWearabilityComposition,
  applyWearabilityLayoutScore,
  applyWearabilityStyleScore,
  applyWearabilityTemplateScore,
  buildWearabilityWeights,
  effectiveWearabilityNegativeSpace,
  evaluateWearabilityCompositionMatch,
  rankWearabilityOrnaments,
  rankWearabilitySymbols,
  wearabilityRevisionOverrides,
} from "@/lib/design/design-knowledge/wearability/wearability-rules";
