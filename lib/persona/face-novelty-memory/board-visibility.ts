/**
 * Candidate Board visibility — fail-closed filtering and failure-slot DTOs.
 *
 * A candidate is board-visible only when:
 *   status === "ready"
 *   AND novelty evaluation status === "performed"
 *   AND final novelty decision === "allowed"
 *
 * Failed/blocked candidates never include image URLs in board payloads.
 */

import type { CandidateStatus, PersonaCandidate } from "../domain/creation-types";
import type { SafeFaceNoveltyLiveDebug } from "./live-debug";
import { isCandidateVisibleOnBoard } from "./visibility-assertion";

export type NoveltyFailureSlotStatus = "novelty_failed" | "novelty_blocked";

/** Safe failure-slot DTO — no images, signed URLs, or selectable payload. */
export type NoveltyFailureSlotDto = {
  slot: number;
  candidateId: string;
  status: NoveltyFailureSlotStatus;
  reason: string;
  requiresReplacementConfirmation: boolean;
};

export type BoardCandidatePartition = {
  /** Only ready + performed + allowed candidates (full PersonaCandidate). */
  visibleCandidates: PersonaCandidate[];
  /** Non-image failure slots for the board UI. */
  failureSlots: NoveltyFailureSlotDto[];
};

function readLiveDebug(
  candidate: PersonaCandidate,
): SafeFaceNoveltyLiveDebug | null {
  const raw = candidate.generation_settings?.faceNoveltyLiveDebug;
  if (!raw || typeof raw !== "object") return null;
  return raw as SafeFaceNoveltyLiveDebug;
}

/**
 * Whether a candidate may appear as a normal board card with image.
 */
export function isNoveltyBoardVisible(candidate: PersonaCandidate): boolean {
  if (candidate.status !== "ready") return false;
  if (!isCandidateVisibleOnBoard(candidate.status)) return false;

  const debug = readLiveDebug(candidate);
  // Legacy ready candidates without debug (pre-novelty path / A2) remain visible.
  if (!debug) return true;
  if (debug.finalDecision !== "allowed") return false;
  // Fail-closed: performed evaluation is required when novelty debug is present.
  if (debug.faceDetectionStatus !== "performed") return false;
  return true;
}

export function toNoveltyFailureSlot(
  candidate: PersonaCandidate,
): NoveltyFailureSlotDto | null {
  if (
    candidate.status !== "novelty_failed" &&
    candidate.status !== "novelty_blocked"
  ) {
    return null;
  }
  const debug = readLiveDebug(candidate);
  const reason =
    debug?.hardRejectReason ??
    debug?.safeErrorMessage ??
    candidate.user_notes?.replace(/^\[novelty\]\s*/, "") ??
    candidate.rejection_reason ??
    candidate.status;
  return {
    slot: candidate.candidate_number,
    candidateId: candidate.id,
    status: candidate.status,
    reason,
    requiresReplacementConfirmation:
      debug?.requiresReplacementConfirmation ?? true,
  };
}

export function partitionBoardCandidates(
  candidates: PersonaCandidate[],
): BoardCandidatePartition {
  const visibleCandidates: PersonaCandidate[] = [];
  const failureSlots: NoveltyFailureSlotDto[] = [];

  for (const candidate of candidates) {
    if (isNoveltyBoardVisible(candidate)) {
      visibleCandidates.push(candidate);
      continue;
    }
    const slot = toNoveltyFailureSlot(candidate);
    if (slot) failureSlots.push(slot);
  }

  failureSlots.sort((a, b) => a.slot - b.slot);
  return { visibleCandidates, failureSlots };
}

/** Strip any image/preview fields from a candidate for non-visible statuses. */
export function stripCandidateImagePayload<T extends PersonaCandidate>(
  candidate: T,
): T {
  if (isNoveltyBoardVisible(candidate)) return candidate;
  return {
    ...candidate,
    primary_preview_asset_id: null,
    generation_settings: {
      ...(candidate.generation_settings ?? {}),
      // Keep safe debug only — never reintroduce preview URLs here.
    },
  };
}

export function canSelectCandidateOnBoard(candidate: {
  status: CandidateStatus;
}): boolean {
  return candidate.status === "ready";
}
