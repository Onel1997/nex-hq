/**
 * Phase 2.5B.11 — Urban lean / slim-athletic body build only.
 * Body wording only — zero provider calls; face/hair/freshness/age untouched.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ARCHETYPE_PROJECT_MARKER } from "@/lib/brand-face-selection/creation-project-mapper";
import type { PersonaCreationProject } from "@/lib/persona/domain/creation-types";
import {
  URBAN_FACE_SHAPE_POOL,
  URBAN_HAIR_LANE_POOL,
  buildCandidatePrompt,
  buildUrbanFreshRunRecipe,
  composeProviderPrompt,
  faceFreshnessScoreFromDistance,
  urbanFreshRunHairComboKey,
} from "@/lib/persona/creation/candidate-intelligence";
import { loadBrandArchetypeCatalog } from "@/lib/brand-archetypes";
import { URBAN_DISCOVERY_BLUEPRINTS } from "@/lib/brand-archetypes/discovery-blueprints";
import { URBAN_SLOT_BLUEPRINTS } from "@/lib/persona/identity-blueprints";
import {
  DISCOVERY_HARD_DUPLICATE_THRESHOLD,
  DISCOVERY_WARNING_THRESHOLD,
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
} from "@/lib/persona/face-novelty-memory";
import { DEFAULT_DISCOVERY_PROVIDER } from "@/lib/persona/creation/provider/discovery-provider-config";

const ROOT = process.cwd();
const ARCH_URBAN = "arch-urban-community-hero";
const SAMPLED_AT = "2026-08-16T20:00:00.000Z";

function projectForUrban(projectId: string): PersonaCreationProject {
  const now = new Date().toISOString();
  return {
    id: projectId,
    workspace_id: "ws-milaene",
    name: "OBF Urban 2.5B.11",
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

describe("Phase 2.5B.11 — lean body build only", () => {
  it("1–2. Urban body target is lean / slim-athletic; bulky/stocky/heavy-set excluded", () => {
    const catalog = loadBrandArchetypeCatalog("ws-milaene");
    const urban = catalog.archetypes.find((a) => a.id === ARCH_URBAN)!;
    assert.match(urban.bodyDirection, /slim-athletic|lean/i);
    assert.match(urban.bodyDirection, /not bulky|stocky|heavy-set/i);

    for (const lane of URBAN_SLOT_BLUEPRINTS) {
      assert.match(lane.bodyDirection, /slim-athletic|lean/i);
      assert.match(lane.bodyDirection, /not bulky|stocky|heavy-set/i);
      assert.doesNotMatch(lane.bodyDirection, /broader shoulder/i);
    }
    for (const bp of URBAN_DISCOVERY_BLUEPRINTS) {
      assert.match(bp.bodyStructure, /slim-athletic|lean/i);
      assert.match(bp.bodyStructure, /not bulky|stocky|heavy-set/i);
      assert.doesNotMatch(bp.fashionCasting.shoulderLine ?? "", /broader athletic/i);
    }

    const full = composeProviderPrompt(
      buildCandidatePrompt({
        project: projectForUrban("proj-lean-body"),
        assetType: "portrait_front",
        candidateNumber: 2,
        generationRunId: "run-25b11",
        identitySampledAt: SAMPLED_AT,
      }),
      { logBudget: false },
    );
    assert.match(
      full,
      /Lean, slim-athletic fashion-model build with a naturally slender frame/i,
    );
    assert.match(full, /not bulky, stocky or heavy-set/i);
  });

  it("3–5. face / hair / freshness / age unchanged", () => {
    assert.equal(URBAN_FACE_SHAPE_POOL.length, 8);
    assert.equal(URBAN_HAIR_LANE_POOL.length, 12);
    assert.equal(faceFreshnessScoreFromDistance(0.4), 50);
    for (const lane of URBAN_SLOT_BLUEPRINTS) {
      assert.equal(lane.ageRange, "21-24");
    }
    const a = buildUrbanFreshRunRecipe("proj-25b11-stable");
    const b = buildUrbanFreshRunRecipe("proj-25b11-stable");
    assert.equal(urbanFreshRunHairComboKey(a), urbanFreshRunHairComboKey(b));
    assert.ok(a.faceIdentityRecipes.A.promptLine.startsWith("Distinct facial identity:"));
  });

  it("6–7. novelty unchanged; OpenAI default; zero provider calls", () => {
    assert.equal(DISCOVERY_HARD_DUPLICATE_THRESHOLD, 0.3);
    assert.equal(DISCOVERY_WARNING_THRESHOLD, 0.45);
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
    assert.equal(DEFAULT_DISCOVERY_PROVIDER, "openai");
    for (const rel of [
      "lib/persona/identity-blueprints/urban-slot-blueprints.ts",
      "lib/brand-archetypes/archetypes.ts",
      "lib/persona/creation/candidate-intelligence/premium-casting-direction.ts",
    ]) {
      assert.doesNotMatch(
        readFileSync(join(ROOT, rel), "utf8"),
        /generateOpenAiImage|fal\.ai/,
      );
    }
  });
});
