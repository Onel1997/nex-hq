/**
 * Phase 2.5B.11R — rollback lean / slim-athletic body build only.
 * Restores pre-2.5B.11 Urban body wording. Zero provider calls.
 * Face / hair / freshness / age / novelty / Identity Lock untouched.
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

/** 2.5B.11-specific lean-body phrases that must not remain. */
const LEAN_BODY_25B11 =
  /slim-athletic fashion-model|naturally slender frame|narrow-to-medium shoulders|low visible body fat|not bulky, stocky|slender frame, not bulky|never broad\/stocky|lean \/ slim-athletic/i;

function projectForUrban(projectId: string): PersonaCreationProject {
  const now = new Date().toISOString();
  return {
    id: projectId,
    workspace_id: "ws-milaene",
    name: "OBF Urban 2.5B.11R",
    description: `Official Brand Face. ${ARCHETYPE_PROJECT_MARKER}${ARCH_URBAN}`,
    gender_presentation: "Male",
    age_range: "21-24",
    height_range: "180",
    body_type: "athletic",
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

describe("Phase 2.5B.11R — lean body build rollback", () => {
  it("1–2. 2.5B.11 lean-body wording removed; pre-2.5B.11 Urban body restored", () => {
    const catalog = loadBrandArchetypeCatalog("ws-milaene");
    const urban = catalog.archetypes.find((a) => a.id === ARCH_URBAN)!;
    const dna = catalog.identityDnaById[urban.identityDnaId]!;
    assert.equal(
      urban.bodyDirection,
      "lean to athletic — not bodybuilder — normal healthy proportions wearable in oversized clothing",
    );
    assert.doesNotMatch(urban.bodyDirection, LEAN_BODY_25B11);
    assert.equal(
      dna.appearance.proportions,
      "lean to athletic frame — never bodybuilder — wearable in oversized streetwear",
    );
    assert.equal(
      dna.movement.shoulderPosition,
      "natural medium shoulders, relaxed not squared",
    );
    assert.equal(
      dna.movement.bodyEnergy,
      "casting-ready calm — wearable in oversized clothing — never aggressive",
    );

    const expectedSlotBodies = [
      "lean to athletic relaxed streetwear casting frame — never bodybuilder",
      "lean-athletic streetwear build with slightly broader shoulders — never bodybuilder",
      "tall lean soft-athletic lifestyle fashion frame — never bodybuilder",
      "tall lean-athletic broader shoulder campaign frame — never bodybuilder",
    ] as const;
    for (let i = 0; i < URBAN_SLOT_BLUEPRINTS.length; i++) {
      const lane = URBAN_SLOT_BLUEPRINTS[i]!;
      assert.equal(lane.bodyDirection, expectedSlotBodies[i]);
      assert.doesNotMatch(lane.bodyDirection, LEAN_BODY_25B11);
    }

    const expectedStructures = [
      "lean to athletic relaxed adult male fashion proportions — never bodybuilder",
      "lean-athletic adult male with slightly broader shoulders — never bodybuilder",
      "tall lean soft-athletic lifestyle fashion frame",
      "tall lean-athletic broader shoulder line — campaign silhouette, never bodybuilder",
    ] as const;
    const expectedBuilds = [
      "lean-to-athletic relaxed community fashion build",
      "slim-athletic structured street fashion build",
      "lean soft-athletic lifestyle creative build",
      "lean-athletic broader-shoulder campaign build",
    ] as const;
    const expectedShoulders = [
      "soft relaxed shoulder line fully visible",
      "slightly broader clean shoulder line",
      "soft lean shoulder line fully visible",
      "broader athletic shoulder line — relaxed, not military",
    ] as const;
    for (let i = 0; i < URBAN_DISCOVERY_BLUEPRINTS.length; i++) {
      const bp = URBAN_DISCOVERY_BLUEPRINTS[i]!;
      assert.equal(bp.bodyStructure, expectedStructures[i]);
      assert.equal(bp.fashionCasting.modelBuild, expectedBuilds[i]);
      assert.equal(bp.fashionCasting.shoulderLine, expectedShoulders[i]);
      assert.doesNotMatch(bp.bodyStructure, LEAN_BODY_25B11);
      assert.doesNotMatch(bp.fashionCasting.modelBuild ?? "", LEAN_BODY_25B11);
      assert.doesNotMatch(bp.fashionCasting.shoulderLine ?? "", LEAN_BODY_25B11);
    }

    const full = composeProviderPrompt(
      buildCandidatePrompt({
        project: projectForUrban("proj-lean-body-rollback"),
        assetType: "portrait_front",
        candidateNumber: 2,
        generationRunId: "run-25b11r",
        identitySampledAt: SAMPLED_AT,
      }),
      { logBudget: false },
    );
    assert.doesNotMatch(full, LEAN_BODY_25B11);
    assert.match(full, /lean \/ athletic/i);
    assert.doesNotMatch(full, /naturally slender frame/i);
    assert.doesNotMatch(full, /not bulky, stocky or heavy-set/i);
  });

  it("3–5. face / hair / freshness / age unchanged", () => {
    assert.equal(URBAN_FACE_SHAPE_POOL.length, 8);
    assert.equal(URBAN_HAIR_LANE_POOL.length, 12);
    assert.equal(faceFreshnessScoreFromDistance(0.4), 50);
    for (const lane of URBAN_SLOT_BLUEPRINTS) {
      assert.equal(lane.ageRange, "21-24");
    }
    const a = buildUrbanFreshRunRecipe("proj-25b11r-stable");
    const b = buildUrbanFreshRunRecipe("proj-25b11r-stable");
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
      "lib/brand-archetypes/discovery-blueprints.ts",
      "lib/persona/creation/candidate-intelligence/prompt-builder.ts",
    ]) {
      assert.doesNotMatch(
        readFileSync(join(ROOT, rel), "utf8"),
        /generateOpenAiImage|fal\.ai/,
      );
    }
  });
});
