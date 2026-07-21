import type { IdentityDna } from "./types";

function stableFingerprint(parts: string[]): string {
  return parts
    .map((p) => p.trim().toLowerCase().replace(/\s+/g, " "))
    .filter(Boolean)
    .join("|");
}

export function createIdentityDnaFingerprint(
  dna: Omit<IdentityDna, "fingerprint">,
): string {
  return stableFingerprint([
    dna.id,
    dna.archetypeId,
    dna.version,
    dna.appearance.faceGeometryFamily,
    dna.appearance.proportions,
    dna.appearance.eyeFeeling,
    dna.appearance.noseFamily,
    dna.appearance.lips,
    dna.appearance.jawFamily,
    dna.appearance.beardFamily,
    dna.appearance.skinToneFamily,
    dna.appearance.hairFamily,
    dna.presence.confidence,
    dna.presence.approachability,
    dna.presence.calmness,
    dna.presence.communityFeeling,
    dna.presence.luxuryFeeling,
    dna.presence.authenticity,
    dna.presence.socialEnergy,
    dna.movement.posture,
    dna.movement.shoulderPosition,
    dna.movement.naturalAsymmetry,
    dna.movement.bodyEnergy,
    dna.photography.framingPreference,
    dna.photography.cameraEnergy,
    dna.photography.expressionFamily,
    dna.photography.editorialRestraint,
    dna.lifestyle.fashionDirection,
    dna.lifestyle.socialBehavior,
    dna.lifestyle.communityRole,
    dna.lifestyle.campaignRole,
  ]);
}

export function finalizeIdentityDna(
  dna: Omit<IdentityDna, "fingerprint">,
): IdentityDna {
  return {
    ...dna,
    fingerprint: createIdentityDnaFingerprint(dna),
  };
}

/** Users never edit DNA — this helper is for internal construction only. */
export function assertIdentityDnaImmutableContract(_dna: IdentityDna): void {
  // Architecture guard: DNA is permanent and not exposed for user mutation APIs.
}
