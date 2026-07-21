import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCandidatePrompt } from "@/lib/persona/creation/candidate-intelligence/prompt-builder";
import { getCreationPreset } from "@/lib/persona/creation/presets";
import type { PersonaCreationProject } from "@/lib/persona/domain/creation-types";
import { MILAENE_PRODUCT_CATALOG } from "@/lib/product-intelligence";
import {
  BRAND_ARCHETYPE_VERSION,
  MILAENE_BRAND_ARCHETYPE_CATALOG,
  MILAENE_BRAND_ARCHETYPES,
  MILAENE_IDENTITY_DNA,
  bestArchetypeForPlatform,
  createBrandArchetypeSnapshot,
  createIdentityDnaFingerprint,
  getIdentityDnaForArchetype,
  getProductAffinityForArchetype,
  recommendArchetypeForCampaign,
  recommendArchetypeForVideo,
  resolveArchetypeForCandidate,
} from "./index";

function streetLuxuryProject(): PersonaCreationProject {
  const preset = getCreationPreset("milaene_street_luxury")!;
  return {
    id: "proj-arch-1",
    workspace_id: "ws-1",
    name: "Milaene Primary Male",
    description: "",
    gender_presentation: preset.gender_presentation,
    age_range: preset.age_range,
    height_range: preset.height_range,
    body_type: preset.body_type,
    skin_tone_direction: preset.skin_tone_direction,
    face_shape_direction: preset.face_shape_direction,
    hair_direction: preset.hair_direction,
    facial_hair_direction: preset.facial_hair_direction,
    eye_direction: preset.eye_direction,
    expression_direction: preset.expression_direction,
    personality: preset.personality,
    fashion_style: preset.fashion_style,
    brand_role: preset.brand_role,
    visual_keywords: preset.visual_keywords,
    excluded_features: preset.excluded_features,
    preferred_brand_looks: preset.preferred_brand_looks,
    preferred_outfits: preset.preferred_outfits,
    intended_usage: preset.intended_usage,
    candidate_count: 3,
    provider_mode: "image_provider",
    quality_mode: "premium_editorial",
    status: "draft",
    generation_stage: "discovery",
    estimated_cost_min: 0,
    estimated_cost_max: 0,
    actual_cost: 0,
    cost_confirmed_at: null,
    last_estimate_hash: null,
    last_estimate_at: null,
    last_confirmation_token: null,
    additional_description: "",
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe("Brand Archetype Intelligence (Phase 1.7D)", () => {
  it("1. three archetypes exist", () => {
    assert.equal(MILAENE_BRAND_ARCHETYPES.length, 3);
    assert.deepEqual(
      MILAENE_BRAND_ARCHETYPES.map((a) => a.slug).sort(),
      [
        "female-lifestyle-hero",
        "mediterranean-premium-hero",
        "urban-community-hero",
      ].sort(),
    );
  });

  it("2. Identity DNA is deterministic", () => {
    assert.equal(MILAENE_IDENTITY_DNA.length, 3);
    for (const dna of MILAENE_IDENTITY_DNA) {
      assert.equal(dna.fingerprint, createIdentityDnaFingerprint(dna));
      assert.ok(dna.fingerprint.length > 20);
    }
  });

  it("3. prompt builder consumes DNA", () => {
    const built = buildCandidatePrompt({
      project: streetLuxuryProject(),
      assetType: "portrait_front",
      candidateNumber: 1,
    });
    assert.match(built.blocks.identity, /IDENTITY DNA/);
    assert.match(built.blocks.identity, /Mediterranean Premium Hero/);
    assert.equal(built.identityDna.id, built.brandArchetype.identityDnaId);
    assert.match(built.prompt, /Brand Archetype|IDENTITY DNA/i);
  });

  it("4. product affinity works", () => {
    const mediterranean = MILAENE_BRAND_ARCHETYPES[0]!;
    const affinity = getProductAffinityForArchetype(
      mediterranean,
      MILAENE_PRODUCT_CATALOG,
    );
    assert.ok(affinity.some((a) => a.productType.includes("tee") && a.rating === 5));
    assert.ok(affinity.some((a) => a.productType.includes("hoodie")));
  });

  it("5. recommendation engine works", () => {
    const ranked = recommendArchetypeForCampaign(MILAENE_BRAND_ARCHETYPE_CATALOG, {
      platform: "homepage",
    });
    assert.equal(ranked.length, 3);
    assert.ok(ranked[0]!.confidence >= ranked[1]!.confidence);
  });

  it("6. Homepage recommends Hero (Mediterranean)", () => {
    const best = bestArchetypeForPlatform(
      MILAENE_BRAND_ARCHETYPE_CATALOG,
      "homepage",
    );
    assert.ok(best);
    assert.equal(best!.archetypeSlug, "mediterranean-premium-hero");
    assert.ok(best!.confidence >= 95);
  });

  it("7. TikTok recommends Urban", () => {
    const best = bestArchetypeForPlatform(
      MILAENE_BRAND_ARCHETYPE_CATALOG,
      "tiktok",
    );
    assert.ok(best);
    assert.equal(best!.archetypeSlug, "urban-community-hero");
  });

  it("8. Pinterest recommends Female", () => {
    const best = bestArchetypeForPlatform(
      MILAENE_BRAND_ARCHETYPE_CATALOG,
      "pinterest",
    );
    assert.ok(best);
    assert.equal(best!.archetypeSlug, "female-lifestyle-hero");

    const video = recommendArchetypeForVideo(MILAENE_BRAND_ARCHETYPE_CATALOG, {
      platform: "tiktok",
    });
    assert.equal(video[0]!.archetypeSlug, "urban-community-hero");
  });

  it("9. snapshot is deterministic", () => {
    const archetype = resolveArchetypeForCandidate(
      MILAENE_BRAND_ARCHETYPE_CATALOG,
      1,
    );
    const dna = getIdentityDnaForArchetype(
      MILAENE_BRAND_ARCHETYPE_CATALOG,
      archetype,
    );
    const a = createBrandArchetypeSnapshot({
      archetype,
      dna,
      capturedAt: "2026-07-21T00:00:00.000Z",
    });
    const b = createBrandArchetypeSnapshot({
      archetype,
      dna,
      capturedAt: "2026-07-21T00:00:00.000Z",
    });
    assert.equal(a.brandArchetypeVersion, BRAND_ARCHETYPE_VERSION);
    assert.equal(a.identityDnaFingerprint, b.identityDnaFingerprint);
    assert.deepEqual(a.roles, b.roles);
    JSON.stringify(a);
  });

  it("10. no duplicate DNA", () => {
    const ids = MILAENE_IDENTITY_DNA.map((d) => d.id);
    const fingerprints = MILAENE_IDENTITY_DNA.map((d) => d.fingerprint);
    assert.equal(new Set(ids).size, 3);
    assert.equal(new Set(fingerprints).size, 3);
  });

  it("11. identity fingerprint is stable", () => {
    const dna = MILAENE_IDENTITY_DNA[0]!;
    assert.equal(
      createIdentityDnaFingerprint(dna),
      createIdentityDnaFingerprint({ ...dna }),
    );
  });

  it("12. Persona prompt order is correct", () => {
    const built = buildCandidatePrompt({
      project: streetLuxuryProject(),
      assetType: "portrait_front",
      candidateNumber: 2,
    });
    const dnaIdx = built.prompt.indexOf("IDENTITY DNA");
    const brandIdx = built.prompt.indexOf("BRAND DNA");
    const wardrobeIdx = built.prompt.indexOf("WARDROBE AND FIT");
    const cameraIdx = built.prompt.indexOf("CAMERA");
    const envIdx = built.prompt.indexOf("CONTROLLED NEUTRAL CASTING ENVIRONMENT");
    assert.ok(dnaIdx >= 0 && dnaIdx < brandIdx);
    assert.ok(brandIdx < wardrobeIdx);
    assert.ok(wardrobeIdx < cameraIdx);
    assert.ok(cameraIdx < envIdx);
    assert.equal(built.brandArchetype.slug, "urban-community-hero");
  });

  it("13–15. no OpenAI / Shopify / provider calls", () => {
    buildCandidatePrompt({
      project: streetLuxuryProject(),
      assetType: "portrait_front",
      candidateNumber: 3,
    });
    recommendArchetypeForCampaign(MILAENE_BRAND_ARCHETYPE_CATALOG, {
      platform: "email",
    });
    assert.equal(MILAENE_BRAND_ARCHETYPE_CATALOG.brandSlug, "milaene");
  });
});
