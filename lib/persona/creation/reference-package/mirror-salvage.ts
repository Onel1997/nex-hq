/**
 * Phase 2.3D.9 — Deterministic horizontal-mirror salvage eligibility.
 *
 * Wrong-direction Stage B refs with usable identity may be salvaged by
 * local horizontal flip — no OpenAI / FLUX regeneration.
 */

import type { IdentityConsistencyDecision } from "./identity-consistency";
import type { AngleDirection } from "./angle-direction";
import type { DetectedOrientation } from "./orientation-from-landmarks";
import type { ReferencePackageSlot } from "./slots";
import {
  isOppositeOrientationFailure,
  oppositeOrientationsForSlot,
} from "./provider-direction-fallback";

export const DERIVATION_TYPES = ["horizontal_mirror"] as const;
export type DerivationType = (typeof DERIVATION_TYPES)[number];

export const MIRROR_SALVAGE_PROVIDER = "derived_local" as const;

export const MIRROR_SALVAGE_POLICY_VERSION =
  "deterministic-mirror-salvage-v1.0.0" as const;

/** Orientations that swap under a pure horizontal flip. */
const HORIZONTAL_MIRROR_ORIENTATION_PAIRS: ReadonlyArray<
  readonly [DetectedOrientation, DetectedOrientation]
> = [
  ["image_left", "image_right"],
  ["image_right", "image_left"],
  ["profile_left", "profile_right"],
  ["profile_right", "profile_left"],
];

export function mirroredOrientation(
  orientation: DetectedOrientation | null | undefined,
): DetectedOrientation | null {
  if (!orientation || orientation === "uncertain" || orientation === "frontal") {
    return orientation === "frontal" ? "frontal" : null;
  }
  for (const [a, b] of HORIZONTAL_MIRROR_ORIENTATION_PAIRS) {
    if (orientation === a) return b;
  }
  return null;
}

/**
 * True when detected orientation is exactly the opposite of the canonical slot
 * and a horizontal mirror would land on an expected orientation for that slot.
 */
export function isExactOppositeOrientationForMirror(input: {
  slot: ReferencePackageSlot;
  angle_direction: AngleDirection | null | undefined;
  detected_orientation: DetectedOrientation | null | undefined;
}): boolean {
  if (
    !isOppositeOrientationFailure({
      slot: input.slot,
      angle_direction: input.angle_direction,
      detected_orientation: input.detected_orientation,
    })
  ) {
    return false;
  }
  const after = mirroredOrientation(input.detected_orientation);
  if (!after) return false;
  // After mirror, expected orientations for the SAME canonical slot must include it.
  // oppositeOrientationsForSlot lists what is wrong; the mirror of those should be correct.
  const stillOpposite = oppositeOrientationsForSlot(input.slot).includes(after);
  return !stillOpposite;
}

export function canProposeMirrorSalvage(input: {
  isMaster: boolean;
  isStageBGenerated: boolean;
  identityLocked: boolean;
  assetStatus: string;
  identityDecision: IdentityConsistencyDecision | null | undefined;
  angleDirection: AngleDirection | null | undefined;
  detectedOrientation: DetectedOrientation | null | undefined;
  slot: ReferencePackageSlot;
}): { ok: true } | { ok: false; reason: string } {
  if (input.isMaster) {
    return {
      ok: false,
      reason: "Master Identity Reference cannot create a mirrored version.",
    };
  }
  if (!input.isStageBGenerated) {
    return {
      ok: false,
      reason: "Only Stage B generated supporting references can be mirrored.",
    };
  }
  if (input.identityLocked) {
    return {
      ok: false,
      reason: "Cannot create mirrored version after Identity Lock is finalized.",
    };
  }
  if (input.assetStatus === "archived") {
    return {
      ok: false,
      reason: "Archived references cannot create a mirrored version.",
    };
  }
  if (input.identityDecision === "identity_mismatch") {
    return {
      ok: false,
      reason:
        "identity_mismatch cannot create a mirrored version in this phase.",
    };
  }
  if (
    input.identityDecision !== "identity_match" &&
    input.identityDecision !== "identity_warning"
  ) {
    return {
      ok: false,
      reason:
        "Mirror salvage requires machine identity_match or identity_warning.",
    };
  }
  if (input.angleDirection !== "incorrect") {
    return {
      ok: false,
      reason: "Mirror salvage requires angle_direction = incorrect.",
    };
  }
  if (
    !isExactOppositeOrientationForMirror({
      slot: input.slot,
      angle_direction: input.angleDirection,
      detected_orientation: input.detectedOrientation,
    })
  ) {
    return {
      ok: false,
      reason:
        "Detected orientation must be the exact opposite of the canonical slot.",
    };
  }
  return { ok: true };
}

/**
 * After mirror salvage, usable only when angle is correct AND
 * (identity_match OR identity_warning awaiting human approval).
 * identity_mismatch after mirror remains blocked.
 * No automatic approval.
 */
export function isMirrorSalvageUsableAfterApproval(input: {
  angleDirection: AngleDirection | null | undefined;
  identityDecision: IdentityConsistencyDecision | null | undefined;
  assetStatus: string;
}): boolean {
  if (input.assetStatus !== "approved") return false;
  if (input.angleDirection !== "correct") return false;
  if (input.identityDecision === "identity_mismatch") return false;
  if (input.identityDecision === "evaluation_failed") return false;
  return (
    input.identityDecision === "identity_match" ||
    input.identityDecision === "identity_warning"
  );
}
