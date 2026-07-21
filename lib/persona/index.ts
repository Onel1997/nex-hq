export type * from "./domain/types";
export {
  PERSONA_STATUSES,
  LOCATION_SETTINGS,
  REFERENCE_ASSET_TYPES,
  REFERENCE_STATUSES,
  VIEW_ANGLES,
  FRAMINGS,
  SOURCE_TYPES,
  PERSONA_READINESS_STATES,
} from "./domain/types";

export type * from "./domain/creation-types";
export {
  CREATION_PROJECT_STATUSES,
  GENERATION_STAGES,
  PROVIDER_MODES,
  BRAND_ROLES,
  INTENDED_USAGES,
  CANDIDATE_STATUSES,
  CANDIDATE_ASSET_TYPES,
  CANDIDATE_ASSET_STATUSES,
  IDENTITY_LOCK_STATUSES,
  IDENTITY_REVIEW_CHECK_KEYS,
  QUALITY_MODES,
  GENERATION_JOB_STATUSES,
  STAGE_A_ASSET_TYPES,
  STAGE_B_ASSET_TYPES,
  DEFAULT_CANDIDATE_COUNT,
  MAX_CANDIDATE_BATCH_SIZE,
  MAX_DAILY_GENERATION_EUR,
  TARGET_PERSONA_BUDGET_EUR_MIN,
  TARGET_PERSONA_BUDGET_EUR_MAX,
} from "./domain/creation-types";

export {
  PersonaDomainError,
  PersonaStoreError,
  PersonaWorkflowError,
} from "./domain/errors";

export {
  canApprovePersona,
  computePersonaReadiness,
  computeReferenceCompleteness,
  listApprovalPrerequisiteGaps,
  isProfileComplete,
} from "./domain/readiness";

export {
  PERSONA_STATUS_TRANSITIONS,
  applyPersonaStatus,
  approvePersona,
  archivePersona,
  canTransitionPersonaStatus,
  isApprovedForProduction,
  reopenPersonaAsDraft,
  submitPersonaForReview,
} from "./approval/workflow";

export {
  createProductionPersonaRepository,
  getPersonaRepository,
  getPersonaRepositoryKind,
  setPersonaRepositoryForTests,
} from "./repositories/factory";
export { MemoryPersonaRepository } from "./repositories/memory-persona-repository";
export { SupabasePersonaRepository } from "./repositories/supabase-persona-repository";
export type { PersonaRepository } from "./repositories/persona-repository";

export {
  CANDIDATE_VARIATION_PROFILES,
  resolveCandidateVariation,
  buildCandidatePrompt,
  composeProviderPrompt,
  assessCandidateQuality,
  qualityFieldsForCandidate,
  readCandidateOverallScore,
  readCandidateCastingScores,
  buildCastingRecommendation,
  ACTIVE_CASTING_POOL,
  FUTURE_CASTING_POOL_PRESETS,
  rankCandidatesByCommercialScore,
  selectTopCandidatesForDisplay,
  resolveCastingGenerateCount,
  assertCandidateIdentityDiversity,
  auditCandidateIdentityDiversity,
  emptyVisualEvaluation,
  FakePersonaVisualEvaluator,
  isPersonaVisualEvaluationEnabled,
  buildDiversityReport,
  appendCandidateNoteRevision,
  readNotesHistory,
} from "./creation/candidate-intelligence";
export type {
  CandidateVariationProfile,
  BuiltCandidatePrompt,
  PromptBlocks,
  CandidateQualityAssessment,
  CandidateQualityDimensions,
  CastingChannel,
  CastingRecommendation,
  CastingPoolConfig,
  CastingPoolMode,
  RankableCandidate,
  RankedCastingCandidate,
  IdentityDiversityAudit,
  IdentityDiversityViolation,
  VisualCastingEvaluation,
  PersonaVisualEvaluator,
  CandidateDiversityReport,
  CandidateNoteRevision,
} from "./creation/candidate-intelligence";

export {
  STAGE_A1_DISCOVERY_ASSET_TYPES,
  STAGE_A2_VALIDATION_ASSET_TYPES,
  DEFAULT_A2_MAX_SELECTED,
  missingValidationAssetTypes,
  clampA2Selection,
  assetTypesForCastingPhase,
  castingPhaseLabel,
  type CastingFunnelPhase,
} from "./creation/casting-funnel";

export {
  resolvePersonaImageConcurrency,
  mapPool,
  withTransientRetry,
} from "./creation/provider/concurrency";

export {
  estimateSecondsFromRollingHistory,
  recordCompletedImageDurationMs,
  resetRollingImageDurationsForTests,
} from "./creation/provider/generation-metrics";

export {
  getFakeBatchInvocationCount,
  resetFakeBatchInvocationCount,
} from "./creation/provider/fake-candidate-generator";

export {
  imagesPerCandidateForStage,
  assetTypesForStage,
  buildCostEstimate,
} from "./creation/provider/cost";

export {
  createProductionCreationRepository,
  getCreationRepository,
  getCreationRepositoryKind,
  setCreationRepositoryForTests,
} from "./creation/creation-factory";
export { MemoryCreationRepository } from "./creation/memory-creation-repository";
export { SupabaseCreationRepository } from "./creation/supabase-creation-repository";
export type { PersonaCreationRepository } from "./creation/creation-repository";
export * from "./creation/creation-service";
export {
  assertCreationProjectAction,
  canPrepareManualSlots,
  canPreparePaidConfirmation,
  canStartPaidGeneration,
  evaluatePreparePaidConfirmationGate,
  resolveCreationWorkflowStep,
} from "./creation/creation-workflow";
export type {
  CreationWorkflowAction,
  CreationWorkflowStep,
  PaidGenerationSafetyContext,
  PreparePaidConfirmationGateReasons,
} from "./creation/creation-workflow";
export { PERSONA_CREATION_PRESETS, getCreationPreset } from "./creation/presets";
export {
  getPersonaCandidateGenerator,
  getProviderSetupState,
} from "./creation/provider/registry";
export {
  buildPersonaCandidateStoragePath,
  defaultCandidateRetentionUntil,
} from "./creation/candidate-storage";
export {
  QUALITY_MODE_PROFILES,
  DEFAULT_QUALITY_MODE,
  getQualityModeProfile,
  OPENAI_PROVIDER_CAPABILITY,
} from "./creation/quality-modes";
export {
  getGenerationJobRepository,
  setGenerationJobRepositoryForTests,
} from "./creation/generation-job-factory";
export { resetMemoryGenerationJobStoreForTests, MemoryGenerationJobRepository } from "./creation/memory-generation-job-repository";
export {
  buildEstimateHash,
  createConfirmationToken,
  estimateFingerprintFromCost,
} from "./creation/paid-confirmation";
export {
  assertLivePaidProviderInvocationAllowed,
  assertPaidGenerationEnabled,
  getPaidGenerationSafetyStatus,
  isConfirmationCancelledOrExpired,
  isDebugOrUnattestedGenerationJob,
  isDebugOrTestHttpRequest,
  isPaidGenerationEnabled,
  shouldUseFakePersonaProvider,
  UI_CHECKBOX_ATTESTATION,
  ALLOW_LIVE_PERSONA_GENERATION_TESTS_ENV,
  EXPECTED_SUPABASE_PROJECT_REF_ENV,
  LIVE_PERSONA_GENERATION_MAX_EUR_ENV,
  PERSONA_PAID_GENERATION_ENABLED_ENV,
  PERSONA_USE_FAKE_PROVIDER_ENV,
} from "./creation/paid-generation-guard";
export {
  PERSONA_INCIDENT_PROJECT_ID,
  INCIDENT_CLASSIFICATION,
} from "./creation/incident-constants";

export * from "./services/persona-service";
export { resolvePersonaWorkspaceScope } from "./services/workspace-scope";
export {
  checkPersonaStudioHealth,
  PERSONA_SCHEMA_VERSION,
  type PersonaHealthReport,
  type PersonaHealthStatus,
} from "./services/health";

export {
  PERSONA_REFERENCES_BUCKET,
  PERSONA_REFERENCE_ALLOWED_MIME,
  PERSONA_REFERENCE_MAX_BYTES,
  assertAllowedPersonaReferenceUpload,
  buildPersonaReferenceStoragePath,
  checksumBytes,
  createPersonaReferenceSignedUrl,
  ensurePersonaReferencesBucket,
  extractImageDimensions,
  isPublicPermanentPersonaUrl,
} from "./storage/reference-storage";

export {
  buildImageStudioPersonaHandoff,
  listImageStudioIntegrationHooks,
  type ImageStudioPersonaHandoff,
} from "./future/image-studio-hooks";

export {
  buildVideoStudioPersonaHandoff,
  listVideoStudioIntegrationHooks,
  type VideoStudioPersonaHandoff,
} from "./future/video-studio-hooks";

/** @deprecated Demo seed is tests/dev only — never used in production repository. */
export { PERSONA_DEMO_SEED, PERSONA_TEST_WORKSPACE_ID } from "./demo-seed";
