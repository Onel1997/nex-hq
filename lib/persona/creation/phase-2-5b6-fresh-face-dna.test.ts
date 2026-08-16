/**
 * Phase 2.5B.6 — Fresh face DNA across Urban discovery runs.
 * Config / prompt / clustering only — zero paid provider calls.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ARCHETYPE_PROJECT_MARKER } from "@/lib/brand-face-selection/creation-project-mapper";
import type { PersonaCreationProject } from "@/lib/persona/domain/creation-types";
import {
  TARGET_PROVIDER_PROMPT_LENGTH,
  URBAN_FACIAL_EMPHASIS_POOL,
  URBAN_HAIR_LANE_POOL,
  analyzeRecentUrbanFaceClusters,
  buildCandidatePrompt,
  buildUrbanFreshRunRecipe,
  composeProviderPrompt,
  pickUrbanSlotFacialEmphases,
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
const SAMPLED_AT = "2026-08-16T15:00:00.000Z";

function projectForUrban(projectId: string): PersonaCreationProject {
  const now = new Date().toISOString();
  return {
    id: projectId,
    workspace_id: "ws-milaene",
    name: "OBF Urban 2.5B.6",
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

/** Unit embedding helper — place mass on one axis for controllable distance. */
function emb(axis: number, scale = 1): number[] {
  const v = new Array(128).fill(0);
  v[axis] = scale;
  return v;
}

function sample(
  projectId: string,
  candidateId: string,
  embedding: number[],
  extras?: Partial<UrbanFaceEmbeddingSample>,
): UrbanFaceEmbeddingSample {
  return {
    creationProjectId: projectId,
    candidateId,
    embedding,
    historicalProtectionStatus: "unprotected",
    createdAt: extras?.createdAt ?? "2026-08-15T12:00:00.000Z",
    ...extras,
  };
}

describe("Phase 2.5B.6 — fresh face DNA across discovery runs", () => {
  it("1. two fresh Urban projects receive different face-emphasis recipes", () => {
    const a = pickUrbanSlotFacialEmphases("proj-face-dna-aaa");
    const b = pickUrbanSlotFacialEmphases("proj-face-dna-bbb");
    assert.notDeepEqual(a, b);
    assert.equal(new Set(Object.values(a)).size, 4);
    assert.equal(URBAN_FACIAL_EMPHASIS_POOL.length, 14);

    const recipeA = buildUrbanFreshRunRecipe("proj-face-dna-aaa");
    const recipeB = buildUrbanFreshRunRecipe("proj-face-dna-bbb");
    assert.notDeepEqual(recipeA.faceDna.facialEmphasis, recipeB.faceDna.facialEmphasis);
    assert.match(recipeA.freshFaceDirection, /genuinely new person/i);
  });

  it("2. recent dominant face clusters influence future prompt bias", () => {
    const shared = emb(0);
    const recent: UrbanFaceEmbeddingSample[] = [];
    for (let p = 0; p < 3; p += 1) {
      for (let c = 0; c < 3; c += 1) {
        recent.push(
          sample(`old-proj-${p}`, `cand-${p}-${c}`, shared, {
            createdAt: `2026-08-1${p}T10:0${c}:00.000Z`,
          }),
        );
      }
    }
    const analysis = analyzeRecentUrbanFaceClusters(recent, {
      currentCreationProjectId: "proj-new-fresh",
    });
    assert.ok(analysis.recentClustersConsidered >= 1);
    assert.ok(analysis.avoidanceWeight >= 2);
    assert.ok(analysis.dominantClusterAvoided);

    const withBias = buildUrbanFreshRunRecipe("proj-new-fresh", {
      recentFaceSamples: recent,
    });
    const without = buildUrbanFreshRunRecipe("proj-new-fresh");
    assert.ok(withBias.faceDna.avoidanceWeight > without.faceDna.avoidanceWeight);
    assert.match(withBias.freshFaceDirection, /Stronger freshness required/i);

    const prompt = composeProviderPrompt(
      buildCandidatePrompt({
        project: projectForUrban("proj-new-fresh"),
        assetType: "portrait_front",
        candidateNumber: 1,
        generationRunId: "run-bias",
        identitySampledAt: SAMPLED_AT,
        urbanFreshFaceSamples: recent,
      }),
      { logBudget: false },
    );
    assert.match(prompt, /Stronger freshness required|dominant facial proportions/i);
  });

  it("3. prompts do not copy old candidate descriptions", () => {
    const recent = [
      sample("old-a", "SECRET_OLD_CANDIDATE_ID", emb(1), {
        createdAt: "2026-08-14T10:00:00.000Z",
      }),
    ];
    const full = composeProviderPrompt(
      buildCandidatePrompt({
        project: projectForUrban("proj-no-copy-face"),
        assetType: "portrait_front",
        candidateNumber: 2,
        generationRunId: "run-no-copy",
        identitySampledAt: SAMPLED_AT,
        urbanFreshFaceSamples: recent,
      }),
      { logBudget: false },
    );
    assert.doesNotMatch(full, /SECRET_OLD_CANDIDATE_ID/);
    assert.doesNotMatch(full, /Existing siblings in this run/i);
    assert.match(full, /Create a new person not based on previous discovery faces/i);
  });

  it("4. hair rotation remains unchanged when face samples are present", () => {
    assert.equal(URBAN_HAIR_LANE_POOL.length, 12);
    const recent = [
      sample("old-h", "c1", emb(2), { createdAt: "2026-08-14T11:00:00.000Z" }),
      sample("old-h", "c2", emb(2), { createdAt: "2026-08-14T11:01:00.000Z" }),
    ];
    const bare = buildUrbanFreshRunRecipe("proj-hair-stable-25b6");
    const withFace = buildUrbanFreshRunRecipe("proj-hair-stable-25b6", {
      recentFaceSamples: recent,
    });
    assert.deepEqual(bare.hairLanes, withFace.hairLanes);
    assert.equal(
      urbanFreshRunHairComboKey(bare),
      urbanFreshRunHairComboKey(withFace),
    );
  });

  it("5. discovery novelty policy remains PASS/WARNING/HARD_DUPLICATE", () => {
    assert.equal(DISCOVERY_HARD_DUPLICATE_THRESHOLD, 0.3);
    assert.equal(DISCOVERY_WARNING_THRESHOLD, 0.45);
    assert.equal(classifyDiscoveryFaceDistance(0.5), "PASS");
    assert.equal(classifyDiscoveryFaceDistance(0.4), "WARNING");
    assert.equal(classifyDiscoveryFaceDistance(0.2), "HARD_DUPLICATE");
  });

  it("6–7. Identity Lock thresholds unchanged; finalized Brand Models excluded from bias bucket", () => {
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
    const locked: UrbanFaceEmbeddingSample[] = [
      sample("locked-proj", "locked-cand", emb(0), {
        historicalProtectionStatus: "identity_locked",
        createdAt: "2026-08-16T09:00:00.000Z",
      }),
      sample("locked-proj", "selected-cand", emb(0), {
        historicalProtectionStatus: "selected_brand_face",
        createdAt: "2026-08-16T09:01:00.000Z",
      }),
    ];
    const analysis = analyzeRecentUrbanFaceClusters(locked, {
      currentCreationProjectId: "proj-after-lock",
    });
    assert.equal(analysis.sampleCount, 0);
    assert.equal(analysis.avoidanceWeight, 0);
    assert.equal(analysis.dominantClusterAvoided, null);

    const lock = readFileSync(
      join(ROOT, "lib/persona/creation/identity-lock/identity-lock-service.ts"),
      "utf8",
    );
    assert.match(lock, /lockBrandIdentity/);
  });

  it("8. prompts remain under target budget", () => {
    const recent: UrbanFaceEmbeddingSample[] = [];
    for (let i = 0; i < 5; i += 1) {
      recent.push(
        sample(`rp-${i}`, `c-${i}`, emb(0), {
          createdAt: `2026-08-1${i}T12:00:00.000Z`,
        }),
      );
    }
    for (const n of [1, 2, 3, 4]) {
      const built = buildCandidatePrompt({
        project: projectForUrban("proj-budget-25b6"),
        assetType: "portrait_front",
        candidateNumber: n,
        generationRunId: "run-budget",
        identitySampledAt: SAMPLED_AT,
        urbanFreshFaceSamples: recent,
      });
      const full = composeProviderPrompt(built, { logBudget: false });
      assert.ok(
        full.length <= TARGET_PROVIDER_PROMPT_LENGTH,
        `slot ${n} length ${full.length}`,
      );
      assert.ok(built.urbanFreshRunDebug?.freshFaceDirection);
      assert.ok(built.urbanFreshRunDebug?.facialEmphasis.A);
      assert.equal(built.urbanFreshRunDebug?.provider, "openai");
      assert.ok((built.urbanFreshRunDebug?.promptLength ?? 0) > 0);
    }
  });

  it("9–10. OpenAI remains default; no FLUX fallback", () => {
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

  it("11. no provider calls in fresh-face DNA modules", () => {
    const dna = readFileSync(
      join(
        ROOT,
        "lib/persona/creation/candidate-intelligence/urban-fresh-face-dna.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(dna, /generateOpenAiImage|fal\.ai/);
    const loader = readFileSync(
      join(
        ROOT,
        "lib/persona/creation/candidate-intelligence/urban-fresh-face-bias-loader.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(loader, /generateOpenAiImage|fal\.ai/);
  });
});
