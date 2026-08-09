/**
 * Neutral identity-reference photography prompts per Stage B angle.
 * Phase 2.3D.3 — subject-perspective direction hard lock.
 * Phase 2.3D.7 — optional inverted provider-direction fallback (canonical slot unchanged).
 * Phase 2.3D.8 — profile-only identity-first preservation mode.
 */

import {
  CAMERA_DIRECTION_POLICY_VERSION,
  getCanonicalCameraDirection,
} from "./camera-direction";
import {
  isProfileIdentitySlot,
  PROFILE_DRIFT_NEGATIVES,
  PROFILE_FORBIDDEN_CASTING_MARKERS,
  PROFILE_HARD_IDENTITY_ANCHORS,
  PROFILE_IDENTITY_FIRST_OPENER,
  PROFILE_IDENTITY_MODE,
  PROFILE_PHOTOGRAPHY_SIMPLE,
  PROFILE_PROMPT_VERSION,
  resolveProfileIdentityMeta,
} from "./profile-identity-preservation";
import type { ProviderDirectionStrategy } from "./provider-direction-fallback";
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

export type BuildReferencePackageAnglePromptOptions = {
  /**
   * Direction instruction sent to the provider.
   * Defaults to the canonical slot. Under inverted_fallback this is the opposite L/R slot.
   */
  providerRequestedDirection?: ReferencePackageSlot;
  providerDirectionStrategy?: ProviderDirectionStrategy;
};

export type BuiltReferencePackageAnglePrompt = {
  prompt: string;
  profile_identity_mode: typeof PROFILE_IDENTITY_MODE | null;
  profile_prompt_version: string | null;
};

/**
 * Build Stage B angle prompt.
 * Identity-preservation block is never altered by inverted fallback.
 * Only the provider-facing direction instruction may use an inverted direction.
 * Canonical target slot label remains the requested_slot for auditability.
 *
 * Profile slots (left/right) use profile_identity_preservation_v1 — identity FIRST.
 * Front / three-quarter prompts remain the pre-2.3D.8 structure.
 */
export function buildReferencePackageAnglePrompt(
  slot: ReferencePackageSlot,
  options?: BuildReferencePackageAnglePromptOptions,
): string {
  return buildReferencePackageAnglePromptDetailed(slot, options).prompt;
}

export function buildReferencePackageAnglePromptDetailed(
  slot: ReferencePackageSlot,
  options?: BuildReferencePackageAnglePromptOptions,
): BuiltReferencePackageAnglePrompt {
  const strategy = options?.providerDirectionStrategy ?? "canonical";
  const providerDirection = options?.providerRequestedDirection ?? slot;
  const dir = getCanonicalCameraDirection(providerDirection);
  const profileMeta = resolveProfileIdentityMeta(slot);

  const strategyLine =
    strategy === "inverted_fallback"
      ? `Provider direction strategy: inverted_fallback. Provider requested direction: ${REFERENCE_PACKAGE_SLOT_LABELS[providerDirection]} (${providerDirection}). Canonical target slot remains ${REFERENCE_PACKAGE_SLOT_LABELS[slot]} (${slot}).`
      : `Provider direction strategy: canonical.`;

  if (isProfileIdentitySlot(slot)) {
    const prompt = [
      PROFILE_IDENTITY_FIRST_OPENER,
      `Profile identity mode: ${PROFILE_IDENTITY_MODE} (${PROFILE_PROMPT_VERSION}).`,
      `Master Identity Reference is the absolute identity source — the input image is that Master.`,
      PROFILE_HARD_IDENTITY_ANCHORS,
      PROFILE_DRIFT_NEGATIVES,
      `Target slot: ${REFERENCE_PACKAGE_SLOT_LABELS[slot]} (${slot}).`,
      strategyLine,
      DIRECTION_HARD_LOCK,
      `Subject action: ${dir.subjectAction}`,
      `Camera sees: ${dir.cameraSees}`,
      `Nose direction in final image: points toward the ${dir.nosePointsImageSide.toUpperCase()} of the final image.`,
      `Approximate yaw: ${dir.yawDegreesApprox} degrees.`,
      ...dir.hardConstraints,
      PROFILE_PHOTOGRAPHY_SIMPLE,
      `Output: single neutral head-and-shoulders identity-documentation profile for slot ${slot} only.`,
    ].join(" ");

    // Guard: profile prompts must not reintroduce casting/archetype language.
    for (const marker of PROFILE_FORBIDDEN_CASTING_MARKERS) {
      if (prompt.toLowerCase().includes(marker.toLowerCase())) {
        throw new Error(
          `FAIL CLOSED: profile prompt contains forbidden casting language: ${marker}`,
        );
      }
    }

    return {
      prompt,
      profile_identity_mode: profileMeta.profile_identity_mode,
      profile_prompt_version: profileMeta.profile_prompt_version,
    };
  }

  // Front / three-quarter — unchanged pre-2.3D.8 structure.
  const prompt = [
    `Generate a technical identity reference photo of the SAME PERSON shown in the input image.`,
    `Target slot: ${REFERENCE_PACKAGE_SLOT_LABELS[slot]} (${slot}).`,
    strategyLine,
    DIRECTION_HARD_LOCK,
    `Subject action: ${dir.subjectAction}`,
    `Camera sees: ${dir.cameraSees}`,
    `Nose direction in final image: points toward the ${dir.nosePointsImageSide.toUpperCase()} of the final image.`,
    `Approximate yaw: ${dir.yawDegreesApprox} degrees.`,
    ...dir.hardConstraints,
    IDENTITY_LOCK,
    `Output: single photorealistic head-and-shoulders identity reference for slot ${slot} only.`,
  ].join(" ");

  return {
    prompt,
    profile_identity_mode: null,
    profile_prompt_version: null,
  };
}
