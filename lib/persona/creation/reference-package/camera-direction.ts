/**
 * Phase 2.3D.3 — Canonical Stage B camera directions.
 * ALL directions are FROM THE SUBJECT'S PERSPECTIVE.
 */

import type { ReferencePackageSlot } from "./slots";

export const CAMERA_DIRECTION_POLICY_VERSION =
  "camera-direction-subject-perspective-v1.0.0" as const;

export type CanonicalCameraDirection = {
  slot: ReferencePackageSlot;
  subjectAction: string;
  cameraSees: string;
  nosePointsImageSide: "center" | "left" | "right";
  yawDegreesApprox: string;
  bothEyesVisible: boolean;
  isFullProfile: boolean;
  hardConstraints: string[];
};

/**
 * Subject-perspective definitions — do not reinterpret as camera-orbit language.
 */
export const CANONICAL_CAMERA_DIRECTIONS: Record<
  ReferencePackageSlot,
  CanonicalCameraDirection
> = {
  front: {
    slot: "front",
    subjectAction:
      "Head centered and straight toward camera. No meaningful yaw.",
    cameraSees: "Balanced frontal face — both ears/eyes naturally balanced.",
    nosePointsImageSide: "center",
    yawDegreesApprox: "0",
    bothEyesVisible: true,
    isFullProfile: false,
    hardConstraints: [
      "Near-zero yaw — head facing camera straight on.",
      "Both eyes and both ears naturally balanced.",
      "Nose points toward the CENTER of the final image.",
    ],
  },
  three_quarter_left: {
    slot: "three_quarter_left",
    subjectAction:
      "The SUBJECT turns HIS head approximately 35–45 degrees toward HIS LEFT shoulder.",
    cameraSees:
      "Camera sees more of the SUBJECT'S RIGHT side of the face. Both eyes still visible. NOT a full profile.",
    nosePointsImageSide: "left",
    yawDegreesApprox: "35-45",
    bothEyesVisible: true,
    isFullProfile: false,
    hardConstraints: [
      "SUBJECT turns toward HIS LEFT shoulder (subject perspective).",
      "His nose points toward the LEFT side of the final image.",
      "Camera sees more of the SUBJECT'S RIGHT facial side.",
      "Both eyes still visible — NOT a full profile.",
      "Do not mirror. Do not reverse left and right.",
    ],
  },
  three_quarter_right: {
    slot: "three_quarter_right",
    subjectAction:
      "The SUBJECT turns HIS head approximately 35–45 degrees toward HIS RIGHT shoulder.",
    cameraSees:
      "Camera sees more of the SUBJECT'S LEFT side of the face. Both eyes still visible. NOT a full profile.",
    nosePointsImageSide: "right",
    yawDegreesApprox: "35-45",
    bothEyesVisible: true,
    isFullProfile: false,
    hardConstraints: [
      "SUBJECT turns toward HIS RIGHT shoulder (subject perspective).",
      "His nose points toward the RIGHT side of the final image.",
      "Camera sees more of the SUBJECT'S LEFT facial side.",
      "Both eyes still visible — NOT a full profile.",
      "Do not mirror. Do not reverse left and right.",
    ],
  },
  left_profile: {
    slot: "left_profile",
    subjectAction:
      "The SUBJECT turns 90 degrees toward HIS LEFT shoulder.",
    cameraSees:
      "Camera primarily sees the SUBJECT'S RIGHT facial side. True profile.",
    nosePointsImageSide: "left",
    yawDegreesApprox: "90",
    bothEyesVisible: false,
    isFullProfile: true,
    hardConstraints: [
      "SUBJECT turns 90° toward HIS LEFT shoulder (subject perspective).",
      "His nose points toward the LEFT side of the final image.",
      "Camera primarily sees the SUBJECT'S RIGHT facial side.",
      "True profile — not three-quarter.",
      "Do not mirror. Do not reverse left and right.",
    ],
  },
  right_profile: {
    slot: "right_profile",
    subjectAction:
      "The SUBJECT turns 90 degrees toward HIS RIGHT shoulder.",
    cameraSees:
      "Camera primarily sees the SUBJECT'S LEFT facial side. True profile.",
    nosePointsImageSide: "right",
    yawDegreesApprox: "90",
    bothEyesVisible: false,
    isFullProfile: true,
    hardConstraints: [
      "SUBJECT turns 90° toward HIS RIGHT shoulder (subject perspective).",
      "His nose points toward the RIGHT side of the final image.",
      "Camera primarily sees the SUBJECT'S LEFT facial side.",
      "True profile — not three-quarter.",
      "Do not mirror. Do not reverse left and right.",
    ],
  },
};

export function getCanonicalCameraDirection(
  slot: ReferencePackageSlot,
): CanonicalCameraDirection {
  return CANONICAL_CAMERA_DIRECTIONS[slot];
}
