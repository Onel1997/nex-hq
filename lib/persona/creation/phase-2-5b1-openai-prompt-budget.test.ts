/**
 * Phase 2.5B.1 — OpenAI discovery prompt length budget.
 * Config / prompt only — no paid provider calls.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ARCHETYPE_PROJECT_MARKER } from "@/lib/brand-face-selection/creation-project-mapper";
import type { PersonaCreationProject } from "@/lib/persona/domain/creation-types";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import {
  MAX_PROVIDER_PROMPT_LENGTH,
  TARGET_PROVIDER_PROMPT_LENGTH,
  buildCandidatePrompt,
  buildUrbanFreshRunRecipe,
  composeProviderPrompt,
  enforceOpenAiDiscoveryPromptBudget,
} from "@/lib/persona/creation/candidate-intelligence";
import {
  DEFAULT_DISCOVERY_PROVIDER,
  resolveConfiguredDiscoveryProviderId,
} from "@/lib/persona/creation/provider/discovery-provider-config";

const ROOT = process.cwd();
const ARCH_URBAN = "arch-urban-community-hero";
const ARCH_MED = "arch-mediterranean-premium-hero";
const SAMPLED_AT = "2026-08-13T20:00:00.000Z";

function projectForArchetype(
  archetypeId: string,
  projectId: string,
): PersonaCreationProject {
  const now = new Date().toISOString();
  return {
    id: projectId,
    workspace_id: "ws-milaene",
    name: "OBF Discovery 2.5B.1",
    description: `Official Brand Face. ${ARCHETYPE_PROJECT_MARKER}${archetypeId}`,
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

function buildUrban(n: number) {
  return buildCandidatePrompt({
    project: projectForArchetype(ARCH_URBAN, `proj-25b1-urban-${n}`),
    assetType: "portrait_front",
    candidateNumber: n,
    generationRunId: `run-25b1-urban-${n}`,
    identitySampledAt: SAMPLED_AT,
  });
}

describe("Phase 2.5B.1 — OpenAI discovery prompt length budget", () => {
  it("1. all Urban A/B/C/D OpenAI prompts are <= 28,000 chars", () => {
    for (const n of [1, 2, 3, 4] as const) {
      const built = buildUrban(n);
      const full = composeProviderPrompt(built, { logBudget: false });
      assert.ok(
        full.length <= TARGET_PROVIDER_PROMPT_LENGTH,
        `slot ${built.slotBlueprint?.slot} length ${full.length} > ${TARGET_PROVIDER_PROMPT_LENGTH}`,
      );
    }
  });

  it("2. no OpenAI prompt can exceed 32,000 after enforcement", () => {
    for (const n of [1, 2, 3, 4]) {
      const built = buildUrban(n);
      const full = composeProviderPrompt(built, { logBudget: false });
      assert.ok(full.length <= MAX_PROVIDER_PROMPT_LENGTH);
    }
    const med = buildCandidatePrompt({
      project: projectForArchetype(ARCH_MED, "proj-25b1-med"),
      assetType: "portrait_front",
      candidateNumber: 1,
      generationRunId: "run-25b1-med",
      identitySampledAt: SAMPLED_AT,
    });
    const medFull = composeProviderPrompt(med, { logBudget: false });
    assert.ok(medFull.length <= MAX_PROVIDER_PROMPT_LENGTH);
  });

  it("3–5. candidate-specific run hair, dark-skinned male / 21–25 survive", () => {
    const projectId = "proj-25b1-urban-shared";
    const recipe = buildUrbanFreshRunRecipe(projectId);
    for (const n of [1, 2, 3, 4] as const) {
      const built = buildCandidatePrompt({
        project: projectForArchetype(ARCH_URBAN, projectId),
        assetType: "portrait_front",
        candidateNumber: n,
        generationRunId: "run-25b1-shared",
        identitySampledAt: SAMPLED_AT,
      });
      const slot = built.slotBlueprint!.slot as "A" | "B" | "C" | "D";
      const full = composeProviderPrompt(built, { logBudget: false });
      assert.match(
        full,
        new RegExp(recipe.hairLanes[slot].slice(0, 10), "i"),
      );
      assert.match(full, /Black|Afro-European|dark-skinned|deep brown|ebony/i);
      assert.match(full, /21–25|21-25/);
      assert.match(full, /\bmale\b/i);
      assert.match(full, /approachable lifestyle|clean street|creative fashion|confident campaign/i);
    }
  });

  it("6–7. provider remains OpenAI; no silent FLUX fallback", () => {
    assert.equal(DEFAULT_DISCOVERY_PROVIDER, "openai");
    const prev = process.env.PERSONA_DISCOVERY_PROVIDER;
    delete process.env.PERSONA_DISCOVERY_PROVIDER;
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-25b1";
    assert.equal(resolveConfiguredDiscoveryProviderId(), "openai");
    if (prev === undefined) delete process.env.PERSONA_DISCOVERY_PROVIDER;
    else process.env.PERSONA_DISCOVERY_PROVIDER = prev;

    const openaiSrc = readFileSync(
      join(ROOT, "lib/persona/creation/provider/openai-candidate-generator.ts"),
      "utf8",
    );
    assert.match(openaiSrc, /enforceOpenAiDiscoveryPromptBudget|composeProviderPrompt\(built/);
    assert.doesNotMatch(openaiSrc, /fal_flux.*fallback|fallback.*fal_flux/i);
  });

  it("8. no provider call for oversized uncompactable prompt", () => {
    const oversized = "x".repeat(MAX_PROVIDER_PROMPT_LENGTH + 500);
    assert.throws(
      () =>
        enforceOpenAiDiscoveryPromptBudget({
          prompt: oversized,
          provider: "openai",
          candidateSlot: "A",
          allowCompaction: false,
        }),
      (err: unknown) =>
        err instanceof PersonaDomainError && err.code === "PROMPT_TOO_LONG",
    );
  });

  it("9. existing Mediterranean Brand Model / Med casting still under budget and distinct", () => {
    const med = buildCandidatePrompt({
      project: projectForArchetype(ARCH_MED, "proj-25b1-med-b"),
      assetType: "portrait_front",
      candidateNumber: 2,
      generationRunId: "run-25b1-med-b",
      identitySampledAt: SAMPLED_AT,
    });
    const full = composeProviderPrompt(med, { logBudget: false });
    assert.ok(full.length <= TARGET_PROVIDER_PROMPT_LENGTH);
    assert.match(full, /North African|Maghrebi|Mediterranean/i);
    assert.match(full, /PHASE 2\.2L SLOT B CASTING LOCK/);
    const urbanSrc = readFileSync(
      join(ROOT, "lib/persona/identity-blueprints/urban-slot-blueprints.ts"),
      "utf8",
    );
    assert.doesNotMatch(urbanSrc, /lockBrandIdentity|724778f9-10df-4b27-8c49-ad4c18eaf5d5/);
  });

  it("10. zero paid provider calls during these tests", () => {
    const budgetSrc = readFileSync(
      join(ROOT, "lib/persona/creation/candidate-intelligence/prompt-budget.ts"),
      "utf8",
    );
    assert.doesNotMatch(budgetSrc, /generateOpenAiImage|fal\.ai|fetch\(/i);
  });
});
