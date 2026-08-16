/**
 * Phase 2.5B.8 — Fresher + younger Urban model-face casting.
 * Config / scoring only — zero paid provider calls.
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
  classifyFaceFreshnessScore,
  composeProviderPrompt,
  computeUrbanFaceFreshness,
  faceFreshnessBlocksSelection,
  faceFreshnessScoreFromDistance,
  urbanFreshRunHairComboKey,
} from "@/lib/persona/creation/candidate-intelligence";
import type { UrbanFaceEmbeddingSample } from "@/lib/persona/creation/candidate-intelligence";
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
const SAMPLED_AT = "2026-08-16T18:00:00.000Z";

function projectForUrban(projectId: string): PersonaCreationProject {
  const now = new Date().toISOString();
  return {
    id: projectId,
    workspace_id: "ws-milaene",
    name: "OBF Urban 2.5B.8",
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

describe("Phase 2.5B.8 — fresher + younger model-face casting", () => {
  it("1. Urban target age is apparent 21–24", () => {
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

  it("2–3. prompt prevents underage/teenage and keeps compact model-like direction", () => {
    const built = buildCandidatePrompt({
      project: projectForUrban("proj-younger-model"),
      assetType: "portrait_front",
      candidateNumber: 1,
      generationRunId: "run-25b8",
      identitySampledAt: SAMPLED_AT,
    });
    const full = composeProviderPrompt(built, { logBudget: false });
    assert.match(full, /21–24|21-24/);
    assert.match(full, /never underage/i);
    assert.match(full, /teenage|baby-face/i);
    assert.match(
      full,
      /Young fashion-model face with distinctive but believable features/i,
    );
    assert.doesNotMatch(full, /Nose bridge:/i);
    assert.doesNotMatch(full, /millimeter|zygomatic|philtrum/i);
  });

  it("4. facial hair biases younger with light neat stubble allowed", () => {
    let youngMajority = 0;
    let sawLightNeat = false;
    for (let i = 0; i < 25; i += 1) {
      const recipe = buildUrbanFreshRunRecipe(`proj-young-beard-${i}`);
      const lanes = Object.values(recipe.facialHairLanes);
      const younger = lanes.filter((l) =>
        [
          "clean shaven",
          "faint moustache",
          "very light stubble",
          "light neat stubble",
        ].includes(l),
      ).length;
      const beards = lanes.filter((l) => l === "short neat beard").length;
      if (lanes.includes("light neat stubble")) sawLightNeat = true;
      assert.ok(beards <= 1);
      if (younger >= 3) youngMajority += 1;
    }
    assert.ok(youngMajority >= 20);
    assert.equal(sawLightNeat, true);
  });

  it("5. faceFreshnessScore derives from recent embeddings", () => {
    assert.equal(faceFreshnessScoreFromDistance(null), 100);
    assert.equal(faceFreshnessScoreFromDistance(0.8), 100);
    assert.equal(faceFreshnessScoreFromDistance(0.4), 50);
    assert.equal(faceFreshnessScoreFromDistance(0), 0);

    const recent = [
      sample("old-a", "cand-old-a", emb(0), "2026-08-14T10:00:00.000Z"),
      sample("old-b", "cand-old-b", emb(0), "2026-08-15T10:00:00.000Z"),
    ];
    const familiar = computeUrbanFaceFreshness({
      candidateEmbedding: emb(0),
      recentFaceSamples: recent,
      currentCreationProjectId: "proj-new",
    });
    assert.ok(familiar.faceFreshnessScore <= 40);
    assert.equal(familiar.classification, "VERY_FAMILIAR");
    assert.equal(familiar.closestRecentCandidateId, "cand-old-a");
    assert.ok(familiar.projectsCompared.length >= 1);

    const fresh = computeUrbanFaceFreshness({
      candidateEmbedding: emb(7, 1),
      recentFaceSamples: recent,
      currentCreationProjectId: "proj-new",
    });
    assert.ok(fresh.faceFreshnessScore >= 80);
    assert.equal(fresh.classification, "VERY_FRESH");
  });

  it("6. freshness classifications map correctly; novelty thresholds unchanged", () => {
    assert.equal(classifyFaceFreshnessScore(95), "VERY_FRESH");
    assert.equal(classifyFaceFreshnessScore(70), "FRESH");
    assert.equal(classifyFaceFreshnessScore(50), "FAMILIAR");
    assert.equal(classifyFaceFreshnessScore(10), "VERY_FAMILIAR");

    assert.equal(DISCOVERY_HARD_DUPLICATE_THRESHOLD, 0.3);
    assert.equal(DISCOVERY_WARNING_THRESHOLD, 0.45);
    assert.equal(classifyDiscoveryFaceDistance(0.5), "PASS");
    assert.equal(classifyDiscoveryFaceDistance(0.4), "WARNING");
    assert.equal(classifyDiscoveryFaceDistance(0.2), "HARD_DUPLICATE");
  });

  it("7–8. familiar candidates remain selectable; no auto provider retries", () => {
    const familiar = computeUrbanFaceFreshness({
      candidateEmbedding: emb(0),
      recentFaceSamples: [
        sample("p1", "c1", emb(0), "2026-08-14T10:00:00.000Z"),
      ],
      currentCreationProjectId: "proj-x",
    });
    assert.equal(faceFreshnessBlocksSelection(familiar), false);
    assert.match(familiar.classification, /FAMILIAR/);

    const attachSrc = readFileSync(
      join(
        ROOT,
        "lib/persona/creation/candidate-intelligence/attach-urban-face-freshness.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(attachSrc, /generateOpenAiImage|regenerat/i);
    const freshnessSrc = readFileSync(
      join(
        ROOT,
        "lib/persona/creation/candidate-intelligence/urban-face-freshness.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(freshnessSrc, /generateOpenAiImage|fal\.ai/);
  });

  it("9–10. hair system and faceIdentityRecipe architecture unchanged", () => {
    assert.equal(URBAN_HAIR_LANE_POOL.length, 12);
    assert.equal(URBAN_FACE_SHAPE_POOL.length, 8);
    const a = buildUrbanFreshRunRecipe("proj-25b8-stable");
    const b = buildUrbanFreshRunRecipe("proj-25b8-stable", {
      recentFaceSamples: [
        sample("old", "c", emb(1), "2026-08-14T10:00:00.000Z"),
      ],
    });
    assert.deepEqual(a.hairLanes, b.hairLanes);
    assert.equal(urbanFreshRunHairComboKey(a), urbanFreshRunHairComboKey(b));
    assert.ok(a.faceIdentityRecipes.A.promptLine.startsWith("Distinct facial identity:"));
    assert.equal(new Set(Object.values(a.faceIdentityRecipes).map((r) => r.faceShape)).size, 4);
  });

  it("11–13. OpenAI default; no FLUX; Brand Model / Identity Lock untouched", () => {
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
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
    const lock = readFileSync(
      join(ROOT, "lib/persona/creation/identity-lock/identity-lock-service.ts"),
      "utf8",
    );
    assert.match(lock, /lockBrandIdentity/);
  });

  it("14. zero provider calls in freshness / younger casting modules", () => {
    for (const rel of [
      "lib/persona/creation/candidate-intelligence/urban-face-freshness.ts",
      "lib/persona/creation/candidate-intelligence/urban-face-freshness-loader.ts",
      "lib/persona/creation/candidate-intelligence/attach-urban-face-freshness.ts",
    ]) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      assert.doesNotMatch(src, /generateOpenAiImage|fal\.ai|openai\.images/i);
    }
  });
});
