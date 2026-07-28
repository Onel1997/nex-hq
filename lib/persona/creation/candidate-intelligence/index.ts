export {
  CANDIDATE_VARIATION_PROFILES,
  resolveCandidateVariation,
  variationFingerprint,
  type CandidateVariationProfile,
} from "./variations";

export {
  buildCandidatePrompt,
  composeProviderPrompt,
  type BuiltCandidatePrompt,
  type PromptBlocks,
} from "./prompt-builder";

export {
  PREMIUM_CASTING_QUALITY_REFERENCE,
  buildPremiumRetryPromptSuffix,
  genderEnforcementBlock,
  isOfficialArchetypeSlug,
  premiumArchetypeCastingBlock,
  premiumFashionPresenceBlock,
  premiumNegativePromptAdditions,
  premiumPhotographyBlock,
  type OfficialArchetypeSlug,
} from "./premium-casting-direction";

export {
  DISCOVERY_QUALITY_MAX_REGENERATION_ATTEMPTS,
  DISCOVERY_QUALITY_MIN_BRIEF_FIT,
  evaluateDiscoveryCastingQuality,
  passesDiscoveryQualityGate,
  type DiscoveryQualityVerdict,
} from "./discovery-quality-filter";

export {
  assertCandidateIdentityDiversity,
  auditCandidateIdentityDiversity,
  type IdentityDiversityAudit,
  type IdentityDiversityViolation,
} from "./identity-diversity";

export {
  emptyVisualEvaluation,
  FakePersonaVisualEvaluator,
  isPersonaVisualEvaluationEnabled,
  resolvePersonaVisualEvaluator,
  PERSONA_VISUAL_EVALUATION_ENABLED_ENV,
  type PersonaVisualEvaluator,
  type VisualCastingEvaluation,
  type VisualCastingDimensions,
  type VisualEvaluationStatus,
} from "./visual-evaluator";

export {
  assessCandidateQuality,
  qualityFieldsForCandidate,
  readCandidateOverallScore,
  readCandidateCastingScores,
  type CandidateQualityAssessment,
  type CandidateQualityDimensions,
} from "./quality-score";

export {
  buildCastingRecommendation,
  type CastingChannel,
  type CastingRecommendation,
} from "./casting-recommendations";

export {
  ACTIVE_CASTING_POOL,
  FUTURE_CASTING_POOL_PRESETS,
  rankCandidatesByCommercialScore,
  selectTopCandidatesForDisplay,
  resolveCastingGenerateCount,
  type CastingPoolConfig,
  type CastingPoolMode,
  type RankableCandidate,
  type RankedCastingCandidate,
} from "./casting-pool";

export {
  buildDiversityReport,
  fingerprintDistance,
  type CandidateDiversityReport,
  type PairwiseDiversity,
} from "./visual-difference";

export {
  NOTES_HISTORY_KEY,
  appendCandidateNoteRevision,
  readNotesHistory,
  type CandidateNoteRevision,
} from "./notes";
