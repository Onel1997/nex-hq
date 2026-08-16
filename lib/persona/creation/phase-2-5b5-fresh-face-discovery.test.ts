/**
 * Phase 2.5B.5 — Simple fresh face discovery for Urban Community Hero.
 * Config / prompt only — zero paid provider calls.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ARCHETYPE_PROJECT_MARKER } from "@/lib/brand-face-selection/creation-project-mapper";
import type { PersonaCreationProject } from "@/lib/persona/domain/creation-types";
import {
  URBAN_HAIR_LANE_POOL,
  URBAN_SLOT_MOODS,
  buildCandidatePrompt,
  buildUrbanFreshRunRecipe,
  composeProviderPrompt,
  urbanFreshRunHairComboKey,
  urbanSlotFaceDiversityBlock,
} from "@/lib/persona/creation/candidate-intelligence";
import {
  DISCOVERY_HARD_DUPLICATE_THRESHOLD,
  DISCOVERY_WARNING_THRESHOLD,
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
  classifyDiscoveryFaceDistance,
} from "@/lib/persona/face-novelty-memory";
import { DEFAULT_DISCOVERY_PROVIDER } from "@/lib/persona/creation/provider/discovery-provider-config";

const ROOT = process.cwd();
const ARCH_URBAN = "arch-urban-community-hero";
const SAMPLED_AT = "2026-08-13T22:00:00.000Z";

function projectForUrban(projectId: string): PersonaCreationProject {
  const now = new Date().toISOString();
  return {
    id: projectId,
    workspace_id: "ws-milaene",
    name: "OBF Urban 2.5B.5",
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

describe("Phase 2.5B.5 — simple fresh Urban face discovery", () => {
  it("1. two fresh Urban projects do not receive identical A/B/C/D recipes", () => {
    const a = buildUrbanFreshRunRecipe("proj-urban-fresh-aaa");
    const b = buildUrbanFreshRunRecipe("proj-urban-fresh-bbb");
    assert.notEqual(a.variationSeed, b.variationSeed);
    assert.notEqual(
      urbanFreshRunHairComboKey(a),
      urbanFreshRunHairComboKey(b),
    );
    const promptsA = [1, 2, 3, 4].map((n) =>
      composeProviderPrompt(
        buildCandidatePrompt({
          project: projectForUrban("proj-urban-fresh-aaa"),
          assetType: "portrait_front",
          candidateNumber: n,
          generationRunId: "run-a",
          identitySampledAt: SAMPLED_AT,
        }),
        { logBudget: false },
      ),
    );
    const promptsB = [1, 2, 3, 4].map((n) =>
      composeProviderPrompt(
        buildCandidatePrompt({
          project: projectForUrban("proj-urban-fresh-bbb"),
          assetType: "portrait_front",
          candidateNumber: n,
          generationRunId: "run-b",
          identitySampledAt: SAMPLED_AT,
        }),
        { logBudget: false },
      ),
    );
    assert.notEqual(promptsA.join("\n---\n"), promptsB.join("\n---\n"));
  });

  it("2–4. hair combinations rotate; longer styles and short styles both possible", () => {
    assert.equal(URBAN_HAIR_LANE_POOL.length, 12);
    assert.ok(URBAN_HAIR_LANE_POOL.some((h) => h.id === "braids"));
    assert.ok(URBAN_HAIR_LANE_POOL.some((h) => h.id === "cornrows"));
    assert.ok(URBAN_HAIR_LANE_POOL.some((h) => h.id === "medium_locs"));
    assert.ok(URBAN_HAIR_LANE_POOL.some((h) => h.id === "very_short_buzz"));
    assert.ok(URBAN_HAIR_LANE_POOL.some((h) => h.length === "short"));
    assert.ok(URBAN_HAIR_LANE_POOL.some((h) => h.length !== "short"));

    const combos = new Set<string>();
    let sawLonger = false;
    let sawShort = false;
    for (let i = 0; i < 40; i += 1) {
      const recipe = buildUrbanFreshRunRecipe(`proj-hair-rotate-${i}`);
      combos.add(urbanFreshRunHairComboKey(recipe));
      for (const slot of ["A", "B", "C", "D"] as const) {
        const cue = recipe.slots[slot];
        if (cue.hairLength === "short") sawShort = true;
        else sawLonger = true;
      }
    }
    assert.ok(combos.size >= 8, `expected rotating combos, got ${combos.size}`);
    assert.equal(sawShort, true);
    assert.equal(sawLonger, true);
  });

  it("5. face prompts remain simple — no micro-anatomy essays / no prior geometry injection", () => {
    const built = buildCandidatePrompt({
      project: projectForUrban("proj-urban-simple-face"),
      assetType: "portrait_front",
      candidateNumber: 1,
      generationRunId: "run-simple",
      identitySampledAt: SAMPLED_AT,
    });
    const full = composeProviderPrompt(built, { logBudget: false });
    assert.match(full, /Create a new person not based on previous discovery faces/i);
    assert.match(full, /Do NOT force detailed fixed jaw/i);
    assert.doesNotMatch(full, /Nose bridge:/i);
    assert.doesNotMatch(full, /Exact facial anatomy below is authoritative/i);
    assert.doesNotMatch(full, /Existing siblings in this run/i);
    assert.equal(URBAN_SLOT_MOODS.A, "approachable lifestyle");
    assert.equal(URBAN_SLOT_MOODS.D, "confident campaign");
    const block = urbanSlotFaceDiversityBlock("B", {
      recipe: built.urbanFreshRunDebug
        ? buildUrbanFreshRunRecipe("proj-urban-simple-face")
        : null,
      creationProjectId: "proj-urban-simple-face",
    });
    assert.match(block, /clean street/i);
    assert.doesNotMatch(block, /MANDATORY/);
  });

  it("6. previous discovery candidate descriptions are not injected into prompts", () => {
    const diversitySrc = readFileSync(
      join(
        ROOT,
        "lib/persona/creation/candidate-intelligence/urban-face-diversity.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(
      diversitySrc,
      /Existing siblings in this run \(look different\)/,
    );
    const full = composeProviderPrompt(
      buildCandidatePrompt({
        project: projectForUrban("proj-no-prior-copy"),
        assetType: "portrait_front",
        candidateNumber: 4,
        generationRunId: "run-no-prior",
        identitySampledAt: SAMPLED_AT,
      }),
      { logBudget: false },
    );
    assert.match(full, /Create a new person not based on previous discovery faces/i);
    assert.doesNotMatch(full, /Existing siblings in this run/i);
    assert.doesNotMatch(full, /SECRET_PRIOR_/);
  });

  it("7. locked Brand Model / identity-lock thresholds remain protected", () => {
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
    const lock = readFileSync(
      join(ROOT, "lib/persona/creation/identity-lock/identity-lock-service.ts"),
      "utf8",
    );
    assert.match(lock, /lockBrandIdentity/);
    const urbanSrc = readFileSync(
      join(ROOT, "lib/persona/identity-blueprints/urban-slot-blueprints.ts"),
      "utf8",
    );
    assert.doesNotMatch(
      urbanSrc,
      /724778f9-10df-4b27-8c49-ad4c18eaf5d5|North African Street Premium/i,
    );
  });

  it("8. PASS / WARNING / HARD_DUPLICATE unchanged", () => {
    assert.equal(DISCOVERY_HARD_DUPLICATE_THRESHOLD, 0.3);
    assert.equal(DISCOVERY_WARNING_THRESHOLD, 0.45);
    assert.equal(classifyDiscoveryFaceDistance(0.5), "PASS");
    assert.equal(classifyDiscoveryFaceDistance(0.4), "WARNING");
    assert.equal(classifyDiscoveryFaceDistance(0.2), "HARD_DUPLICATE");
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

  it("11. fresh-run debug exposes seed + hair lanes; no provider calls in module", () => {
    const built = buildCandidatePrompt({
      project: projectForUrban("proj-urban-debug"),
      assetType: "portrait_front",
      candidateNumber: 2,
      generationRunId: "run-debug",
      identitySampledAt: SAMPLED_AT,
    });
    assert.ok(built.urbanFreshRunDebug);
    assert.equal(built.urbanFreshRunDebug!.creationProjectId, "proj-urban-debug");
    assert.ok(built.urbanFreshRunDebug!.variationSeed.length > 0);
    assert.ok(built.urbanFreshRunDebug!.hairLanes.A);
    assert.ok(built.urbanFreshRunDebug!.hairLanes.D);
    const full = composeProviderPrompt(built, {
      provider: "openai",
      logBudget: false,
    });
    assert.equal(built.urbanFreshRunDebug!.provider, "openai");
    assert.ok((built.urbanFreshRunDebug!.promptLength ?? 0) > 0);
    assert.ok(full.length > 100);
    const freshSrc = readFileSync(
      join(
        ROOT,
        "lib/persona/creation/candidate-intelligence/urban-fresh-run-casting.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(freshSrc, /generateOpenAiImage|fal\.ai|fetch\(/i);
  });

  it("same project id yields stable recipe", () => {
    const a = buildUrbanFreshRunRecipe("stable-urban-project");
    const b = buildUrbanFreshRunRecipe("stable-urban-project");
    assert.deepEqual(a.hairLanes, b.hairLanes);
    assert.equal(a.variationSeed, b.variationSeed);
  });
});
