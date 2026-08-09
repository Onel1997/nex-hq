/**
 * Phase 2.2K — Softer Primary Streetwear Face Refinement.
 * Creative direction only. Preserves 2.2I/J. No architecture / novelty / face-copy.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
import { FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD } from "@/lib/persona/face-novelty-memory/similarity-threshold";
import { ARCHETYPE_PROJECT_MARKER } from "@/lib/brand-face-selection/creation-project-mapper";
import type { PersonaCreationProject } from "@/lib/persona/domain/creation-types";
import {
  buildCandidatePrompt,
  composeProviderPrompt,
  SOFTER_PRIMARY_STREETWEAR_FACE_QUALITY,
} from "@/lib/persona/creation/candidate-intelligence";

const ARCH_MED = "arch-mediterranean-premium-hero";
const SAMPLED_AT = "2026-08-08T16:00:00.000Z";
const ROOT = process.cwd();

function projectForArchetype() {
  const now = new Date().toISOString();
  return {
    id: "proj-22k",
    workspace_id: "ws-milaene",
    name: "OBF Discovery 2.2K",
    description: `Official Brand Face. ${ARCHETYPE_PROJECT_MARKER}${ARCH_MED}`,
    gender_presentation: "Male",
    age_range: "22-25",
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
  } satisfies PersonaCreationProject;
}

function buildObf(candidateNumber: number) {
  return buildCandidatePrompt({
    project: projectForArchetype(),
    assetType: "portrait_front",
    candidateNumber,
    generationRunId: "run-22k",
    attemptNumber: 1,
    identitySampledAt: SAMPLED_AT,
  });
}

describe("Phase 2.2K softer primary streetwear face", () => {
  it("1. age remains 22–25/26 youth band", () => {
    const arch = getBrandArchetypeBySlug(
      MILAENE_BRAND_ARCHETYPE_CATALOG,
      "mediterranean-premium-hero",
    );
    assert.match(arch!.ageRange, /^22-2[56]$/);
    for (const bp of MEDITERRANEAN_DISCOVERY_BLUEPRINTS) {
      assert.match(bp.ageRange, /^22-2[56]$/, bp.id);
    }
    for (const bp of listMediterraneanSlotBlueprints()) {
      assert.match(bp.ageRange, /^22-2[56]$/, bp.slot);
    }
    const full = composeProviderPrompt(buildObf(1));
    assert.match(full, /22–25|22-25/);
    assert.match(full, /27\+|visually 27|looking older than 26/i);
  });

  it("2. soft masculine direction is explicit", () => {
    const full = composeProviderPrompt(buildObf(1));
    assert.match(full, /PHASE 2\.2K — SOFTER PRIMARY STREETWEAR FACE/);
    assert.match(full, /soft masculine/i);
    assert.match(full, /never feminine-coded|Keep clear male identity/i);
    assert.match(full, /70% approachable commercial/i);
    assert.match(full, /10% masculine edge/i);
  });

  it("3. narrower / softer face geometry is preferred", () => {
    const full = composeProviderPrompt(buildObf(2));
    assert.match(full, /reduced facial width/i);
    assert.match(full, /softer oval|subtle rectangular/i);
    assert.match(full, /natural medium jaw|softer lower face/i);
    assert.match(full, /youthful cheeks/i);
    assert.ok(SOFTER_PRIMARY_STREETWEAR_FACE_QUALITY.includes("reduced facial width"));
  });

  it("4–5. beard density reduced; clean shave / light stubble preferred", () => {
    const full = composeProviderPrompt(buildObf(3));
    assert.match(full, /clean shave OR very light natural stubble|clean shave or very light/i);
    assert.match(full, /full beard|dense beard shadow|heavy beard/i);
    for (const bp of MEDITERRANEAN_DISCOVERY_BLUEPRINTS) {
      assert.match(bp.facialHair, /clean shave|clean-shaven|very light|sparse light/i);
      assert.ok(
        /never full beard|never dense|never beard/i.test(bp.facialHair),
        bp.id,
      );
    }
    for (const slot of ["A", "B", "C", "D"] as const) {
      const pools = getMediterraneanSlotBlueprint(slot).controlledPools.beardPattern;
      assert.ok(pools.some((p) => /clean-shaven|clean shave/i.test(p)), slot);
      assert.ok(pools.every((p) => !/dense refined|short even beard|dense cheek-to-jaw/i.test(p)), slot);
    }
  });

  it("6. rugged / heroic / alpha-male language is discouraged", () => {
    const full = composeProviderPrompt(buildObf(4));
    for (const token of [
      "rugged",
      "alpha-male",
      "extremely masculine",
      "He looks good in that outfit",
    ]) {
      assert.match(full, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    }
  });

  it("7. A/B/C/D diversity remains intact", () => {
    const fps = [1, 2, 3, 4].map(
      (n) => buildObf(n).discoveryIdentityInstance!.anatomyFingerprint,
    );
    assert.equal(new Set(fps).size, 4);
    const regions = MEDITERRANEAN_DISCOVERY_BLUEPRINTS.map(
      (b) => b.diversitySampling.regionalCluster,
    );
    assert.equal(new Set(regions).size, 4);
    assert.equal(new Set(Object.values(DISCOVERY_DIVERSITY_PROFILES).map((p) => p.castingBrief)).size, 4);
  });

  it("8. no exact face-copying behavior exists", () => {
    const full = composeProviderPrompt(buildObf(1));
    assert.match(full, /PROPORTIONAL REFINEMENT ONLY|Do NOT copy any previously generated/i);
    assert.doesNotMatch(full, /createReferenceEmbedding|lockCandidateDAnatomy/i);
  });

  it("9. novelty threshold remains 0.45", () => {
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
  });

  it("10. provider/orchestration unchanged by this phase", () => {
    const untouched = [
      "lib/persona/creation/provider/fal-flux-discovery-provider.ts",
      "lib/persona/creation/discovery/completion-engine.ts",
      "lib/persona/face-novelty-memory/novelty-service.ts",
      "lib/persona/face-novelty-memory/similarity-threshold.ts",
    ];
    for (const rel of untouched) {
      const text = readFileSync(join(ROOT, rel), "utf8");
      assert.doesNotMatch(text, /PHASE 2\.2K — SOFTER PRIMARY STREETWEAR FACE/);
    }
    assert.equal(SLOT_BLUEPRINT_VERSION, "2.2L.0");
  });
});
