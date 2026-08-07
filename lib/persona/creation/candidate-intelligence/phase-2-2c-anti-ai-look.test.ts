/**
 * Phase 2.2C — Remove AI look from discovery faces (prompt direction only).
 * No paid provider calls. Architecture / novelty / seeds untouched.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ARCHETYPE_PROJECT_MARKER } from "@/lib/brand-face-selection/creation-project-mapper";
import type { PersonaCreationProject } from "@/lib/persona/domain/creation-types";
import {
  buildCandidatePrompt,
  composeProviderPrompt,
  PREMIUM_PROMPT_REQUIRED_TOKENS,
} from "@/lib/persona/creation/candidate-intelligence";

const ARCH_MED = "arch-mediterranean-premium-hero";
const SAMPLED_AT = "2026-08-07T18:00:00.000Z";

function projectForArchetype(projectId = "proj-22c"): PersonaCreationProject {
  const now = new Date().toISOString();
  return {
    id: projectId,
    workspace_id: "ws-milaene",
    name: "OBF Discovery 2.2C",
    description: `Official Brand Face. ${ARCHETYPE_PROJECT_MARKER}${ARCH_MED}`,
    gender_presentation: "Male",
    age_range: "24-30",
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
    brand_role: "primary_male",
    visual_keywords: "homepage shopify",
    preferred_brand_looks: "",
    preferred_outfits: "oversized heavyweight tee",
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

function buildObf(candidateNumber: number, generationRunId = "run-22c") {
  return buildCandidatePrompt({
    project: projectForArchetype(),
    assetType: "portrait_front",
    candidateNumber,
    generationRunId,
    attemptNumber: 1,
    identitySampledAt: SAMPLED_AT,
  });
}

describe("Phase 2.2C remove AI look from discovery faces", () => {
  it("keeps four distinct identities across A/B/C/D", () => {
    const fps = [1, 2, 3, 4].map(
      (n) => buildObf(n).discoveryIdentityInstance!.anatomyFingerprint,
    );
    assert.equal(new Set(fps).size, 4);
  });

  it("prioritizes real human photograph before brand DNA and wardrobe styling", () => {
    const built = buildObf(1);
    const realIdx = built.prompt.indexOf("REAL HUMAN PHOTOGRAPH");
    const l3Idx = built.prompt.indexOf("DISCOVERY IDENTITY INSTANCE (L3)");
    const realismIdx = built.prompt.indexOf("PHOTOGRAPHIC REALISM");
    const garmentIdx = built.prompt.indexOf("A1 SIMPLE WARDROBE");
    const cameraIdx = built.prompt.indexOf("CAMERA DIRECTION — SLOT A");
    const brandIdx = built.prompt.indexOf("BRAND DNA");

    assert.ok(realIdx >= 0 && realIdx < l3Idx);
    assert.ok(l3Idx < realismIdx);
    assert.ok(realismIdx < garmentIdx);
    assert.ok(garmentIdx < cameraIdx);
    assert.ok(cameraIdx < brandIdx);
  });

  it("includes strong realism instructions", () => {
    const full = composeProviderPrompt(buildObf(2));
    assert.match(full, /real unretouched human skin/i);
    assert.match(full, /visible natural pores/i);
    assert.match(full, /slight eye asymmetry/i);
    assert.match(full, /under-eye texture/i);
    assert.match(full, /individual imperfect hair strands/i);
    assert.match(full, /believable fabric texture/i);
    assert.match(full, /agency casting/i);
    assert.match(full, /NOT a finished advertising campaign/i);
  });

  it("suppresses AI / plastic / beauty language in negatives", () => {
    const full = composeProviderPrompt(buildObf(3));
    for (const token of [
      "plastic skin",
      "wax skin",
      "beauty filter",
      "perfect symmetry",
      "perfect jawlines",
      "Instagram AI model",
      "Midjourney aesthetic",
      "hyper-polished fashion avatar",
      "excessive cinematic glow",
      "orange teal grading",
      "CGI",
      "3d render",
    ]) {
      assert.match(full, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    }
  });

  it("keeps distinct per-slot camera lenses without extreme bokeh", () => {
    const lenses = [1, 2, 3, 4].map((n) => {
      const prompt = buildObf(n).prompt;
      const match = prompt.match(/Lens: ~[^\n]+/);
      assert.ok(match, `missing lens for candidate ${n}`);
      assert.match(prompt, /avoid extreme bokeh/i);
      return match![0];
    });
    assert.equal(new Set(lenses).size, 4);
  });

  it("contains required premium tokens and no Identity Lock wording", () => {
    const built = buildObf(1);
    const full = composeProviderPrompt(built);
    for (const token of PREMIUM_PROMPT_REQUIRED_TOKENS) {
      assert.match(full, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.doesNotMatch(full, /Lock this Identity DNA/i);
    assert.doesNotMatch(full, /do not invent a different person/i);
    assert.doesNotMatch(full, /Keep identity requirements fixed/i);
    assert.doesNotMatch(full, /CANDIDATE IDENTITY LOCK/i);
  });

  it("does not modify provider or novelty architecture files in this phase", () => {
    const root = process.cwd();
    const untouched = [
      "lib/persona/creation/provider/fal-flux-discovery-provider.ts",
      "lib/persona/creation/provider/fal-flux-candidate-generator.ts",
      "lib/persona/creation/discovery/completion-engine.ts",
      "lib/persona/creation/discovery/completion-budget.ts",
      "lib/persona/face-novelty-memory/novelty-service.ts",
      "lib/persona/face-novelty-memory/similarity-threshold.ts",
    ];
    for (const rel of untouched) {
      const text = readFileSync(join(root, rel), "utf8");
      assert.ok(text.length > 0, rel);
      assert.doesNotMatch(text, /REAL HUMAN PHOTOGRAPH — A1 DISCOVERY PRIORITY/);
    }
  });
});
