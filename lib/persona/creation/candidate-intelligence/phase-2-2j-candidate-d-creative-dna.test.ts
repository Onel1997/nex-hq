/**
 * Phase 2.2J — Candidate D Creative DNA Refinement (quality bar only).
 * Preserves Phase 2.2I. Does NOT copy Candidate D identity / embeddings / face match.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getBrandArchetypeBySlug,
  MEDITERRANEAN_DISCOVERY_BLUEPRINTS,
  MILAENE_BRAND_ARCHETYPE_CATALOG,
} from "@/lib/brand-archetypes";
import {
  getMediterraneanSlotBlueprint,
  listMediterraneanSlotBlueprints,
  SLOT_BLUEPRINT_VERSION,
} from "@/lib/persona/identity-blueprints";
import { DISCOVERY_DIVERSITY_PROFILES } from "@/lib/persona/creation/discovery/diversity-profiles";
import { FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD } from "@/lib/persona/face-novelty-memory/similarity-threshold";
import { ARCHETYPE_PROJECT_MARKER } from "@/lib/brand-face-selection/creation-project-mapper";
import type { PersonaCreationProject } from "@/lib/persona/domain/creation-types";
import {
  buildCandidatePrompt,
  CANDIDATE_D_CREATIVE_DNA_NON_GOALS,
  CANDIDATE_D_CREATIVE_DNA_QUALITY,
  composeProviderPrompt,
  PREMIUM_CASTING_QUALITY_REFERENCE,
} from "@/lib/persona/creation/candidate-intelligence";

const ARCH_MED = "arch-mediterranean-premium-hero";
const SAMPLED_AT = "2026-08-08T12:00:00.000Z";
const ROOT = process.cwd();

function projectForArchetype(projectId = "proj-22j"): PersonaCreationProject {
  const now = new Date().toISOString();
  return {
    id: projectId,
    workspace_id: "ws-milaene",
    name: "OBF Discovery 2.2J",
    description: `Official Brand Face. ${ARCHETYPE_PROJECT_MARKER}${ARCH_MED}`,
    gender_presentation: "Male",
    age_range: "22-26",
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

function buildObf(candidateNumber: number) {
  return buildCandidatePrompt({
    project: projectForArchetype(),
    assetType: "portrait_front",
    candidateNumber,
    generationRunId: "run-22j",
    attemptNumber: 1,
    identitySampledAt: SAMPLED_AT,
  });
}

describe("Phase 2.2J Candidate D creative DNA refinement", () => {
  it("1. preserves Phase 2.2I commercial streetwear direction", () => {
    const full = composeProviderPrompt(buildObf(1));
    assert.match(full, /I want to dress like him/i);
    assert.match(full, /22–25|22-25|22–26|22-26/);
    assert.match(full, /softer facial harmony|softer oval|soft masculine/i);
    assert.match(full, /reduce model perfection/i);
    assert.match(full, /Milan, Barcelona, or Berlin|looks good in that outfit/i);
    assert.match(full, /soft even shadows|dramatic facial shadows/i);
  });

  it("2. Mediterranean age remains approximately 22–26", () => {
    const arch = getBrandArchetypeBySlug(
      MILAENE_BRAND_ARCHETYPE_CATALOG,
      "mediterranean-premium-hero",
    );
    assert.match(arch!.ageRange, /^22-2[56]$/);
    for (const bp of MEDITERRANEAN_DISCOVERY_BLUEPRINTS) {
      assert.match(bp.ageRange, /^22-2[56]$/, bp.id);
    }
    for (const bp of listMediterraneanSlotBlueprints()) {
      assert.match(bp.ageRange, /^22-2[56]$/, bp.slot);
    }
  });

  it("3. Candidate-D creative qualities appear as casting QUALITY BAR", () => {
    const full = composeProviderPrompt(buildObf(1));
    assert.match(full, /PHASE 2\.2J — CANDIDATE D CREATIVE DNA/);
    assert.match(full, /QUALITY BAR ONLY/i);
    assert.match(full, /naturally belongs in Milaene/i);
    assert.match(full, /narrow-to-medium face|balanced narrow-to-medium facial width|reduced facial width/i);
    assert.match(full, /defined but subtle jaw|natural medium jaw/i);
    assert.match(full, /expressive warm eyes|relaxed open eyes/i);
    assert.match(full, /balanced brows|naturally thick eyebrows|naturally thick brows/i);
    assert.match(full, /quiet confidence|quiet youthful confidence/i);
    assert.match(full, /effortless charisma|effortless/i);
    assert.match(full, /premium everyday attractiveness|commercially attractive/i);
    for (const token of CANDIDATE_D_CREATIVE_DNA_QUALITY.slice(0, 8)) {
      assert.ok(
        CANDIDATE_D_CREATIVE_DNA_QUALITY.includes(token),
        `quality token registry missing ${token}`,
      );
    }
  });

  it("4. hyper-masculine / runway / perfume direction remains discouraged", () => {
    const full = composeProviderPrompt(buildObf(2));
    for (const token of [
      "hyper masculine",
      "square oversized jaw",
      "perfume",
      "luxury runway",
      "heavy beard",
      "bodybuilder",
      "Instagram model",
      "mature 30+",
    ]) {
      assert.match(full, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    }
    assert.ok(PREMIUM_CASTING_QUALITY_REFERENCE.includes("Fear of God ESSENTIALS"));
    assert.ok(PREMIUM_CASTING_QUALITY_REFERENCE.includes("Aimé Leon Dore"));
  });

  it("5. A/B/C/D biological diversity remains preserved", () => {
    const fps = [1, 2, 3, 4].map(
      (n) => buildObf(n).discoveryIdentityInstance!.anatomyFingerprint,
    );
    assert.equal(new Set(fps).size, 4);
    const regions = MEDITERRANEAN_DISCOVERY_BLUEPRINTS.map(
      (b) => b.diversitySampling.regionalCluster,
    );
    assert.equal(new Set(regions).size, 4);
    const briefs = ["A", "B", "C", "D"].map(
      (s) => DISCOVERY_DIVERSITY_PROFILES[s as "A" | "B" | "C" | "D"].castingBrief,
    );
    assert.equal(new Set(briefs).size, 4);
    assert.match(briefs[0]!, /Iberian|oval/i);
    assert.match(briefs[1]!, /Maghrebi/i);
    assert.match(briefs[2]!, /Greek|Balkan/i);
    assert.match(briefs[3]!, /Levantine/i);
  });

  it("6. Candidate D is NOT encoded as a specific identity", () => {
    const full = composeProviderPrompt(buildObf(4));
    assert.match(full, /QUALITY BAR ONLY|NOT an identity|quality bar only/i);
    assert.match(full, /never brothers|never.*Candidate D face|NOT a locked prior Candidate D/i);
    // Negatives may mention the forbidden behavior; prove we forbid identity lock / face match.
    assert.match(full, /Do NOT copy any prior Candidate D face/i);
    assert.match(full, /NEVER a reference embedding|reference embedding from Candidate D/i);
    assert.doesNotMatch(full, /face match this exact prior Candidate D photo/i);
    assert.doesNotMatch(full, /copy Candidate D's exact nose|exact eye spacing|exact skull/i);
    for (const nonGoal of CANDIDATE_D_CREATIVE_DNA_NON_GOALS) {
      assert.ok(nonGoal.length > 10);
      assert.match(nonGoal, /Do NOT/i);
    }
    const d = MEDITERRANEAN_DISCOVERY_BLUEPRINTS.find((b) => b.slot === "D")!;
    assert.match(d.fashionCasting.facialCharacter, /NOT a locked prior Candidate D identity/i);
  });

  it("7. no face/reference/embedding matching was added in creative files", () => {
    const creativeFiles = [
      "lib/persona/creation/candidate-intelligence/premium-casting-direction.ts",
      "lib/brand-archetypes/archetypes.ts",
      "lib/brand-archetypes/discovery-blueprints.ts",
      "lib/persona/identity-blueprints/slot-blueprints.ts",
      "lib/persona/creation/discovery/diversity-profiles.ts",
    ];
    for (const rel of creativeFiles) {
      const text = readFileSync(join(ROOT, rel), "utf8");
      assert.doesNotMatch(text, /createReferenceEmbedding|faceMatchFromCandidateD|embeddingFromCandidateD/i);
      assert.doesNotMatch(text, /compareToCandidateDEmbedding|lockCandidateDAnatomy/i);
    }
  });

  it("8. novelty threshold remains 0.45", () => {
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
  });

  it("9. provider/orchestration remains unchanged by this phase", () => {
    const untouched = [
      "lib/persona/creation/provider/fal-flux-discovery-provider.ts",
      "lib/persona/creation/discovery/completion-engine.ts",
      "lib/persona/creation/discovery/live-a1-completion-orchestrator.ts",
      "lib/persona/face-novelty-memory/novelty-service.ts",
      "lib/persona/face-novelty-memory/similarity-threshold.ts",
      "lib/persona/face-novelty-memory/historical-protection.ts",
    ];
    for (const rel of untouched) {
      const text = readFileSync(join(ROOT, rel), "utf8");
      assert.ok(text.length > 0, rel);
      assert.doesNotMatch(text, /PHASE 2\.2J — CANDIDATE D CREATIVE DNA/);
      assert.doesNotMatch(text, /CANDIDATE_D_CREATIVE_DNA_QUALITY/);
    }
    assert.equal(SLOT_BLUEPRINT_VERSION, "2.2K.0");
    assert.equal(getMediterraneanSlotBlueprint("A").version, "2.2K.0");
  });
});
