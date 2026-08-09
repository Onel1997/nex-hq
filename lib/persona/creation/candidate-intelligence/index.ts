export {
  CANDIDATE_VARIATION_PROFILES,
  resolveCandidateVariation,
  variationFingerprint,
  type CandidateVariationProfile,
} from "./variations";

export {
  buildCandidatePrompt,
  composeProviderPrompt,
  resolveOfficialDiscoveryVariations,
  type BuiltCandidatePrompt,
  type PromptBlocks,
} from "./prompt-builder";

export {
  assertObfCastAnatomyDiversity,
  assertObfPromptHasNoLegacyBiology,
  buildDiscoveryIdentityL3Debug,
  buildDiscoveryIdentityL3Metadata,
  buildNoveltyBlockIdentityRetryContract,
  formatObfAgeBodyDirectionPrompt,
  formatObfArchetypeConstraintsPrompt,
  formatObfCastingSetPrompt,
  formatObfGarmentDirectionPrompt,
  formatObfPresenceFamilyPrompt,
  isObfL3DebugEnabled,
  nextDiscoveryIdentityAttempt,
  resolveObfDiscoveryIdentity,
  MAX_DISCOVERY_IDENTITY_ATTEMPTS,
  type DiscoveryIdentityL3Debug,
  type DiscoveryIdentityL3Metadata,
  type NoveltyBlockIdentityRetryContract,
  type ObfL3ResolveInput,
  type ObfL3ResolveResult,
} from "./obf-l3-integration";

export {
  CANDIDATE_D_CREATIVE_DNA_NON_GOALS,
  CANDIDATE_D_CREATIVE_DNA_QUALITY,
  CASTING_DIVERSITY_FACE_GEOMETRY,
  CASTING_DIVERSITY_HAIR_SILHOUETTES,
  PREMIUM_CASTING_QUALITY_REFERENCE,
  PREMIUM_PROMPT_REQUIRED_TOKENS,
  SOFTER_PRIMARY_STREETWEAR_FACE_QUALITY,
  SUBPREMIUM_CASTING_CUES,
  a1CastingCompositionBlock,
  a1CastingPhotographyBlock,
  a1PresenceRulesBlock,
  buildPremiumRetryPromptSuffix,
  genderEnforcementBlock,
  isOfficialArchetypeSlug,
  photographicRealismBlock,
  premiumArchetypeCastingBlock,
  premiumFashionPresenceBlock,
  premiumNegativePromptAdditions,
  premiumPhotographyBlock,
  realHumanPhotographPriorityBlock,
  slotCastingCameraBlock,
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
  defaultA1VisualCastingEvaluation,
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
