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
 *
 * Soft warning only:
 *   - face evaluator is not available (not_available)
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

  // 4. Face-similarity evaluation (real biometric layer — will be not_available
  //    until a real provider is wired).
  // Always invoke the evaluator when present so embedding extraction can be
  // persisted even for the very first candidate (no priors yet).
  let faceSimilarityResult = undefined;
  if (faceSimilarityEvaluator) {
    try {
      faceSimilarityResult = await faceSimilarityEvaluator.evaluate({
        candidateAsset: assetRef,
        comparisonAssets: history.priorAssetReferences,
      });
      evaluatorMethod = faceSimilarityResult.method;
      if (faceSimilarityResult.status === "not_available") {
        // Honest soft warning — cannot confirm visual uniqueness.
        if (!hardReject) {
          softWarning = true;
          softWarningReason =
            "face_similarity_evaluator_not_available — cannot confirm visual novelty; image-level checks passed only";
        }
      } else if (faceSimilarityResult.isDuplicate && !hardReject) {
        hardReject = true;
        hardRejectReason = "face_similarity_duplicate";
        closestPriorCandidateId = faceSimilarityResult.closestMatchAssetId;
      }
    } catch {
      softWarning = true;
      softWarningReason = "face_similarity_evaluator_error";
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
