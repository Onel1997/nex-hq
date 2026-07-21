/**
 * Hard candidate identity diversity audit for Milaene Stage-A casting.
 * Fails when profiles share critical biological / styling keys.
 */

import {
  CANDIDATE_VARIATION_PROFILES,
  type CandidateVariationProfile,
} from "./variations";

export interface IdentityDiversityViolation {
  code: string;
  message: string;
  candidateIds: string[];
}

export interface IdentityDiversityAudit {
  ok: boolean;
  violations: IdentityDiversityViolation[];
  profileCount: number;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function hairCombo(profile: CandidateVariationProfile): string {
  return `${normalizeKey(profile.hairTexture)}|${normalizeKey(profile.haircut)}`;
}

function jawNoseEyeCombo(profile: CandidateVariationProfile): string {
  return [
    normalizeKey(profile.jawShape),
    normalizeKey(profile.noseShape),
    normalizeKey(profile.eyeShape),
  ].join("|");
}

function skinToneGroup(profile: CandidateVariationProfile): string {
  const t = normalizeKey(profile.skinTone);
  if (
    t.includes("deep brown") ||
    t.includes("dark skin") ||
    t.includes("rich deep") ||
    t.includes("afro")
  ) {
    return "deep_dark";
  }
  if (t.includes("medium brown") || (t.includes("warm medium") && t.includes("brown"))) {
    return "medium_brown";
  }
  if (t.includes("medium olive") || t.includes("medium olive to medium brown")) {
    return "medium_olive";
  }
  if (t.includes("light-medium olive") || t.includes("light medium olive")) {
    return "light_medium_olive";
  }
  if (t.includes("olive")) return "olive_other";
  return `other:${t.slice(0, 48)}`;
}

/**
 * Compare candidate identity profiles and collect critical overlap violations.
 */
export function auditCandidateIdentityDiversity(
  profiles: readonly CandidateVariationProfile[] = CANDIDATE_VARIATION_PROFILES,
): IdentityDiversityAudit {
  const violations: IdentityDiversityViolation[] = [];

  if (profiles.length < 2) {
    return { ok: true, violations: [], profileCount: profiles.length };
  }

  const seenDescriptors = new Map<string, string>();
  const seenGeometry = new Map<string, string>();
  const seenSkin = new Map<string, string>();
  const seenHair = new Map<string, string>();
  const seenCombo = new Map<string, string>();

  for (const profile of profiles) {
    const id = profile.id;

    const descriptor = normalizeKey(profile.identityDescriptor);
    if (seenDescriptors.has(descriptor)) {
      violations.push({
        code: "duplicate_identity_descriptor",
        message: `Identical identityDescriptor shared by ${seenDescriptors.get(descriptor)} and ${id}`,
        candidateIds: [seenDescriptors.get(descriptor)!, id],
      });
    } else {
      seenDescriptors.set(descriptor, id);
    }

    const geometry = normalizeKey(profile.faceGeometry);
    if (seenGeometry.has(geometry)) {
      violations.push({
        code: "duplicate_face_geometry",
        message: `Identical faceGeometry shared by ${seenGeometry.get(geometry)} and ${id}`,
        candidateIds: [seenGeometry.get(geometry)!, id],
      });
    } else {
      seenGeometry.set(geometry, id);
    }

    const skin = normalizeKey(profile.skinTone);
    if (seenSkin.has(skin)) {
      violations.push({
        code: "duplicate_skin_tone",
        message: `Identical skinTone shared by ${seenSkin.get(skin)} and ${id}`,
        candidateIds: [seenSkin.get(skin)!, id],
      });
    } else {
      seenSkin.set(skin, id);
    }

    const hair = hairCombo(profile);
    if (seenHair.has(hair)) {
      violations.push({
        code: "duplicate_hair_combo",
        message: `Identical hairTexture+haircut shared by ${seenHair.get(hair)} and ${id}`,
        candidateIds: [seenHair.get(hair)!, id],
      });
    } else {
      seenHair.set(hair, id);
    }

    const combo = jawNoseEyeCombo(profile);
    if (seenCombo.has(combo)) {
      violations.push({
        code: "duplicate_jaw_nose_eye",
        message: `Identical jaw/nose/eye combination shared by ${seenCombo.get(combo)} and ${id}`,
        candidateIds: [seenCombo.get(combo)!, id],
      });
    } else {
      seenCombo.set(combo, id);
    }
  }

  // Candidate 4 must not read as Candidate 1 with only darker skin.
  const c1 = profiles.find((p) => p.id === "relaxed_mediterranean");
  const c4 = profiles.find((p) => p.id === "weekend_community");
  if (c1 && c4) {
    const geometryClose =
      normalizeKey(c1.faceGeometry) === normalizeKey(c4.faceGeometry) ||
      normalizeKey(c1.jawShape) === normalizeKey(c4.jawShape);
    const hairClose = hairCombo(c1) === hairCombo(c4);
    const bodyClose = normalizeKey(c1.bodyBuild) === normalizeKey(c4.bodyBuild);
    if (geometryClose || hairClose) {
      violations.push({
        code: "candidate4_not_recolored_candidate1",
        message:
          "Weekend Community must not reuse Relaxed Mediterranean face geometry or hair — dark skin alone is not diversity",
        candidateIds: [c1.id, c4.id],
      });
    }
    if (geometryClose && bodyClose) {
      violations.push({
        code: "candidate4_body_geometry_clone",
        message: "Weekend Community shares too much geometry/body with Relaxed Mediterranean",
        candidateIds: [c1.id, c4.id],
      });
    }
  }

  const toneGroups = new Set(profiles.map(skinToneGroup));
  if (profiles.length >= 4 && toneGroups.size < 3) {
    violations.push({
      code: "insufficient_skin_tone_groups",
      message: `Expected at least 3 distinct skin-tone groups across 4 candidates, found ${toneGroups.size}`,
      candidateIds: profiles.map((p) => p.id),
    });
  }

  return {
    ok: violations.length === 0,
    violations,
    profileCount: profiles.length,
  };
}

/**
 * Assert candidate identity diversity — throws AssertionError-style Error on failure.
 */
export function assertCandidateIdentityDiversity(
  profiles: readonly CandidateVariationProfile[] = CANDIDATE_VARIATION_PROFILES,
): void {
  const audit = auditCandidateIdentityDiversity(profiles);
  if (audit.ok) return;
  const detail = audit.violations
    .map((v) => `[${v.code}] ${v.message}`)
    .join("\n");
  throw new Error(`Candidate identity diversity failed:\n${detail}`);
}
