/**
 * Phase 2.5B.9 — Urban apparent-age recalibration only (21–24).
 * Config / prompt only — zero paid provider calls.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ARCHETYPE_PROJECT_MARKER } from "@/lib/brand-face-selection/creation-project-mapper";
import type { PersonaCreationProject } from "@/lib/persona/domain/creation-types";
import {
  URBAN_FACE_SHAPE_POOL,
  URBAN_FACIAL_HAIR_LANE_POOL,
  URBAN_HAIR_LANE_POOL,
  buildCandidatePrompt,
  buildUrbanFreshRunRecipe,
  classifyFaceFreshnessScore,
  composeProviderPrompt,
  faceFreshnessScoreFromDistance,
  urbanFreshRunHairComboKey,
} from "@/lib/persona/creation/candidate-intelligence";
import { URBAN_DISCOVERY_BLUEPRINTS } from "@/lib/brand-archetypes/discovery-blueprints";
import { loadBrandArchetypeCatalog } from "@/lib/brand-archetypes";
import { URBAN_SLOT_BLUEPRINTS } from "@/lib/persona/identity-blueprints";
import {
  DISCOVERY_HARD_DUPLICATE_THRESHOLD,
  DISCOVERY_WARNING_THRESHOLD,
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
  classifyDiscoveryFaceDistance,
} from "@/lib/persona/face-novelty-memory";
import { DEFAULT_DISCOVERY_PROVIDER } from "@/lib/persona/creation/provider/discovery-provider-config";

const ROOT = process.cwd();
const ARCH_URBAN = "arch-urban-community-hero";
const SAMPLED_AT = "2026-08-16T19:00:00.000Z";

function projectForUrban(projectId: string): PersonaCreationProject {
  const now = new Date().toISOString();
  return {
    id: projectId,
    workspace_id: "ws-milaene",
    name: "OBF Urban 2.5B.9",
    description: `Official Brand Face. ${ARCHETYPE_PROJECT_MARKER}${ARCH_URBAN}`,
    gender_presentation: "Male",
    age_range: "21-24",
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
    brand_role: "secondary_male",
    visual_keywords: "community social",
    preferred_brand_looks: "",
    preferred_outfits: "oversized hoodie",
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

describe("Phase 2.5B.9 — age recalibration only", () => {
  it("1. apparent age is now 21–24", () => {
    const catalog = loadBrandArchetypeCatalog("ws-milaene");
    const urban = catalog.archetypes.find((a) => a.id === ARCH_URBAN)!;
    assert.equal(urban.ageRange, "21-24");
    for (const bp of URBAN_DISCOVERY_BLUEPRINTS) {
      assert.equal(bp.ageRange, "21-24");
    }
    for (const lane of URBAN_SLOT_BLUEPRINTS) {
      assert.equal(lane.ageRange, "21-24");
    }
  });

  it("2–3. prompts avoid teenage/underage; model-like direction unchanged", () => {
    const full = composeProviderPrompt(
      buildCandidatePrompt({
        project: projectForUrban("proj-age-recal"),
        assetType: "portrait_front",
        candidateNumber: 2,
        generationRunId: "run-25b9",
        identitySampledAt: SAMPLED_AT,
      }),
      { logBudget: false },
    );
    assert.match(full, /21–24|21-24/);
    assert.match(full, /never underage/i);
    assert.match(full, /teenage|baby-face/i);
    assert.match(
      full,
      /Young fashion-model face with distinctive but believable features/i,
    );
    assert.doesNotMatch(full, /19–23|19-23/);
  });

  it("4–6. face diversity / freshness / hair architecture unchanged", () => {
    assert.equal(URBAN_FACE_SHAPE_POOL.length, 8);
    assert.equal(URBAN_HAIR_LANE_POOL.length, 12);
    assert.ok(URBAN_FACIAL_HAIR_LANE_POOL.includes("light neat stubble"));
    assert.equal(faceFreshnessScoreFromDistance(0.4), 50);
    assert.equal(classifyFaceFreshnessScore(82), "VERY_FRESH");

    const a = buildUrbanFreshRunRecipe("proj-25b9-stable");
    const b = buildUrbanFreshRunRecipe("proj-25b9-stable");
    assert.deepEqual(a.hairLanes, b.hairLanes);
    assert.equal(urbanFreshRunHairComboKey(a), urbanFreshRunHairComboKey(b));
    assert.ok(a.faceIdentityRecipes.A.promptLine.startsWith("Distinct facial identity:"));
    assert.equal(
      new Set(Object.values(a.faceIdentityRecipes).map((r) => r.faceShape)).size,
      4,
    );
  });

  it("7–9. novelty / Identity Lock / OpenAI unchanged", () => {
    assert.equal(DISCOVERY_HARD_DUPLICATE_THRESHOLD, 0.3);
    assert.equal(DISCOVERY_WARNING_THRESHOLD, 0.45);
    assert.equal(classifyDiscoveryFaceDistance(0.5), "PASS");
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
    assert.equal(DEFAULT_DISCOVERY_PROVIDER, "openai");
    assert.match(
      readFileSync(
        join(ROOT, "lib/persona/creation/identity-lock/identity-lock-service.ts"),
        "utf8",
      ),
      /lockBrandIdentity/,
    );
  });

  it("10. zero provider calls in age-recalibration paths", () => {
    for (const rel of [
      "lib/persona/identity-blueprints/urban-slot-blueprints.ts",
      "lib/persona/creation/candidate-intelligence/urban-face-identity-recipe.ts",
      "lib/persona/creation/candidate-intelligence/urban-fresh-face-dna.ts",
    ]) {
      assert.doesNotMatch(
        readFileSync(join(ROOT, rel), "utf8"),
        /generateOpenAiImage|fal\.ai/,
      );
    }
  });
});
