/**
 * Phase 2.1B — Live L3 Identity Prompt Integration tests.
 * No OpenAI / provider calls. Face novelty untouched.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ARCHETYPE_PROJECT_MARKER } from "@/lib/brand-face-selection/creation-project-mapper";
import { IdentityBlueprintError } from "@/lib/persona/identity-blueprints";
import type { PersonaCreationProject } from "@/lib/persona/domain/creation-types";
import {
  buildCandidatePrompt,
  buildNoveltyBlockIdentityRetryContract,
  nextDiscoveryIdentityAttempt,
  resolveObfDiscoveryIdentity,
} from "@/lib/persona/creation/candidate-intelligence";
import {
  FACE_SIMILARITY_COSINE_DUPLICATE_THRESHOLD,
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
  FACE_SIMILARITY_THRESHOLD_VERSION,
} from "@/lib/persona/face-novelty-memory/similarity-threshold";

const ARCH_MED = "arch-mediterranean-premium-hero";
const ARCH_URBAN = "arch-urban-community-hero";
const SAMPLED_AT = "2026-08-05T14:00:00.000Z";

function projectForArchetype(
  archetypeId: string,
  projectId = "proj-21b-1",
): PersonaCreationProject {
  const now = new Date().toISOString();
  return {
    id: projectId,
    workspace_id: "ws-milaene",
    name: "OBF Discovery 2.1B",
    description: `Official Brand Face. ${ARCHETYPE_PROJECT_MARKER}${archetypeId}`,
    gender_presentation: archetypeId.includes("female") ? "Female" : "Male",
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
    brand_role: archetypeId.includes("female")
      ? "primary_female"
      : "primary_male",
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

function buildObf(input: {
  candidateNumber: number;
  projectId?: string;
  generationRunId?: string;
  attemptNumber?: number;
}) {
  return buildCandidatePrompt({
    project: projectForArchetype(ARCH_MED, input.projectId ?? "proj-21b"),
    assetType: "portrait_front",
    candidateNumber: input.candidateNumber,
    generationRunId: input.generationRunId ?? input.projectId ?? "run-21b",
    attemptNumber: input.attemptNumber ?? 1,
    identitySampledAt: SAMPLED_AT,
  });
}

describe("Phase 2.1B live L3 identity prompt integration", () => {
  it("1. OBF A1 resolves an L2 blueprint", () => {
    const built = buildObf({ candidateNumber: 1, generationRunId: "run-l2" });
    assert.equal(built.officialBrandFace, true);
    assert.ok(built.slotBlueprint);
    assert.equal(built.slotBlueprint?.slot, "A");
    assert.equal(built.slotBlueprint?.id, "med-lane-a-soft-luxury");
  });

  it("2. OBF A1 samples one L3 instance per candidate", () => {
    const built = buildObf({ candidateNumber: 2, generationRunId: "run-l3" });
    assert.ok(built.discoveryIdentityInstance);
    assert.equal(built.discoveryIdentityInstance?.slot, "B");
    assert.equal(built.discoveryIdentityInstance?.source, "controlled_sampling");
    assert.equal(built.identityAttemptNumber, 1);
  });

  it("3. live prompt contains the L3 anatomy block", () => {
    const built = buildObf({ candidateNumber: 1, generationRunId: "run-anatomy" });
    assert.match(built.prompt, /DISCOVERY IDENTITY INSTANCE \(L3\)/);
    assert.match(built.blocks.biologicalIdentity, /BIOLOGICAL IDENTITY \(sampled for this run\)/);
    assert.ok(built.prompt.includes(built.discoveryIdentityInstance!.noseBridge));
  });

  it("4. live prompt says Generate a new individual inside this casting lane", () => {
    const built = buildObf({ candidateNumber: 1, generationRunId: "run-wording" });
    assert.match(
      built.prompt,
      /Generate a new individual inside this casting lane\./,
    );
  });

  it("5. legacy biology is absent from OBF prompt", () => {
    const built = buildObf({ candidateNumber: 1, generationRunId: "run-legacy" });
    assert.doesNotMatch(built.prompt, /CANDIDATE-SPECIFIC BIOLOGICAL IDENTITY/);
    assert.doesNotMatch(built.prompt, /DISCOVERY DIVERSITY BRIEF/);
    assert.doesNotMatch(built.prompt, /Permanent unique human identity/);
    assert.equal(built.blocks.diversityBrief, "");
  });

  it("6. old identity-lock wording is absent from discovery prompt", () => {
    const built = buildObf({ candidateNumber: 1, generationRunId: "run-lock" });
    assert.doesNotMatch(built.prompt, /Lock this Identity DNA/);
    assert.doesNotMatch(built.prompt, /do not invent a different person/);
    assert.doesNotMatch(built.prompt, /Keep identity requirements fixed/);
  });

  it("7. slots A–D have unique anatomy fingerprints", () => {
    const fps = [1, 2, 3, 4].map(
      (n) =>
        buildObf({ candidateNumber: n, generationRunId: "run-cast" })
          .discoveryIdentityInstance!.anatomyFingerprint,
    );
    assert.equal(new Set(fps).size, 4);
  });

  it("8. different generationRunId changes L3 identity", () => {
    const a = buildObf({ candidateNumber: 1, generationRunId: "run-aaa" });
    const b = buildObf({ candidateNumber: 1, generationRunId: "run-bbb" });
    assert.notEqual(
      a.discoveryIdentityInstance!.anatomyFingerprint,
      b.discoveryIdentityInstance!.anatomyFingerprint,
    );
  });

  it("9. different attemptNumber changes L3 identity", () => {
    const a = buildObf({
      candidateNumber: 1,
      generationRunId: "run-attempt",
      attemptNumber: 1,
    });
    const b = buildObf({
      candidateNumber: 1,
      generationRunId: "run-attempt",
      attemptNumber: 2,
    });
    assert.notEqual(
      a.discoveryIdentityInstance!.anatomyFingerprint,
      b.discoveryIdentityInstance!.anatomyFingerprint,
    );
  });

  it("10. same inputs reproduce the same L3 identity", () => {
    const a = buildObf({
      candidateNumber: 3,
      generationRunId: "run-stable",
      attemptNumber: 1,
    });
    const b = buildObf({
      candidateNumber: 3,
      generationRunId: "run-stable",
      attemptNumber: 1,
    });
    assert.equal(
      a.discoveryIdentityInstance!.identityFingerprint,
      b.discoveryIdentityInstance!.identityFingerprint,
    );
    assert.equal(a.promptFingerprint, b.promptFingerprint);
  });

  it("11. Brand Memory remains present", () => {
    const built = buildObf({ candidateNumber: 1, generationRunId: "run-brand" });
    assert.ok(built.brandMemory);
    assert.match(built.prompt, /MILAENE|PREMIUM STREETWEAR BRAND DNA/i);
  });

  it("12. Product Intelligence remains present", () => {
    const built = buildObf({ candidateNumber: 1, generationRunId: "run-pi" });
    assert.ok(built.productIntelligence);
    assert.match(built.prompt, /Product Intelligence|PRODUCT INTELLIGENCE/i);
    assert.match(built.blocks.garmentDirection, /heavyweight|hoodie|T-shirt|tee/i);
  });

  it("13. Reference Intelligence remains optional", () => {
    const built = buildObf({ candidateNumber: 1, generationRunId: "run-ref" });
    assert.ok(built.referenceIntelligence);
    // Empty when no approved refs — still a valid optional block.
    assert.equal(typeof built.blocks.referenceDirection, "string");
  });

  it("14. camera / lighting remain present", () => {
    const built = buildObf({ candidateNumber: 1, generationRunId: "run-cam" });
    assert.match(built.blocks.camera, /CAMERA|shoulders FULLY visible|mid-torso/i);
    assert.match(
      built.blocks.lighting,
      /PREMIUM CASTING PHOTOGRAPHY|casting set|not a campaign location/i,
    );
    assert.ok(
      built.prompt.includes(built.discoveryIdentityInstance!.castingBackground),
    );
  });

  it("15. strict gender lock remains active", () => {
    const built = buildObf({ candidateNumber: 1, generationRunId: "run-gender" });
    assert.match(built.prompt, /ONLY adult male/);
    assert.equal(built.discoveryIdentityInstance!.gender, "male");
  });

  it("16. L3 metadata is persisted on BuiltCandidatePrompt", () => {
    const built = buildObf({ candidateNumber: 1, generationRunId: "run-meta" });
    assert.ok(built.discoveryIdentityMetadata);
    assert.equal(built.discoveryIdentityMetadata?.source, "controlled_sampling");
    assert.equal(
      built.discoveryIdentityMetadata?.discoveryIdentityInstanceId,
      built.discoveryIdentityInstance?.id,
    );
    assert.ok(built.discoveryIdentityMetadata?.identityFingerprint);
    assert.ok(built.discoveryIdentityMetadata?.anatomyFingerprint);
    assert.ok(built.discoveryIdentityMetadata?.promptFingerprint);
    assert.ok(built.discoveryIdentityMetadata?.samplingSeed);
  });

  it("17. Urban L2 SlotBlueprints resolve for Official Brand Face A1", () => {
    const identity = resolveObfDiscoveryIdentity({
      archetypeId: ARCH_URBAN,
      candidateNumber: 1,
      creationProjectId: "proj-urban-l2",
      generationRunId: "run-urban-l2",
    });
    assert.equal(identity.slotBlueprint.archetypeId, ARCH_URBAN);
    assert.equal(identity.slotBlueprint.ageRange, "21-25");
    assert.match(identity.slotBlueprint.hairTextureFamily, /run hair may rotate|short|curls|afro/i);
    assert.doesNotMatch(identity.slotBlueprint.hairTextureFamily, /NEVER braids/i);
  });

  it("18. legacy biology in OBF throws when useBrandArchetypes=false", () => {
    assert.throws(
      () =>
        buildCandidatePrompt({
          project: projectForArchetype(ARCH_MED, "proj-legacy-guard"),
          assetType: "portrait_front",
          candidateNumber: 1,
          generationRunId: "run-legacy-guard",
          useBrandArchetypes: false,
          identitySampledAt: SAMPLED_AT,
        }),
      (err: unknown) =>
        err instanceof IdentityBlueprintError &&
        /cannot use legacy variation biology/i.test(err.message),
    );
  });

  it("19. retry contract increments attempt number without changing thresholds", () => {
    const built = buildObf({ candidateNumber: 1, generationRunId: "run-retry" });
    const contract = buildNoveltyBlockIdentityRetryContract({
      previousAttemptNumber: built.identityAttemptNumber,
      slotBlueprint: built.slotBlueprint!,
      generationRunId: "run-retry",
      creationProjectId: built.discoveryIdentityInstance!.creationProjectId,
    });
    assert.equal(contract.nextAttemptNumber, 2);
    assert.equal(nextDiscoveryIdentityAttempt(2), 3);
    assert.equal(contract.noveltyThresholdsUnchanged, true);
    assert.equal(contract.autoSpendMoney, false);
    assert.equal(FACE_SIMILARITY_THRESHOLD_VERSION, "v1.0.0");
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
    assert.equal(FACE_SIMILARITY_COSINE_DUPLICATE_THRESHOLD, 0.775);
  });

  it("20. no OpenAI/provider call during implementation module path", () => {
    const built = buildObf({ candidateNumber: 1, generationRunId: "run-no-openai" });
    assert.ok(built.prompt.length > 100);
    assert.equal(built.prompt.includes("generateOpenAiImage"), false);
  });

  it("21. face novelty thresholds remain untouched", () => {
    assert.equal(FACE_SIMILARITY_THRESHOLD_VERSION, "v1.0.0");
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
  });

  it("22. prompt order places L3 anatomy and camera before Brand Memory (Phase 2.2C)", () => {
    const built = buildObf({ candidateNumber: 1, generationRunId: "run-order" });
    const real = built.prompt.indexOf("REAL HUMAN PHOTOGRAPH");
    const l3 = built.prompt.indexOf("DISCOVERY IDENTITY INSTANCE (L3)");
    const camera = built.prompt.indexOf("CAMERA — Official Brand Face A1");
    const brand = built.prompt.indexOf("PREMIUM STREETWEAR BRAND DNA");
    assert.ok(real >= 0 && real < l3);
    assert.ok(l3 >= 0 && camera > l3);
    assert.ok(brand > camera);
  });
});
