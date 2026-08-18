/**
 * Phase 2.1E.2 — Stale novelty replacement job recovery tests.
 * Fake provider only — never calls OpenAI.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  MemoryCreationRepository,
  MemoryPersonaRepository,
  MemoryGenerationJobRepository,
  PERSONA_TEST_WORKSPACE_ID,
  confirmAndStartCandidateGeneration,
  confirmNoveltyReplacementGeneration,
  createCreationProject,
  prepareNoveltyReplacementConfirmation,
  preparePaidGenerationConfirmation,
  reconcileStaleNoveltyReplacementJobs,
  resetMemoryGenerationJobStoreForTests,
  setCreationRepositoryForTests,
  setGenerationJobRepositoryForTests,
  setPersonaRepositoryForTests,
  getFakeBatchInvocationCount,
  resetFakeBatchInvocationCount,
  UI_CHECKBOX_ATTESTATION,
  listCandidateBoardPayload,
} from "@/lib/persona";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type { PersonaGenerationJob } from "@/lib/persona/domain/creation-types";
import {
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
  FACE_SIMILARITY_THRESHOLD_VERSION,
  FACE_SIMILARITY_EVALUATOR_VERSION,
} from "@/lib/persona/face-novelty-memory/similarity-threshold";
import { NOVELTY_REPLACEMENT_REASON } from "./novelty-replacement";
import {
  STALE_ABSOLUTE_ACTIVE_MS,
  STALE_GENERATING_WITHOUT_HEARTBEAT_MS,
  REPLACEMENT_JOB_STALE_CODE,
  REPLACEMENT_JOB_STALE_MESSAGE,
  computeReplacementElapsed,
  evaluateReplacementJobStaleness,
  formatElapsedMs,
  hasTerminalReplacementResult,
  readActiveNoveltyReplacements,
  resolveReplacementLifecyclePhase,
  resolveSlotReplacementStates,
} from "./novelty-replacement-result";

const scopeA: WorkspaceScope = {
  workspaceId: PERSONA_TEST_WORKSPACE_ID,
  actorId: "tester-2-1e2",
};

function uiOpts(token: string) {
  return {
    costConfirmed: true as const,
    confirmationToken: token,
    userConfirmedAt: new Date().toISOString(),
    attestation: UI_CHECKBOX_ATTESTATION,
  };
}

function baseJob(
  overrides: Partial<PersonaGenerationJob> & {
    confirmation_payload?: Record<string, unknown>;
  },
): PersonaGenerationJob {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? "job-1",
    workspace_id: scopeA.workspaceId,
    creation_project_id: overrides.creation_project_id ?? "proj-1",
    candidate_id: overrides.candidate_id ?? "cand-a",
    stage: "discovery",
    provider: "openai",
    provider_job_id: null,
    status: overrides.status ?? "generating",
    requested_asset_types: ["portrait_front"],
    quality_mode: "premium_editorial",
    estimated_cost_min: 0.04,
    estimated_cost_max: 0.08,
    actual_cost: 0,
    cost_is_estimated: true,
    confirmation_token: null,
    estimate_hash: null,
    confirmation_payload: {
      noveltyReplacement: true,
      intent: "novelty_replacement",
      slot: "A",
      candidateId: "cand-a",
      nextAttemptNumber: 2,
      maxAttempts: 4,
      ...(overrides.confirmation_payload ?? {}),
    },
    confirmed_at: overrides.confirmed_at ?? now,
    retry_count: 2,
    error_code: overrides.error_code ?? null,
    error_message: overrides.error_message ?? null,
    started_at: overrides.started_at ?? now,
    completed_at: overrides.completed_at ?? null,
    cancelled_at: null,
    created_by: scopeA.actorId ?? null,
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
  };
}

describe("Phase 2.1E.2 stale replacement job recovery", () => {
  let creationRepo: MemoryCreationRepository;
  let jobRepo: MemoryGenerationJobRepository;
  let previousOpenAiKey: string | undefined;

  beforeEach(() => {
    process.env.PERSONA_USE_FAKE_PROVIDER = "true";
    delete process.env.PERSONA_FORCE_LIVE_PROVIDER_GUARD;
    delete process.env.PERSONA_SIMULATE_PRODUCTION_ENV;
    delete process.env.PERSONA_PAID_GENERATION_ENABLED;
    previousOpenAiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key";
    creationRepo = new MemoryCreationRepository();
    jobRepo = new MemoryGenerationJobRepository();
    resetMemoryGenerationJobStoreForTests();
    resetFakeBatchInvocationCount();
    setPersonaRepositoryForTests(new MemoryPersonaRepository());
    setCreationRepositoryForTests(creationRepo);
    setGenerationJobRepositoryForTests(jobRepo);
  });

  afterEach(() => {
    setPersonaRepositoryForTests(null);
    setCreationRepositoryForTests(null);
    setGenerationJobRepositoryForTests(null);
    resetMemoryGenerationJobStoreForTests();
    resetFakeBatchInvocationCount();
    if (previousOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAiKey;
  });

  it("1–3. old/terminal/pending jobs are not restored as active generating", () => {
    const oldStarted = new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString();
    const old = baseJob({
      id: "stale-gen",
      status: "generating",
      started_at: oldStarted,
      created_at: oldStarted,
      confirmation_payload: {
        providerStartedAt: oldStarted,
      },
    });
    assert.equal(evaluateReplacementJobStaleness(old).stale, true);
    assert.equal(readActiveNoveltyReplacements([old]).length, 0);

    const terminal = baseJob({
      id: "done",
      status: "completed",
      completed_at: new Date().toISOString(),
      confirmation_payload: {
        providerStartedAt: new Date().toISOString(),
        providerCompletedAt: new Date().toISOString(),
        noveltyDecision: "blocked",
        finalCandidateStatus: "novelty_blocked",
      },
    });
    assert.equal(hasTerminalReplacementResult(terminal), true);
    assert.equal(readActiveNoveltyReplacements([terminal]).length, 0);
    assert.equal(resolveSlotReplacementStates([terminal]).A, "blocked");

    const pending = baseJob({
      id: "pending",
      status: "pending_confirmation",
      confirmation_payload: { slot: "A" },
    });
    assert.equal(resolveReplacementLifecyclePhase(pending), "pending_confirmation");
    assert.equal(readActiveNoveltyReplacements([pending]).length, 0);
  });

  it("4–6. generating older than stale limit becomes stale_failed without provider call", async () => {
    const project = await createCreationProject(scopeA, {
      name: "2.1E.2 Stale",
      description: "arch-mediterranean-premium-hero",
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
      provider_mode: "image_provider",
      quality_mode: "premium_editorial",
      additional_description: "",
      status: "draft",
    } as never);

    const oldStarted = new Date(
      Date.now() - STALE_GENERATING_WITHOUT_HEARTBEAT_MS - 60_000,
    ).toISOString();
    const before = getFakeBatchInvocationCount();
    const job = await jobRepo.createJob(scopeA, {
      creation_project_id: project.id,
      candidate_id: null,
      stage: "discovery",
      provider: "openai",
      status: "generating",
      requested_asset_types: ["portrait_front"],
      quality_mode: "premium_editorial",
      estimated_cost_min: 0.04,
      estimated_cost_max: 0.08,
      cost_is_estimated: true,
      started_at: oldStarted,
      confirmation_payload: {
        noveltyReplacement: true,
        intent: "novelty_replacement",
        slot: "A",
        candidateId: "cand-a",
        nextAttemptNumber: 2,
        maxAttempts: 4,
        providerStartedAt: oldStarted,
      },
    });

    const reconciled = await reconcileStaleNoveltyReplacementJobs(
      scopeA,
      project.id,
    );
    assert.ok(reconciled.reconciledJobIds.includes(job.id));
    assert.equal(reconciled.activeNoveltyReplacements.length, 0);
    assert.equal(getFakeBatchInvocationCount(), before);

    const updated = await jobRepo.getJob(scopeA, job.id);
    assert.equal(updated!.status, "failed");
    // Provider started but overdue past 180s → provider_generation_timeout (not generic stale).
    assert.equal(updated!.error_code, "provider_generation_timeout");
    assert.equal(
      updated!.confirmation_payload?.safeErrorCode,
      "provider_generation_timeout",
    );

    // Page/board load reconciliation also makes no provider call.
    await listCandidateBoardPayload(scopeA, project.id);
    assert.equal(getFakeBatchInvocationCount(), before);
  });

  it("7–10. elapsed uses providerStartedAt; ms/s not mixed; terminal stops; missing startedAt waits", () => {
    const started = new Date(Date.now() - 134_000).toISOString();
    const elapsed = computeReplacementElapsed({ providerStartedAt: started });
    assert.equal(elapsed.waitingToStart, false);
    assert.ok(elapsed.elapsedMs >= 130_000);
    assert.match(elapsed.display, /2m/);
    assert.equal(formatElapsedMs(42_000), "42s");
    assert.equal(formatElapsedMs(134_000), "2m 14s");

    const waiting = computeReplacementElapsed({ providerStartedAt: null });
    assert.equal(waiting.waitingToStart, true);
    assert.equal(waiting.display, "Wartet auf Start");

    const frozen = computeReplacementElapsed({
      providerStartedAt: started,
      terminal: true,
      frozenElapsedMs: 5000,
    });
    assert.equal(frozen.display, "5s");

    // Impossible huge elapsed rejected
    const ancient = new Date(Date.now() - STALE_ABSOLUTE_ACTIVE_MS * 5).toISOString();
    const bad = computeReplacementElapsed({ providerStartedAt: ancient });
    assert.equal(bad.display, "Wartet auf Start");
  });

  it("11–15. server clears stale active list; token cannot be reused after consume; no duplicate provider", async () => {
    const project = await createCreationProject(scopeA, {
      name: "2.1E.2 Token",
      description: "arch-mediterranean-premium-hero",
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
      provider_mode: "image_provider",
      quality_mode: "premium_editorial",
      additional_description: "",
      status: "draft",
    } as never);

    const preparedDisc = await preparePaidGenerationConfirmation(scopeA, project.id);
    const generated = await confirmAndStartCandidateGeneration(
      scopeA,
      project.id,
      uiOpts(preparedDisc.confirmation.confirmation_token),
    );
    const target = generated.candidates.find((c) => c.candidate_number === 1)!;
    const blocked = await creationRepo.updateCandidate(scopeA, target.id, {
      status: "novelty_blocked",
      generation_settings: {
        ...(target.generation_settings ?? {}),
        identityAttemptNumber: 1,
        discoveryIdentity: {
          ...((target.generation_settings?.discoveryIdentity as object) ?? {}),
          attemptNumber: 1,
          generationRunId: target.provider_job_id,
        },
        discoveryIdentitySample: {
          faceGeometry: "g1",
          eyeSpacing: "e1",
          noseBridge: "n1",
          noseWidth: "w1",
          jaw: "j1",
          hairline: "h1",
          haircut: "c1",
          beardPattern: "b1",
          optionalMicroMarks: "none",
        },
        faceNoveltyLiveDebug: {
          finalDecision: "blocked",
          requiresReplacementConfirmation: true,
          hardRejectReason: NOVELTY_REPLACEMENT_REASON,
        },
      },
    });

    const prepared = await prepareNoveltyReplacementConfirmation(scopeA, project.id, {
      candidateId: blocked!.id,
    });
    const before = getFakeBatchInvocationCount();
    const first = await confirmNoveltyReplacementGeneration(scopeA, project.id, {
      candidateId: blocked!.id,
      ...uiOpts(prepared.confirmation.confirmation_token),
    });
    assert.equal(first.ok, true);
    assert.equal(getFakeBatchInvocationCount(), before + 1);

    // Fresh confirm required for next attempt — consumed token resumes, does not re-call provider.
    const second = await confirmNoveltyReplacementGeneration(scopeA, project.id, {
      candidateId: blocked!.id,
      ...uiOpts(prepared.confirmation.confirmation_token),
    });
    assert.equal(second.ok, true);
    assert.equal(getFakeBatchInvocationCount(), before + 1);

    const board = await listCandidateBoardPayload(scopeA, project.id);
    assert.equal(board.activeNoveltyReplacements.length, 0);
  });

  it("16–18. blocked attempt display helpers; allowed untouched; thresholds unchanged", () => {
    const blockedJob = baseJob({
      status: "completed",
      completed_at: new Date().toISOString(),
      confirmation_payload: {
        noveltyDecision: "blocked",
        finalCandidateStatus: "novelty_blocked",
        nextAttemptNumber: 2,
      },
    });
    assert.equal(resolveSlotReplacementStates([blockedJob]).A, "blocked");
    assert.equal(FACE_SIMILARITY_THRESHOLD_VERSION, "v1.0.0");
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
    assert.equal(FACE_SIMILARITY_EVALUATOR_VERSION, "local-vladmandic-1.7.x-v1");
  });

  it("fresh confirmation required after stale — prepare still does not call provider", async () => {
    const project = await createCreationProject(scopeA, {
      name: "2.1E.2 Fresh",
      description: "arch-mediterranean-premium-hero",
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
      candidate_count: 1,
      provider_mode: "image_provider",
      quality_mode: "premium_editorial",
      additional_description: "",
      status: "draft",
    } as never);
    const preparedDisc = await preparePaidGenerationConfirmation(scopeA, project.id);
    const generated = await confirmAndStartCandidateGeneration(
      scopeA,
      project.id,
      uiOpts(preparedDisc.confirmation.confirmation_token),
    );
    const cand = generated.candidates[0]!;
    await creationRepo.updateCandidate(scopeA, cand.id, {
      status: "novelty_blocked",
      generation_settings: {
        identityAttemptNumber: 1,
        discoveryIdentity: { attemptNumber: 1, generationRunId: cand.provider_job_id },
        faceNoveltyLiveDebug: {
          finalDecision: "blocked",
          requiresReplacementConfirmation: true,
          hardRejectReason: NOVELTY_REPLACEMENT_REASON,
        },
      },
    });
    const before = getFakeBatchInvocationCount();
    await prepareNoveltyReplacementConfirmation(scopeA, project.id, {
      candidateId: cand.id,
    });
    assert.equal(getFakeBatchInvocationCount(), before);

    await assert.rejects(
      () =>
        confirmNoveltyReplacementGeneration(scopeA, project.id, {
          candidateId: cand.id,
          costConfirmed: false,
        }),
      (e: unknown) => e instanceof PersonaDomainError,
    );
    assert.equal(getFakeBatchInvocationCount(), before);
  });
});
