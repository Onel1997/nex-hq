/**
 * Neutral identity-reference photography prompts per Stage B angle.
 * Phase 2.3D.3 — subject-perspective direction hard lock.
 */

import {
  CAMERA_DIRECTION_POLICY_VERSION,
  getCanonicalCameraDirection,
} from "./camera-direction";
import type { ReferencePackageSlot } from "./slots";
import { REFERENCE_PACKAGE_SLOT_LABELS } from "./slots";

const IDENTITY_LOCK = [
  "SAME PERSON as the Master Identity Reference image — change camera/head angle only.",
  "Preserve eyes, nose, lips, jaw/chin, ears, eyebrows, skin tone, hairline, hairstyle, beard/stubble, apparent age.",
  "No beautification. No identity reinterpretation.",
  "Neutral identity-reference photography only — not a campaign image.",
  "Plain neutral background. Soft even studio or daylight. Realistic skin texture. Neutral expression.",
  "Simple dark or neutral T-shirt. Head and upper shoulders clearly visible.",
  "No dramatic shadows, no cinematic grade, no editorial posing, no accessories that obscure facial landmarks.",
].join(" ");

const DIRECTION_HARD_LOCK = [
  "DIRECTION IS A HARD CONSTRAINT.",
  "Do not mirror the requested direction.",
  "Do not reverse left and right.",
  "Do not invent another pose.",
  `All left/right terms are FROM THE SUBJECT'S PERSPECTIVE (${CAMERA_DIRECTION_POLICY_VERSION}).`,
].join(" ");

export function buildReferencePackageAnglePrompt(
  slot: ReferencePackageSlot,
): string {
  const dir = getCanonicalCameraDirection(slot);
  return [
    `Generate a technical identity reference photo of the SAME PERSON shown in the input image.`,
    `Target slot: ${REFERENCE_PACKAGE_SLOT_LABELS[slot]} (${slot}).`,
    DIRECTION_HARD_LOCK,
    `Subject action: ${dir.subjectAction}`,
    `Camera sees: ${dir.cameraSees}`,
    `Nose direction in final image: points toward the ${dir.nosePointsImageSide.toUpperCase()} of the final image.`,
    `Approximate yaw: ${dir.yawDegreesApprox} degrees.`,
    ...dir.hardConstraints,
    IDENTITY_LOCK,
    `Output: single photorealistic head-and-shoulders identity reference for slot ${slot} only.`,
  ].join(" ");
}
