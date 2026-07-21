/**
 * Phase 1.6B — A1/A2 funnel, honest scores, concurrency, cost labels.
 * Never invokes OpenAI.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  MemoryCreationRepository,
  MemoryPersonaRepository,
  PERSONA_TEST_WORKSPACE_ID,
  STAGE_A_ASSET_TYPES,
  STAGE_A1_DISCOVERY_ASSET_TYPES,
  STAGE_A2_VALIDATION_ASSET_TYPES,
  assessCandidateQuality,
  assetTypesForCastingPhase,
  clampA2Selection,
  confirmAndStartCandidateGeneration,
  createCreationProject,
  emptyVisualEvaluation,
  estimateCreationCost,
  FakePersonaVisualEvaluator,
  getFakeBatchInvocationCount,
  imagesPerCandidateForStage,
  isPersonaVisualEvaluationEnabled,
  mapPool,
  missingValidationAssetTypes,
  preparePaidGenerationConfirmation,
  resetFakeBatchInvocationCount,
  resolveCandidateVariation,
  resolvePersonaImageConcurrency,
  setCreationRepositoryForTests,
  setGenerationJobRepositoryForTests,
  setPersonaRepositoryForTests,
  UI_CHECKBOX_ATTESTATION,
  MemoryGenerationJobRepository,
  resetMemoryGenerationJobStoreForTests,
} from "@/lib/persona";
import type { WorkspaceScope } from "@/lib/persona/domain/types";

const scopeA: WorkspaceScope = {
  workspaceId: PERSONA_TEST_WORKSPACE_ID,
  actorId: "tester-a",
};

async function paidProject(overrides: Record<string, unknown> = {}) {
  return createCreationProject(scopeA, {
    name: "Phase 1.6B Cast",
    description: "",
    gender_presentation: "Male",
    age_range: "23-30",
    height_range: "178 cm",
    body_type: "Lean",
    skin_tone_direction: "Diverse",
    face_shape_direction: "Approachable",
    hair_direction: "Natural",
    facial_hair_direction: "Light stubble",
    eye_direction: "Friendly",
    expression_direction: "Calm",
    personality: "Approachable",
    fashion_style: "Premium Streetwear Lifestyle Casting",
    brand_role: "primary_male",
    visual_keywords: "streetwear casting",
    excluded_features: "fashion week, CEO",
    preferred_brand_looks: "Milaene",
    preferred_outfits: "Heavyweight tee",
    intended_usage: "image_and_video",
    candidate_count: 4,
    provider_mode: "image_provider",
    quality_mode: "premium_editorial",
    additional_description: "",
    ...overrides,
  } as never);
}

describe("Phase 1.6B Stage-A efficiency & honest scores", () => {
  let personaRepo: MemoryPersonaRepository;
  let creationRepo: MemoryCreationRepository;
  let jobRepo: MemoryGenerationJobRepository;

  beforeEach(() => {
    process.env.PERSONA_USE_FAKE_PROVIDER = "true";
    process.env.PERSONA_PAID_GENERATION_ENABLED = "true";
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.PERSONA_VISUAL_EVALUATION_ENABLED;
    delete process.env.PERSONA_FORCE_LIVE_PROVIDER_GUARD;
    delete process.env.PERSONA_SIMULATE_PRODUCTION_ENV;
    process.env.PERSONA_IMAGE_CONCURRENCY = "2";
    personaRepo = new MemoryPersonaRepository();
    creationRepo = new MemoryCreationRepository();
    jobRepo = new MemoryGenerationJobRepository();
    resetMemoryGenerationJobStoreForTests();
    resetFakeBatchInvocationCount();
    setPersonaRepositoryForTests(personaRepo);
    setCreationRepositoryForTests(creationRepo);
    setGenerationJobRepositoryForTests(jobRepo);
  });

  afterEach(() => {
    delete process.env.PERSONA_PAID_GENERATION_ENABLED;
    delete process.env.PERSONA_IMAGE_CONCURRENCY;
    delete process.env.OPENAI_API_KEY;
    setPersonaRepositoryForTests(null);
    setCreationRepositoryForTests(null);
    setGenerationJobRepositoryForTests(null);
    resetMemoryGenerationJobStoreForTests();
  });

  it("A1 discovery uses exactly 1 image per candidate", () => {
    assert.deepEqual(STAGE_A1_DISCOVERY_ASSET_TYPES, ["portrait_front"]);
    assert.equal(imagesPerCandidateForStage("discovery"), 1);
    assert.deepEqual(assetTypesForCastingPhase("a1_discovery"), ["portrait_front"]);
    assert.deepEqual(STAGE_A2_VALIDATION_ASSET_TYPES, STAGE_A_ASSET_TYPES);
    assert.equal(STAGE_A_ASSET_TYPES.length, 3);
  });

  it("A1 estimate is 4 images and A1 generation never auto-starts A2", async () => {
    const project = await paidProject();
    const estimate = await estimateCreationCost(scopeA, project.id, {
      castingPhase: "a1_discovery",
    });
    assert.equal(estimate.totalImages, 4);
    assert.equal(estimate.imagesPerCandidate, 1);
    assert.equal(estimate.castingPhase, "a1_discovery");
    assert.match(estimate.note, /Discovery casting \(A1\)/i);

    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id, {
      castingPhase: "a1_discovery",
    });
    assert.equal(prepared.castingPhase, "a1_discovery");
    assert.equal(prepared.estimate.totalImages, 4);

    const before = getFakeBatchInvocationCount();
    await confirmAndStartCandidateGeneration(scopeA, project.id, {
      costConfirmed: true,
      confirmationToken: prepared.confirmation.confirmation_token,
      userConfirmedAt: new Date().toISOString(),
      attestation: UI_CHECKBOX_ATTESTATION,
    });
    assert.equal(getFakeBatchInvocationCount(), before + 1);

    const candidates = await creationRepo.listCandidates(scopeA, project.id);
    assert.equal(candidates.length, 4);
    for (const c of candidates) {
      const assets = await creationRepo.listCandidateAssets(scopeA, c.id);
      assert.equal(assets.length, 1);
      assert.equal(assets[0]!.asset_type, "portrait_front");
    }
    // A2 not auto-started — still only one fake batch invocation.
    assert.equal(getFakeBatchInvocationCount(), before + 1);
  });

  it("A2 requires fresh confirmation and only expands selected candidates", async () => {
    const project = await paidProject();
    const a1 = await preparePaidGenerationConfirmation(scopeA, project.id, {
      castingPhase: "a1_discovery",
    });
    await confirmAndStartCandidateGeneration(scopeA, project.id, {
      costConfirmed: true,
      confirmationToken: a1.confirmation.confirmation_token,
      userConfirmedAt: new Date().toISOString(),
      attestation: UI_CHECKBOX_ATTESTATION,
    });

    const candidates = await creationRepo.listCandidates(scopeA, project.id);
    const selected = clampA2Selection([candidates[0]!.id, candidates[3]!.id]);
    assert.equal(selected.length, 2);

    const missing = missingValidationAssetTypes(["portrait_front"]);
    assert.deepEqual(missing, ["portrait_three_quarter", "half_body"]);

    await assert.rejects(
      () =>
        preparePaidGenerationConfirmation(scopeA, project.id, {
          castingPhase: "a2_validation",
        }),
      /ausgewählt|selected/i,
    );

    const a2 = await preparePaidGenerationConfirmation(scopeA, project.id, {
      castingPhase: "a2_validation",
      candidateIds: selected,
    });
    assert.equal(a2.castingPhase, "a2_validation");
    assert.equal(a2.estimate.totalImages, 4); // 2 candidates × 2 missing angles
    assert.notEqual(a2.confirmation.confirmation_token, a1.confirmation.confirmation_token);

    const before = getFakeBatchInvocationCount();
    await confirmAndStartCandidateGeneration(scopeA, project.id, {
      costConfirmed: true,
      confirmationToken: a2.confirmation.confirmation_token,
      userConfirmedAt: new Date().toISOString(),
      attestation: UI_CHECKBOX_ATTESTATION,
    });
    assert.equal(getFakeBatchInvocationCount(), before + 1);

    for (const id of selected) {
      const assets = await creationRepo.listCandidateAssets(scopeA, id);
      const types = new Set(assets.map((a) => a.asset_type));
      assert.ok(types.has("portrait_front"));
      assert.ok(types.has("portrait_three_quarter"));
      assert.ok(types.has("half_body"));
    }
    // Unselected candidates remain at discovery-only.
    const unselected = candidates.filter((c) => !selected.includes(c.id));
    for (const c of unselected) {
      const assets = await creationRepo.listCandidateAssets(scopeA, c.id);
      assert.equal(assets.length, 1);
    }
  });

  it("reuses discovery portrait — missingValidationAssetTypes skips existing front", () => {
    assert.deepEqual(missingValidationAssetTypes(["portrait_front"]), [
      "portrait_three_quarter",
      "half_body",
    ]);
    assert.deepEqual(
      missingValidationAssetTypes([
        "portrait_front",
        "portrait_three_quarter",
        "half_body",
      ]),
      [],
    );
  });

  it("controlled concurrency never exceeds configured limit", async () => {
    assert.equal(resolvePersonaImageConcurrency({ PERSONA_IMAGE_CONCURRENCY: "2" }), 2);
    let active = 0;
    let peak = 0;
    await mapPool(
      [1, 2, 3, 4, 5, 6],
      async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 20));
        active -= 1;
      },
      { concurrency: 2 },
    );
    assert.ok(peak <= 2, `peak concurrency ${peak} exceeded 2`);
  });

  it("rule-based scores are Brief Fit and visual defaults not performed", () => {
    assert.equal(isPersonaVisualEvaluationEnabled({}), false);
    assert.equal(
      isPersonaVisualEvaluationEnabled({ PERSONA_VISUAL_EVALUATION_ENABLED: "true" }),
      true,
    );

    const project = {
      fashion_style: "Premium Streetwear Lifestyle Casting",
      visual_keywords: "streetwear, authentic",
      personality: "approachable",
      expression_direction: "calm friendly",
      preferred_outfits: "heavyweight tee",
      age_range: "23-30",
      gender_presentation: "Male",
      body_type: "lean",
      skin_tone_direction: "olive",
      face_shape_direction: "oval",
      hair_direction: "crop",
      eye_direction: "friendly",
      quality_mode: "premium_editorial",
    } as never;

    const assessment = assessCandidateQuality({
      project,
      variation: resolveCandidateVariation(4),
      assetTypes: ["portrait_front"],
    });
    assert.equal(assessment.method, "rule_based_brief_fit_v1");
    assert.equal(assessment.briefFit, assessment.dimensions.overall);
    assert.ok(assessment.technicalCompleteness <= 40);
    assert.equal(assessment.visualEvaluation.status, "not_performed");
    assert.equal(assessment.scoreHonesty.briefFitLabel, "Brief Fit");
    assert.equal(assessment.scoreHonesty.visualLabel, "Not visually evaluated");
    assert.ok(assessment.briefFit < 100);
  });

  it("fake visual evaluator works when explicitly invoked in tests", async () => {
    const fake = new FakePersonaVisualEvaluator();
    const result = await fake.evaluateCandidate({
      candidateId: "c1",
      candidateNumber: 4,
      imageUrls: ["https://example.test/a.png"],
      assetTypes: ["portrait_front"],
    });
    assert.equal(result.status, "completed");
    assert.equal(result.method, "fake_vision_v1");
    assert.ok(result.dimensions);
    assert.equal(emptyVisualEvaluation().status, "not_performed");
  });

  it("candidate cost is labeled allocated estimate", async () => {
    const project = await paidProject();
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    await confirmAndStartCandidateGeneration(scopeA, project.id, {
      costConfirmed: true,
      confirmationToken: prepared.confirmation.confirmation_token,
      userConfirmedAt: new Date().toISOString(),
      attestation: UI_CHECKBOX_ATTESTATION,
    });
    const candidates = await creationRepo.listCandidates(scopeA, project.id);
    const settings = candidates[0]!.generation_settings;
    assert.equal(settings.costLabel, "allocated_estimate");
    assert.ok(prepared.estimate.allocatedPerCandidate);
    assert.equal(prepared.estimate.allocatedPerCandidate!.label, "allocated_estimate");
  });

  it("discovery identities include Weekend Community as slot 4", () => {
    const ids = [1, 2, 3, 4].map((n) => resolveCandidateVariation(n).id);
    assert.deepEqual(ids, [
      "relaxed_mediterranean",
      "modern_creator",
      "clean_street_athletic",
      "weekend_community",
    ]);
    assert.match(resolveCandidateVariation(4).skinTone, /deep brown|dark/i);
    assert.match(resolveCandidateVariation(4).expression, /relax|warm|friendly|calm/i);
  });
});
