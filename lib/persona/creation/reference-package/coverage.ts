/**
 * Phase 2.3D.2–2.3D.5 — Live Reference Package slot coverage.
 *
 * Distinguishes:
 * 1) machine identity evaluation (preserved evidence)
 * 2) human approval / usability
 * 3) effective camera slot
 *
 * Coverage counts ONLY currently approved usable references on the EFFECTIVE slot.
 * identity_match OR identity_warning + human approved → usable.
 * identity_mismatch → never usable.
 */

import type { PersonaReferenceAsset } from "@/lib/persona/domain/types";
import {
  getAttemptEffectiveSlot,
  parseReferencePackageAssetNotes,
  type ReferencePackageAttempt,
} from "./types";
import {
  REFERENCE_PACKAGE_SLOTS,
  type ReferencePackageAttemptStatus,
  type ReferencePackageSlot,
} from "./slots";
import { isAngleDirectionUsable, type AngleDirection } from "./angle-direction";
import type { IdentityConsistencyDecision } from "./identity-consistency";

export type SlotCoverageResolution = {
  slot: ReferencePackageSlot;
  status: ReferencePackageAttemptStatus;
  latestAttempt: ReferencePackageAttempt | null;
  activeAssetId: string | null;
  countsTowardCoverage: boolean;
  attemptHistory: ReferencePackageAttempt[];
  /** Machine identity evidence — never rewritten by human approval. */
  identityDecision: IdentityConsistencyDecision | null;
  humanReview: "approved" | "rejected" | "pending" | null;
  angleManuallyReassigned: boolean;
  angleDirection: AngleDirection | null;
  detectedOrientation: ReferencePackageAttempt["detected_orientation"];
  wrongCameraDirection: boolean;
};

/** identity_match or identity_warning may become usable after explicit human approval. */
export function isIdentityDecisionEligibleForHumanApproval(
  decision: IdentityConsistencyDecision | null | undefined,
): boolean {
  return decision === "identity_match" || decision === "identity_warning";
}

/**
 * Usable when:
 * - asset.status === approved
 * - identity is match OR warning (never mismatch)
 * - angle_direction is not incorrect
 *
 * attempt.status === "mismatch" alone must NOT block identity_warning after approval
 * (legacy generations stored warning as attempt status "mismatch").
 */
export function isCurrentlyAcceptedUsable(input: {
  attempt: ReferencePackageAttempt | null;
  asset: Pick<PersonaReferenceAsset, "id" | "status" | "notes"> | null;
}): boolean {
  if (!input.attempt) return false;
  if (!input.asset) return false;
  if (input.asset.status !== "approved") return false;

  const decision = input.attempt.identity_decision;
  if (decision === "identity_mismatch" || decision === "evaluation_failed") {
    return false;
  }
  if (decision == null) {
    // Legacy attempts without identity_decision: only count accepted/review machine states.
    if (
      input.attempt.status !== "accepted" &&
      input.attempt.status !== "review"
    ) {
      return false;
    }
  } else if (!isIdentityDecisionEligibleForHumanApproval(decision)) {
    return false;
  }

  if (
    input.attempt.angle_direction &&
    !isAngleDirectionUsable(input.attempt.angle_direction as AngleDirection)
  ) {
    // Fail closed: incorrect never usable.
    // Image-validated uncertain (detected_orientation set) also not usable.
    if (input.attempt.angle_direction === "incorrect") return false;
    if (
      input.attempt.angle_direction === "uncertain" &&
      input.attempt.detected_orientation != null
    ) {
      return false;
    }
    // Legacy prompt-only uncertain (no detected_orientation) still tolerated
    // until recomputed — do not strip accepted coverage.
    if (input.attempt.angle_direction === "uncertain") {
      // tolerate
    } else {
      return false;
    }
  }

  // Hard operational failures still block (angle/provider failures).
  if (input.attempt.status === "failed") return false;
  if (input.attempt.status === "rejected") return false;

  return true;
}

export function resolveSlotDisplayStatus(input: {
  attempt: ReferencePackageAttempt | null;
  asset: Pick<PersonaReferenceAsset, "status"> | null;
}): ReferencePackageAttemptStatus {
  const { attempt, asset } = input;
  if (!attempt) return "missing";

  const decision = attempt.identity_decision;
  const angleBad =
    attempt.angle_direction === "incorrect" ||
    (attempt.angle_direction === "uncertain" &&
      attempt.detected_orientation != null);

  // Wrong camera direction is a primary slot state (not Accepted / not Mismatch).
  if (angleBad) {
    return "failed";
  }

  // Human-approved match/warning → Accepted.
  if (
    asset?.status === "approved" &&
    isIdentityDecisionEligibleForHumanApproval(decision)
  ) {
    return "accepted";
  }

  // True mismatch only when machine identity is identity_mismatch.
  if (decision === "identity_mismatch") {
    return "mismatch";
  }

  // identity_warning awaiting human approval → review (not primary Mismatch).
  if (decision === "identity_warning") {
    if (asset?.status === "rejected" || asset?.status === "archived") {
      return "rejected";
    }
    return "review";
  }

  if (attempt.status === "failed") {
    return "failed";
  }

  // Legacy: attempt.status === "mismatch" with identity_match shouldn't happen;
  // if asset rejected, show rejected.
  if (asset?.status === "rejected" || asset?.status === "archived") {
    return "rejected";
  }

  if (asset?.status === "approved") {
    return "accepted";
  }

  if (
    asset &&
    (asset.status === "review" || asset.status === "uploaded") &&
    (attempt.status === "accepted" ||
      attempt.status === "review" ||
      attempt.status === "mismatch")
  ) {
    // mismatch here only if decision wasn't handled above
    return "review";
  }

  if (attempt.status === "accepted") {
    if (!asset) return "failed";
  }

  if (attempt.status === "mismatch") {
    // Fallback without identity_decision: review-needed (true mismatch handled above).
    return "review";
  }

  return attempt.status === "missing" ? "failed" : attempt.status;
}

export function resolveHumanReview(
  asset: Pick<PersonaReferenceAsset, "status"> | null,
): "approved" | "rejected" | "pending" | null {
  if (!asset) return null;
  if (asset.status === "approved") return "approved";
  if (asset.status === "rejected" || asset.status === "archived") return "rejected";
  if (asset.status === "review" || asset.status === "uploaded") return "pending";
  return null;
}

/** Latest attempt whose effective slot matches (prefer reassignment recency). */
export function latestAttemptPerSlot(
  attempts: readonly ReferencePackageAttempt[],
): Map<ReferencePackageSlot, ReferencePackageAttempt> {
  const map = new Map<ReferencePackageSlot, ReferencePackageAttempt>();
  const recency = (a: ReferencePackageAttempt) =>
    a.reassigned_at && a.reassigned_at > a.updated_at
      ? a.reassigned_at
      : a.updated_at;
  for (const attempt of attempts) {
    const slot = getAttemptEffectiveSlot(attempt);
    const prev = map.get(slot);
    if (!prev) {
      map.set(slot, attempt);
      continue;
    }
    const aRec = recency(attempt);
    const pRec = recency(prev);
    if (aRec > pRec) {
      map.set(slot, attempt);
    } else if (aRec === pRec) {
      if (attempt.reassigned_from && !prev.reassigned_from) {
        map.set(slot, attempt);
      } else if (prev.reassigned_from && !attempt.reassigned_from) {
        // Keep reassigned attempt over a newer historical occupant of the slot.
      } else if (attempt.created_at >= prev.created_at) {
        map.set(slot, attempt);
      }
    }
  }
  return map;
}

/**
 * History for a slot: attempts requested for it OR currently effective on it.
 * Preserves original generation history after reassignment.
 */
export function attemptsHistoryForSlot(
  attempts: readonly ReferencePackageAttempt[],
  slot: ReferencePackageSlot,
): ReferencePackageAttempt[] {
  return attempts
    .filter(
      (a) =>
        a.reference_slot === slot || getAttemptEffectiveSlot(a) === slot,
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function resolveActiveAssetForSlot(
  slot: ReferencePackageSlot,
  latestAttempt: ReferencePackageAttempt | null,
  assets: readonly PersonaReferenceAsset[],
): PersonaReferenceAsset | null {
  if (latestAttempt?.generated_asset_id) {
    const linked = assets.find((a) => a.id === latestAttempt.generated_asset_id);
    if (linked) return linked;
  }
  const byNotes = assets
    .filter((a) => {
      const meta = parseReferencePackageAssetNotes(a.notes);
      return meta?.effective_slot === slot || meta?.slot === slot;
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return byNotes[0] ?? null;
}

export function resolveReferencePackageSlotCoverage(input: {
  attempts: readonly ReferencePackageAttempt[];
  assets: readonly PersonaReferenceAsset[];
}): {
  slots: SlotCoverageResolution[];
  acceptedCount: number;
  referencePackageReady: boolean;
} {
  const latest = latestAttemptPerSlot(input.attempts);
  const countedAssetIds = new Set<string>();

  const slots: SlotCoverageResolution[] = REFERENCE_PACKAGE_SLOTS.map((slot) => {
    const attempt = latest.get(slot) ?? null;
    const asset = resolveActiveAssetForSlot(slot, attempt, input.assets);
    const status = resolveSlotDisplayStatus({ attempt, asset });
    let countsTowardCoverage = isCurrentlyAcceptedUsable({ attempt, asset });

    // Same asset must not count twice across slots.
    if (countsTowardCoverage && asset) {
      if (countedAssetIds.has(asset.id)) {
        countsTowardCoverage = false;
      } else {
        countedAssetIds.add(asset.id);
      }
    }

    return {
      slot,
      status: countsTowardCoverage
        ? "accepted"
        : status === "accepted" && !countsTowardCoverage
          ? // approved but not usable (e.g. mismatch blocked) → show mismatch/review
            attempt?.identity_decision === "identity_mismatch"
              ? "mismatch"
              : attempt?.angle_direction === "incorrect"
                ? "failed"
                : "review"
          : status,
      latestAttempt: attempt,
      activeAssetId: asset?.id ?? null,
      countsTowardCoverage,
      attemptHistory: attemptsHistoryForSlot(input.attempts, slot),
      identityDecision: attempt?.identity_decision ?? null,
      humanReview: resolveHumanReview(asset),
      angleManuallyReassigned: Boolean(
        attempt?.reassigned_from ||
          (attempt?.effective_slot &&
            attempt.effective_slot !== attempt.reference_slot),
      ),
      angleDirection: attempt?.angle_direction ?? null,
      detectedOrientation: attempt?.detected_orientation ?? null,
      wrongCameraDirection: attempt?.angle_direction === "incorrect",
    };
  });

  for (const row of slots) {
    if (!row.countsTowardCoverage && row.status === "accepted") {
      row.status =
        row.identityDecision === "identity_mismatch" ? "mismatch" : "review";
    }
  }

  const acceptedCount = slots.filter((s) => s.countsTowardCoverage).length;
  return {
    slots,
    acceptedCount,
    referencePackageReady: acceptedCount === REFERENCE_PACKAGE_SLOTS.length,
  };
}

export function slotsNeedingGenerationFromCoverage(
  coverage: ReturnType<typeof resolveReferencePackageSlotCoverage>,
  onlySlot?: ReferencePackageSlot,
): ReferencePackageSlot[] {
  const slots = onlySlot ? [onlySlot] : [...REFERENCE_PACKAGE_SLOTS];
  return slots.filter((slot) => {
    const row = coverage.slots.find((s) => s.slot === slot);
    return !row?.countsTowardCoverage;
  });
}

/** Block regenerating a slot that already has an approved usable reference. */
export function assertSlotMayBeRegenerated(
  coverage: ReturnType<typeof resolveReferencePackageSlotCoverage>,
  slot: ReferencePackageSlot,
): void {
  const row = coverage.slots.find((s) => s.slot === slot);
  if (row?.countsTowardCoverage) {
    throw new Error(
      `Slot ${slot} has an approved usable reference and must not be regenerated.`,
    );
  }
}
