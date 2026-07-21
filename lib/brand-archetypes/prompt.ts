import type { BrandArchetype, IdentityDna } from "./types";

export function formatIdentityDnaPrompt(
  archetype: BrandArchetype,
  dna: IdentityDna,
): string {
  return [
    `1. IDENTITY DNA — ${archetype.name} (${archetype.slug})`,
    `Official Brand Archetype. Permanent Identity DNA v${dna.version}.`,
    `Commercial role: ${archetype.commercialRole}.`,
    `Gender presentation: ${archetype.genderPresentation}. Age feel: ${archetype.ageRange}.`,
    `Ethnicity direction: ${archetype.ethnicityDirection}.`,
    "",
    "APPEARANCE",
    `Face geometry family: ${dna.appearance.faceGeometryFamily}.`,
    `Proportions: ${dna.appearance.proportions}.`,
    `Eyes: ${dna.appearance.eyeFeeling}.`,
    `Nose family: ${dna.appearance.noseFamily}.`,
    `Lips: ${dna.appearance.lips}.`,
    `Jaw family: ${dna.appearance.jawFamily}.`,
    `Beard family: ${dna.appearance.beardFamily}.`,
    `Skin tone family: ${dna.appearance.skinToneFamily}.`,
    `Hair family: ${dna.appearance.hairFamily}.`,
    "",
    "PRESENCE",
    `Confidence: ${dna.presence.confidence}.`,
    `Approachability: ${dna.presence.approachability}.`,
    `Calmness: ${dna.presence.calmness}.`,
    `Community: ${dna.presence.communityFeeling}.`,
    `Luxury feeling: ${dna.presence.luxuryFeeling}.`,
    `Authenticity: ${dna.presence.authenticity}.`,
    `Social energy: ${dna.presence.socialEnergy}.`,
    "",
    "MOVEMENT",
    `Posture: ${dna.movement.posture}.`,
    `Shoulders: ${dna.movement.shoulderPosition}.`,
    `Asymmetry: ${dna.movement.naturalAsymmetry}.`,
    `Body energy: ${dna.movement.bodyEnergy}.`,
    "",
    "PHOTOGRAPHY",
    `Framing: ${dna.photography.framingPreference}.`,
    `Camera energy: ${dna.photography.cameraEnergy}.`,
    `Expression family: ${dna.photography.expressionFamily}.`,
    `Editorial restraint: ${dna.photography.editorialRestraint}.`,
    "",
    "LIFESTYLE",
    `Fashion: ${dna.lifestyle.fashionDirection}.`,
    `Social behavior: ${dna.lifestyle.socialBehavior}.`,
    `Community role: ${dna.lifestyle.communityRole}.`,
    `Campaign role: ${dna.lifestyle.campaignRole}.`,
    "",
    "Never produce corporate authority energy, intimidation, or overstyled glam casting.",
    "Lock this Identity DNA across all Stage A angles for this archetype.",
    "Do not invent a different person or drift identity between frames.",
  ].join("\n");
}

export function formatArchetypeAppearancePrompt(dna: IdentityDna): string {
  return [
    "2. AUTHENTIC HUMAN APPEARANCE (Identity DNA)",
    `Skin: ${dna.appearance.skinToneFamily}.`,
    "Allow visible but subtle skin texture, natural pores, slight under-eye detail, minor asymmetry.",
    "Photoreal adult human — not porcelain beauty skin, not plastic AI finish.",
    "Still groomed, premium, and commercially usable.",
  ].join("\n");
}

export function formatArchetypePresencePrompt(dna: IdentityDna): string {
  return [
    "3. CALM / FRIENDLY COMMERCIAL PRESENCE (Identity DNA)",
    `Expression family: ${dna.photography.expressionFamily}.`,
    `Posture: ${dna.movement.posture}.`,
    `Social energy: ${dna.presence.socialEnergy}.`,
    `Approachability: ${dna.presence.approachability}.`,
    `Authenticity: ${dna.presence.authenticity}.`,
    "Relaxed confidence. Approachable. Quiet self-assurance.",
    "No angry eyes, no tough-guy stare, no hostile energy, no gangster styling.",
  ].join("\n");
}

export function formatArchetypeDirectionPrompt(
  archetype: BrandArchetype,
): string {
  return [
    `ARCHETYPE DIRECTION — ${archetype.name}`,
    `Purpose: ${archetype.purpose.join(", ")}.`,
    `Best platforms: ${archetype.bestPlatforms.join(", ")}.`,
    `Campaign role: ${archetype.campaignRole}.`,
    `Wardrobe direction: ${archetype.wardrobeDirection}.`,
    `Photography: ${archetype.photographyDirection}.`,
    `Strengths: ${archetype.strengths.join("; ")}.`,
  ].join("\n");
}

export function formatArchetypeCatalogPrompt(
  archetypes: BrandArchetype[],
): string {
  const lines = archetypes.map(
    (a) =>
      `- ${a.name} [${a.slug}] role=${a.commercialRole} platforms=${a.bestPlatforms.join("/")}`,
  );
  return ["## BRAND ARCHETYPES", "", ...lines].join("\n");
}
