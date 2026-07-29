/**
 * Face Novelty Memory — core types.
 *
 * Every generated discovery identity has one lifecycle state.
 * Exhausted identities are permanently excluded from new discovery runs.
 *
 * IMPORTANT: this module tracks image-level duplicate detection (exact
 * checksums, perceptual hashes, storage-object reuse).  Detecting biologically
 * similar but *newly generated* faces requires a real face-similarity
 * evaluator.  The FaceSimilarityEvaluator adapter is wired below but will
 * return `not_available` until a real provider is connected.
 */

export const FACE_NOVELTY_STATES = [
  "generated",
  "shown",
  "shortlisted",
  "saved",
  "rejected",
  "exhausted",
  "approved",
] as const;

export type FaceNoveltyState = (typeof FACE_NOVELTY_STATES)[number];

/**
 * Persistent record of one discovery candidate's lifecycle state.
 * Workspace-scoped and archetype-aware.
 */
export interface FaceNoveltyRecord {
  id: string;
  workspaceId: string;
  archetypeId: string;
  creationProjectId: string;
  candidateId: string;
  assetId: string;
  state: FaceNoveltyState;
  /** Pre-generation identity fingerprint built from biological + styling keys. */
  identityFingerprint: string;
  /** Post-generation visual fingerprint (storage-path + checksum composite). */
  visualFingerprint?: string;
  /** Perceptual hash of the generated image (e.g. pHash hex string). */
  perceptualHash?: string;
  /** Storage object key — used to detect same-object-different-URL reuse. */
  storageObjectKey?: string;
  /** SHA-256 hex of the raw image bytes. */
  imageChecksum?: string;
  embeddingVersion?: string;
  sourceProvider: string;
  sourceModel: string;
  createdAt: string;
  firstShownAt?: string;
  exhaustedAt?: string;
  savedAt?: string;
  approvedAt?: string;
  shortlistedAt?: string;
  rejectedAt?: string;
}

/** Lightweight reference passed to similarity evaluators. */
export interface CandidateAssetReference {
  candidateId: string;
  assetId: string;
  storageObjectKey?: string;
  imageChecksum?: string;
  perceptualHash?: string;
  signedUrl?: string;
}

/** Result from the face-similarity evaluator. */
export interface FaceSimilarityResult {
  /** Whether a real evaluation was performed or the adapter was not available. */
  status: "performed" | "not_available";
  closestMatchAssetId?: string;
  similarity?: number;
  threshold?: number;
  isDuplicate?: boolean;
  method?: string;
}

/** Adapter interface for future face embedding / similarity providers. */
export interface FaceSimilarityEvaluator {
  evaluate(input: {
    candidateAsset: CandidateAssetReference;
    comparisonAssets: CandidateAssetReference[];
  }): Promise<FaceSimilarityResult>;
}

/** Image-level duplicate detection result — does NOT claim biological similarity. */
export interface ImageDuplicateResult {
  isDuplicate: boolean;
  reason?:
    | "exact_checksum"
    | "same_storage_object"
    | "perceptual_near_duplicate"
    | "identical_bytes";
  matchedAssetId?: string;
  matchedStorageKey?: string;
  /** Hamming distance between perceptual hashes (lower = more similar). */
  perceptualDistance?: number;
  threshold?: number;
}

/** Full novelty evaluation for one candidate before display. */
export interface NoveltyEvaluation {
  candidateId: string;
  assetId: string;
  identityFingerprint: string;
  /** Hard-block: must not be shown. */
  hardReject: boolean;
  hardRejectReason?: string;
  /** Soft warning: real evaluator unavailable; metadata suggests risk. */
  softWarning: boolean;
  softWarningReason?: string;
  imageDuplicate?: ImageDuplicateResult;
  faceSimilarity?: FaceSimilarityResult;
  closestPriorCandidateId?: string;
  evaluatorMethod?: string;
  evaluatorVersion?: string;
}

/** What the discovery history service exposes per workspace+archetype. */
export interface DiscoveryHistory {
  workspaceId: string;
  archetypeId: string;
  totalShown: number;
  totalExhausted: number;
  totalSaved: number;
  totalApproved: number;
  totalRejected: number;
  forbiddenIdentityFingerprints: Set<string>;
  forbiddenImageChecksums: Set<string>;
  forbiddenPerceptualHashes: Set<string>;
  forbiddenStorageKeys: Set<string>;
  priorAssetReferences: CandidateAssetReference[];
}

/** Replacement cost policy for failed novelty slots. */
export const NOVELTY_REPLACEMENT_POLICY = {
  maxReplacementAttemptsPerSlot: 2,
  silentReplacementAllowed: false,
} as const;

/** Debug data emitted in development mode — never includes secrets or prompts. */
export interface NoveltyDebugData {
  workspaceId: string;
  archetypeId: string;
  noveltyMemoryCount: number;
  forbiddenIdentityFingerprintCount: number;
  forbiddenImageHashCount: number;
  candidateNoveltyResults: Array<{
    candidateId: string;
    hardReject: boolean;
    hardRejectReason?: string;
    softWarning: boolean;
    closestPriorCandidateId?: string;
    similarityStatus?: string;
    duplicateReason?: string;
    evaluatorMethod?: string;
    evaluatorVersion?: string;
  }>;
}
