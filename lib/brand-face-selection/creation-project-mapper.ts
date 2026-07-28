/**
 * Map a Brand Archetype (+ Identity DNA) into a Persona Creation Project input.
 *
 * Users do not edit face/body/hair/fashion for official Milaene Brand Faces —
 * those fields come exclusively from Brand Archetype Intelligence / Identity DNA,
 * with wardrobe direction reinforced by Brand Memory + Product Intelligence prompts
 * at generation time.
 */

import {
  getIdentityDnaForArchetype,
  loadBrandArchetypeCatalog,
  type BrandArchetype,
  type IdentityDna,
} from "@/lib/brand-archetypes";
import { loadBrandMemory } from "@/lib/brand-memory";
import type {
  BrandRole,
  CreateCreationProjectInput,
  ProviderMode,
  QualityMode,
} from "@/lib/persona/domain/creation-types";
import { BrandFaceSelectionError } from "./constants";
import { targetRoleForArchetype } from "./selection-project";
import { A1_DISCOVERY_CANDIDATE_COUNT } from "./types";

const BRAND_ROLE_BY_ARCHETYPE_SLUG: Record<string, BrandRole> = {
  "mediterranean-premium-hero": "primary_male",
  "urban-community-hero": "secondary_male",
  "female-lifestyle-hero": "primary_female",
};

/** Stable marker embedded in project description for round-trip lookup. */
export const ARCHETYPE_PROJECT_MARKER = "official_brand_face_archetype:";

export function brandRoleForArchetypeSlug(slug: string): BrandRole {
  const role = BRAND_ROLE_BY_ARCHETYPE_SLUG[slug];
  if (!role) {
    throw new BrandFaceSelectionError(
      `No Brand Role mapping for archetype slug "${slug}"`,
      "CONFIG",
    );
  }
  return role;
}

export function parseArchetypeIdFromProjectDescription(
  description: string | null | undefined,
): string | null {
  if (!description) return null;
  const match = description.match(
    new RegExp(`${ARCHETYPE_PROJECT_MARKER}([a-z0-9-]+)`, "i"),
  );
  return match?.[1] ?? null;
}

export function creationProjectInputFromArchetype(input: {
  archetype: BrandArchetype;
  dna: IdentityDna;
  workspaceId?: string;
  providerMode?: ProviderMode;
  qualityMode?: QualityMode;
}): CreateCreationProjectInput {
  const { archetype, dna } = input;
  const brandRole = brandRoleForArchetypeSlug(archetype.slug);
  const targetRole = targetRoleForArchetype(archetype);
  const memory = loadBrandMemory(input.workspaceId ?? archetype.workspaceId);

  const height =
    archetype.genderPresentation.toLowerCase().startsWith("female")
      ? "165-175 cm"
      : "175-187 cm";

  const wardrobeFromMemory = [
    ...memory.fit.labels.slice(0, 2),
    ...memory.fit.silhouettes.slice(0, 2),
    ...memory.wardrobeBasics.slice(0, 3),
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    name: `Brand Face · ${archetype.name}`,
    description: [
      `Official Milaene Brand Face Selection for ${archetype.name}.`,
      `Traits are locked to Brand Archetype Intelligence + Identity DNA — not user-edited.`,
      `${ARCHETYPE_PROJECT_MARKER}${archetype.id}`,
      `target_role:${targetRole}`,
      `identity_dna:${dna.fingerprint}`,
    ].join(" "),
    gender_presentation: archetype.genderPresentation,
    age_range: archetype.ageRange,
    height_range: height,
    body_type: archetype.bodyDirection,
    skin_tone_direction: [
      archetype.ethnicityDirection,
      dna.appearance.skinToneFamily,
    ].join(" — "),
    face_shape_direction: [
      archetype.faceDirection,
      dna.appearance.faceGeometryFamily,
    ].join(" — "),
    hair_direction: [archetype.hairDirection, dna.appearance.hairFamily].join(
      " — ",
    ),
    facial_hair_direction: [
      archetype.groomingDirection,
      dna.appearance.beardFamily,
    ].join(" — "),
    eye_direction: dna.appearance.eyeFeeling,
    expression_direction: [
      dna.photography.expressionFamily,
      archetype.personality,
    ].join(" — "),
    personality: [archetype.personality, archetype.socialEnergy].join(" — "),
    fashion_style: [
      archetype.wardrobeDirection,
      dna.lifestyle.fashionDirection,
    ].join(" — "),
    brand_role: brandRole,
    visual_keywords: [
      archetype.commercialRole,
      archetype.campaignRole,
      archetype.bestPlatforms.join(", "),
      ...archetype.purpose,
    ].join(" · "),
    excluded_features: archetype.avoid.join(", "),
    preferred_brand_looks: `${memory.brandName} · ${archetype.commercialRole}`,
    preferred_outfits:
      wardrobeFromMemory ||
      archetype.wardrobeDirection ||
      dna.lifestyle.fashionDirection,
    intended_usage: "image_and_video",
    candidate_count: A1_DISCOVERY_CANDIDATE_COUNT,
    provider_mode: input.providerMode ?? "image_provider",
    quality_mode: input.qualityMode ?? "premium_editorial",
    additional_description: [
      "SOURCE_OF_TRUTH: Brand Memory + Brand Archetype Intelligence + Product Intelligence + Reference Intelligence.",
      "Do not invent face, body, hair, or fashion traits outside Identity DNA and archetype direction.",
      `Photography: ${archetype.photographyDirection}`,
      `Camera: ${archetype.cameraDirection}`,
      `Lighting: ${archetype.lightingDirection}`,
    ].join(" "),
  };
}

export function creationProjectInputForArchetypeId(
  archetypeId: string,
  workspaceId?: string,
  opts?: {
    providerMode?: ProviderMode;
    qualityMode?: QualityMode;
  },
): CreateCreationProjectInput {
  const catalog = loadBrandArchetypeCatalog(workspaceId);
  const archetype = catalog.archetypes.find((a) => a.id === archetypeId);
  if (!archetype) {
    throw new BrandFaceSelectionError(
      `Brand Archetype not found: ${archetypeId}`,
      "NOT_FOUND",
    );
  }
  const dna = getIdentityDnaForArchetype(catalog, archetype);
  return creationProjectInputFromArchetype({
    archetype,
    dna,
    workspaceId,
    providerMode: opts?.providerMode,
    qualityMode: opts?.qualityMode,
  });
}
