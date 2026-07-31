/**
 * Server-side visibility assertion for face novelty.
 *
 * A candidate must not receive ready/visible status unless:
 *   - face evaluation status is "performed"
 *   - final novelty decision is "allowed"
 *
 * Under fail_closed, detection failures and duplicates become
 * novelty_blocked or novelty_failed — never ready.
 */

import type { CandidateStatus } from "../domain/creation-types";
import type { FaceDetectionStatus } from "./similarity-threshold";

function resolveFailureMode(): "fail_closed" | "fail_open_with_warning" {
  const env = process.env["FACE_EVALUATOR_FAILURE_MODE"];
  if (env === "fail_open_with_warning") return "fail_open_with_warning";
  return "fail_closed";
}

/** Detection / evaluation outcomes that must never become visible under fail_closed. */
export const FAIL_CLOSED_BLOCKING_DETECTION_STATUSES: ReadonlySet<string> = new Set([
  "no_face",
  "multiple_faces",
  "low_confidence",
  "too_small",
  "unavailable",
  "error",
]);

export type NoveltyVisibilityDecision = "allowed" | "blocked" | "failed";

export type NoveltyCandidateStatusResult = {
  status: CandidateStatus;
  finalDecision: NoveltyVisibilityDecision;
  hardRejectReason?: string;
  requiresReplacementConfirmation: boolean;
};

export type ResolveNoveltyCandidateStatusInput = {
  hardReject: boolean;
  hardRejectReason?: string;
  softWarning?: boolean;
  softWarningReason?: string;
  /** FaceSimilarityResult.status */
  evaluationStatus?: "performed" | "not_available";
  detectionStatus?: string;
  /** Whether LocalFaceEmbeddingEvaluator was active for this check. */
  evaluatorActive: boolean;
  failureMode?: "fail_closed" | "fail_open_with_warning";
};

/**
 * Map a novelty check into the candidate DB status that enforces visibility.
 */
export function resolveNoveltyCandidateStatus(
  input: ResolveNoveltyCandidateStatusInput,
): NoveltyCandidateStatusResult {
  const failureMode = input.failureMode ?? resolveFailureMode();
  const detection = input.detectionStatus;
  const evaluationPerformed = input.evaluationStatus === "performed";

  // Explicit hard rejects from policy (duplicates, fingerprints, etc.).
  if (input.hardReject) {
    const reason = input.hardRejectReason ?? "novelty_protection";
    const isEvaluatorFailure =
      reason === "face_similarity_evaluator_error" ||
      reason === "evaluator_error" ||
      detection === "error";
    return {
      status: isEvaluatorFailure ? "novelty_failed" : "novelty_blocked",
      finalDecision: isEvaluatorFailure ? "failed" : "blocked",
      hardRejectReason: reason,
      requiresReplacementConfirmation: true,
    };
  }

  /**
   * fail_closed visibility rules apply only when the live LocalFace evaluator
   * is active. The Null adapter (method "none") keeps soft-warning behaviour
   * for unit tests and non-live paths — live discovery forbids Null via
   * assertLiveFaceEvaluatorNotNull.
   */
  if (failureMode === "fail_closed" && input.evaluatorActive) {
    // Detection failures must never become visible.
    if (detection && FAIL_CLOSED_BLOCKING_DETECTION_STATUSES.has(detection)) {
      const isError = detection === "error";
      return {
        status: isError ? "novelty_failed" : "novelty_blocked",
        finalDecision: isError ? "failed" : "blocked",
        hardRejectReason: detection,
        requiresReplacementConfirmation: true,
      };
    }

    // Soft warnings from not_available / evaluator error under fail_closed.
    if (input.softWarning) {
      const reason = input.softWarningReason ?? "face_similarity_evaluator_not_available";
      const isError =
        reason.includes("evaluator_error") || reason.includes("error");
      return {
        status: isError ? "novelty_failed" : "novelty_blocked",
        finalDecision: isError ? "failed" : "blocked",
        hardRejectReason: reason,
        requiresReplacementConfirmation: true,
      };
    }

    // Must have performed evaluation before ready.
    if (!evaluationPerformed) {
      return {
        status: "novelty_failed",
        finalDecision: "failed",
        hardRejectReason: "evaluation_not_performed",
        requiresReplacementConfirmation: true,
      };
    }
  }

  return {
    status: "ready",
    finalDecision: "allowed",
    requiresReplacementConfirmation: false,
  };
}

/**
 * Assert a candidate may become ready/visible.
 * Throws when the ready transition would violate novelty rules.
 */
export function assertCandidateMayBecomeReady(input: {
  proposedStatus: CandidateStatus;
  evaluationStatus?: "performed" | "not_available";
  finalDecision?: NoveltyVisibilityDecision;
  detectionStatus?: string;
  failureMode?: "fail_closed" | "fail_open_with_warning";
}): void {
  if (input.proposedStatus !== "ready") return;

  const failureMode = input.failureMode ?? resolveFailureMode();
  if (failureMode !== "fail_closed") return;

  if (input.finalDecision && input.finalDecision !== "allowed") {
    throw new Error(
      `Visibility assertion failed: cannot set ready when finalDecision=${input.finalDecision}`,
    );
  }
  if (input.evaluationStatus !== "performed") {
    throw new Error(
      "Visibility assertion failed: cannot set ready before performed face evaluation",
    );
  }
  if (
    input.detectionStatus &&
    FAIL_CLOSED_BLOCKING_DETECTION_STATUSES.has(input.detectionStatus)
  ) {
    throw new Error(
      `Visibility assertion failed: detection status ${input.detectionStatus} must never become visible`,
    );
  }
}

/** Statuses that must not appear as visible casting cards. */
export const NON_VISIBLE_NOVELTY_STATUSES: ReadonlySet<CandidateStatus> = new Set([
  "novelty_blocked",
  "novelty_failed",
  "rejected",
  "failed",
  "archived",
  "queued",
  "generating",
]);

export function isCandidateVisibleOnBoard(status: CandidateStatus): boolean {
  return !NON_VISIBLE_NOVELTY_STATUSES.has(status);
}

/** Hard-reject reasons that map to fail_closed detection blocks. */
export function detectionStatusToHardRejectReason(
  status: FaceDetectionStatus | string,
): string {
  return status;
}
