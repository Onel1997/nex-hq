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

export type { NoveltyRepository, NoveltyRecordFilter } from "./novelty-repository";
export { MemoryNoveltyRepository } from "./novelty-repository";
export { SupabaseNoveltyRepository } from "./supabase-novelty-repository";

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
} from "./local-face-embedding-evaluator";
export type { FaceExtractionResult, StoredEmbeddingRef, EvaluatorFailureMode } from "./local-face-embedding-evaluator";

export {
  FACE_SIMILARITY_THRESHOLD_VERSION,
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
  FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD,
  FACE_SIMILARITY_COSINE_DUPLICATE_THRESHOLD,
  FACE_SIMILARITY_COSINE_WARNING_THRESHOLD,
  FACE_SIMILARITY_EMBEDDING_DIMENSION,
  FACE_SIMILARITY_EVALUATOR_VERSION,
  FACE_DETECTION_MIN_CONFIDENCE,
  euclideanDistance,
  euclideanToCosineSimilarity,
  getThresholdConfig,
} from "./similarity-threshold";
export type { ThresholdConfig, FaceDetectionStatus } from "./similarity-threshold";

export type { FaceEmbeddingRecord, EmbeddingComparisonResult } from "./face-embedding-types";

export type { EmbeddingRepository, EmbeddingUpdate } from "./embedding-repository";
export { MemoryEmbeddingRepository } from "./embedding-repository";
export { SupabaseEmbeddingRepository } from "./supabase-embedding-repository";

export { runCalibration } from "./calibration";
export type { CalibrationPair, CalibrationReport } from "./calibration";
