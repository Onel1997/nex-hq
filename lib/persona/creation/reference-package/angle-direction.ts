/**
 * Phase 2.3D.3 / 2.3D.6 — Angle direction validation.
 *
 * 2.3D.3: prompt marker lock (still required).
 * 2.3D.6: real post-generation orientation from facial landmarks.
 */

import {
  CAMERA_DIRECTION_POLICY_VERSION,
  getCanonicalCameraDirection,
} from "./camera-direction";
import type { ReferencePackageSlot } from "./slots";
import type {
  DetectedOrientation,
  OrientationEstimate,
} from "./orientation-from-landmarks";

export const ANGLE_DIRECTIONS = [
  "correct",
  "incorrect",
  "uncertain",
] as const;

export type AngleDirection = (typeof ANGLE_DIRECTIONS)[number];

export const ANGLE_IMAGE_VALIDATION_VERSION =
  "angle-image-orientation-v1.0.0" as const;

export type AngleDirectionValidation = {
  policyVersion: typeof CAMERA_DIRECTION_POLICY_VERSION;
  imageValidationVersion: typeof ANGLE_IMAGE_VALIDATION_VERSION;
  slot: ReferencePackageSlot;
  angle_direction: AngleDirection;
  reason: string;
  requiredPromptMarkers: string[];
  missingPromptMarkers: string[];
  detected_orientation: DetectedOrientation | null;
  detected_yaw_degrees: number | null;
};

function requiredMarkersForSlot(slot: ReferencePackageSlot): string[] {
  const dir = getCanonicalCameraDirection(slot);
  const markers: string[] = [
    "DIRECTION IS A HARD CONSTRAINT",
    "Do not mirror",
    "Do not reverse left and right",
  ];
  if (slot === "front") {
    markers.push("Near-zero yaw", "CENTER of the final image");
  } else if (dir.nosePointsImageSide === "left") {
    markers.push("LEFT side of the final image");
  } else if (dir.nosePointsImageSide === "right") {
    markers.push("RIGHT side of the final image");
  }
  if (slot === "three_quarter_left") {
    markers.push("LEFT shoulder", "RIGHT side of the face");
  }
  if (slot === "three_quarter_right") {
    markers.push("RIGHT shoulder", "LEFT side of the face");
  }
  if (slot === "left_profile") {
    markers.push("90", "LEFT shoulder", "RIGHT facial side");
  }
  if (slot === "right_profile") {
    markers.push("90", "RIGHT shoulder", "LEFT facial side");
  }
  return markers;
}

/**
 * Prompt-lock only (pre-image). Missing markers → incorrect.
 * Locked prompt alone never claims "correct" (pixels not inspected).
 */
export function validateAngleDirectionFromPrompt(input: {
  slot: ReferencePackageSlot;
  prompt: string;
}): AngleDirectionValidation {
  const requiredPromptMarkers = requiredMarkersForSlot(input.slot);
  const prompt = input.prompt ?? "";
  const missingPromptMarkers = requiredPromptMarkers.filter(
    (m) => !prompt.includes(m),
  );

  if (missingPromptMarkers.length > 0) {
    return {
      policyVersion: CAMERA_DIRECTION_POLICY_VERSION,
      imageValidationVersion: ANGLE_IMAGE_VALIDATION_VERSION,
      slot: input.slot,
      angle_direction: "incorrect",
      reason:
        "Generation prompt missing hard direction lock markers — refusing to treat angle as usable.",
      requiredPromptMarkers,
      missingPromptMarkers,
      detected_orientation: null,
      detected_yaw_degrees: null,
    };
  }

  return {
    policyVersion: CAMERA_DIRECTION_POLICY_VERSION,
    imageValidationVersion: ANGLE_IMAGE_VALIDATION_VERSION,
    slot: input.slot,
    angle_direction: "uncertain",
    reason:
      "Prompt direction lock present; awaiting real image orientation validation.",
    requiredPromptMarkers,
    missingPromptMarkers: [],
    detected_orientation: null,
    detected_yaw_degrees: null,
  };
}

/**
 * Compare detected image orientation to the requested Stage B slot.
 * Fail closed: uncertain landmarks → uncertain (not usable for new gens).
 * Contradictory orientation → incorrect.
 */
export function validateAngleDirectionFromOrientation(input: {
  slot: ReferencePackageSlot;
  orientation: Pick<
    OrientationEstimate,
    "detected_orientation" | "detected_yaw_degrees" | "bothEyesVisible" | "reason"
  >;
  promptValidation?: AngleDirectionValidation;
}): AngleDirectionValidation {
  const promptBase =
    input.promptValidation ??
    validateAngleDirectionFromPrompt({
      slot: input.slot,
      prompt: [
        "DIRECTION IS A HARD CONSTRAINT",
        "Do not mirror",
        "Do not reverse left and right",
        "Near-zero yaw",
        "CENTER of the final image",
        "LEFT side of the final image",
        "RIGHT side of the final image",
        "LEFT shoulder",
        "RIGHT shoulder",
        "RIGHT side of the face",
        "LEFT side of the face",
        "90",
        "RIGHT facial side",
        "LEFT facial side",
      ].join(" "),
    });

  if (promptBase.angle_direction === "incorrect") {
    return {
      ...promptBase,
      detected_orientation: input.orientation.detected_orientation,
      detected_yaw_degrees: input.orientation.detected_yaw_degrees,
    };
  }

  const detected = input.orientation.detected_orientation;
  const yaw = input.orientation.detected_yaw_degrees;

  if (detected === "uncertain") {
    return {
      ...promptBase,
      angle_direction: "uncertain",
      reason: `Fail closed: landmarks/orientation uncertain. ${input.orientation.reason}`,
      detected_orientation: "uncertain",
      detected_yaw_degrees: yaw,
    };
  }

  const expected = expectedOrientationsForSlot(input.slot);
  const matches = expected.includes(detected);

  // Three-quarter requires both eyes visible when we claim correct.
  if (
    matches &&
    (input.slot === "three_quarter_left" ||
      input.slot === "three_quarter_right") &&
    !input.orientation.bothEyesVisible
  ) {
    return {
      ...promptBase,
      angle_direction: "incorrect",
      reason: `Wrong camera direction: ${input.slot} requires both eyes visible; landmarks suggest profile/occluded eye. Detected=${detected}.`,
      detected_orientation: detected,
      detected_yaw_degrees: yaw,
    };
  }

  if (!matches) {
    return {
      ...promptBase,
      angle_direction: "incorrect",
      reason: `Wrong camera direction: requested ${input.slot} expects ${expected.join("|")}, detected ${detected}${yaw != null ? ` (yaw≈${yaw}°)` : ""}.`,
      detected_orientation: detected,
      detected_yaw_degrees: yaw,
    };
  }

  return {
    ...promptBase,
    angle_direction: "correct",
    reason: `Image orientation matches ${input.slot}: detected ${detected}${yaw != null ? ` (yaw≈${yaw}°)` : ""}.`,
    detected_orientation: detected,
    detected_yaw_degrees: yaw,
  };
}

function expectedOrientationsForSlot(
  slot: ReferencePackageSlot,
): DetectedOrientation[] {
  switch (slot) {
    case "front":
      return ["frontal"];
    case "three_quarter_left":
      return ["image_left"];
    case "three_quarter_right":
      return ["image_right"];
    case "left_profile":
      return ["profile_left", "image_left"];
    case "right_profile":
      return ["profile_right", "image_right"];
  }
}

/**
 * Usable Stage B angle:
 * - correct → usable
 * - incorrect → never
 * - uncertain → fail closed for NEW image-validated attempts (not usable)
 *
 * Legacy rows with null angle_direction are handled by coverage separately.
 */
export function isAngleDirectionUsable(direction: AngleDirection): boolean {
  return direction === "correct";
}

/** Legacy: pre-image uncertain must not count as hard incorrect. */
export function isLegacyUncertainAngleTolerated(
  direction: AngleDirection | null | undefined,
): boolean {
  return direction === "uncertain" || direction == null;
}
