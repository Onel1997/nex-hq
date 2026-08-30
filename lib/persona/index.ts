export type * from "./domain/types";
export {
  BRAND_MODEL_CONTRACT_VERSION,
  BRAND_MODEL_CONSUMERS,
  brandModelContractSchema,
  brandModelHandoffSchema,
  brandModelSummarySchema,
  brandModelTraceSchema,
  expectedBrandModelIdentitySchema,
  traceBrandModelContract,
} from "./domain/brand-model-contract";
export type {
  BrandModelConsumer,
  BrandModelContract,
  BrandModelReferenceContract,
  BrandModelCanonicalReferenceContract,
  BrandModelHandoff,
  BrandModelSummary,
  BrandModelTrace,
  BrandModelAssetAccess,
  ExpectedBrandModelIdentity,
} from "./domain/brand-model-contract";
export {
  resolveBrandModelContract,
  buildBrandModelHandoff,
  listEligibleBrandModels,
} from "./integrations/brand-model-handoff";
export type { BrandModelAssetAccessResolver } from "./integrations/brand-model-handoff";
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
  resolvePersonaReadiness,
  resolvePersonaReadinessFromFacts,
  PERSONA_VISUAL_STATUSES,
} from "./domain/persona-readiness-resolver";
export type {
  PersonaCanonicalReadiness,
  PersonaVisualStatus,
} from "./domain/persona-readiness-resolver";

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
  setFakeBatchDelayMsForTests,
  setFakeBatchErrorForTests,
  getLastFakeBatchAbortSignalForTests,
  resetFakeBatchTestHooks,
} from "./creation/provider/fake-candidate-generator";

export {
  setNoveltyReplacementStageTimeoutsForTests,
  clearNoveltyReplacementLocksForTests,
  withNoveltyReplacementStageTimeout,
  executeProviderWithDeadline,
  finalizeNoveltyReplacementJob,
  createNoveltyReplacementPollController,
  PROVIDER_GENERATION_TIMEOUT_CODE,
  ASSET_UPLOAD_TIMEOUT_CODE,
  NOVELTY_EVALUATION_TIMEOUT_CODE,
  RESULT_PERSISTENCE_TIMEOUT_CODE,
  PROVIDER_GENERATION_TIMEOUT_MESSAGE,
  PROVIDER_GENERATION_TIMEOUT_MS,
  NoveltyReplacementStageTimeoutError,
  ProviderGenerationTimeoutError,
  toNoveltyReplacementJobStatusDto,
  isProviderGenerationOverdue,
} from "./creation/novelty-replacement-execution";

export {
  NOVELTY_REPLACEMENT_POLL_INTERVAL_MS,
  NOVELTY_REPLACEMENT_POLL_TIMEOUT_MS,
  NOVELTY_REPLACEMENT_TIMEOUT_MESSAGE,
  NOVELTY_REPLACEMENT_TERMINAL_STATUSES,
  REPLACEMENT_PERSIST_FAILED_USER_MESSAGE,
  isTerminalNoveltyReplacementStatus,
  stageLabelForCheckpoint,
  evaluateReplacementJobStaleness,
  hasTerminalReplacementResult,
  readActiveNoveltyReplacements,
  resolveSlotReplacementStates,
} from "./creation/novelty-replacement-result";

export {
  SUPERSEDED_CANDIDATE_NUMBER_BASE,
  supersededCandidateNumber,
  resolveBoardSlotNumber,
  boardSlotLabel,
  isCandidateNumberUniqueViolation,
} from "./creation/novelty-replacement";

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
  resolveBrandFaceUiLifecycle,
  resolveCreationWorkflowStep,
  BRAND_FACE_UI_LIFECYCLE_LABELS,
} from "./creation/creation-workflow";
export type {
  BrandFaceUiLifecycle,
  CreationWorkflowAction,
  CreationWorkflowStep,
  PaidGenerationSafetyContext,
  PreparePaidConfirmationGateReasons,
} from "./creation/creation-workflow";
export {
  ensureMasterIdentityReferenceFromSelectedCandidate,
  findMasterIdentityReference,
  getMasterIdentityReferenceForPersona,
  isMasterIdentityReference,
  parseMasterIdentityNotes,
  buildMasterIdentityNotes,
  MASTER_IDENTITY_REFERENCE_TYPE,
  MASTER_IDENTITY_SOURCE,
} from "./creation/master-identity-reference";
export type {
  EnsureMasterIdentityResult,
  MasterIdentityReferenceMeta,
} from "./creation/master-identity-reference";
export {
  DISCOVERY_SAFE_ERROR_CODES,
  isInitialDiscoveryJob,
  listInitialDiscoveryJobs,
  logDiscoveryCheckpoint,
  resolveActiveInitialDiscoveryJob,
  resolveBoardGenerationRunId,
  resolveDiscoveryProjectState,
  resolveExecutedDiscoveryRunId,
  shouldOpenCandidateBoardForDiscovery,
} from "./creation/discovery-lifecycle";
export type {
  DiscoveryLifecycleSnapshot,
  DiscoveryProjectState,
  DiscoverySafeErrorCode,
  DiscoveryWorkflowCheckpoint,
} from "./creation/discovery-lifecycle";
export {
  canSubmitDiscoveryConfirmation,
  resolveActiveDiscoveryConfirmation,
} from "./creation/active-discovery-confirmation";
export type {
  ActiveConfirmationStatus,
  ActiveDiscoveryConfirmation,
} from "./creation/active-discovery-confirmation";
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
  REFERENCE_PACKAGE_SLOTS,
  REFERENCE_PACKAGE_SLOT_LABELS,
  STAGE_B_REFERENCE_PACKAGE_CAPABILITY,
  estimateReferencePackageCost,
  prepareReferencePackageConfirmation,
  confirmAndGenerateReferencePackage,
  getReferencePackageStatus,
  prepareReferencePackageAngleRegeneration,
  confirmAndRegenerateReferencePackageAngle,
  reassignReferencePackageAngle,
  TARGET_SLOT_ACCEPTED_MESSAGE,
  evaluateIdentityConsistency,
  IDENTITY_CONSISTENCY_POLICY_VERSION,
  IDENTITY_CONSISTENCY_MATCH_EUCLIDEAN,
  MemoryReferencePackageRepository,
  setReferencePackageRepositoryForTests,
  buildReferencePackageAnglePrompt,
  CANONICAL_CAMERA_DIRECTIONS,
  CAMERA_DIRECTION_POLICY_VERSION,
  validateAngleDirectionFromPrompt,
  validateAngleDirectionFromOrientation,
  isAngleDirectionUsable,
  isCurrentlyAcceptedUsable,
  resolveReferencePackageSlotCoverage,
  getAttemptEffectiveSlot,
  parseReferencePackageAssetNotes,
  resolveProviderDirectionPlan,
  invertProviderDirection,
  DIRECTION_GENERATION_UNRELIABLE_MESSAGE,
  INVERTED_FALLBACK_REASON,
  PROFILE_IDENTITY_MODE,
  PROFILE_PROMPT_VERSION,
  isProfileIdentitySlot,
  IDENTITY_CONSISTENCY_WARNING_EUCLIDEAN,
  approveHumanIdentityOverride,
  canProposeHumanIdentityOverride,
  isMismatchOverrideUsable,
  IDENTITY_OVERRIDE_VERSION,
  resolveIdentitySourceConfidence,
  createMirroredReferenceVersion,
  canProposeMirrorSalvage,
  MIRROR_SALVAGE_PROVIDER,
  horizontalMirrorImageBytes,
  assertHorizontallyMirroredPngPixels,
  prepareAcceptedAngleReplacement,
  confirmAcceptedAngleReplacement,
  approveAndReplaceAcceptedReference,
  rejectAcceptedReplacement,
  canProposeAcceptedReplacement,
  resolveIncumbentAcceptedForSlot,
  resolvePendingReplacementForSlot,
  reconcileReferencePackageState,
  deriveReferenceUsability,
  isFinalizedApprovedReplacement,
  assertReferenceAssetDeletable,
  REFERENCE_PACKAGE_RECONCILER_VERSION,
} from "./creation/reference-package";
export type {
  ReferencePackageSlot,
  ReferencePackageStatusView,
  ReferencePackageCostEstimate,
  ProviderDirectionPlan,
  ProviderDirectionStrategy,
  CreateMirroredVersionResult,
  ReferencePackageSlotState,
  ReconciledReferencePackageState,
} from "./creation/reference-package";
export {
  IDENTITY_LOCK_POLICY_VERSION,
  computeReferencePackageFingerprint,
  validateIdentityLockEligibility,
  validateIdentityPackageEvidence,
  getIdentityLockEligibility,
  lockBrandIdentity,
  resolveLockedBrandIdentity,
  getIdentityLockSnapshot,
  isPersonaIdentityLocked,
  assertLockedIdentityAssetMutable,
  setIdentityLockRepositoryForTests,
  MemoryIdentityLockRepository,
  coerceUuidOrNull,
  IdentityLockError,
  diagnoseLegacyIdentityLockReconciliation,
  getLegacyIdentityReconciliationView,
  readLegacyReconciliationReviewContext,
  submitLegacyIdentityReconciliation,
  LEGACY_RECONCILIATION_CONTEXT_KEY,
  LEGACY_RECONCILIATION_REASON,
  LEGACY_RECONCILIATION_REVIEW_KIND,
} from "./creation/identity-lock";
export {
  getReferenceRightsView,
  submitReferenceRightsDecision,
  setReferenceRightsEvidenceRepositoryForTests,
  MemoryReferenceRightsEvidenceRepository,
  REFERENCE_RIGHTS_CONFIRMATION_SCOPE,
  REFERENCE_RIGHTS_EVIDENCE_VERSION,
} from "./creation/reference-rights";
export type {
  ReferenceRightsConfirmations,
  ReferenceRightsEvidence,
  ReferenceRightsView,
  SubmitReferenceRightsDecisionInput,
} from "./creation/reference-rights";
export type {
  IdentityLockEligibilityView,
  LockedBrandIdentity,
  PersonaIdentityLockSnapshot,
  HistoricalProtectionPromotionStatus,
  IdentityLockStage,
  LegacyIdentityLockReconciliationDiagnostic,
  LegacyIdentityLockReconciliationStatus,
  LegacyIdentityReconciliationView,
  LegacyReconciliationConfirmations,
  LegacyReconciliationDecision,
  LegacyReconciliationReviewContext,
  SubmitLegacyIdentityReconciliationInput,
} from "./creation/identity-lock";
export {
  VIDEO_IDENTITY_READINESS_POLICY,
  BRAND_CAST_REQUIRES_VIDEO_USE_APPROVED,
  evaluateImageUseEligibility,
  evaluateVideoUseEligibility,
  evaluateBrandCastEligibility,
  evaluateBrandModelEligibility,
  isImageStudioConsumerEligible,
  evaluateVideoStudioConsumerEligibility,
  getBrandModelApprovalsView,
  approveImageUse,
  approveVideoUse,
  approveBrandCast,
  listImageStudioEligibleBrandModels,
  listVideoStudioEligibleBrandModels,
  listOfficialBrandCastMembers,
  UseApprovalError,
} from "./creation/use-approvals";
export {
  getVideoIdentityReadinessView,
  submitVideoIdentityReview,
  isCurrentVideoIdentityReady,
  isCurrentVideoUseApproved,
  VIDEO_IDENTITY_REVIEW_VERSION,
  VIDEO_IDENTITY_REVIEW_KEYS,
} from "./creation/video-readiness";
export type {
  VideoIdentityReviewChecklist,
  VideoIdentityReviewEvidence,
  VideoIdentityReadinessView,
  SubmitVideoIdentityReviewInput,
} from "./creation/video-readiness";
export type {
  UseApprovalGate,
  UseApprovalEligibility,
  BrandModelApprovalsView,
  UseApprovalResult,
  BrandCastMemberCard,
  ImageStudioBrandModelEligibility,
  VideoStudioBrandModelEligibility,
  BrandModelEligibility,
} from "./creation/use-approvals";
export { FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD } from "./face-novelty-memory/similarity-threshold";
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
  authorizePersonaActor,
  parsePersonaAuthorizedUserIds,
  resolvePersonaAuthorizationContext,
  PERSONA_LOCAL_DEV_ACTOR_ID,
} from "./security/authorization";
export type {
  PersonaActorAuthorization,
  PersonaAuthorizationContext,
  PersonaAuthorizationDependencies,
  PersonaAuthorizationMode,
} from "./security/authorization";
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
  listImageStudioBrandModels,
  type ImageStudioPersonaHandoff,
} from "./future/image-studio-hooks";

export {
  buildVideoStudioPersonaHandoff,
  listVideoStudioBrandModels,
  type VideoStudioPersonaHandoff,
} from "./future/video-studio-hooks";

/** @deprecated Demo seed is tests/dev only — never used in production repository. */
export { PERSONA_DEMO_SEED, PERSONA_TEST_WORKSPACE_ID } from "./demo-seed";
