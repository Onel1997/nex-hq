/** Shared Stage B test fixture: orientation that matches a requested slot. */

import type { OrientationEstimate } from "@/lib/persona/creation/reference-package/orientation-from-landmarks";
import type { ReferencePackageSlot } from "@/lib/persona/creation/reference-package/slots";

export function orientationFixtureForSlot(
  slot: ReferencePackageSlot,
): OrientationEstimate {
  switch (slot) {
    case "front":
      return {
        detected_orientation: "frontal",
        detected_yaw_degrees: 0,
        noseSide: "center",
        bothEyesVisible: true,
        noseOffsetNorm: 0,
        reason: "test fixture frontal",
      };
    case "three_quarter_left":
      return {
        detected_orientation: "image_left",
        detected_yaw_degrees: -38,
        noseSide: "left",
        bothEyesVisible: true,
        noseOffsetNorm: -0.35,
        reason: "test fixture TQ left",
      };
    case "three_quarter_right":
      return {
        detected_orientation: "image_right",
        detected_yaw_degrees: 38,
        noseSide: "right",
        bothEyesVisible: true,
        noseOffsetNorm: 0.35,
        reason: "test fixture TQ right",
      };
    case "left_profile":
      return {
        detected_orientation: "profile_left",
        detected_yaw_degrees: -78,
        noseSide: "left",
        bothEyesVisible: false,
        noseOffsetNorm: -0.8,
        reason: "test fixture left profile",
      };
    case "right_profile":
      return {
        detected_orientation: "profile_right",
        detected_yaw_degrees: 78,
        noseSide: "right",
        bothEyesVisible: false,
        noseOffsetNorm: 0.8,
        reason: "test fixture right profile",
      };
  }
}
