/**
 * L3 prompt formatter — casting-director identity brief (anatomy only).
 * Does not include Brand Memory, Product Intelligence, camera, lighting, or negatives.
 */

import type { DiscoveryIdentityInstance } from "./types";

const FORBIDDEN_PROMPT_PHRASES = [
  "lock this identity",
  "do not invent a different person",
  "keep identity requirements fixed",
  "brand memory",
  "product intelligence",
  "avoid:",
] as const;

/**
 * Format concrete L3 anatomy for a discovery identity instance.
 * Framed as an independent casting brief so each slot reads as a different real human.
 */
export function formatDiscoveryIdentityInstancePrompt(
  instance: DiscoveryIdentityInstance,
): string {
  const lines = [
    "DISCOVERY IDENTITY INSTANCE (L3)",
    "Generate a new individual inside this casting lane.",
    "This is a fresh person for this discovery run — not a locked Brand Face.",
    "Cast this person as a real professional model — not an AI fashion clone.",
    "Exact facial anatomy below is authoritative for THIS slot only.",
    "Do not borrow proportions, lighting face-shape habits, or styling from other slots.",
    "",
    `Slot: ${instance.slot}`,
    `Gender: ${instance.gender}`,
    `Regional cluster: ${instance.regionalCluster}`,
    `Exact age feel: ${instance.exactAge}`,
    "",
    "BIOLOGICAL IDENTITY (sampled for this run)",
    "Unique human for THIS slot only — never four brothers.",
    `Skin: ${instance.skinToneExact}.`,
    `Facial proportions: ${instance.facialRatioVariant}.`,
    `Face geometry: ${instance.faceGeometry}.`,
    `Forehead: ${instance.forehead}.`,
    `Eyebrows: ${instance.eyebrows}.`,
    `Eyes: ${instance.eyeShape}. Eye spacing: ${instance.eyeSpacing}.`,
    `Nose bridge: ${instance.noseBridge}. Nose width: ${instance.noseWidth}. Nose tip: ${instance.noseTip}.`,
    `Jaw: ${instance.jaw}. Chin: ${instance.chin}.`,
    `Cheekbones: ${instance.cheekbones}.`,
    `Lips: ${instance.lips}.`,
    `Ears: ${instance.ears}.`,
    `Hairline: ${instance.hairline}.`,
    `Haircut: ${instance.haircut}.`,
    `Facial hair pattern: ${instance.beardPattern}.`,
    `Micro-expression: ${instance.microExpression}.`,
    `Natural asymmetry (required): ${instance.asymmetry}.`,
    `Optional micro-marks: ${instance.optionalMicroMarks}.`,
    "",
    "REALISM NOTES FOR THIS PERSON",
    "Render real unretouched human skin on this exact face — visible natural pores and subtle pigmentation variation.",
    "Keep the stated asymmetry visible, including slight eye asymmetry. Keep ears, lips, under-eye texture, and hairline photographically real.",
    "Render individual imperfect hair strands. If facial hair is present, keep density slightly uneven — never stamped CGI.",
    "If optional micro-marks are present, keep them subtle and believable.",
    "Do not beautify, symmetrize, airbrush, or polish this person into an Instagram AI / Midjourney fashion model.",
    "",
    "CASTING SUPPORT (non-anatomy, instance-scoped)",
    `Garment color direction: ${instance.garmentColor}.`,
    `Casting background: ${instance.castingBackground}.`,
    "",
    `Identity fingerprint: ${instance.identityFingerprint}`,
    `Anatomy fingerprint: ${instance.anatomyFingerprint}`,
    `Sampling seed: ${instance.samplingSeed}`,
    `Attempt: ${instance.attemptNumber}`,
  ];

  const text = lines.join("\n");
  for (const phrase of FORBIDDEN_PROMPT_PHRASES) {
    if (text.toLowerCase().includes(phrase)) {
      // Defensive: sampled attribute text must not inject lock wording.
      throw new Error(
        `Discovery identity prompt unexpectedly contains forbidden phrase: ${phrase}`,
      );
    }
  }
  return text;
}

export function discoveryIdentityPromptContainsNewIndividualWording(
  text: string,
): boolean {
  return /Generate a new individual inside this casting lane\./i.test(text);
}

export function discoveryIdentityPromptContainsIdentityLockWording(
  text: string,
): boolean {
  return (
    /lock this identity/i.test(text) ||
    /do not invent a different person/i.test(text) ||
    /keep identity requirements fixed/i.test(text)
  );
}
