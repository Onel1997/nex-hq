/**
 * Bridge Brand Archetype Identity DNA → legacy CandidateVariationProfile
 * so diversity / quality helpers keep working without random face recipes.
 */

import type { BrandArchetype, IdentityDna } from "@/lib/brand-archetypes";
import type { CandidateVariationProfile } from "./variations";

export function variationProfileFromArchetype(
  archetype: BrandArchetype,
  dna: IdentityDna,
): CandidateVariationProfile {
  const hairParts = dna.appearance.hairFamily;
  return {
    id: archetype.slug,
    label: archetype.name,
    style: archetype.slug.replace(/-/g, " "),
    identityDescriptor: `${archetype.name} — official Brand Archetype Identity DNA. ${archetype.personality}`,
    faceGeometry: dna.appearance.faceGeometryFamily,
    jawShape: dna.appearance.jawFamily,
    chinShape: dna.appearance.jawFamily,
    eyeShape: dna.appearance.eyeFeeling,
    eyeSpacing: "natural spacing from Identity DNA",
    noseShape: dna.appearance.noseFamily,
    lipShape: dna.appearance.lips,
    skinTone: dna.appearance.skinToneFamily,
    hairTexture: hairParts,
    haircut: hairParts,
    facialHair: dna.appearance.beardFamily,
    bodyBuild: dna.appearance.proportions,
    shoulderProfile: dna.movement.shoulderPosition,
    socialPresence: dna.presence.socialEnergy,
    stylingDirection: dna.lifestyle.fashionDirection,
    faceStructure: dna.appearance.faceGeometryFamily,
    jawline: dna.appearance.jawFamily,
    cheekbones: "natural cheek volume from Identity DNA",
    nose: dna.appearance.noseFamily,
    hair: hairParts,
    stubble: dna.appearance.beardFamily,
    body: dna.appearance.proportions,
    posture: dna.movement.posture,
    expression: dna.photography.expressionFamily,
    presence: dna.presence.socialEnergy,
    wardrobe: archetype.wardrobeDirection,
    lighting: archetype.lightingDirection,
    background: "controlled Stage A casting set — warm grey plaster wall, neutral quiet",
    aesthetic: `${archetype.name} Brand Archetype casting`,
    promptLines: [
      `Official archetype: ${archetype.name}.`,
      `Purpose: ${archetype.purpose.join(", ")}.`,
      `Campaign role: ${archetype.campaignRole}.`,
      "Never: corporate authority, intimidation, overstyled glam.",
    ],
  };
}
