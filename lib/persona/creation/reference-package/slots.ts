/**
 * Phase 2.3D — Reference Package angle slots (facial identity coverage only).
 * Master Identity Reference remains separate and immutable.
 */

export const REFERENCE_PACKAGE_SLOTS = [
  "front",
  "three_quarter_left",
  "three_quarter_right",
  "left_profile",
  "right_profile",
] as const;

export type ReferencePackageSlot = (typeof REFERENCE_PACKAGE_SLOTS)[number];

export const REFERENCE_PACKAGE_SLOT_LABELS: Record<ReferencePackageSlot, string> = {
  front: "Front",
  three_quarter_left: "Three-quarter left",
  three_quarter_right: "Three-quarter right",
  left_profile: "Left profile",
  right_profile: "Right profile",
};

export const REFERENCE_PACKAGE_ATTEMPT_STATUSES = [
  "missing",
  "queued",
  "generating",
  "identity_check",
  "review",
  "accepted",
  "mismatch",
  "failed",
  "rejected",
] as const;

export type ReferencePackageAttemptStatus =
  (typeof REFERENCE_PACKAGE_ATTEMPT_STATUSES)[number];

export function isReferencePackageSlot(
  value: string,
): value is ReferencePackageSlot {
  return (REFERENCE_PACKAGE_SLOTS as readonly string[]).includes(value);
}

/** Map slot → persona reference asset view_angle / framing metadata. */
export function slotToReferenceMeta(slot: ReferencePackageSlot): {
  asset_type: "portrait" | "profile" | "three_quarter";
  view_angle:
    | "front"
    | "three_quarter_left"
    | "three_quarter_right"
    | "left_profile"
    | "right_profile";
  framing: "face" | "head_shoulders";
} {
  switch (slot) {
    case "front":
      return {
        asset_type: "portrait",
        view_angle: "front",
        framing: "head_shoulders",
      };
    case "three_quarter_left":
      return {
        asset_type: "three_quarter",
        view_angle: "three_quarter_left",
        framing: "head_shoulders",
      };
    case "three_quarter_right":
      return {
        asset_type: "three_quarter",
        view_angle: "three_quarter_right",
        framing: "head_shoulders",
      };
    case "left_profile":
      return {
        asset_type: "profile",
        view_angle: "left_profile",
        framing: "head_shoulders",
      };
    case "right_profile":
      return {
        asset_type: "profile",
        view_angle: "right_profile",
        framing: "head_shoulders",
      };
  }
}
