/**
 * Persona Studio Phase 1.5 — durable jobs, paid confirmation, Stage B gates.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  MemoryCreationRepository,
  MemoryPersonaRepository,
  PERSONA_TEST_WORKSPACE_ID,
  confirmAndStartCandidateGeneration,
  createCreationProject,
  estimateCreationCost,
  listGenerationJobsForProject,
  preparePaidGenerationConfirmation,
  requestStageBReferencePackage,
  setCreationRepositoryForTests,
  setGenerationJobRepositoryForTests,
  setPersonaRepositoryForTests,
  updateCandidateReview,
  ensureManualCandidateSlots,
  convertCandidateToPersona,
  submitIdentityReview,
  lockPersonaIdentity,
  IDENTITY_REVIEW_CHECK_KEYS,
  OPENAI_PROVIDER_CAPABILITY,
  listImageStudioIntegrationHooks,
  listVideoStudioIntegrationHooks,
  emptyIdentityChecklist,
  resetMemoryGenerationJobStoreForTests,
  MemoryGenerationJobRepository,
  getQualityModeProfile,
  buildEstimateHash,
} from "@/lib/persona";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import { PersonaDomainError } from "@/lib/persona/domain/errors";

const scopeA: WorkspaceScope = {
  workspaceId: PERSONA_TEST_WORKSPACE_ID,
  actorId: "tester-a",
};

async function baseProject(overrides: Record<string, unknown> = {}) {
  return createCreationProject(scopeA, {
    name: "Phase 1.5 Cast",
    description: "",
    gender_presentation: "Male",
    age_range: "28-35",
    height_range: "180 cm",
    body_type: "Lean",
    skin_tone_direction: "Olive",
    face_shape_direction: "Defined",
    hair_direction: "Dark short",
    facial_hair_direction: "None",
    eye_direction: "Brown",
    expression_direction: "Calm",
    personality: "Reserved",
    fashion_style: "Quiet luxury",
    brand_role: "primary_male",
    visual_keywords: "editorial",
    excluded_features: "logos",
    preferred_brand_looks: "Quiet Luxury",
    preferred_outfits: "Black basics",
    intended_usage: "image_and_video",
    candidate_count: 4,
    provider_mode: "manual_upload",
    quality_mode: "premium_editorial",
    additional_description: "",
    ...overrides,
  } as never);
}

async function paidBaseProject(overrides: Record<string, unknown> = {}) {
  return baseProject({
    provider_mode: "image_provider",
    status: "draft",
    ...overrides,
  });
}

describe("Persona Studio Phase 1.5 generation jobs & confirmation", () => {
  let personaRepo: MemoryPersonaRepository;
  let creationRepo: MemoryCreationRepository;
  let jobRepo: MemoryGenerationJobRepository;

  beforeEach(() => {
    personaRepo = new MemoryPersonaRepository();
    creationRepo = new MemoryCreationRepository();
    jobRepo = new MemoryGenerationJobRepository();
    resetMemoryGenerationJobStoreForTests();
    setPersonaRepositoryForTests(personaRepo);
    setCreationRepositoryForTests(creationRepo);
    setGenerationJobRepositoryForTests(jobRepo);
  });

  afterEach(() => {
    setPersonaRepositoryForTests(null);
    setCreationRepositoryForTests(null);
    setGenerationJobRepositoryForTests(null);
    resetMemoryGenerationJobStoreForTests();
  });

  describe("paid OpenAI confirmation (requires OPENAI_API_KEY stub)", () => {
    let previousOpenAiKey: string | undefined;

    beforeEach(() => {
      previousOpenAiKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = "test-key";
    });

    afterEach(() => {
      if (previousOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousOpenAiKey;
    });

  it("1. generation jobs persist across service restart (shared memory store)", async () => {
    const project = await paidBaseProject();
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    assert.ok(prepared.job.id);
    assert.equal(prepared.job.status, "pending_confirmation");

    // Simulate new service instance — new repository, same shared store
    const jobRepo2 = new MemoryGenerationJobRepository();
    setGenerationJobRepositoryForTests(jobRepo2);
    const jobs = await listGenerationJobsForProject(scopeA, project.id);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]?.id, prepared.job.id);
  });

  it("2. page refresh does not lose active job", async () => {
    const project = await paidBaseProject();
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    const again = await listGenerationJobsForProject(scopeA, project.id);
    assert.equal(again[0]?.confirmation_token, prepared.confirmation.confirmation_token);
  });

  it("3. stale estimate blocks generation", async () => {
    const project = await paidBaseProject();
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    await creationRepo.updateProject(scopeA, project.id, { candidate_count: 6 });
    await assert.rejects(
      () =>
        confirmAndStartCandidateGeneration(scopeA, project.id, {
          costConfirmed: true,
          confirmationToken: prepared.confirmation.confirmation_token,
          userConfirmedAt: new Date().toISOString(),
        }),
      (err: unknown) =>
        err instanceof PersonaDomainError &&
        (/veraltet|Bestätigung|Parameter/i.test(err.message) ||
          err.code === "WORKFLOW"),
    );
  });

  it("4. changed candidate count requires reconfirmation", async () => {
    const project = await paidBaseProject();
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    const hashBefore = prepared.confirmation.estimate_hash;
    await creationRepo.updateProject(scopeA, project.id, { candidate_count: 8 });
    const estimate = await estimateCreationCost(scopeA, project.id);
    const hashAfter = buildEstimateHash({
      projectId: project.id,
      stage: estimate.stage,
      qualityMode: "premium_editorial",
      candidateCount: estimate.candidateCount,
      assetCount: estimate.totalImages,
      estimatedMin: estimate.estimatedMin,
      estimatedMax: estimate.estimatedMax,
    });
    assert.notEqual(hashBefore, hashAfter);
  });

  it("22. quality mode defaults to Premium Editorial with estimated cost labels", async () => {
    const profile = getQualityModeProfile("premium_editorial");
    assert.equal(profile.label, "Premium Editorial");
    const project = await paidBaseProject();
    assert.equal(project.quality_mode, "premium_editorial");
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    assert.equal(prepared.costLabel, "estimated");
  });

  it("workflow: generating status rejects prepare_confirmation", async () => {
    const project = await paidBaseProject({ status: "generating" });
    await assert.rejects(
      () => preparePaidGenerationConfirmation(scopeA, project.id),
      (err: unknown) =>
        err instanceof PersonaDomainError &&
        err.code === "WORKFLOW" &&
        /Generierung läuft bereits/i.test(err.message),
    );
  });
  });

  it("5. no paid generation without confirmation", async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key";
    try {
      const project = await baseProject({ provider_mode: "image_provider" });
      await assert.rejects(
        () =>
          confirmAndStartCandidateGeneration(scopeA, project.id, {
            costConfirmed: false,
          }),
        (err: unknown) =>
          err instanceof PersonaDomainError && /Kostenbestätigung/i.test(err.message),
      );
    } finally {
      if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousKey;
    }
  });

  it("6. no silent provider fallback when provider missing", async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const project = await baseProject({ provider_mode: "image_provider" });
      await assert.rejects(
        () =>
          confirmAndStartCandidateGeneration(scopeA, project.id, {
            costConfirmed: true,
          }),
        (err: unknown) =>
          err instanceof PersonaDomainError &&
          (/Provider nicht eingerichtet|deaktiviert|Fallback|OPENAI|Kostenschätzung/i.test(
            err.message,
          ) ||
            err.code === "CONFIG"),
      );
    } finally {
      if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousKey;
    }
  });

  it("9. shortlist required for Stage B package request", async () => {
    const project = await baseProject();
    const candidates = await ensureManualCandidateSlots(scopeA, project.id);
    await assert.rejects(
      () => requestStageBReferencePackage(scopeA, candidates[0]!.id),
      (err: unknown) =>
        err instanceof PersonaDomainError && /shortlist/i.test(err.message),
    );
  });

  it("10. Stage B does not fake OpenAI identity expansion", async () => {
    assert.equal(OPENAI_PROVIDER_CAPABILITY.stageBIdentityConsistentExpansion, false);
    const project = await baseProject();
    const candidates = await ensureManualCandidateSlots(scopeA, project.id);
    await updateCandidateReview(scopeA, candidates[0]!.id, { status: "ready" });
    await updateCandidateReview(scopeA, candidates[0]!.id, { status: "shortlisted" });
    const result = await requestStageBReferencePackage(scopeA, candidates[0]!.id);
    assert.equal(result.automaticExpansion, false);
    assert.equal(result.requiredAction, "manual_upload");
    assert.equal(result.candidate.status, "needs_manual_references");
  });

  it("12. exactly one selected candidate per project", async () => {
    const project = await baseProject();
    const candidates = await ensureManualCandidateSlots(scopeA, project.id);
    await updateCandidateReview(scopeA, candidates[0]!.id, { status: "ready" });
    await updateCandidateReview(scopeA, candidates[1]!.id, { status: "ready" });
    await updateCandidateReview(scopeA, candidates[0]!.id, { status: "selected" });
    await assert.rejects(
      () => updateCandidateReview(scopeA, candidates[1]!.id, { status: "selected" }),
      (err: unknown) =>
        err instanceof PersonaDomainError && /nur ein Kandidat/i.test(err.message),
    );
  });

  it("13. candidate conversion creates one Draft Persona", async () => {
    const project = await baseProject();
    const candidates = await ensureManualCandidateSlots(scopeA, project.id);
    await updateCandidateReview(scopeA, candidates[0]!.id, { status: "ready" });
    await updateCandidateReview(scopeA, candidates[0]!.id, { status: "selected" });
    const { persona } = await convertCandidateToPersona(scopeA, candidates[0]!.id);
    assert.equal(persona.status, "Draft");
    assert.equal(persona.image_use_approved, false);
    assert.equal(persona.video_use_approved, false);
  });

  it("17–18. identity lock stores traits and does not auto-approve production", async () => {
    const project = await baseProject();
    const candidates = await ensureManualCandidateSlots(scopeA, project.id);
    await updateCandidateReview(scopeA, candidates[0]!.id, { status: "ready" });
    await updateCandidateReview(scopeA, candidates[0]!.id, { status: "selected" });
    const { persona } = await convertCandidateToPersona(scopeA, candidates[0]!.id);
    const checklist = emptyIdentityChecklist();
    for (const key of IDENTITY_REVIEW_CHECK_KEYS) checklist[key] = true;
    await submitIdentityReview(scopeA, persona.id, {
      checklist,
      reviewer_notes: "All clear",
    });
    const locked = await lockPersonaIdentity(scopeA, persona.id);
    assert.ok(locked.identity_lock_version >= 1);
    assert.equal(locked.image_use_approved, false);
    assert.equal(locked.video_use_approved, false);
  });

  it("21. manual upload has workflow parity (shortlist → select → convert)", async () => {
    const project = await baseProject({ provider_mode: "manual_upload" });
    const candidates = await ensureManualCandidateSlots(scopeA, project.id);
    assert.ok(candidates.length >= 1);
    await updateCandidateReview(scopeA, candidates[0]!.id, { status: "ready" });
    await updateCandidateReview(scopeA, candidates[0]!.id, { status: "shortlisted" });
    await updateCandidateReview(scopeA, candidates[0]!.id, { status: "selected" });
    const { persona } = await convertCandidateToPersona(scopeA, candidates[0]!.id);
    assert.equal(persona.status, "Draft");
  });

  it("workflow: manual_upload rejects paid prepare_confirmation", async () => {
    const project = await baseProject({ provider_mode: "manual_upload", status: "draft" });
    await assert.rejects(
      () => preparePaidGenerationConfirmation(scopeA, project.id),
      (err: unknown) =>
        err instanceof PersonaDomainError &&
        err.code === "WORKFLOW" &&
        /Manueller Upload/i.test(err.message),
    );
    const candidates = await ensureManualCandidateSlots(scopeA, project.id);
    assert.ok(candidates.length >= 1);
  });

  it("26–28. Image/Video Studio remain unstarted hooks", () => {
    assert.ok(Array.isArray(listImageStudioIntegrationHooks()));
    assert.ok(Array.isArray(listVideoStudioIntegrationHooks()));
    // Handoffs stay null until studios are built — covered in persona-creation tests
  });
});
