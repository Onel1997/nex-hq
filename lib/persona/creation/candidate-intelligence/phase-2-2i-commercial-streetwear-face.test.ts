/**
 * Phase 2.2I — Commercial Streetwear Brand Face Refinement.
 * Softens Mediterranean Premium Hero casting quality without redesigning the archetype.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getBrandArchetypeBySlug,
  MEDITERRANEAN_DISCOVERY_BLUEPRINTS,
  MILAENE_BRAND_ARCHETYPE_CATALOG,
} from "@/lib/brand-archetypes";
import {
  getMediterraneanSlotBlueprint,
  listMediterraneanSlotBlueprints,
  SLOT_BLUEPRINT_VERSION,
} from "@/lib/persona/identity-blueprints";
import { DISCOVERY_DIVERSITY_PROFILES } from "@/lib/persona/creation/discovery/diversity-profiles";
import { ARCHETYPE_PROJECT_MARKER } from "@/lib/brand-face-selection/creation-project-mapper";
import type { PersonaCreationProject } from "@/lib/persona/domain/creation-types";
import {
  buildCandidatePrompt,
  composeProviderPrompt,
  PREMIUM_CASTING_QUALITY_REFERENCE,
} from "@/lib/persona/creation/candidate-intelligence";

const ARCH_MED = "arch-mediterranean-premium-hero";
const SAMPLED_AT = "2026-08-07T23:00:00.000Z";

function projectForArchetype(projectId = "proj-22i"): PersonaCreationProject {
  const now = new Date().toISOString();
  return {
    id: projectId,
    workspace_id: "ws-milaene",
    name: "OBF Discovery 2.2I",
    description: `Official Brand Face. ${ARCHETYPE_PROJECT_MARKER}${ARCH_MED}`,
    gender_presentation: "Male",
    age_range: "22-26",
    height_range: "180",
    body_type: "Lean",
    skin_tone_direction: "",
    face_shape_direction: "",
    hair_direction: "",
    facial_hair_direction: "",
    eye_direction: "",
    expression_direction: "",
    personality: "",
    fashion_style: "premium oversized streetwear",
    brand_role: "primary_male",
    visual_keywords: "homepage shopify",
    preferred_brand_looks: "",
    preferred_outfits: "oversized heavyweight tee",
    intended_usage: "image_and_video",
    candidate_count: 4,
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
    excluded_features: "",
    created_by: null,
    created_at: now,
    updated_at: now,
  };
}

function buildObf(candidateNumber: number) {
  return buildCandidatePrompt({
    project: projectForArchetype(),
    assetType: "portrait_front",
    candidateNumber,
    generationRunId: "run-22i",
    attemptNumber: 1,
    identitySampledAt: SAMPLED_AT,
  });
}

describe("Phase 2.2I commercial streetwear brand face refinement", () => {
  it("keeps Mediterranean Premium Hero archetype identity", () => {
    const arch = getBrandArchetypeBySlug(
      MILAENE_BRAND_ARCHETYPE_CATALOG,
      "mediterranean-premium-hero",
    );
    assert.ok(arch);
    assert.equal(arch!.name, "Mediterranean Premium Hero");
    assert.equal(arch!.slug, "mediterranean-premium-hero");
    assert.equal(arch!.ageRange, "22-25");
  });

  it("targets dress-like-him commercial impression over unreal fashion model", () => {
    const full = composeProviderPrompt(buildObf(1));
    assert.match(full, /I want to dress like him/i);
    assert.match(full, /unreal fashion model|extremely masculine\/model face/i);
    assert.match(full, /22–25|22-25|22–26|22-26/);
    assert.match(full, /softer facial harmony|softer oval|soft masculine/i);
    assert.match(full, /natural medium jaw|defined but subtle jaw|less pronounced jawline/i);
    assert.match(full, /softer cheekbones|youthful cheeks/i);
    assert.match(full, /effortless smile potential|calm neutral expression|approachable neutral/i);
    assert.match(full, /naturally photogenic rather than striking|naturally handsome rather than striking/i);
    assert.match(full, /reduce model perfection/i);
    assert.match(full, /Milan, Barcelona, or Berlin|looks good in that outfit/i);
  });

  it("reduces editorial intensity and dramatic shadows in photography direction", () => {
    const full = composeProviderPrompt(buildObf(2));
    assert.match(full, /dramatic facial shadows/i);
    assert.match(full, /soft even shadows|soft commercial falloff/i);
    assert.match(full, /Rembrandt/i);
    assert.doesNotMatch(full, /gentle Rembrandt cheek cue/);
  });

  it("references commercial streetwear quality brands, not D&G / perfume runway", () => {
    assert.ok(PREMIUM_CASTING_QUALITY_REFERENCE.includes("Zara Studio"));
    assert.ok(PREMIUM_CASTING_QUALITY_REFERENCE.includes("Fear of God ESSENTIALS"));
    assert.ok(PREMIUM_CASTING_QUALITY_REFERENCE.includes("Aimé Leon Dore"));
    assert.ok(PREMIUM_CASTING_QUALITY_REFERENCE.includes("COS"));
    assert.ok(PREMIUM_CASTING_QUALITY_REFERENCE.includes("Our Legacy"));
    const full = composeProviderPrompt(buildObf(3));
    assert.match(full, /Zara Studio/);
    assert.match(full, /Dolce & Gabbana|Dolce and Gabbana/i);
    assert.match(full, /perfume/i);
  });

  it("softens Mediterranean discovery blueprints to age 22-26 with warmer commercial cues", () => {
    for (const bp of MEDITERRANEAN_DISCOVERY_BLUEPRINTS) {
      assert.match(bp.ageRange, /^22-2[56]$/, bp.id);
      assert.match(bp.expression, /calm|warm|friendly|approachable/i);
      assert.match(bp.lightingDirection, /soft even shadows|soft natural daylight/i);
    }
    const d = MEDITERRANEAN_DISCOVERY_BLUEPRINTS.find((b) => b.slot === "D")!;
    assert.match(d.jaw, /natural medium|less pronounced|soft/i);
    assert.match(d.cheekbones, /soft|youthful/i);
    assert.match(d.fashionCasting.memorabilityCue, /I want to dress like him|looks good in that outfit/i);
    assert.doesNotMatch(d.jaw, /square jaw/i);
    assert.doesNotMatch(d.fashionCasting.facialCharacter, /strongest hero presence/i);
  });

  it("bumps L2 slot blueprints to 2.2I and removes Rembrandt / square-hero jaw pools", () => {
    assert.match(SLOT_BLUEPRINT_VERSION, /^2\.2[IJK]\.0$/);
    for (const bp of listMediterraneanSlotBlueprints()) {
      assert.match(bp.ageRange, /^22-2[56]$/, bp.slot);
      assert.match(bp.version, /^2\.2[IJK]\.0$/);
      assert.match(bp.qualityBar, /22–2[56]|I want to dress like him|looks good in that outfit|naturally belongs in Milaene/);
    }
    const d = getMediterraneanSlotBlueprint("D");
    assert.ok(d.cameraRules.every((r) => !/Rembrandt cheek cue/i.test(r)));
    assert.ok(d.controlledPools.jaw.every((j) => !/square jaw|hero square/i.test(j)));
    assert.ok(d.controlledPools.cheekbones.every((c) => /soft/i.test(c)));
  });

  it("keeps four biologically separated diversity regions with commercial briefs", () => {
    const briefs = ["A", "B", "C", "D"].map(
      (s) => DISCOVERY_DIVERSITY_PROFILES[s as "A" | "B" | "C" | "D"].castingBrief,
    );
    assert.equal(new Set(briefs).size, 4);
    for (const brief of briefs) {
      assert.match(brief, /22|23|24|25|26/);
      assert.doesNotMatch(brief, /27y/);
    }
    assert.match(briefs[0]!, /belongs in Milaene|I want to dress like him|looks good in oversized/);
    assert.match(briefs[3]!, /natural medium soft jaw|defined but subtle jaw|less pronounced jaw|softer cheekbones|youthful cheeks/);
  });

  it("preserves four distinct board identities after refinement", () => {
    const fps = [1, 2, 3, 4].map(
      (n) => buildObf(n).discoveryIdentityInstance!.anatomyFingerprint,
    );
    assert.equal(new Set(fps).size, 4);
  });
});
