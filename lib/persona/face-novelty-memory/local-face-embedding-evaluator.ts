/**
 * LocalFaceEmbeddingEvaluator — server-only face similarity evaluator.
 *
 * Uses @vladmandic/face-api (ResNet-34, 128D descriptor) running via
 * @tensorflow/tfjs-node.  Models are loaded from the package's bundled
 * weights — no external downloads, no paid provider calls.
 *
 * SERVER-SIDE ONLY.  Never import this module in client bundles.
 * Add 'use server' or load it exclusively from API routes / server actions.
 *
 * Security:
 *   - Image bytes are loaded transiently, never logged or persisted.
 *   - Embedding vectors are returned to the caller for persistence —
 *     never printed in debug output.
 *   - No signed URLs are forwarded to any third party.
 *   - No biometric data is sent to any external service.
 *
 * DISCLAIMER:
 *   This evaluator reduces repeated and near-duplicate faces.
 *   It does not guarantee perfect identity recognition.
 *   Thresholds can cause false positives (different people blocked) or
 *   false negatives (near-copies passing through).
 *   See similarity-threshold.ts for documented calibration guidance.
 */

import * as path from "path";
import type { CandidateAssetReference, FaceSimilarityEvaluator, FaceSimilarityResult } from "./types";
import type { FaceEmbeddingRecord, EmbeddingComparisonResult } from "./face-embedding-types";
import type { FaceDetectionStatus } from "./similarity-threshold";
import {
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
  FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD,
  FACE_SIMILARITY_EVALUATOR_VERSION,
  FACE_SIMILARITY_THRESHOLD_VERSION,
  FACE_DETECTION_MIN_CONFIDENCE,
  FACE_DETECTION_MIN_BOX_FRACTION,
  FACE_SIMILARITY_EMBEDDING_DIMENSION,
  euclideanDistance,
  euclideanToCosineSimilarity,
} from "./similarity-threshold";

/** Models path — resolved lazily to avoid webpack build-time require.resolve issues. */
function getModelsPath(): string {
  // In webpack bundled environments require.resolve returns a numeric module ID.
  // Use a fallback that works in both contexts.
  try {
    const packageJsonPath = require.resolve("@vladmandic/face-api/package.json");
    if (typeof packageJsonPath !== "string") throw new Error("non-string");
    return path.join(path.dirname(packageJsonPath), "model");
  } catch {
    // Fallback: resolve relative to node_modules conventionally.
    return path.join(process.cwd(), "node_modules/@vladmandic/face-api/model");
  }
}

let _faceapiModule: typeof import("@vladmandic/face-api") | null = null;
let _modelsLoaded = false;
let _loadPromise: Promise<void> | null = null;

/** Load models once and cache. */
async function ensureModelsLoaded(): Promise<typeof import("@vladmandic/face-api")> {
  if (_faceapiModule && _modelsLoaded) return _faceapiModule;

  if (_loadPromise) {
    await _loadPromise;
    return _faceapiModule!;
  }

  _loadPromise = (async () => {
    const modelsPath = getModelsPath();
    // Dynamic import so this module only loads in server contexts.
    await import("@tensorflow/tfjs-node");
    const faceapi = await import("@vladmandic/face-api");
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath);
    _faceapiModule = faceapi;
    _modelsLoaded = true;
  })();

  await _loadPromise;
  return _faceapiModule!;
}

export interface FaceExtractionResult {
  status: FaceDetectionStatus;
  /** 128-dim embedding — do not log or expose in debug output. */
  embedding?: number[];
  detectionConfidence: number;
  faceCount: number;
  embeddingVersion: string;
  embeddingModel: string;
  embeddingDimension: number;
  similarityThresholdVersion: string;
}

/**
 * Load an image from a URL or file path (server-side only) and extract the
 * 128-dim face embedding.
 *
 * Returns status codes for all failure cases — never throws for expected
 * detection failures.
 */
export async function extractFaceEmbedding(
  imageSource: string,
): Promise<FaceExtractionResult> {
  const base: Omit<FaceExtractionResult, "status" | "embedding"> = {
    detectionConfidence: 0,
    faceCount: 0,
    embeddingVersion: FACE_SIMILARITY_EVALUATOR_VERSION,
    embeddingModel: "faceRecognitionNet",
    embeddingDimension: FACE_SIMILARITY_EMBEDDING_DIMENSION,
    similarityThresholdVersion: FACE_SIMILARITY_THRESHOLD_VERSION,
  };

  try {
    const faceapi = await ensureModelsLoaded();
    // canvas is a peer dep of @vladmandic/face-api in node environments
    const { loadImage } = await import("canvas");

    const img = await loadImage(imageSource);
    const imgWidth = img.width;

    // Detect all faces to check for multiple
    const allDetections = await faceapi.detectAllFaces(
      img as never,
      new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }),
    );

    base.faceCount = allDetections.length;

    if (allDetections.length === 0) {
      return { ...base, status: "no_face" };
    }
    if (allDetections.length > 1) {
      return { ...base, status: "multiple_faces", detectionConfidence: allDetections[0].score };
    }

    const detection = allDetections[0];
    base.detectionConfidence = detection.score;

    if (detection.score < FACE_DETECTION_MIN_CONFIDENCE) {
      return { ...base, status: "low_confidence" };
    }

    // Reject faces that are too small (heavily occluded or far away)
    const boxWidth = detection.box.width;
    if (boxWidth / imgWidth < FACE_DETECTION_MIN_BOX_FRACTION) {
      return { ...base, status: "too_small" };
    }

    // Extract landmarks + descriptor
    const fullResult = await faceapi
      .detectSingleFace(img as never, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!fullResult) {
      return { ...base, status: "no_face" };
    }

    const embedding = Array.from(fullResult.descriptor);

    return {
      ...base,
      status: "performed",
      embedding,
      detectionConfidence: fullResult.detection.score,
    };
  } catch {
    return { ...base, status: "error" };
  }
}

/** Compare one candidate embedding against an array of prior embeddings. */
export function compareEmbeddings(input: {
  candidateEmbedding: number[];
  priorEmbeddings: Array<{ assetId: string; candidateId: string; embedding: number[] }>;
  euclideanDuplicateThreshold?: number;
  euclideanWarningThreshold?: number;
}): EmbeddingComparisonResult {
  const dupThreshold = input.euclideanDuplicateThreshold ?? FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD;
  const warnThreshold = input.euclideanWarningThreshold ?? FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD;

  let closestDistance = Infinity;
  let closestAssetId: string | undefined;
  let closestCandidateId: string | undefined;

  for (const prior of input.priorEmbeddings) {
    if (!prior.embedding || prior.embedding.length !== input.candidateEmbedding.length) continue;
    const dist = euclideanDistance(input.candidateEmbedding, prior.embedding);
    if (dist < closestDistance) {
      closestDistance = dist;
      closestAssetId = prior.assetId;
      closestCandidateId = prior.candidateId;
    }
  }

  const isDuplicate = closestDistance <= dupThreshold;
  const isWarning = !isDuplicate && closestDistance <= warnThreshold;
  const closestSimilarity =
    closestDistance < Infinity ? euclideanToCosineSimilarity(closestDistance) : undefined;

  return {
    closestMatchAssetId: closestAssetId,
    closestMatchCandidateId: closestCandidateId,
    closestDistance: closestDistance < Infinity ? closestDistance : undefined,
    closestSimilarity,
    isDuplicate,
    isWarning,
    euclideanThreshold: dupThreshold,
    warningThreshold: warnThreshold,
  };
}

/**
 * LocalFaceEmbeddingEvaluator — implements FaceSimilarityEvaluator.
 *
 * Requires priorEmbeddings to be injected (loaded from DB by the caller).
 * The evaluate() method accepts an optional imageSource override for the
 * candidate; if absent it will return unavailable.
 */
export class LocalFaceEmbeddingEvaluator implements FaceSimilarityEvaluator {
  readonly method = "local-face-embedding-v1";
  readonly version = FACE_SIMILARITY_EVALUATOR_VERSION;

  /**
   * Prior embeddings for this workspace — caller must load from DB.
   * MUST be workspace-scoped; cross-workspace embeddings must never be mixed.
   */
  private priorEmbeddings: Array<{
    assetId: string;
    candidateId: string;
    embedding: number[];
  }>;

  /** Optional image source for candidate (signed URL or path). */
  private imageSourceMap: Map<string, string>;

  constructor(
    priorEmbeddings: Array<{
      assetId: string;
      candidateId: string;
      embedding: number[];
    }>,
    imageSourceMap?: Map<string, string>,
  ) {
    this.priorEmbeddings = priorEmbeddings;
    this.imageSourceMap = imageSourceMap ?? new Map();
  }

  async evaluate(input: {
    candidateAsset: CandidateAssetReference;
    comparisonAssets: CandidateAssetReference[];
  }): Promise<FaceSimilarityResult> {
    const imageSource =
      this.imageSourceMap.get(input.candidateAsset.assetId) ??
      input.candidateAsset.signedUrl;

    if (!imageSource) {
      return {
        status: "not_available",
        method: this.method,
      };
    }

    if (this.priorEmbeddings.length === 0) {
      // Nothing to compare against — first ever candidate for this workspace.
      // Perform extraction anyway so we can persist the embedding.
      const extraction = await extractFaceEmbedding(imageSource);
      return {
        status: extraction.status === "performed" ? "performed" : "not_available",
        method: this.method,
        isDuplicate: false,
        similarity: undefined,
        threshold: FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
        // We attach extraction metadata for the caller to persist.
        ...(extraction.embedding
          ? {
              _embedding: extraction.embedding,
              _detectionConfidence: extraction.detectionConfidence,
              _faceCount: extraction.faceCount,
            }
          : {}),
      } as FaceSimilarityResult & Record<string, unknown>;
    }

    const extraction = await extractFaceEmbedding(imageSource);

    if (extraction.status !== "performed" || !extraction.embedding) {
      return {
        status: extraction.status === "error" ? "not_available" : "not_available",
        method: this.method,
        // Attach detection status for debug.
        ...(extraction.status !== "performed"
          ? { _detectionStatus: extraction.status, _faceCount: extraction.faceCount }
          : {}),
      } as FaceSimilarityResult & Record<string, unknown>;
    }

    const comparison = compareEmbeddings({
      candidateEmbedding: extraction.embedding,
      priorEmbeddings: this.priorEmbeddings,
    });

    return {
      status: "performed",
      closestMatchAssetId: comparison.closestMatchAssetId,
      similarity: comparison.closestSimilarity,
      threshold: FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
      isDuplicate: comparison.isDuplicate,
      method: this.method,
      // Attach embedding for persistence — caller must persist, never log.
      _embedding: extraction.embedding,
      _detectionConfidence: extraction.detectionConfidence,
      _faceCount: extraction.faceCount,
      _closestMatchCandidateId: comparison.closestMatchCandidateId,
      _closestDistance: comparison.closestDistance,
      _isWarning: comparison.isWarning,
      _euclideanThreshold: comparison.euclideanThreshold,
      _warningThreshold: comparison.warningThreshold,
      _evaluatorVersion: this.version,
      _thresholdVersion: FACE_SIMILARITY_THRESHOLD_VERSION,
    } as FaceSimilarityResult & Record<string, unknown>;
  }
}

/** Stored embedding reference for comparison loading. */
export type StoredEmbeddingRef = Pick<
  FaceEmbeddingRecord,
  "assetId" | "candidateId" | "embedding"
>;

/** Failure mode for production: "fail_closed" | "fail_open_with_warning" */
export type EvaluatorFailureMode = "fail_closed" | "fail_open_with_warning";

/**
 * Resolve the production failure mode.
 * Default: fail_closed when evaluator is configured.
 */
export function resolveEvaluatorFailureMode(): EvaluatorFailureMode {
  const env = process.env["FACE_EVALUATOR_FAILURE_MODE"];
  if (env === "fail_open_with_warning") return "fail_open_with_warning";
  return "fail_closed";
}
