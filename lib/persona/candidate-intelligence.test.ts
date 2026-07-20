import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PersonaCreationProject } from "./domain/creation-types";
import { getCreationPreset, PERSONA_CREATION_PRESETS } from "./creation/presets";
import {
  assessCandidateQuality,
  buildCandidatePrompt,
  buildDiversityReport,
  fingerprintDistance,
  qualityFieldsForCandidate,
  resolveCandidateVariation,
  variationFingerprint,
} from "./creation/candidate-intelligence";

function streetLuxuryProject(
  overrides: Partial<PersonaCreationProject> = {},
): PersonaCreationProject {
  const preset = getCreationPreset("milaene_street_luxury")!;
  return {
    id: "proj-street-1",
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
    candidate_count: preset.candidate_count,
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
    ...overrides,
  };
}

describe("Milaene premium streetwear lifestyle casting", () => {
  it("exposes milaene_street_luxury preset without removing legacy presets", () => {
    const street = getCreationPreset("milaene_street_luxury");
    assert.ok(street);
    assert.equal(street!.brand_role, "primary_male");
    assert.match(street!.skin_tone_direction, /olive/i);
    assert.match(street!.fashion_style, /streetwear lifestyle/i);
    assert.match(street!.excluded_features, /fashion week|CEO|runway/i);
    assert.ok(PERSONA_CREATION_PRESETS.some((p) => p.id === "primary_male_quiet_luxury"));
    assert.ok(PERSONA_CREATION_PRESETS.some((p) => p.id === "secondary_male_street_editorial"));
  });

  it("uses four distinct lifestyle identities with unique descriptors", () => {
    const ids = [1, 2, 3, 4].map((n) => resolveCandidateVariation(n).id);
    assert.deepEqual(ids, [
      "everyday_premium",
      "urban_creator",
      "modern_street_luxury",
      "weekend_minimal",
    ]);

    const descriptors = [1, 2, 3, 4].map(
      (n) => resolveCandidateVariation(n).identityDescriptor,
    );
    assert.equal(new Set(descriptors).size, 4);
    assert.equal(new Set([1, 2, 3, 4].map((n) => variationFingerprint(resolveCandidateVariation(n)))).size, 4);
  });

  it("keeps identity lock per candidate and prioritizes brand DNA + lifestyle over editorial", () => {
    const project = streetLuxuryProject();
    const c1Front = buildCandidatePrompt({
      project,
      assetType: "portrait_front",
      candidateNumber: 1,
    });
    const c1Half = buildCandidatePrompt({
      project,
      assetType: "half_body",
      candidateNumber: 1,
    });
    const c2Front = buildCandidatePrompt({
      project,
      assetType: "portrait_front",
      candidateNumber: 2,
    });

    assert.equal(c1Front.identityLock, c1Half.identityLock);
    assert.match(c1Front.identityLock, /Candidate 1 only/);
    assert.match(c1Front.identityLock, /Everyday Premium/);
    assert.notEqual(c1Front.identityLock, c2Front.identityLock);

    const brandIdx = c1Front.prompt.indexOf("BRAND DNA");
    const lifestyleIdx = c1Front.prompt.indexOf("LIFESTYLE");
    const editorialIdx = c1Front.prompt.indexOf("EDITORIAL SUPPORT");
    assert.ok(brandIdx >= 0 && lifestyleIdx > brandIdx);
    assert.ok(editorialIdx > lifestyleIdx);

    assert.match(c1Front.prompt, /streetwear lifestyle/i);
    assert.match(c1Front.prompt, /Instagram/i);
    assert.match(c1Front.prompt, /not Vogue, not Fashion Week/i);
    assert.match(c1Front.negativePrompt, /fashion week|runway|CEO portrait|intimidating expression/i);
    assert.match(c1Front.blocks.appearance, /heavyweight|hoodie|tee/i);
    assert.match(c1Front.blocks.lifestyle, /Milan|Barcelona|Copenhagen/i);
  });

  it("encodes warm olive skin and friendly authentic presence", () => {
    const project = streetLuxuryProject();
    for (const n of [1, 2, 3, 4]) {
      const built = buildCandidatePrompt({
        project,
        assetType: "portrait_front",
        candidateNumber: n,
      });
      assert.match(built.variation.skinTone, /olive|Mediterranean/i);
      assert.match(built.prompt, /friendly|approachable|authentic|relaxed/i);
      assert.match(built.prompt, /DIFFERENT person/i);
      assert.match(built.variation.expression, /friendly|calm|warm|easy|relaxed|soft/i);
    }
  });

  it("scores authenticity heavily and keeps cast diversity healthy", () => {
    const project = streetLuxuryProject();
    const lifestyle = assessCandidateQuality({
      project,
      variation: resolveCandidateVariation(1),
      assetTypes: ["portrait_front", "portrait_three_quarter", "half_body"],
    });
    assert.ok(lifestyle.dimensions.authenticity >= 60);
    assert.ok(lifestyle.dimensions.lifestyleFit >= 55);
    assert.ok(lifestyle.dimensions.streetwearMatch >= 55);
    assert.ok(lifestyle.dimensions.overall >= 50);
    assert.ok(
      lifestyle.dimensions.authenticity * 0.16 +
        lifestyle.dimensions.editorialQuality * 0.02 <
        lifestyle.dimensions.authenticity,
    );
    assert.ok(qualityFieldsForCandidate(lifestyle).visual_strengths.includes("Everyday Premium"));

    // Fashion-week-shaped variation text should not outrank authenticity-led overall trivially:
    // editorialQuality remains supporting and below authenticity for lifestyle cast.
    assert.ok(lifestyle.dimensions.editorialQuality < lifestyle.dimensions.authenticity);

    const report = buildDiversityReport({ candidateNumbers: [1, 2, 3, 4] });
    assert.equal(report.lowDiversity, false);
    assert.ok(
      fingerprintDistance(
        variationFingerprint(resolveCandidateVariation(1)),
        variationFingerprint(resolveCandidateVariation(2)),
      ) >= 35,
    );
  });
});
