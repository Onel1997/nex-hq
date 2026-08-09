/**
 * Phase 2.2L — Restore Strong A/B/C/D Casting Diversity.
 * Creative direction only. Keeps 2.2K softer commercial quality.
 * No architecture / novelty / embedding / Candidate-D face-copy changes.
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
  CASTING_DIVERSITY_FACE_GEOMETRY,
  CASTING_DIVERSITY_HAIR_SILHOUETTES,
  composeProviderPrompt,
  SOFTER_PRIMARY_STREETWEAR_FACE_QUALITY,
  CANDIDATE_D_CREATIVE_DNA_NON_GOALS,
} from "@/lib/persona/creation/candidate-intelligence";

const ARCH_MED = "arch-mediterranean-premium-hero";
const SAMPLED_AT = "2026-08-08T17:00:00.000Z";
const ROOT = process.cwd();

function projectForArchetype() {
  const now = new Date().toISOString();
  return {
    id: "proj-22l",
    workspace_id: "ws-milaene",
    name: "OBF Discovery 2.2L",
    description: `Official Brand Face. ${ARCHETYPE_PROJECT_MARKER}${ARCH_MED}`,
    gender_presentation: "Male",
    age_range: "22-25",
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
  } satisfies PersonaCreationProject;
}

function buildObf(candidateNumber: number) {
  return buildCandidatePrompt({
    project: projectForArchetype(),
    assetType: "portrait_front",
    candidateNumber,
    generationRunId: "run-22l",
    attemptNumber: 1,
    identitySampledAt: SAMPLED_AT,
  });
}

function medBySlot(slot: "A" | "B" | "C" | "D") {
  return MEDITERRANEAN_DISCOVERY_BLUEPRINTS.find((b) => b.slot === slot)!;
}

describe("Phase 2.2L restore strong A/B/C/D casting diversity", () => {
  it("1. 2.2K softer commercial direction remains intact", () => {
    const full = composeProviderPrompt(buildObf(1));
    assert.match(full, /PHASE 2\.2K — SOFTER PRIMARY STREETWEAR FACE/);
    assert.match(full, /70% approachable commercial/i);
    assert.match(full, /soft masculine/i);
    assert.match(full, /He looks good in that outfit/);
    assert.ok(SOFTER_PRIMARY_STREETWEAR_FACE_QUALITY.includes("apparent age 22–25"));
  });

  it("2. age remains approximately 22–25", () => {
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
    assert.match(composeProviderPrompt(buildObf(2)), /22–25|22-25/);
  });

  it("3. at least 3 distinct hair silhouette families across A/B/C/D", () => {
    const haircuts = {
      A: medBySlot("A").haircut,
      B: medBySlot("B").haircut,
      C: medBySlot("C").haircut,
      D: medBySlot("D").haircut,
    };
    assert.match(haircuts.A, /short textured crop|short curls|clean taper/i);
    assert.match(haircuts.A, /NO medium-long waves/i);
    assert.match(haircuts.B, /very short crop|buzz-adjacent|tight short curls/i);
    assert.match(haircuts.B, /NO loose long curls/i);
    assert.match(haircuts.C, /medium-length relaxed waves/i);
    assert.match(haircuts.D, /short messy curls|short natural textured|soft taper/i);
    assert.match(haircuts.D, /NO long editorial/i);

    const pools = {
      A: getMediterraneanSlotBlueprint("A").controlledPools.haircut,
      B: getMediterraneanSlotBlueprint("B").controlledPools.haircut,
      C: getMediterraneanSlotBlueprint("C").controlledPools.haircut,
      D: getMediterraneanSlotBlueprint("D").controlledPools.haircut,
    };
    assert.ok(pools.A.every((h) => /short .+crop|short curls|clean taper/i.test(h)));
    assert.ok(pools.A.every((h) => !/medium-length relaxed waves|relaxed wavy medium top/i.test(h)));
    assert.ok(pools.B.every((h) => /very short|buzz|tight short|fade/i.test(h)));
    assert.ok(pools.C.every((h) => /medium/i.test(h) && /wav/i.test(h)));
    assert.ok(pools.D.every((h) => /short messy|short natural|soft taper|curly crop/i.test(h)));
    assert.ok(pools.D.every((h) => !/medium-length relaxed waves/i.test(h)));

    assert.equal(new Set(Object.values(CASTING_DIVERSITY_HAIR_SILHOUETTES)).size, 4);
    assert.ok(Object.values(CASTING_DIVERSITY_HAIR_SILHOUETTES).length >= 3);
  });

  it("4. only one slot strongly prefers medium/long waves", () => {
    const fullC = composeProviderPrompt(buildObf(3));
    assert.match(fullC, /ONLY slot that strongly prefers medium-length relaxed waves/i);
    assert.match(medBySlot("C").haircut, /ONLY slot where longer\/wavier hair is strongly preferred/i);
    assert.match(DISCOVERY_DIVERSITY_PROFILES.C.castingBrief, /ONLY slot for longer\/wavier hair/i);

    for (const slot of ["A", "B", "D"] as const) {
      assert.doesNotMatch(medBySlot(slot).haircut, /strongly preferred.*wave|ONLY slot.*wave/i);
      assert.ok(
        /NO medium-long waves|NO loose long curls|NO long editorial|NO medium-length waves/i.test(
          medBySlot(slot).haircut,
        ),
        slot,
      );
    }
  });

  it("5. face geometry differs materially across slots", () => {
    const geos = MEDITERRANEAN_DISCOVERY_BLUEPRINTS.map((b) => b.faceGeometry);
    assert.equal(new Set(geos).size, 4);
    assert.match(medBySlot("A").faceGeometry, /soft oval|slightly rectangular/i);
    assert.match(medBySlot("B").faceGeometry, /narrower elongated/i);
    assert.match(medBySlot("C").faceGeometry, /wider upper face|softer lower face/i);
    assert.match(medBySlot("D").faceGeometry, /balanced narrow-to-medium|subtle angularity/i);
    assert.equal(new Set(Object.values(CASTING_DIVERSITY_FACE_GEOMETRY)).size, 4);

    for (const slot of ["A", "B", "C", "D"] as const) {
      const full = composeProviderPrompt(
        buildObf({ A: 1, B: 2, C: 3, D: 4 }[slot]),
      );
      assert.match(full, /PHASE 2\.2L SLOT [ABCD] CASTING LOCK/);
      assert.match(full, new RegExp(CASTING_DIVERSITY_FACE_GEOMETRY[slot].slice(0, 24), "i"));
    }
  });

  it("6. regional diversity remains", () => {
    const regions = MEDITERRANEAN_DISCOVERY_BLUEPRINTS.map(
      (b) => b.diversitySampling.regionalCluster,
    );
    assert.equal(new Set(regions).size, 4);
    assert.match(regions[0]!, /Iberian|Spanish/i);
    assert.match(regions[1]!, /Maghrebi|North African/i);
    assert.match(regions[2]!, /Greek|Balkan/i);
    assert.match(regions[3]!, /Levantine|Lebanese/i);
    assert.equal(
      new Set(Object.values(DISCOVERY_DIVERSITY_PROFILES).map((p) => p.regionId)).size,
      4,
    );
  });

  it("7. no Candidate-D face copying", () => {
    const full = composeProviderPrompt(buildObf(4));
    assert.match(full, /QUALITY BAR only|NEVER a face match|NEVER the anatomy template/i);
    assert.match(full, /Do NOT copy any prior Candidate D face/i);
    for (const token of CANDIDATE_D_CREATIVE_DNA_NON_GOALS) {
      assert.ok(token.length > 10);
    }
    assert.doesNotMatch(full, /createReferenceEmbedding|lockCandidateDAnatomy/i);
  });

  it("8. no embedding/reference changes", () => {
    const full = composeProviderPrompt(buildObf(1));
    assert.match(full, /NEVER a reference embedding|Do NOT create a reference embedding/i);
    assert.doesNotMatch(full, /createReferenceEmbedding|buildCandidateDEmbedding|lockCandidateDAnatomy/i);
  });

  it("9. novelty threshold remains 0.45", () => {
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
  });

  it("10. provider/orchestration unchanged by this phase", () => {
    const untouched = [
      "lib/persona/creation/provider/fal-flux-discovery-provider.ts",
      "lib/persona/creation/discovery/completion-engine.ts",
      "lib/persona/face-novelty-memory/novelty-service.ts",
      "lib/persona/face-novelty-memory/similarity-threshold.ts",
    ];
    for (const rel of untouched) {
      const text = readFileSync(join(ROOT, rel), "utf8");
      assert.doesNotMatch(text, /PHASE 2\.2L — STRONG A\/B\/C\/D CASTING DIVERSITY/);
    }
    assert.equal(SLOT_BLUEPRINT_VERSION, "2.2L.0");
    assert.equal(getMediterraneanSlotBlueprint("A").version, "2.2L.0");
  });

  it("anti-collapse language is present in Mediterranean casting prompts", () => {
    const full = composeProviderPrompt(buildObf(1));
    assert.match(full, /PHASE 2\.2L — STRONG A\/B\/C\/D CASTING DIVERSITY/);
    assert.match(full, /never brothers/i);
    assert.match(full, /same wavy hairstyle across slots|same wavy medium/i);
    assert.match(full, /minimum 3 clearly different haircut silhouettes/i);
  });
});
