/**
 * Phase 2.3D.8 — Profile-specific identity preservation for Stage B.
 *
 * Activates ONLY for left_profile / right_profile.
 * Does not change Front or Three-quarter prompts.
 * Does not change identity thresholds or evaluators.
 */

import type { ReferencePackageSlot } from "./slots";

export const PROFILE_IDENTITY_MODE =
  "profile_identity_preservation_v1" as const;

export type ProfileIdentityMode = typeof PROFILE_IDENTITY_MODE;

export const PROFILE_PROMPT_VERSION =
  "profile-identity-preservation-v1.0.0" as const;

export function isProfileIdentitySlot(
  slot: ReferencePackageSlot,
): slot is "left_profile" | "right_profile" {
  return slot === "left_profile" || slot === "right_profile";
}

export function resolveProfileIdentityMeta(slot: ReferencePackageSlot): {
  profile_identity_mode: ProfileIdentityMode | null;
  profile_prompt_version: string | null;
} {
  if (!isProfileIdentitySlot(slot)) {
    return {
      profile_identity_mode: null,
      profile_prompt_version: null,
    };
  }
  return {
    profile_identity_mode: PROFILE_IDENTITY_MODE,
    profile_prompt_version: PROFILE_PROMPT_VERSION,
  };
}

/** Identity-critical opener — must lead the profile prompt. */
export const PROFILE_IDENTITY_FIRST_OPENER = [
  "IDENTITY-CRITICAL REFERENCE EDIT.",
  "This is the exact same real person shown in the Master Identity Reference.",
  "Do not redesign, reinterpret, beautify, age, masculinize, soften, idealize or reconstruct his face.",
  "The task is ONLY to rotate the same head into the requested side-profile orientation.",
].join(" ");

export const PROFILE_HARD_IDENTITY_ANCHORS = [
  "Preserve exact forehead shape.",
  "Preserve exact hairline position and shape.",
  "Preserve exact eyebrow thickness, arch, and spacing.",
  "Preserve exact eye placement.",
  "Preserve exact nose bridge.",
  "Preserve exact nose length.",
  "Preserve exact nose tip projection.",
  "Preserve exact nostril structure.",
  "Preserve exact philtrum.",
  "Preserve exact upper and lower lip proportions.",
  "Preserve exact chin projection.",
  "Preserve exact jaw depth.",
  "Preserve exact ear size, position, and attachment.",
  "Preserve exact cheek structure.",
  "Preserve exact beard/stubble distribution.",
  "Preserve exact skin tone.",
  "Preserve exact apparent age.",
  "Preserve exact hairstyle.",
  "Do not create a plausible side profile of this person.",
  "Infer the side profile conservatively from the Master.",
  "When uncertain, preserve existing anatomy rather than inventing new anatomy.",
].join(" ");

export const PROFILE_DRIFT_NEGATIVES = [
  "Avoid: different nose, longer nose, shorter nose, hooked nose unless present in Master.",
  "Avoid: larger chin, smaller chin, stronger jaw, weaker jaw.",
  "Avoid: different forehead slope, changed ear, changed hairline, changed beard.",
  "Avoid: changed ethnicity, older face, more masculine face.",
  "Avoid: fashion-model reinterpretation, reconstructed identity, generic Mediterranean male, different person.",
  "No face enhancement.",
].join(" ");

export const PROFILE_PHOTOGRAPHY_SIMPLE = [
  "Neutral studio/reference photograph only — Stage B identity documentation, not campaign photography.",
  "Same washed dark T-shirt if practical.",
  "Plain light neutral background.",
  "Soft even daylight or studio light.",
  "Head-and-shoulders framing.",
  "Neutral expression.",
  "No dramatic shadows, no cinematic look, no fashion campaign styling.",
].join(" ");

/** Language that must NOT appear in profile prompts (casting / archetype / brand). */
export const PROFILE_FORBIDDEN_CASTING_MARKERS = [
  "brand personality",
  "archetype",
  "casting direction",
  "streetwear casting",
  "handsome",
  "attractive",
  "campaign hero",
  "beautify for campaign",
] as const;
