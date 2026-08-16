/**
 * Phase 2.5B.7 — Stronger Urban facial identity diversity.
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
  URBAN_HAIR_LANE_POOL,
  URBAN_JAW_POOL,
  URBAN_SLOT_MOODS,
  assertUrbanFaceIdentityWithinRunSeparation,
  buildCandidatePrompt,
  buildUrbanFreshRunRecipe,
  composeProviderPrompt,
  pickUrbanFaceIdentityRecipes,
  urbanFreshRunHairComboKey,
} from "@/lib/persona/creation/candidate-intelligence";
import type { UrbanFaceEmbeddingSample } from "@/lib/persona/creation/candidate-intelligence";
import {
  DISCOVERY_HARD_DUPLICATE_THRESHOLD,
  DISCOVERY_WARNING_THRESHOLD,
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
  classifyDiscoveryFaceDistance,
} from "@/lib/persona/face-novelty-memory";
import { DEFAULT_DISCOVERY_PROVIDER } from "@/lib/persona/creation/provider/discovery-provider-config";

const ROOT = process.cwd();
const ARCH_URBAN = "arch-urban-community-hero";
const SAMPLED_AT = "2026-08-16T17:00:00.000Z";
const EXAMPLE_SEED = "proj-face-id-example-seed-25b7";

function projectForUrban(projectId: string): PersonaCreationProject {
  const now = new Date().toISOString();
  return {
    id: projectId,
    workspace_id: "ws-milaene",
    name: "OBF Urban 2.5B.7",
    description: `Official Brand Face. ${ARCHETYPE_PROJECT_MARKER}${ARCH_URBAN}`,
    gender_presentation: "Male",
    age_range: "21-25",
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

function emb(axis: number, scale = 1): number[] {
  const v = new Array(128).fill(0);
  v[axis] = scale;
  return v;
}

function sample(
  projectId: string,
  candidateId: string,
  embedding: number[],
  createdAt: string,
): UrbanFaceEmbeddingSample {
  return {
    creationProjectId: projectId,
    candidateId,
    embedding,
    historicalProtectionStatus: "unprotected",
    createdAt,
  };
}

describe("Phase 2.5B.7 — stronger facial identity diversity", () => {
  it("1–4. fresh Urban project gets 4 distinct faceIdentityRecipes with shape/jaw/eye/nose separation", () => {
    const recipe = buildUrbanFreshRunRecipe(EXAMPLE_SEED);
    const recipes = recipe.faceIdentityRecipes;
    const lines = (["A", "B", "C", "D"] as const).map(
      (s) => recipes[s].promptLine,
    );
    assert.equal(new Set(lines).size, 4);

    const sep = assertUrbanFaceIdentityWithinRunSeparation(recipes);
    assert.equal(sep.faceShapesDistinct, true);
    assert.equal(sep.jawsDistinct, true);
    assert.ok(sep.eyePatterns >= 3, `eyes=${sep.eyePatterns}`);
    assert.ok(sep.nosePatterns >= 3, `noses=${sep.nosePatterns}`);
    assert.equal(sep.ok, true);

    for (const slot of ["A", "B", "C", "D"] as const) {
      assert.match(recipes[slot].promptLine, /^Distinct facial identity:/);
      assert.ok(URBAN_FACE_SHAPE_POOL.includes(recipes[slot].faceShape));
      assert.ok(URBAN_JAW_POOL.includes(recipes[slot].jaw));
    }

    // Example A/B/C/D for the report (deterministic seed).
    assert.ok(recipe.slots.A.faceIdentityRecipe.promptLine.length > 20);
    assert.ok(recipe.slots.D.faceIdentityRecipe.promptLine.length > 20);
  });

  it("5. face recipe changes across Creation Projects", () => {
    const a = buildUrbanFreshRunRecipe("proj-face-id-aaa");
    const b = buildUrbanFreshRunRecipe("proj-face-id-bbb");
    const key = (r: typeof a) =>
      (["A", "B", "C", "D"] as const)
        .map((s) => r.faceIdentityRecipes[s].promptLine)
        .join(" || ");
    assert.notEqual(key(a), key(b));
    assert.notDeepEqual(a.faceIdentityRecipes, b.faceIdentityRecipes);
  });

  it("6. slot mood labels do not permanently map to one anatomy recipe", () => {
    const shapeBySlotA = new Set<string>();
    const jawBySlotA = new Set<string>();
    for (let i = 0; i < 30; i += 1) {
      const recipe = buildUrbanFreshRunRecipe(`proj-slot-rotate-${i}`);
      assert.equal(recipe.slots.A.mood, URBAN_SLOT_MOODS.A);
      assert.equal(recipe.slots.B.mood, URBAN_SLOT_MOODS.B);
      shapeBySlotA.add(recipe.faceIdentityRecipes.A.faceShape);
      jawBySlotA.add(recipe.faceIdentityRecipes.A.jaw);
    }
    assert.ok(
      shapeBySlotA.size >= 3,
      `slot A shapes should rotate, got ${[...shapeBySlotA].join(", ")}`,
    );
    assert.ok(
      jawBySlotA.size >= 3,
      `slot A jaws should rotate, got ${[...jawBySlotA].join(", ")}`,
    );
  });

  it("7. recent cluster memory biases toward underused face recipes", () => {
    const recentIds = [
      "old-face-bias-0",
      "old-face-bias-1",
      "old-face-bias-2",
      "old-face-bias-3",
      "old-face-bias-4",
    ];
    const recentSamples: UrbanFaceEmbeddingSample[] = [];
    for (let p = 0; p < recentIds.length; p += 1) {
      for (let c = 0; c < 3; c += 1) {
        recentSamples.push(
          sample(recentIds[p]!, `c-${p}-${c}`, emb(0), `2026-08-1${p}T10:0${c}:00.000Z`),
        );
      }
    }

    const baseline = pickUrbanFaceIdentityRecipes("proj-new-biased", {
      recentProjectIds: [],
      avoidanceWeight: 0,
    });
    const biased = pickUrbanFaceIdentityRecipes("proj-new-biased", {
      recentProjectIds: recentIds,
      avoidanceWeight: 3,
    });
    assert.ok(biased.recentProjectsBiasedAgainst.length >= 3);

    const usageScore = (set: typeof baseline) => {
      let score = 0;
      for (const slot of ["A", "B", "C", "D"] as const) {
        const r = set.recipes[slot];
        score += biased.recentTraitUsage.faceShape[r.faceShape] ?? 0;
        score += biased.recentTraitUsage.jaw[r.jaw] ?? 0;
        score += biased.recentTraitUsage.eyes[r.eyes] ?? 0;
        score += biased.recentTraitUsage.nose[r.nose] ?? 0;
      }
      return score;
    };
    // Biased selection should prefer underused traits vs pure baseline.
    assert.ok(
      usageScore(biased) <= usageScore(baseline),
      `biased=${usageScore(biased)} baseline=${usageScore(baseline)}`,
    );

    const withSamples = buildUrbanFreshRunRecipe("proj-new-biased", {
      recentFaceSamples: recentSamples,
    });
    assert.ok(withSamples.faceDna.avoidanceWeight >= 2);
    assert.match(
      withSamples.freshFaceDirection,
      /Stronger freshness required|genuinely different individual/i,
    );
    assert.match(
      withSamples.slots.A.faceIdentityRecipe.promptLine,
      /Distinct facial identity:/,
    );
  });

  it("8. hair rotation remains unchanged when face samples / face recipes are present", () => {
    assert.equal(URBAN_HAIR_LANE_POOL.length, 12);
    const recent = [
      sample("old-h7", "c1", emb(2), "2026-08-14T11:00:00.000Z"),
      sample("old-h7", "c2", emb(2), "2026-08-14T11:01:00.000Z"),
    ];
    const bare = buildUrbanFreshRunRecipe("proj-hair-stable-25b7");
    const withFace = buildUrbanFreshRunRecipe("proj-hair-stable-25b7", {
      recentFaceSamples: recent,
    });
    assert.deepEqual(bare.hairLanes, withFace.hairLanes);
    assert.equal(
      urbanFreshRunHairComboKey(bare),
      urbanFreshRunHairComboKey(withFace),
    );
  });

  it("9. novelty thresholds remain PASS / WARNING / HARD_DUPLICATE unchanged", () => {
    assert.equal(DISCOVERY_HARD_DUPLICATE_THRESHOLD, 0.3);
    assert.equal(DISCOVERY_WARNING_THRESHOLD, 0.45);
    assert.equal(classifyDiscoveryFaceDistance(0.5), "PASS");
    assert.equal(classifyDiscoveryFaceDistance(0.4), "WARNING");
    assert.equal(classifyDiscoveryFaceDistance(0.2), "HARD_DUPLICATE");
  });

  it("10. Identity Lock thresholds remain unchanged", () => {
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
    const lock = readFileSync(
      join(ROOT, "lib/persona/creation/identity-lock/identity-lock-service.ts"),
      "utf8",
    );
    assert.match(lock, /lockBrandIdentity/);
  });

  it("11–12. OpenAI remains default; no FLUX fallback", () => {
    assert.equal(DEFAULT_DISCOVERY_PROVIDER, "openai");
    const configSrc = readFileSync(
      join(ROOT, "lib/persona/creation/provider/discovery-provider-config.ts"),
      "utf8",
    );
    assert.match(
      configSrc,
      /export const DEFAULT_DISCOVERY_PROVIDER: DiscoveryProviderId = "openai"/,
    );
    assert.doesNotMatch(
      configSrc,
      /export const DEFAULT_DISCOVERY_PROVIDER: DiscoveryProviderId = "fal_flux"/,
    );
  });

  it("13. debug exposes faceIdentityRecipe / hairLane / facialHairLane / recentClusters", () => {
    const built = buildCandidatePrompt({
      project: projectForUrban(EXAMPLE_SEED),
      assetType: "portrait_front",
      candidateNumber: 1,
      generationRunId: "run-debug-25b7",
      identitySampledAt: SAMPLED_AT,
    });
    const full = composeProviderPrompt(built, { logBudget: false });
    const debug = built.urbanFreshRunDebug;
    assert.ok(debug);
    assert.equal(debug!.creationProjectId, EXAMPLE_SEED);
    assert.ok(debug!.variationSeed.length > 0);
    assert.equal(debug!.slot, "A");
    assert.ok(debug!.hairLane);
    assert.ok(debug!.facialHairLane);
    assert.ok(debug!.faceIdentityRecipe);
    assert.match(debug!.faceIdentityRecipe!, /Distinct facial identity:/);
    assert.ok(typeof debug!.recentClustersConsidered === "number");
    assert.ok(debug!.freshFaceDirection.length > 0);
    assert.equal(debug!.provider, "openai");
    assert.ok((debug!.promptLength ?? 0) > 0);
    assert.ok(full.length > 100);
    assert.match(full, /Distinct facial identity:/);
    assert.match(full, /genuinely different individual/i);
  });

  it("14. facial hair biases younger; not all bearded", () => {
    let sawYoungerMajority = false;
    for (let i = 0; i < 20; i += 1) {
      const recipe = buildUrbanFreshRunRecipe(`proj-beard-mix-${i}`);
      const lanes = (["A", "B", "C", "D"] as const).map(
        (s) => recipe.facialHairLanes[s],
      );
      const younger = lanes.filter(
        (l) =>
          l === "clean shaven" ||
          l === "faint moustache" ||
          l === "very light stubble" ||
          l === "light neat stubble",
      ).length;
      const bearded = lanes.filter((l) => l === "short neat beard").length;
      assert.ok(younger >= 3, `expected mostly younger grooming, got ${lanes.join("|")}`);
      assert.ok(bearded <= 1, `expected at most one beard, got ${lanes.join("|")}`);
      if (younger >= 3) sawYoungerMajority = true;
    }
    assert.equal(sawYoungerMajority, true);
  });

  it("15. no provider calls in face-identity modules", () => {
    const recipeSrc = readFileSync(
      join(
        ROOT,
        "lib/persona/creation/candidate-intelligence/urban-face-identity-recipe.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(recipeSrc, /generateOpenAiImage|fal\.ai/);
    const dna = readFileSync(
      join(
        ROOT,
        "lib/persona/creation/candidate-intelligence/urban-fresh-face-dna.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(dna, /generateOpenAiImage|fal\.ai/);
  });
});
