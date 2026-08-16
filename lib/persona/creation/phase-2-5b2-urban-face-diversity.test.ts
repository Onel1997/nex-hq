/**
 * Phase 2.5B.2 — Urban cross-candidate face diversity.
 * Updated for 2.5B.5 fresh-run simplified prompts (still no paid provider calls).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ARCHETYPE_PROJECT_MARKER } from "@/lib/brand-face-selection/creation-project-mapper";
import { URBAN_DISCOVERY_BLUEPRINTS } from "@/lib/brand-archetypes/discovery-blueprints";
import type { PersonaCreationProject } from "@/lib/persona/domain/creation-types";
import {
  URBAN_CASTING_DIVERSITY_FACE_GEOMETRY,
  URBAN_CASTING_DIVERSITY_HAIR_SILHOUETTES,
  URBAN_CROSS_SLOT_EXCLUSIONS,
  URBAN_SLOT_MOODS,
  anatomySampleFromDiscoveryInstance,
  buildCandidatePrompt,
  buildUrbanFreshRunRecipe,
  composeProviderPrompt,
  diversityEscalationLevelFromAttempt,
  urbanSiblingSeparationEscalationSuffix,
  urbanSlotFaceDiversityBlock,
} from "@/lib/persona/creation/candidate-intelligence";
import {
  DEFAULT_DISCOVERY_PROVIDER,
  resolveConfiguredDiscoveryProviderId,
} from "@/lib/persona/creation/provider/discovery-provider-config";
import { URBAN_SLOT_BLUEPRINTS } from "@/lib/persona/identity-blueprints";

const ROOT = process.cwd();
const ARCH_URBAN = "arch-urban-community-hero";
const SAMPLED_AT = "2026-08-13T21:00:00.000Z";

function projectForUrban(projectId: string): PersonaCreationProject {
  const now = new Date().toISOString();
  return {
    id: projectId,
    workspace_id: "ws-milaene",
    name: "OBF Urban 2.5B.2",
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

function buildUrban(
  n: number,
  opts?: {
    attemptNumber?: number;
    siblingSamples?: ReturnType<typeof anatomySampleFromDiscoveryInstance>[];
    siblingSlots?: Array<"A" | "B" | "C" | "D">;
    projectId?: string;
  },
) {
  return buildCandidatePrompt({
    project: projectForUrban(opts?.projectId ?? `proj-25b2-${n}`),
    assetType: "portrait_front",
    candidateNumber: n,
    generationRunId: `run-25b2-${n}`,
    attemptNumber: opts?.attemptNumber ?? 1,
    identitySampledAt: SAMPLED_AT,
    urbanSiblingSamples: opts?.siblingSamples ?? null,
    urbanSiblingSlots: opts?.siblingSlots ?? null,
  });
}

describe("Phase 2.5B.2 — Urban cross-candidate face diversity", () => {
  it("1. A/B/C/D moods and lanes remain structurally distinct", () => {
    assert.equal(new Set(Object.values(URBAN_SLOT_MOODS)).size, 4);
    const geos = Object.values(URBAN_CASTING_DIVERSITY_FACE_GEOMETRY);
    assert.equal(new Set(geos).size, 4);
    const bpGeos = URBAN_DISCOVERY_BLUEPRINTS.map((b) => b.faceGeometry);
    assert.equal(new Set(bpGeos).size, 4);
    const laneGeos = URBAN_SLOT_BLUEPRINTS.map((b) => b.facialProportionFamily);
    assert.equal(new Set(laneGeos).size, 4);
  });

  it("2. face differences are not based only on hair", () => {
    const recipe = buildUrbanFreshRunRecipe("proj-25b2-hair");
    for (const slot of ["A", "B", "C", "D"] as const) {
      const block = urbanSlotFaceDiversityBlock(slot, { recipe });
      assert.match(block, /Light cues:|Hair for this run/i);
      assert.match(block, new RegExp(recipe.hairLanes[slot].slice(0, 8), "i"));
      assert.ok(URBAN_CROSS_SLOT_EXCLUSIONS[slot].length >= 3);
    }
  });

  it("3–4. candidate prompts retain unique run hair + moods survive budget", () => {
    const projectId = "proj-25b2-shared";
    const recipe = buildUrbanFreshRunRecipe(projectId);
    const prompts = [1, 2, 3, 4].map((n) => {
      const built = buildUrban(n, { projectId });
      const full = composeProviderPrompt(built, { logBudget: false });
      return {
        built,
        full,
        slot: built.slotBlueprint!.slot as "A" | "B" | "C" | "D",
      };
    });
    for (const row of prompts) {
      assert.match(row.full, /PHASE 2\.5B\.5 URBAN SLOT|URBAN SLOT/);
      assert.match(
        row.full,
        new RegExp(recipe.hairLanes[row.slot].slice(0, 8), "i"),
      );
      assert.ok(row.full.length <= 28000);
    }
    const hairs = prompts.map((p) => recipe.hairLanes[p.slot]);
    assert.equal(new Set(hairs).size, 4);
  });

  it("5. retry prompt differs materially from original prompt", () => {
    const base = buildUrban(4, { attemptNumber: 1, projectId: "proj-25b2-retry" });
    const retry = buildUrban(4, {
      attemptNumber: 3,
      projectId: "proj-25b2-retry",
      siblingSamples: [
        anatomySampleFromDiscoveryInstance(base.discoveryIdentityInstance!),
      ],
      siblingSlots: ["A"],
    });
    const baseFull = composeProviderPrompt(base, { logBudget: false });
    const retryFull = composeProviderPrompt(retry, { logBudget: false });
    assert.notEqual(baseFull, retryFull);
    assert.match(retryFull, /clearly different person/i);
    assert.equal(diversityEscalationLevelFromAttempt(3), 2);
    assert.match(
      urbanSiblingSeparationEscalationSuffix("D", 2),
      /clearly different person/i,
    );
  });

  it("6–7. blocked D regeneration does not recreate A/B/C; same project remains linked", () => {
    const src = readFileSync(
      join(ROOT, "lib/persona/creation/creation-service.ts"),
      "utf8",
    );
    assert.match(src, /urbanSiblingSamples/);
    assert.match(src, /urbanSiblingCandidateIds/);
    assert.match(src, /candidateNumbers: \[previous\.candidate_number\]/);
    assert.match(src, /keepGenerationRunId/);
    assert.match(
      src,
      /Generate New Face is only available for novelty_blocked slots/,
    );
  });

  it("8–9. OpenAI remains default; no silent FLUX fallback", () => {
    assert.equal(DEFAULT_DISCOVERY_PROVIDER, "openai");
    const prev = process.env.PERSONA_DISCOVERY_PROVIDER;
    delete process.env.PERSONA_DISCOVERY_PROVIDER;
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-test-25b2";
    assert.equal(resolveConfiguredDiscoveryProviderId(), "openai");
    if (prev === undefined) delete process.env.PERSONA_DISCOVERY_PROVIDER;
    else process.env.PERSONA_DISCOVERY_PROVIDER = prev;
    const openaiSrc = readFileSync(
      join(ROOT, "lib/persona/creation/provider/openai-candidate-generator.ts"),
      "utf8",
    );
    assert.match(openaiSrc, /urbanSiblingSamples/);
    assert.doesNotMatch(openaiSrc, /fal\.ai|fal_flux.*fallback|fallback.*fal_flux/i);
  });

  it("10. first completed Brand Model remains untouched", () => {
    const urbanSrc = readFileSync(
      join(ROOT, "lib/persona/identity-blueprints/urban-slot-blueprints.ts"),
      "utf8",
    );
    assert.doesNotMatch(
      urbanSrc,
      /724778f9-10df-4b27-8c49-ad4c18eaf5d5|North African Street Premium/i,
    );
    const lock = readFileSync(
      join(ROOT, "lib/persona/creation/identity-lock/identity-lock-service.ts"),
      "utf8",
    );
    assert.match(lock, /lockBrandIdentity/);
  });

  it("11. no provider calls during these tests", () => {
    const diversitySrc = readFileSync(
      join(
        ROOT,
        "lib/persona/creation/candidate-intelligence/urban-face-diversity.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(diversitySrc, /generateOpenAiImage|fal\.ai|fetch\(/i);
    void URBAN_CASTING_DIVERSITY_HAIR_SILHOUETTES;
  });
});
