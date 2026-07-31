/**
 * LocalFaceEmbeddingEvaluator — server-only face similarity evaluator.
 *
 * Uses @vladmandic/face-api (ResNet-34, 128D descriptor) running via
 * @tensorflow/tfjs-node.  Models are loaded from the package's bundled
 * weights — no external downloads, no paid provider calls.
 *
 * SERVER-SIDE ONLY.  Never import this module in client bundles.
 * (Do not add `import "server-only"` — it breaks Node test runners.)
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
import {
  assertFaceApiModelsPresent,
  validateFaceApiModelFiles,
} from "./model-assets";

let _faceapiModule: typeof import("@vladmandic/face-api") | null = null;
let _modelsLoaded = false;
let _loadPromise: Promise<void> | null = null;
let _canvasPatched = false;

/** Test/dev helper — clear cached model load so a failed init can be retried. */
export function resetFaceApiModelLoadCacheForTests(): void {
  _faceapiModule = null;
  _modelsLoaded = false;
  _loadPromise = null;
}

/**
 * Register node-canvas types with face-api.
 * Without this, detectAllFaces throws:
 *   "toNetInput - expected media to be of type HTMLImageElement | ..."
 * which was the live Phase 2.0B.2 failure on all four candidates.
 */
async function ensureCanvasMonkeyPatch(
  faceapi: typeof import("@vladmandic/face-api"),
): Promise<void> {
  if (_canvasPatched) return;
  const canvas = await import("canvas");
  faceapi.env.monkeyPatch({
    Canvas: canvas.Canvas as unknown as typeof HTMLCanvasElement,
    Image: canvas.Image as unknown as typeof HTMLImageElement,
    ImageData: canvas.ImageData as unknown as typeof ImageData,
  });
  _canvasPatched = true;
}

/**
 * Load models once from the stable server-assets directory and cache.
 * Failed initialization clears the promise so a later retry can succeed
 * after model files are fixed (does not permanently poison the cache).
 */
async function ensureModelsLoaded(): Promise<typeof import("@vladmandic/face-api")> {
  if (_faceapiModule && _modelsLoaded) return _faceapiModule;

  if (_loadPromise) {
    await _loadPromise;
    if (!_faceapiModule || !_modelsLoaded) {
      throw new Error(
        "Face-api model initialization previously failed and was not recovered",
      );
    }
    return _faceapiModule;
  }

  _loadPromise = (async () => {
    const startedAt = Date.now();
    const validation = validateFaceApiModelFiles();
    if (process.env.NODE_ENV !== "production") {
      console.info("[persona.face-api.models] resolve", {
        modelsDir: validation.modelsDir,
        requiredFilesPresent: validation.ok,
        missing: validation.missing,
      });
    }
    const modelsPath = assertFaceApiModelsPresent();

    if (process.env.NODE_ENV !== "production") {
      console.info("[persona.face-api.models] initialization_started", {
        modelsDir: modelsPath,
      });
    }

    // Dynamic import so this module only loads in server contexts.
    await import("@tensorflow/tfjs-node");
    const faceapi = await import("@vladmandic/face-api");
    await ensureCanvasMonkeyPatch(faceapi);
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath);
    _faceapiModule = faceapi;
    _modelsLoaded = true;

    if (process.env.NODE_ENV !== "production") {
      console.info("[persona.face-api.models] initialization_completed", {
        modelsDir: modelsPath,
        durationMs: Date.now() - startedAt,
      });
    }
  })();

  try {
    await _loadPromise;
  } catch (err) {
    // Allow a later retry after fixing missing weights / native deps.
    _loadPromise = null;
    _modelsLoaded = false;
    _faceapiModule = null;
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Face-api model loading failed: ${message}`, {
      cause: err instanceof Error ? err : undefined,
    });
  }

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
  /** Safe, non-sensitive error code when status === "error". */
  safeErrorCode?: string;
  /** Safe, non-sensitive error message (no paths with secrets / URLs with tokens). */
  safeErrorMessage?: string;
  /** Development-only stack when status === "error". */
  safeErrorStack?: string;
}

function sanitizeEvaluatorError(err: unknown): {
  code: string;
  message: string;
  stack?: string;
} {
  const raw = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  const message = raw
    .replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, "[redacted-data-url]")
    .replace(/https?:\/\/[^\s]+/g, "[redacted-url]")
    .replace(/\?token=[^\s&]+/g, "?token=[redacted]")
    .slice(0, 400);
  if (message.includes("toNetInput")) {
    return {
      code: "faceapi_canvas_not_patched_or_invalid_media",
      message,
      stack,
    };
  }
  if (message.toLowerCase().includes("canvas")) {
    return { code: "canvas_image_decode_failed", message, stack };
  }
  if (message.toLowerCase().includes("tensorflow") || message.toLowerCase().includes("tfjs")) {
    return { code: "tensorflow_init_failed", message, stack };
  }
  return { code: "face_extraction_error", message, stack };
}

function retryTraceEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env["PERSONA_FACE_NOVELTY_RETRY_TRACE"] === "1"
  );
}

function retryTrace(checkpoint: string, detail?: Record<string, unknown>): void {
  if (!retryTraceEnabled()) return;
  console.info(`[persona.novelty.retry] ${checkpoint}`, detail ?? "");
}

/**
 * Load an image from a URL, file path, or data URL (server-side only) and
 * extract the 128-dim face embedding.
 *
 * Returns status codes for all failure cases — never throws for expected
 * detection failures. Errors are captured as safeErrorCode/safeErrorMessage.
 */
export async function extractFaceEmbedding(
  imageSource: string | Buffer,
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
    await ensureCanvasMonkeyPatch(faceapi);
    retryTrace("5.canvas_created", { monkeyPatched: true });
    // canvas is a peer dep of @vladmandic/face-api in node environments
    const { loadImage } = await import("canvas");

    const img = await loadImage(imageSource);
    const imgWidth = img.width;
    retryTrace("5b.image_decoded", { width: imgWidth, height: img.height });

    // Detect all faces to check for multiple
    const allDetections = await faceapi.detectAllFaces(
      img as never,
      new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }),
    );

    base.faceCount = allDetections.length;
    retryTrace("7.face_detection_completed", {
      faceCount: allDetections.length,
      topScore: allDetections[0]?.score,
    });

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
    retryTrace("8.embedding_extracted", {
      embeddingDimension: embedding.length,
      detectionConfidence: fullResult.detection.score,
    });

    return {
      ...base,
      status: "performed",
      embedding,
      detectionConfidence: fullResult.detection.score,
    };
  } catch (err) {
    const safe = sanitizeEvaluatorError(err);
    retryTrace("EXTRACT_FAILED", {
      errorCode: safe.code,
      errorMessage: safe.message,
      errorStack: safe.stack,
    });
    return {
      ...base,
      status: "error",
      safeErrorCode: safe.code,
      safeErrorMessage: safe.message,
      safeErrorStack: process.env.NODE_ENV !== "production" ? safe.stack : undefined,
    };
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
        _detectionStatus: extraction.status,
        _faceCount: extraction.faceCount,
        _detectionConfidence: extraction.detectionConfidence,
        ...(extraction.safeErrorCode
          ? {
              _safeErrorCode: extraction.safeErrorCode,
              _safeErrorMessage: extraction.safeErrorMessage,
              _safeErrorStack: extraction.safeErrorStack,
            }
          : {}),
        ...(extraction.embedding
          ? {
              _embedding: extraction.embedding,
            }
          : {}),
      } as FaceSimilarityResult & Record<string, unknown>;
    }

    const extraction = await extractFaceEmbedding(imageSource);

    if (extraction.status !== "performed" || !extraction.embedding) {
      return {
        status: "not_available",
        method: this.method,
        // Attach detection status for debug.
        _detectionStatus: extraction.status,
        _faceCount: extraction.faceCount,
        _detectionConfidence: extraction.detectionConfidence,
        ...(extraction.safeErrorCode
          ? {
              _safeErrorCode: extraction.safeErrorCode,
              _safeErrorMessage: extraction.safeErrorMessage,
              _safeErrorStack: extraction.safeErrorStack,
            }
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
      _detectionStatus: "performed",
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
