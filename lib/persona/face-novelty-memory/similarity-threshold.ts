/**
 * Face-similarity threshold configuration — versioned.
 *
 * Model: @vladmandic/face-api faceRecognitionNet (ResNet-34, 128D descriptor)
 * Metric: Euclidean distance between L2-normalised 128-dim embeddings,
 *         converted to cosine similarity by: similarity = 1 - (dist / 2)
 *
 * DOCUMENTED DEFAULTS based on vladmandic/face-api and standard ResNet-34
 * face-recognition literature:
 *
 *   Euclidean duplicate threshold   ≤ 0.45  (same identity, strict)
 *   Euclidean warning threshold     ≤ 0.55  (possibly same identity)
 *
 * Equivalent cosine similarity:
 *   duplicate threshold  ≥ 0.775   (1 - 0.45/2)
 *   warning threshold    ≥ 0.725   (1 - 0.55/2)
 *
 * FALSE-POSITIVE / FALSE-NEGATIVE RISKS:
 *   - Threshold too tight (low dist) → false positives: different people blocked.
 *   - Threshold too loose (high dist) → false negatives: near-copies pass through.
 *   - Lighting extremes, partial occlusion, large pose differences can push
 *     genuine same-identity distance above 0.45.
 *   - Visually similar but different people (especially twins or similar
 *     ethnicities) may fall below the threshold.
 *
 * Calibrate using the calibration utility in calibration.ts with real
 * production image pairs before tightening the threshold.
 *
 * The threshold version must be incremented when any value changes so that
 * stored embeddings can be re-evaluated against the new thresholds.
 */

export const FACE_SIMILARITY_THRESHOLD_VERSION = "v1.0.0" as const;

/** Euclidean distance threshold below which two faces are treated as duplicates. */
export const FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD = 0.45;

/** Euclidean distance threshold for soft warning (possible same identity). */
export const FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD = 0.55;

/**
 * Phase 2.5B.4 — Discovery-only hard duplicate threshold.
 * Lower than identity-lock (0.45): only near-identical faces hard-block casting.
 * Identity Lock / Reference Package continue using FACE_SIMILARITY_EUCLIDEAN_*.
 */
export const DISCOVERY_HARD_DUPLICATE_THRESHOLD = 0.30;

/**
 * Phase 2.5B.4 — Discovery soft-warning band (still PASS / ready / selectable).
 * Distances in (HARD, WARNING] show "Similarity warning" without blocking.
 */
export const DISCOVERY_WARNING_THRESHOLD = 0.45;

export const DISCOVERY_SIMILARITY_THRESHOLD_VERSION = "discovery-v2.5b4" as const;

export type DiscoveryNoveltyClassification =
  | "PASS"
  | "WARNING"
  | "HARD_DUPLICATE";

/**
 * Classify a discovery face distance using discovery-only thresholds.
 * Identity-lock thresholds are intentionally not used here.
 */
export function classifyDiscoveryFaceDistance(
  distance: number | null | undefined,
): DiscoveryNoveltyClassification {
  if (distance == null || !Number.isFinite(distance)) return "PASS";
  if (distance <= DISCOVERY_HARD_DUPLICATE_THRESHOLD) return "HARD_DUPLICATE";
  if (distance <= DISCOVERY_WARNING_THRESHOLD) return "WARNING";
  return "PASS";
}

/** Converted to cosine similarity (1 - dist/2) for external reporting. */
export const FACE_SIMILARITY_COSINE_DUPLICATE_THRESHOLD = 1 - FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD / 2;
export const FACE_SIMILARITY_COSINE_WARNING_THRESHOLD = 1 - FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD / 2;

export const FACE_SIMILARITY_MODEL = "faceRecognitionNet" as const;
export const FACE_SIMILARITY_EMBEDDING_DIMENSION = 128 as const;
export const FACE_SIMILARITY_EVALUATOR_VERSION = "local-vladmandic-1.7.x-v1" as const;

/** Minimum face detection confidence to accept a detection (0–1). */
export const FACE_DETECTION_MIN_CONFIDENCE = 0.6;

/** Minimum face box size as a fraction of image width before rejecting. */
export const FACE_DETECTION_MIN_BOX_FRACTION = 0.05;

export type FaceDetectionStatus =
  | "performed"
  | "no_face"
  | "multiple_faces"
  | "low_confidence"
  | "too_small"
  | "unavailable"
  | "error";

export interface ThresholdConfig {
  version: string;
  euclideanDuplicateThreshold: number;
  euclideanWarningThreshold: number;
  cosineDuplicateThreshold: number;
  cosineWarningThreshold: number;
  model: string;
  embeddingDimension: number;
  evaluatorVersion: string;
  minDetectionConfidence: number;
}

export function getThresholdConfig(): ThresholdConfig {
  return {
    version: FACE_SIMILARITY_THRESHOLD_VERSION,
    euclideanDuplicateThreshold: FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
    euclideanWarningThreshold: FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD,
    cosineDuplicateThreshold: FACE_SIMILARITY_COSINE_DUPLICATE_THRESHOLD,
    cosineWarningThreshold: FACE_SIMILARITY_COSINE_WARNING_THRESHOLD,
    model: FACE_SIMILARITY_MODEL,
    embeddingDimension: FACE_SIMILARITY_EMBEDDING_DIMENSION,
    evaluatorVersion: FACE_SIMILARITY_EVALUATOR_VERSION,
    minDetectionConfidence: FACE_DETECTION_MIN_CONFIDENCE,
  };
}

/** Compute Euclidean distance between two equal-length float arrays. */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/** Convert Euclidean distance to cosine similarity (valid for L2-normalised embeddings). */
export function euclideanToCosineSimilarity(distance: number): number {
  return 1 - distance / 2;
}
