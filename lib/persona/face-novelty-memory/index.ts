/**
 * Face Novelty Memory — public module index.
 *
 * Workspace-scoped, archetype-aware discovery identity lifecycle tracker.
 * Prevents shown / rejected / exhausted faces from reappearing in later runs.
 *
 * Exact/near-identical image reuse is blocked now.
 * Biologically similar newly generated faces require a real face-similarity
 * evaluator.  The FaceSimilarityEvaluator adapter is ready for that next step.
 */

export type {
  FaceNoveltyRecord,
  FaceNoveltyState,
  CandidateAssetReference,
  FaceSimilarityResult,
  FaceSimilarityEvaluator,
  ImageDuplicateResult,
  NoveltyEvaluation,
  DiscoveryHistory,
  NoveltyDebugData,
} from "./types";

export { FACE_NOVELTY_STATES, NOVELTY_REPLACEMENT_POLICY } from "./types";

export { buildIdentityFingerprint, buildVisualFingerprint } from "./identity-fingerprint";
export type { IdentityFingerprintInput } from "./identity-fingerprint";

export {
  detectImageDuplicate,
  PERCEPTUAL_HASH_NEAR_DUPLICATE_THRESHOLD,
} from "./image-duplicate-detection";

export {
  NullFaceSimilarityEvaluator,
  resolveFaceSimilarityEvaluator,
} from "./face-similarity-adapter";

export type { NoveltyRepository, NoveltyRecordFilter, HistoricalProtectionUpdate } from "./novelty-repository";
export { MemoryNoveltyRepository } from "./novelty-repository";
export { SupabaseNoveltyRepository } from "./supabase-novelty-repository";

export {
  isEmbeddingEligibleForComparison,
  isHistoricalBlockingProtectionStatus,
  normalizeHistoricalProtectionStatus,
  resolveStrongerProtectionStatus,
  HISTORICAL_FACE_PROTECTION_STATUSES,
  HISTORICAL_BLOCKING_PROTECTION_STATUSES,
} from "./embedding-comparison-eligibility";
export type {
  HistoricalFaceProtectionStatus,
  HistoricalBlockingProtectionStatus,
  HistoricalProtectionPromotionReason,
  NoveltyLiveEvidenceShape,
} from "./embedding-comparison-eligibility";

export { promoteToHistoricallyProtectedIdentity } from "./historical-protection-promotion";
export type {
  PromoteHistoricalProtectionInput,
  PromoteHistoricalProtectionResult,
} from "./historical-protection-promotion";

export { loadDiscoveryHistory, exhaustUnfinishedCandidates } from "./discovery-history";

export { evaluateDiscoveryNovelty } from "./novelty-policy";
export type { NoveltyPolicyInput } from "./novelty-policy";

export {
  registerGeneratedCandidate,
  markCandidateShown,
  markCandidateSaved,
  markCandidateShortlisted,
  markCandidateRejected,
  markCandidateApproved,
  checkAndRegisterCandidate,
  prepareDiscoveryRun,
  buildNoveltyDebugData,
  NOVELTY_REPLACEMENT_CONFIRMATION_MESSAGE,
  FACE_SIMILARITY_REPLACEMENT_CONFIRMATION_MESSAGE,
} from "./novelty-service";
export type { RegisterCandidateInput, CandidateNoveltyCheck, CheckCandidateOptions } from "./novelty-service";

// Phase 2.0B — local face embedding
export {
  extractFaceEmbedding,
  compareEmbeddings,
  LocalFaceEmbeddingEvaluator,
  resolveEvaluatorFailureMode,
  resetFaceApiModelLoadCacheForTests,
} from "./local-face-embedding-evaluator";
export type { FaceExtractionResult, StoredEmbeddingRef, EvaluatorFailureMode } from "./local-face-embedding-evaluator";

export {
  FACE_API_MODELS_RELATIVE_DIR,
  REQUIRED_FACE_API_MODEL_FILES,
  resolveFaceApiModelsDirectory,
  validateFaceApiModelFiles,
  assertFaceApiModelsPresent,
  assertRealFilesystemModelPath,
  listMissingFaceApiModelFiles,
} from "./model-assets";
export type { FaceApiModelValidation } from "./model-assets";

export {
  FACE_SIMILARITY_THRESHOLD_VERSION,
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
  FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD,
  FACE_SIMILARITY_COSINE_DUPLICATE_THRESHOLD,
  FACE_SIMILARITY_COSINE_WARNING_THRESHOLD,
  FACE_SIMILARITY_EMBEDDING_DIMENSION,
  FACE_SIMILARITY_EVALUATOR_VERSION,
  FACE_DETECTION_MIN_CONFIDENCE,
  DISCOVERY_HARD_DUPLICATE_THRESHOLD,
  DISCOVERY_WARNING_THRESHOLD,
  DISCOVERY_SIMILARITY_THRESHOLD_VERSION,
  classifyDiscoveryFaceDistance,
  euclideanDistance,
  euclideanToCosineSimilarity,
  getThresholdConfig,
} from "./similarity-threshold";
export type {
  ThresholdConfig,
  FaceDetectionStatus,
  DiscoveryNoveltyClassification,
} from "./similarity-threshold";

export type { FaceEmbeddingRecord, EmbeddingComparisonResult } from "./face-embedding-types";

export type { EmbeddingRepository, EmbeddingUpdate, LoadEmbeddingsOptions } from "./embedding-repository";
export { MemoryEmbeddingRepository } from "./embedding-repository";
export { SupabaseEmbeddingRepository } from "./supabase-embedding-repository";

export { runCalibration } from "./calibration";
export type { CalibrationPair, CalibrationReport } from "./calibration";

// Phase 2.0B.2 — controlled live novelty test mode
export {
  PERSONA_FACE_NOVELTY_DEBUG_ENV,
  isPersonaFaceNoveltyDebugEnabled,
  buildSafeFaceNoveltyLiveDebug,
  buildRunLiveDebug,
  calculateHistoricalEmbeddingCoverage,
  buildCopyDebugPayload,
  stripNoveltyDebugFromCandidateSettings,
  maybeAttachNoveltyDebugToSettings,
  assertSafeFaceNoveltyDebugDto,
} from "./live-debug";
export {
  assertNoSignedUrlLeakage,
  redactAssetPathForDebug,
} from "./safe-debug-redact";
export type {
  SafeFaceNoveltyLiveDebug,
  FaceNoveltyRunLiveDebug,
  FaceNoveltyPipelineStatus,
  HistoricalFaceProtectionSummary,
  FaceNoveltyCopyDebugPayload,
} from "./live-debug";

export {
  resolveNoveltyCandidateStatus,
  assertCandidateMayBecomeReady,
  isCandidateVisibleOnBoard,
  FAIL_CLOSED_BLOCKING_DETECTION_STATUSES,
  NON_VISIBLE_NOVELTY_STATUSES,
} from "./visibility-assertion";
export type {
  NoveltyVisibilityDecision,
  NoveltyCandidateStatusResult,
  ResolveNoveltyCandidateStatusInput,
} from "./visibility-assertion";

export { runFaceNoveltyPreflight, failingPreflightChecks } from "./preflight";
export type {
  FaceNoveltyPreflightCheck,
  FaceNoveltyPreflightReport,
  PreflightHistoryCounts,
} from "./preflight";

export { MemoryLiveDiagnosticStore } from "./diagnostic-store";
export type { LiveDiagnosticStore, LiveEvaluationEvidence } from "./diagnostic-store";
export { SupabaseLiveDiagnosticStore } from "./supabase-diagnostic-store";

export { runFaceNoveltyStartupValidation } from "./startup-validation";
export type { FaceNoveltyStartupReport } from "./startup-validation";

export {
  buildLiveFaceEvaluator,
  assertLiveFaceEvaluatorNotNull,
} from "./live-evaluator";
export type { LiveEvaluatorConfig } from "./live-evaluator";

export {
  partitionBoardCandidates,
  isNoveltyBoardVisible,
  isSelectedBrandFaceAwaitingConversion,
  isBoardImageStatus,
  toNoveltyFailureSlot,
  canSelectCandidateOnBoard,
} from "./board-visibility";
export type {
  NoveltyFailureSlotDto,
  NoveltyFailureSlotStatus,
  BoardCandidatePartition,
} from "./board-visibility";

export { retryFaceNoveltyEvaluation } from "./retry-evaluation";
export type {
  RetryFaceEvaluationResult,
  RetryFaceEvaluationDeps,
} from "./retry-evaluation";

// Phase 2.0C — historical face embedding backfill
export {
  HISTORICAL_BACKFILL_FORBIDDEN_STATES,
  HISTORICAL_BACKFILL_DEFAULT_BATCH_SIZE,
  BACKFILL_JOB_STATUSES,
  BACKFILL_RESULT_STATUSES,
  BACKFILL_FAILED_RESULT_STATUSES,
  BACKFILL_RETRYABLE_FAILURE_STATUSES,
} from "./historical-backfill-types";
export type {
  HistoricalBackfillForbiddenState,
  BackfillJobStatus,
  BackfillResultStatus,
  FaceEmbeddingBackfillJob,
  FaceEmbeddingBackfillResult,
  HistoricalBackfillEligibilityRecord,
  HistoricalBackfillPreflightSummary,
  SafeBackfillJobSummary,
  HistoricalBackfillBatchOutcome,
} from "./historical-backfill-types";

export {
  isForbiddenBackfillState,
  hasValidStoredEmbedding,
  isBackfillEligible,
  dedupeEligibleByAsset,
  buildHistoricalBackfillPreflightSummary,
  mapDetectionStatusToResultStatus,
} from "./historical-backfill-eligibility";

export { calculateExtendedHistoricalCoverage } from "./historical-backfill-coverage";
export type { ExtendedHistoricalFaceProtectionSummary } from "./historical-backfill-coverage";

export {
  PERSONA_FACE_HISTORICAL_COVERAGE_MIN_PERCENT_ENV,
  resolveMinimumProcessableCoveragePercent,
  evaluateDiscoveryCoverageGate,
} from "./discovery-coverage-gate";
export type {
  DiscoveryCoverageGateInput,
  DiscoveryCoverageGateResult,
} from "./discovery-coverage-gate";

export {
  MemoryHistoricalBackfillRepository,
  toSafeBackfillJobSummary,
  isTerminalJobStatus,
} from "./historical-backfill-repository";
export type {
  HistoricalBackfillRepository,
  CreateBackfillJobInput,
  UpsertBackfillResultInput,
} from "./historical-backfill-repository";

export { SupabaseHistoricalBackfillRepository } from "./supabase-historical-backfill-repository";

export {
  PERSONA_BRAND_ROLE_IDS,
  resolveHistoricalNoveltyArchetypeFilter,
  logHistoricalDiscoveryAudit,
} from "./historical-backfill-archetype-filter";
export type {
  NoveltyArchetypeFilterResolution,
  HistoricalDiscoveryAuditFunnel,
} from "./historical-backfill-archetype-filter";

export {
  loadHistoricalBackfillPreflight,
  loadHistoricalProtectionSnapshot,
  runHistoricalFaceEmbeddingBackfillBatch,
  runHistoricalFaceEmbeddingBackfillUntilDone,
} from "./historical-backfill-service";
export type {
  HistoricalBackfillDeps,
  StartHistoricalBackfillOptions,
} from "./historical-backfill-service";
