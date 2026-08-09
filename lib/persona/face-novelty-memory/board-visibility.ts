/**
 * Candidate Board visibility — fail-closed filtering and failure-slot DTOs.
 *
 * A candidate is board-visible when:
 *   (status === "ready" OR status === "selected" without conversion)
 *   AND novelty evaluation status === "performed" (when debug present)
 *   AND final novelty decision === "allowed" (when debug present)
 *
 * Phase 2.3B — selected Brand Faces stay visible until converted to a Persona.
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
  /** Phase 2.1E — current L3 attempt for this blocked slot. */
  attemptNumber?: number;
  maxAttempts?: number;
  slotExhausted?: boolean;
  nextAttemptNumber?: number | null;
};

export type BoardCandidatePartition = {
  /** Ready + selected (unconverted) + performed + allowed candidates. */
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

/** Phase 2.3B — selected Brand Face awaiting Draft Persona conversion. */
export function isSelectedBrandFaceAwaitingConversion(
  candidate: Pick<PersonaCandidate, "status" | "converted_persona_id">,
): boolean {
  return candidate.status === "selected" && !candidate.converted_persona_id;
}

function passesNoveltyVisibilityGate(candidate: PersonaCandidate): boolean {
  if (!isCandidateVisibleOnBoard(candidate.status)) return false;

  const debug = readLiveDebug(candidate);
  // Legacy candidates without debug (pre-novelty path / A2) remain visible.
  if (!debug) return true;
  if (debug.finalDecision !== "allowed") return false;
  // Fail-closed: performed evaluation is required when novelty debug is present.
  if (debug.faceDetectionStatus !== "performed") return false;
  return true;
}

/**
 * Whether a candidate may appear as a board card with image.
 * Ready casting cards and unconverted selected Brand Faces are visible.
 */
export function isNoveltyBoardVisible(candidate: PersonaCandidate): boolean {
  if (candidate.status === "ready") {
    return passesNoveltyVisibilityGate(candidate);
  }
  // Selected Brand Face stays actionable until Draft Persona conversion.
  if (isSelectedBrandFaceAwaitingConversion(candidate)) {
    return passesNoveltyVisibilityGate(candidate);
  }
  return false;
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
  const settings = candidate.generation_settings ?? {};
  if (settings.boardSupersededByReplacement === true) {
    return null;
  }
  if (settings.slotExhausted === true) {
    return {
      slot: candidate.candidate_number,
      candidateId: candidate.id,
      status: candidate.status,
      reason: "Slot exhausted — start a new discovery",
      requiresReplacementConfirmation: false,
      attemptNumber: readAttempt(settings),
      maxAttempts: 4,
      slotExhausted: true,
      nextAttemptNumber: null,
    };
  }
  const debug = readLiveDebug(candidate);
  const reason =
    debug?.hardRejectReason ??
    debug?.safeErrorMessage ??
    candidate.user_notes?.replace(/^\[novelty\]\s*/, "") ??
    candidate.rejection_reason ??
    candidate.status;
  const attemptNumber = readAttempt(settings);
  const canReplace =
    candidate.status === "novelty_blocked" &&
    (debug?.requiresReplacementConfirmation ?? true) &&
    attemptNumber < 4;
  return {
    slot: candidate.candidate_number,
    candidateId: candidate.id,
    status: candidate.status,
    reason,
    requiresReplacementConfirmation: canReplace,
    attemptNumber,
    maxAttempts: 4,
    slotExhausted: false,
    nextAttemptNumber: canReplace ? attemptNumber + 1 : null,
  };
}

function readAttempt(settings: Record<string, unknown>): number {
  const di = settings.discoveryIdentity;
  if (di && typeof di === "object") {
    const n = (di as { attemptNumber?: unknown }).attemptNumber;
    if (typeof n === "number" && Number.isInteger(n) && n >= 1) return n;
  }
  const top = settings.identityAttemptNumber;
  if (typeof top === "number" && Number.isInteger(top) && top >= 1) return top;
  return 1;
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

/** Board statuses that keep image payloads after refresh (Phase 2.3B). */
export function isBoardImageStatus(status: CandidateStatus): boolean {
  return status === "ready" || status === "selected";
}
