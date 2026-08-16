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
  MAX_PROVIDER_PROMPT_LENGTH,
  TARGET_PROVIDER_PROMPT_LENGTH,
  OBF_DISCOVERY_NEGATIVE_COMPACT,
  compactOfficialBrandFaceProviderPrompt,
  enforceOpenAiDiscoveryPromptBudget,
  logPromptBudgetReport,
  type PromptBudgetReport,
  type EnforcePromptBudgetInput,
  type EnforcePromptBudgetResult,
} from "./prompt-budget";

export {
  URBAN_CASTING_DIVERSITY_FACE_GEOMETRY,
  URBAN_CASTING_DIVERSITY_HAIR_SILHOUETTES,
  URBAN_CROSS_SLOT_EXCLUSIONS,
  URBAN_MIN_SIBLING_DNA_DIFFS,
  URBAN_SIBLING_DNA_AXES,
  anatomySampleFromDiscoveryInstance,
  buildUrbanSiblingDnaReport,
  countUrbanSiblingDnaDiffs,
  diversityEscalationLevelFromAttempt,
  extractUrbanGeometryCue,
  mergeSiblingAvoidSamples,
  urbanSiblingDnaOverlapTooHigh,
  urbanSiblingSeparationEscalationSuffix,
  urbanSlotFaceDiversityBlock,
  type UrbanAnatomySample,
  type UrbanFaceDiversityDebug,
  type UrbanSiblingDnaReport,
} from "./urban-face-diversity";

export {
  URBAN_FRESH_RUN_RECIPE_VERSION,
  URBAN_HAIR_LANE_POOL,
  URBAN_SLOT_MOODS,
  buildUrbanFreshRunRecipe,
  formatUrbanFreshDiscoveryIdentityPrompt,
  hashStringToUint32,
  toUrbanFreshRunDebug,
  urbanFreshRunHairComboKey,
  type UrbanFreshRunDebug,
  type UrbanFreshRunRecipe,
  type UrbanHairLane,
  type UrbanHairLaneId,
  type UrbanSlotCastingCue,
} from "./urban-fresh-run-casting";

export {
  URBAN_FACIAL_EMPHASIS_POOL,
  URBAN_FACE_CLUSTER_DISTANCE,
  URBAN_FRESH_FACE_DNA_VERSION,
  URBAN_RECENT_PROJECTS_FOR_FACE_BIAS,
  analyzeRecentUrbanFaceClusters,
  buildUrbanFreshFaceDirection,
  buildUrbanFreshFaceDna,
  clusterUrbanFaceEmbeddings,
  filterDiscoveryOnlyFaceSamples,
  pickUrbanSlotFacialEmphases,
  type UrbanFaceEmbeddingSample,
  type UrbanFacialEmphasis,
  type UrbanFreshFaceClusterAnalysis,
  type UrbanFreshFaceDna,
} from "./urban-fresh-face-dna";

export { loadUrbanFreshFaceBiasSamples } from "./urban-fresh-face-bias-loader";

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
