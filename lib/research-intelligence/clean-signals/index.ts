export {
  buildCleanResearchSignalSet,
  buildCleanTrendSummary,
  type CleanResearchSignal,
  type CleanResearchSignalSet,
} from "./clean-signal-set";
export {
  deriveResearchScope,
  filterSilhouettesForScope,
  isOutOfScopeCategory,
  passesResearchScope,
  scopeApprovedSilhouettes,
  type ResearchScope,
} from "./research-scope";
export {
  dedupeMaterialTraits,
  dedupeSilhouettes,
  isIncompleteSilhouette,
  normalizeSilhouetteLabel,
  partitionMaterialTraits,
} from "./product-terminology";
export { cleanAggregatedPatterns, sanitizeSuccessReasons } from "./pattern-cleanup";
export { dedupeActionCardsSemantic, dedupeRecommendationsSemantic } from "./semantic-dedup";
