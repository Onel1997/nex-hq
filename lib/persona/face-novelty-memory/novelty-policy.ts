/**
 * Discovery novelty policy — evaluateDiscoveryNovelty.
 *
 * Hard reject rules (candidate must NOT be shown):
 *   - exact image checksum already in forbidden set
 *   - same storage object (different signed URL)
 *   - perceptual near-duplicate
 *   - identity fingerprint already consumed in a prior run
 *   - candidate asset belongs to an old project (cross-project reuse guard)
 *   - real face evaluator marks it duplicate (when available)
 *   - under fail_closed: live evaluator detection failures / errors
 *
 * Soft warning only:
 *   - null/adapter evaluator is not available (method "none")
 *   - fail_open_with_warning mode for detection failures
 *   - metadata suggests closely reused identity recipe
 *
 * The Candidate Board must never display hard-rejected candidates.
 */

import type {
  CandidateAssetReference,
  DiscoveryHistory,
  FaceSimilarityEvaluator,
  NoveltyEvaluation,
} from "./types";
import { detectImageDuplicate } from "./image-duplicate-detection";
import { resolveEvaluatorFailureMode } from "./local-face-embedding-evaluator";
import { FAIL_CLOSED_BLOCKING_DETECTION_STATUSES } from "./visibility-assertion";

export interface NoveltyPolicyInput {
  candidateId: string;
  assetId: string;
  creationProjectId: string;
  identityFingerprint: string;
  assetRef: CandidateAssetReference;
  history: DiscoveryHistory;
  faceSimilarityEvaluator?: FaceSimilarityEvaluator;
}

export async function evaluateDiscoveryNovelty(
  input: NoveltyPolicyInput,
): Promise<NoveltyEvaluation> {
  const {
    candidateId,
    assetId,
    creationProjectId,
    identityFingerprint,
    assetRef,
    history,
    faceSimilarityEvaluator,
  } = input;

  let hardReject = false;
  let hardRejectReason: string | undefined;
  let softWarning = false;
  let softWarningReason: string | undefined;
  let closestPriorCandidateId: string | undefined;
  let evaluatorMethod: string | undefined;
  let evaluatorVersion: string | undefined;

  // 1. Identity fingerprint already consumed.
  if (history.forbiddenIdentityFingerprints.has(identityFingerprint)) {
    hardReject = true;
    hardRejectReason = "identity_fingerprint_already_consumed";
  }

  // 2. Image-level duplicate check (exact + storage + perceptual).
  const imageDuplicate = detectImageDuplicate(assetRef, history.priorAssetReferences);

  if (imageDuplicate.isDuplicate && !hardReject) {
    hardReject = true;
    hardRejectReason = imageDuplicate.reason ?? "image_duplicate";
    closestPriorCandidateId = imageDuplicate.matchedAssetId;
  }

  // 3. Cross-project asset reuse guard — asset checksum or storage key was
  //    seen in a prior project for this workspace (covered by forbidden sets).
  if (assetRef.imageChecksum && history.forbiddenImageChecksums.has(assetRef.imageChecksum)) {
    if (!hardReject) {
      hardReject = true;
      hardRejectReason = "cross_project_checksum_reuse";
    }
  }
  if (assetRef.storageObjectKey && history.forbiddenStorageKeys.has(assetRef.storageObjectKey)) {
    if (!hardReject) {
      hardReject = true;
      hardRejectReason = "cross_project_storage_object_reuse";
    }
  }

  // 4. Face-similarity evaluation (real biometric layer).
  // Always invoke the evaluator when present so embedding extraction can be
  // persisted even for the very first candidate (no priors yet).
  let faceSimilarityResult = undefined;
  const failureMode = resolveEvaluatorFailureMode();

  if (faceSimilarityEvaluator) {
    try {
      faceSimilarityResult = await faceSimilarityEvaluator.evaluate({
        candidateAsset: assetRef,
        comparisonAssets: history.priorAssetReferences,
      });
      evaluatorMethod = faceSimilarityResult.method;
      const raw = faceSimilarityResult as FaceSimilarityResultWithSideChannel;
      const detectionStatus = raw._detectionStatus as string | undefined;

      if (faceSimilarityResult.status === "not_available") {
        const isLiveLocalEvaluator = evaluatorMethod === "local-face-embedding-v1";
        const blockingDetection =
          detectionStatus != null &&
          FAIL_CLOSED_BLOCKING_DETECTION_STATUSES.has(detectionStatus);

        if (
          failureMode === "fail_closed" &&
          isLiveLocalEvaluator &&
          (blockingDetection || !detectionStatus)
        ) {
          if (!hardReject) {
            hardReject = true;
            hardRejectReason =
              detectionStatus === "error"
                ? "face_similarity_evaluator_error"
                : detectionStatus ?? "unavailable";
          }
        } else if (!hardReject) {
          // Honest soft warning — null adapter or fail_open mode.
          softWarning = true;
          softWarningReason =
            "face_similarity_evaluator_not_available — cannot confirm visual novelty; image-level checks passed only";
        }
      } else if (faceSimilarityResult.isDuplicate && !hardReject) {
        hardReject = true;
        hardRejectReason = "face_similarity_duplicate";
        closestPriorCandidateId =
          (raw._closestMatchCandidateId as string | undefined) ??
          faceSimilarityResult.closestMatchAssetId;
      } else if (
        !hardReject &&
        (raw._isWarning === true ||
          (faceSimilarityResult as { isWarning?: boolean }).isWarning === true)
      ) {
        // Phase 2.5B.4 — borderline resemblance: warn only, never hard-block.
        softWarning = true;
        softWarningReason = "face_similarity_warning";
        closestPriorCandidateId =
          (raw._closestMatchCandidateId as string | undefined) ??
          faceSimilarityResult.closestMatchAssetId;
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const safeMessage = raw
        .replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, "[redacted-data-url]")
        .replace(/https?:\/\/[^\s]+/g, "[redacted-url]")
        .replace(/\?token=[^\s&]+/g, "?token=[redacted]")
        .slice(0, 400);
      faceSimilarityResult = {
        status: "not_available",
        method: (faceSimilarityEvaluator as { method?: string }).method ?? "unknown",
        _detectionStatus: "error",
        _safeErrorCode: "face_similarity_evaluator_error",
        _safeErrorMessage: safeMessage,
      } as NoveltyEvaluation["faceSimilarity"] & Record<string, unknown>;
      if (failureMode === "fail_closed" && !hardReject) {
        hardReject = true;
        hardRejectReason = "face_similarity_evaluator_error";
      } else {
        softWarning = true;
        softWarningReason = "face_similarity_evaluator_error";
      }
    }
  } else if (!hardReject) {
    // No evaluator available.
    softWarning = true;
    softWarningReason =
      "face_similarity_evaluator_not_available — cannot confirm visual novelty; image-level checks passed only";
  }

  void creationProjectId; // available for future cross-project checks

  return {
    candidateId,
    assetId,
    identityFingerprint,
    hardReject,
    hardRejectReason,
    softWarning: hardReject ? false : softWarning,
    softWarningReason: hardReject ? undefined : softWarningReason,
    imageDuplicate,
    faceSimilarity: faceSimilarityResult,
    closestPriorCandidateId,
    evaluatorMethod,
    evaluatorVersion,
  };
}

type FaceSimilarityResultWithSideChannel = NonNullable<
  NoveltyEvaluation["faceSimilarity"]
> &
  Record<string, unknown>;
