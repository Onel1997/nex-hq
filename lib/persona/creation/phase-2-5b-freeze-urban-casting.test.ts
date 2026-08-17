/**
 * Phase 2.5B.FREEZE — Urban Community Hero casting regression lock.
 *
 * Snapshot-style contract only. Detects accidental drift.
 * Zero provider calls. Does not change casting behavior.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ARCHETYPE_PROJECT_MARKER } from "@/lib/brand-face-selection/creation-project-mapper";
import type { PersonaCreationProject } from "@/lib/persona/domain/creation-types";
import { loadBrandArchetypeCatalog } from "@/lib/brand-archetypes";
import { URBAN_DISCOVERY_BLUEPRINTS } from "@/lib/brand-archetypes/discovery-blueprints";
import { URBAN_SLOT_BLUEPRINTS } from "@/lib/persona/identity-blueprints";
import {
  MAX_PROVIDER_PROMPT_LENGTH,
  TARGET_PROVIDER_PROMPT_LENGTH,
  URBAN_CASTING_VERSION,
  URBAN_FACE_FRESHNESS_DISTANCE_SATURATION,
  URBAN_FACE_FRESHNESS_VERSION,
  URBAN_FACE_IDENTITY_RECIPE_VERSION,
  URBAN_FACE_SHAPE_POOL,
  URBAN_FACIAL_HAIR_LANE_POOL,
  URBAN_FRESH_FACE_DNA_VERSION,
  URBAN_FRESH_RUN_RECIPE_VERSION,
  URBAN_HAIR_LANE_POOL,
  URBAN_RECENT_PROJECTS_FOR_FACE_BIAS,
  URBAN_SLOT_MOODS,
  buildCandidatePrompt,
  buildUrbanFreshRunRecipe,
  classifyFaceFreshnessScore,
  composeProviderPrompt,
  faceFreshnessBlocksSelection,
  faceFreshnessScoreFromDistance,
  filterDiscoveryOnlyFaceSamples,
  urbanFreshRunHairComboKey,
} from "@/lib/persona/creation/candidate-intelligence";
import {
  DISCOVERY_HARD_DUPLICATE_THRESHOLD,
  DISCOVERY_SIMILARITY_THRESHOLD_VERSION,
  DISCOVERY_WARNING_THRESHOLD,
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
  FACE_SIMILARITY_THRESHOLD_VERSION,
  HISTORICAL_BLOCKING_PROTECTION_STATUSES,
  classifyDiscoveryFaceDistance,
} from "@/lib/persona/face-novelty-memory";
import { DEFAULT_DISCOVERY_PROVIDER } from "@/lib/persona/creation/provider/discovery-provider-config";

const ROOT = process.cwd();
const ARCH_URBAN = "arch-urban-community-hero";
const FREEZE_PROJECT_ID = "proj-urban-freeze-contract-v1";
const FREEZE_SAMPLED_AT = "2026-08-16T18:00:00.000Z";
const FREEZE_RUN_ID = "run-urban-freeze-v1";

/** Frozen A–D board prompt fingerprint (portrait_front × slots 1–4). */
const FROZEN_URBAN_BOARD_PROMPT_SHA256 =
  "c4bbf483b5f58467d60c0aeb62aa5240c7277c2907b5e1668eee58da19b116dc";

const FROZEN_HAIR_COMBO_KEY =
  "short locs | medium natural curls | medium twists | medium locs";

const FROZEN_HAIR_LANE_IDS = [
  "very_short_buzz",
  "low_fade",
  "short_curls",
  "medium_natural_curls",
  "textured_afro",
  "longer_afro",
  "short_twists",
  "medium_twists",
  "braids",
  "cornrows",
  "short_locs",
  "medium_locs",
] as const;

const FROZEN_FACE_SHAPES = [
  "oval",
  "narrow oval",
  "broad oval",
  "rectangular",
  "round",
  "tapered",
  "heart-shaped",
  "longer face",
] as const;

const FROZEN_BODY_DIRECTIONS = [
  "lean to athletic relaxed streetwear casting frame — never bodybuilder",
  "lean-athletic streetwear build with slightly broader shoulders — never bodybuilder",
  "tall lean soft-athletic lifestyle fashion frame — never bodybuilder",
  "tall lean-athletic broader shoulder campaign frame — never bodybuilder",
] as const;

const FROZEN_BODY_STRUCTURES = [
  "lean to athletic relaxed adult male fashion proportions — never bodybuilder",
  "lean-athletic adult male with slightly broader shoulders — never bodybuilder",
  "tall lean soft-athletic lifestyle fashion frame",
  "tall lean-athletic broader shoulder line — campaign silhouette, never bodybuilder",
] as const;

function freezeProject(): PersonaCreationProject {
  const now = new Date().toISOString();
  return {
    id: FREEZE_PROJECT_ID,
    workspace_id: "ws-milaene",
    name: "OBF Urban FREEZE",
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

function frozenBoardPrompt(): string {
  const project = freezeProject();
  return [1, 2, 3, 4]
    .map((n) =>
      composeProviderPrompt(
        buildCandidatePrompt({
          project,
          assetType: "portrait_front",
          candidateNumber: n,
          generationRunId: FREEZE_RUN_ID,
          identitySampledAt: FREEZE_SAMPLED_AT,
        }),
        { logBudget: false },
      ),
    )
    .join("\n---\n");
}

describe("Phase 2.5B.FREEZE — Urban casting regression lock", () => {
  it("1. URBAN_CASTING_VERSION metadata tag is frozen", () => {
    assert.equal(URBAN_CASTING_VERSION, "2.5B-FROZEN");
    const freezeSrc = readFileSync(
      join(
        ROOT,
        "lib/persona/creation/candidate-intelligence/urban-casting-freeze.ts",
      ),
      "utf8",
    );
    assert.match(freezeSrc, /Metadata only/);
    assert.doesNotMatch(freezeSrc, /composeProviderPrompt|buildCandidatePrompt/);
  });

  it("2. age / body / moods / hair / face architecture versions locked", () => {
    const catalog = loadBrandArchetypeCatalog("ws-milaene");
    const urban = catalog.archetypes.find((a) => a.id === ARCH_URBAN)!;
    assert.equal(urban.ageRange, "21-24");
    assert.equal(
      urban.bodyDirection,
      "lean to athletic — not bodybuilder — normal healthy proportions wearable in oversized clothing",
    );

    for (const lane of URBAN_SLOT_BLUEPRINTS) {
      assert.equal(lane.ageRange, "21-24");
    }
    for (let i = 0; i < URBAN_SLOT_BLUEPRINTS.length; i++) {
      assert.equal(URBAN_SLOT_BLUEPRINTS[i]!.bodyDirection, FROZEN_BODY_DIRECTIONS[i]);
    }
    for (let i = 0; i < URBAN_DISCOVERY_BLUEPRINTS.length; i++) {
      assert.equal(
        URBAN_DISCOVERY_BLUEPRINTS[i]!.bodyStructure,
        FROZEN_BODY_STRUCTURES[i],
      );
      assert.equal(URBAN_DISCOVERY_BLUEPRINTS[i]!.ageRange, "21-24");
    }

    assert.deepEqual({ ...URBAN_SLOT_MOODS }, {
      A: "approachable lifestyle",
      B: "clean street",
      C: "creative fashion",
      D: "confident campaign",
    });

    assert.equal(URBAN_HAIR_LANE_POOL.length, 12);
    assert.deepEqual(
      URBAN_HAIR_LANE_POOL.map((h) => h.id),
      [...FROZEN_HAIR_LANE_IDS],
    );
    assert.deepEqual([...URBAN_FACE_SHAPE_POOL], [...FROZEN_FACE_SHAPES]);
    assert.ok(URBAN_FACIAL_HAIR_LANE_POOL.includes("clean shaven"));
    assert.ok(URBAN_FACIAL_HAIR_LANE_POOL.includes("light neat stubble"));

    assert.equal(URBAN_FRESH_RUN_RECIPE_VERSION, "2.5B.5");
    assert.equal(URBAN_FRESH_FACE_DNA_VERSION, "2.5B.7");
    assert.equal(URBAN_FACE_IDENTITY_RECIPE_VERSION, "2.5B.7");
    assert.equal(URBAN_FACE_FRESHNESS_VERSION, "2.5B.8");
    assert.equal(URBAN_RECENT_PROJECTS_FOR_FACE_BIAS, 5);
    assert.equal(URBAN_FACE_FRESHNESS_DISTANCE_SATURATION, 0.8);
  });

  it("3. freshness classifications + advisory-only selection lock", () => {
    assert.equal(faceFreshnessScoreFromDistance(null), 100);
    assert.equal(faceFreshnessScoreFromDistance(0.8), 100);
    assert.equal(faceFreshnessScoreFromDistance(0.4), 50);
    assert.equal(faceFreshnessScoreFromDistance(0), 0);
    assert.equal(classifyFaceFreshnessScore(80), "VERY_FRESH");
    assert.equal(classifyFaceFreshnessScore(60), "FRESH");
    assert.equal(classifyFaceFreshnessScore(40), "FAMILIAR");
    assert.equal(classifyFaceFreshnessScore(39), "VERY_FAMILIAR");
    assert.equal(faceFreshnessBlocksSelection(null), false);
    assert.equal(
      faceFreshnessBlocksSelection({
        version: URBAN_FACE_FRESHNESS_VERSION,
        faceFreshnessScore: 0,
        classification: "VERY_FAMILIAR",
        label: "x",
        closestRecentCandidateId: null,
        closestDistance: 0,
        projectsCompared: [],
        samplesCompared: 0,
      }),
      false,
    );
  });

  it("4. novelty + Identity Lock thresholds locked; OpenAI default", () => {
    assert.equal(DISCOVERY_HARD_DUPLICATE_THRESHOLD, 0.3);
    assert.equal(DISCOVERY_WARNING_THRESHOLD, 0.45);
    assert.equal(DISCOVERY_SIMILARITY_THRESHOLD_VERSION, "discovery-v2.5b4");
    assert.equal(classifyDiscoveryFaceDistance(0.5), "PASS");
    assert.equal(classifyDiscoveryFaceDistance(0.4), "WARNING");
    assert.equal(classifyDiscoveryFaceDistance(0.2), "HARD_DUPLICATE");
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
    assert.equal(FACE_SIMILARITY_THRESHOLD_VERSION, "v1.0.0");
    assert.equal(DEFAULT_DISCOVERY_PROVIDER, "openai");
    assert.equal(MAX_PROVIDER_PROMPT_LENGTH, 32_000);
    assert.equal(TARGET_PROVIDER_PROMPT_LENGTH, 28_000);
  });

  it("5. locked Brand Model / historical protection unchanged", () => {
    assert.deepEqual([...HISTORICAL_BLOCKING_PROTECTION_STATUSES], [
      "selected_brand_face",
      "approved_persona",
      "identity_locked",
      "brand_cast_approved",
    ]);
    const filtered = filterDiscoveryOnlyFaceSamples(
      [
        {
          candidateId: "c-lock",
          creationProjectId: "other",
          embedding: [0.1, 0.2],
          historicalProtectionStatus: "identity_locked",
        },
        {
          candidateId: "c-ok",
          creationProjectId: "other",
          embedding: [0.3, 0.4],
          historicalProtectionStatus: "unprotected",
        },
      ],
      FREEZE_PROJECT_ID,
    );
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]!.candidateId, "c-ok");

    const med = readFileSync(
      join(ROOT, "lib/persona/identity-blueprints/urban-slot-blueprints.ts"),
      "utf8",
    );
    assert.doesNotMatch(
      med,
      /724778f9-10df-4b27-8c49-ad4c18eaf5d5|North African Street Premium/i,
    );
  });

  it("6. deterministic freeze project recipe + board prompt fingerprint", () => {
    const a = buildUrbanFreshRunRecipe(FREEZE_PROJECT_ID);
    const b = buildUrbanFreshRunRecipe(FREEZE_PROJECT_ID);
    assert.equal(urbanFreshRunHairComboKey(a), FROZEN_HAIR_COMBO_KEY);
    assert.equal(urbanFreshRunHairComboKey(a), urbanFreshRunHairComboKey(b));
    assert.equal(a.version, "2.5B.5");
    assert.equal(a.faceDna.version, "2.5B.7");
    assert.ok(a.freshFaceDirection.length > 0);
    assert.ok(a.faceIdentityRecipes.A.promptLine.startsWith("Distinct facial identity:"));
    assert.equal(a.slots.A.mood, "approachable lifestyle");
    assert.equal(a.slots.B.mood, "clean street");
    assert.equal(a.slots.C.mood, "creative fashion");
    assert.equal(a.slots.D.mood, "confident campaign");

    const board = frozenBoardPrompt();
    const digest = createHash("sha256").update(board).digest("hex");
    assert.equal(
      digest,
      FROZEN_URBAN_BOARD_PROMPT_SHA256,
      "Urban board prompt fingerprint drifted — casting wording/composition changed",
    );
    assert.match(board, /apparent age 21–24|age 21–24|21–24/i);
    assert.match(board, /lean \/ athletic/i);
    assert.doesNotMatch(board, /naturally slender frame|not bulky, stocky or heavy-set/i);
  });

  it("7. freeze sources do not call paid providers", () => {
    for (const rel of [
      "lib/persona/creation/candidate-intelligence/urban-casting-freeze.ts",
      "lib/persona/creation/candidate-intelligence/premium-casting-direction.ts",
      "lib/persona/creation/candidate-intelligence/prompt-builder.ts",
      "lib/persona/creation/candidate-intelligence/urban-fresh-run-casting.ts",
      "lib/persona/creation/candidate-intelligence/urban-face-identity-recipe.ts",
      "lib/persona/creation/candidate-intelligence/urban-face-freshness.ts",
    ]) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      assert.doesNotMatch(src, /generateOpenAiImage/);
      assert.doesNotMatch(src, /openai\.images\.generate/);
      assert.equal(src.includes("fal.ai"), false);
    }
    const configSrc = readFileSync(
      join(ROOT, "lib/persona/creation/provider/discovery-provider-config.ts"),
      "utf8",
    );
    assert.match(
      configSrc,
      /export const DEFAULT_DISCOVERY_PROVIDER: DiscoveryProviderId = "openai"/,
    );
  });
});
