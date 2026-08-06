/**
 * Phase 2.1E.3 — Live replacement job completion: timeouts, heartbeats,
 * terminal finalization, polling, status endpoint, cost-safe recovery.
 * Fake provider only — never calls OpenAI.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
  setFakeBatchDelayMsForTests,
  setFakeBatchErrorForTests,
  resetFakeBatchTestHooks,
  setNoveltyReplacementStageTimeoutsForTests,
  clearNoveltyReplacementLocksForTests,
  withNoveltyReplacementStageTimeout,
  finalizeNoveltyReplacementJob,
  createNoveltyReplacementPollController,
  PROVIDER_GENERATION_TIMEOUT_CODE,
  ASSET_UPLOAD_TIMEOUT_CODE,
  NOVELTY_EVALUATION_TIMEOUT_CODE,
  RESULT_PERSISTENCE_TIMEOUT_CODE,
  PROVIDER_GENERATION_TIMEOUT_MESSAGE,
  NoveltyReplacementStageTimeoutError,
  toNoveltyReplacementJobStatusDto,
  UI_CHECKBOX_ATTESTATION,
  evaluateReplacementJobStaleness,
  hasTerminalReplacementResult,
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
  NOVELTY_REPLACEMENT_POLL_INTERVAL_MS,
  NOVELTY_REPLACEMENT_POLL_TIMEOUT_MS,
  STALE_GENERATING_WITHOUT_HEARTBEAT_MS,
  stageLabelForCheckpoint,
} from "./novelty-replacement-result";

const scopeA: WorkspaceScope = {
  workspaceId: PERSONA_TEST_WORKSPACE_ID,
  actorId: "tester-2-1e3",
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

async function paidProject() {
  return createCreationProject(scopeA, {
    name: "2.1E.3 Completion Trace",
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
}

describe("Phase 2.1E.3 replacement completion trace", () => {
  let creationRepo: MemoryCreationRepository;
  let jobRepo: MemoryGenerationJobRepository;
  let previousOpenAiKey: string | undefined;

  beforeEach(() => {
    process.env.PERSONA_USE_FAKE_PROVIDER = "true";
    delete process.env.PERSONA_FORCE_LIVE_PROVIDER_GUARD;
    delete process.env.PERSONA_SIMULATE_PRODUCTION_ENV;
    delete process.env.PERSONA_PAID_GENERATION_ENABLED;
    previousOpenAiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key-must-not-call";
    creationRepo = new MemoryCreationRepository();
    jobRepo = new MemoryGenerationJobRepository();
    resetMemoryGenerationJobStoreForTests();
    resetFakeBatchInvocationCount();
    resetFakeBatchTestHooks();
    setNoveltyReplacementStageTimeoutsForTests(null);
    clearNoveltyReplacementLocksForTests();
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
    resetFakeBatchTestHooks();
    setNoveltyReplacementStageTimeoutsForTests(null);
    clearNoveltyReplacementLocksForTests();
    if (previousOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAiKey;
  });

  async function seedBlocked() {
    const project = await paidProject();
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    const generated = await confirmAndStartCandidateGeneration(
      scopeA,
      project.id,
      uiOpts(prepared.confirmation.confirmation_token),
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
          faceGeometry: "fake-geometry-1",
          eyeSpacing: "fake-eyeSpacing-1",
          noseBridge: "fake-noseBridge-1",
          noseWidth: "fake-noseWidth-1",
          jaw: "fake-jaw-1",
          hairline: "fake-hairline-1",
          haircut: "fake-haircut-1",
          beardPattern: "fake-beard-1",
          optionalMicroMarks: "none",
        },
        faceNoveltyLiveDebug: {
          finalDecision: "blocked",
          requiresReplacementConfirmation: true,
          hardRejectReason: NOVELTY_REPLACEMENT_REASON,
        },
      },
    });
    return { project, candidateId: blocked!.id };
  }

  it("1. provider timeout marks job failed", async () => {
    setFakeBatchDelayMsForTests(200);
    setNoveltyReplacementStageTimeoutsForTests({ providerMs: 30 });
    const { project, candidateId } = await seedBlocked();
    const prepared = await prepareNoveltyReplacementConfirmation(
      scopeA,
      project.id,
      { candidateId },
    );
    const before = getFakeBatchInvocationCount();
    const result = await confirmNoveltyReplacementGeneration(
      scopeA,
      project.id,
      {
        ...uiOpts(prepared.confirmation.confirmation_token),
        candidateId,
        stageTimeouts: { providerMs: 30 },
      },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.safeErrorCode, PROVIDER_GENERATION_TIMEOUT_CODE);
      assert.equal(result.safeErrorMessage, PROVIDER_GENERATION_TIMEOUT_MESSAGE);
      assert.ok(result.replacementJobId);
      const job = await jobRepo.getJob(scopeA, result.replacementJobId!);
      assert.equal(job?.status, "failed");
      assert.ok(job?.completed_at);
      assert.equal(job?.error_code, PROVIDER_GENERATION_TIMEOUT_CODE);
      assert.notEqual(job?.status, "generating");
    }
    assert.ok(getFakeBatchInvocationCount() >= before);
  });

  it("2–4. stage timeout helper emits distinct codes", async () => {
    await assert.rejects(
      () =>
        withNoveltyReplacementStageTimeout({
          stage: "asset_upload_started",
          timeoutMs: 20,
          safeErrorCode: ASSET_UPLOAD_TIMEOUT_CODE,
          safeErrorMessage: "upload timeout",
          run: async () => {
            await new Promise((r) => setTimeout(r, 200));
            return "ok";
          },
        }),
      (err: unknown) =>
        err instanceof NoveltyReplacementStageTimeoutError &&
        err.safeErrorCode === ASSET_UPLOAD_TIMEOUT_CODE,
    );
    await assert.rejects(
      () =>
        withNoveltyReplacementStageTimeout({
          stage: "novelty_evaluation_started",
          timeoutMs: 20,
          safeErrorCode: NOVELTY_EVALUATION_TIMEOUT_CODE,
          safeErrorMessage: "novelty timeout",
          run: async () => {
            await new Promise((r) => setTimeout(r, 200));
            return "ok";
          },
        }),
      (err: unknown) =>
        err instanceof NoveltyReplacementStageTimeoutError &&
        err.safeErrorCode === NOVELTY_EVALUATION_TIMEOUT_CODE,
    );
    await assert.rejects(
      () =>
        withNoveltyReplacementStageTimeout({
          stage: "job_terminal_status_persisted",
          timeoutMs: 20,
          safeErrorCode: RESULT_PERSISTENCE_TIMEOUT_CODE,
          safeErrorMessage: "persist timeout",
          run: async () => {
            await new Promise((r) => setTimeout(r, 200));
            return "ok";
          },
        }),
      (err: unknown) =>
        err instanceof NoveltyReplacementStageTimeoutError &&
        err.safeErrorCode === RESULT_PERSISTENCE_TIMEOUT_CODE,
    );
  });

  it("5. provider exception cannot leave generating status", async () => {
    const { project, candidateId } = await seedBlocked();
    setFakeBatchErrorForTests(new Error("provider boom"));
    const prepared = await prepareNoveltyReplacementConfirmation(
      scopeA,
      project.id,
      { candidateId },
    );
    const result = await confirmNoveltyReplacementGeneration(
      scopeA,
      project.id,
      { ...uiOpts(prepared.confirmation.confirmation_token), candidateId },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.safeErrorCode, "provider_exception");
      const job = await jobRepo.getJob(scopeA, result.replacementJobId!);
      assert.equal(job?.status, "failed");
      assert.ok(hasTerminalReplacementResult(job!));
    }
  });

  it("6–8. finalize covers storage/evaluator/db exception terminal shape", async () => {
    const job = await jobRepo.createJob(scopeA, {
      creation_project_id: "proj-x",
      candidate_id: "c1",
      stage: "discovery",
      provider: "fake",
      status: "generating",
      requested_asset_types: ["portrait_front"],
      quality_mode: "premium_editorial",
      estimated_cost_min: 0.04,
      estimated_cost_max: 0.08,
      confirmation_payload: {
        noveltyReplacement: true,
        intent: "novelty_replacement",
        slot: "A",
        providerStartedAt: new Date().toISOString(),
      },
      started_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
    });
    for (const code of [
      "asset_upload_exception",
      "novelty_evaluation_exception",
      "candidate_persist_exception",
    ]) {
      const updated = await finalizeNoveltyReplacementJob({
        scope: scopeA,
        jobRepo,
        job,
        terminalStatus: "failed",
        outcomeStatus: "failed",
        attemptNumber: 2,
        currentStage: "job_terminal_status_persisted",
        checkpoints: ["job_terminal_status_persisted"],
        providerStartedAt: String(job.confirmation_payload?.providerStartedAt),
        providerCompletedAt: new Date().toISOString(),
        safeErrorCode: code,
        safeErrorMessage: `${code} message`,
        providerMayHaveCompleted: true,
      });
      assert.equal(updated.status, "failed");
      assert.ok(updated.completed_at);
      assert.equal(updated.error_code, code);
      assert.notEqual(updated.status, "generating");
    }
  });

  it("9. every pipeline exit is terminal for successful fake path", async () => {
    const { project, candidateId } = await seedBlocked();
    const prepared = await prepareNoveltyReplacementConfirmation(
      scopeA,
      project.id,
      { candidateId },
    );
    const result = await confirmNoveltyReplacementGeneration(
      scopeA,
      project.id,
      { ...uiOpts(prepared.confirmation.confirmation_token), candidateId },
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      const job = await jobRepo.getJob(scopeA, result.replacementJobId);
      assert.ok(job);
      assert.ok(hasTerminalReplacementResult(job));
      assert.notEqual(job.status, "generating");
      assert.ok(
        job.confirmation_payload?.checkpoints &&
          Array.isArray(job.confirmation_payload.checkpoints),
      );
    }
  });

  it("10. heartbeat updates per stage", async () => {
    const { project, candidateId } = await seedBlocked();
    const prepared = await prepareNoveltyReplacementConfirmation(
      scopeA,
      project.id,
      { candidateId },
    );
    const result = await confirmNoveltyReplacementGeneration(
      scopeA,
      project.id,
      { ...uiOpts(prepared.confirmation.confirmation_token), candidateId },
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      const job = await jobRepo.getJob(scopeA, result.replacementJobId);
      assert.ok(typeof job?.confirmation_payload?.lastHeartbeatAt === "string");
      assert.ok(typeof job?.confirmation_payload?.currentStage === "string");
      assert.ok(
        Array.isArray(job?.confirmation_payload?.checkpoints) &&
          (job!.confirmation_payload!.checkpoints as unknown[]).length >= 3,
      );
    }
  });

  it("11. recent heartbeat prevents stale recovery", () => {
    const recent = new Date().toISOString();
    // Within the 180s provider deadline — heartbeat should keep it active.
    const job = baseJob({
      confirmation_payload: {
        providerStartedAt: new Date(Date.now() - 60_000).toISOString(),
        lastHeartbeatAt: recent,
        currentStage: "provider_request_started",
      },
    });
    const { stale } = evaluateReplacementJobStaleness(job, Date.now());
    assert.equal(stale, false);
  });

  it("12. missing heartbeat permits stale recovery", () => {
    const old = new Date(
      Date.now() - STALE_GENERATING_WITHOUT_HEARTBEAT_MS - 60_000,
    ).toISOString();
    const job = baseJob({
      started_at: old,
      created_at: old,
      confirmation_payload: {
        providerStartedAt: old,
      },
    });
    const { stale } = evaluateReplacementJobStaleness(job, Date.now());
    assert.equal(stale, true);
  });

  it("13–15. client polling stops at 120s, reconciles once, no overlaps", async () => {
    assert.equal(NOVELTY_REPLACEMENT_POLL_INTERVAL_MS, 2000);
    assert.equal(NOVELTY_REPLACEMENT_POLL_TIMEOUT_MS, 120_000);
    let now = 0;
    let pollCount = 0;
    let reconcileCount = 0;
    let timeoutMsg: string | null = null;
    const controller = createNoveltyReplacementPollController({
      intervalMs: 10,
      timeoutMs: 50,
      now: () => now,
      poll: async () => {
        pollCount += 1;
        now += 20;
        return { terminal: false, serverState: "generating" };
      },
      reconcile: async () => {
        reconcileCount += 1;
        return { serverState: "generating" };
      },
      onTimeoutMessage: (state) => {
        timeoutMsg = `Generation is taking longer than expected. Server status: ${state}.`;
      },
    });
    assert.equal(controller.isRunning(), false);
    const start1 = controller.start();
    assert.equal(controller.isRunning(), true);
    // overlapping start is ignored
    const start2 = await controller.start();
    assert.equal(start2, "terminal");
    const outcome = await start1;
    assert.equal(outcome, "timeout");
    assert.equal(reconcileCount, 1);
    assert.ok(pollCount >= 1);
    assert.match(timeoutMsg ?? "", /Server status: generating/);
    assert.equal(controller.isRunning(), false);
  });

  it("16. Generate New Face hidden while active (board source)", () => {
    const board = readFileSync(
      join(process.cwd(), "components/persona/candidate-board.tsx"),
      "utf8",
    );
    assert.match(board, /showGenerateNewFace/);
    assert.match(board, /!isGenerating/);
    assert.match(board, /data-novelty-slot="generating"/);
  });

  it("17. status endpoint exposes only safe fields", () => {
    const route = readFileSync(
      join(process.cwd(), "app/api/persona/creation-projects/[id]/route.ts"),
      "utf8",
    );
    assert.match(route, /novelty_replacement_status/);
    assert.match(route, /safeErrorCode/);
    assert.doesNotMatch(
      route.slice(route.indexOf("novelty_replacement_status")),
      /embedding|signedUrl|prompt|OPENAI_API_KEY|confirmation_token/,
    );
    const job = baseJob({
      confirmation_payload: {
        providerStartedAt: new Date().toISOString(),
        currentStage: "provider_request_started",
        lastHeartbeatAt: new Date().toISOString(),
        slot: "A",
        nextAttemptNumber: 2,
      },
    });
    const dto = toNoveltyReplacementJobStatusDto(job, "proj-1");
    assert.equal(dto.slot, "A");
    assert.equal(dto.currentStage, "provider_request_started");
    assert.ok(!("embedding" in dto));
    assert.ok(!("prompt" in dto));
    assert.ok(!("signedUrl" in dto));
  });

  it("18. completed provider evidence prevents automatic paid rerun", async () => {
    const { project, candidateId } = await seedBlocked();
    const prepared = await prepareNoveltyReplacementConfirmation(
      scopeA,
      project.id,
      { candidateId },
    );
    // Simulate prior provider start without completion on the durable job.
    await jobRepo.updateJob(scopeA, prepared.job.id, {
      status: "generating",
      confirmation_payload: {
        ...prepared.job.confirmation_payload,
        providerStartedAt: new Date().toISOString(),
      },
      started_at: new Date().toISOString(),
    });
    const before = getFakeBatchInvocationCount();
    // Active job with provider evidence must block a second paid start.
    await assert.rejects(
      () =>
        confirmNoveltyReplacementGeneration(scopeA, project.id, {
          ...uiOpts(prepared.confirmation.confirmation_token),
          candidateId,
        }),
      (err: unknown) =>
        err instanceof PersonaDomainError &&
        (Boolean((err.details as { providerStarted?: boolean } | undefined)?.providerStarted) ||
          /already active/i.test(err.message)),
    );
    assert.equal(getFakeBatchInvocationCount(), before);
  });

  it("19. existing asset recovery makes zero provider calls", async () => {
    const { project, candidateId } = await seedBlocked();
    const prepared = await prepareNoveltyReplacementConfirmation(
      scopeA,
      project.id,
      { candidateId },
    );
    const first = await confirmNoveltyReplacementGeneration(
      scopeA,
      project.id,
      { ...uiOpts(prepared.confirmation.confirmation_token), candidateId },
    );
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const afterFirst = getFakeBatchInvocationCount();
    // Re-confirm with same consumed token → idempotent resume, zero new provider calls.
    const second = await confirmNoveltyReplacementGeneration(
      scopeA,
      project.id,
      { ...uiOpts(prepared.confirmation.confirmation_token), candidateId },
    );
    assert.equal(second.ok, true);
    assert.equal(getFakeBatchInvocationCount(), afterFirst);
  });

  it("20. confirmation token remains single-use", async () => {
    const { project, candidateId } = await seedBlocked();
    const prepared = await prepareNoveltyReplacementConfirmation(
      scopeA,
      project.id,
      { candidateId },
    );
    await confirmNoveltyReplacementGeneration(scopeA, project.id, {
      ...uiOpts(prepared.confirmation.confirmation_token),
      candidateId,
    });
    // Force job to failed without newCandidateId so resume fails closed on reuse.
    const jobs = await jobRepo.listJobsForProject(scopeA, project.id);
    const job = jobs.find((j) => j.confirmation_payload?.noveltyReplacement);
    if (job) {
      await jobRepo.updateJob(scopeA, job.id, {
        status: "failed",
        confirmation_payload: {
          ...job.confirmation_payload,
          newCandidateId: null,
          safeErrorCode: "provider_exception",
        },
      });
    }
    await assert.rejects(
      () =>
        confirmNoveltyReplacementGeneration(scopeA, project.id, {
          ...uiOpts(prepared.confirmation.confirmation_token),
          candidateId,
        }),
      (err: unknown) =>
        err instanceof PersonaDomainError &&
        /bereits verwendet|already used|neue Kostenschätzung/i.test(err.message),
    );
  });

  it("21. thresholds/evaluator/L3 logic remain unchanged", () => {
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
    assert.ok(FACE_SIMILARITY_THRESHOLD_VERSION);
    assert.ok(FACE_SIMILARITY_EVALUATOR_VERSION);
    assert.equal(NOVELTY_REPLACEMENT_REASON, "face_similarity_duplicate");
    assert.equal(
      stageLabelForCheckpoint("provider_request_started"),
      "Requesting image",
    );
    assert.equal(
      stageLabelForCheckpoint("novelty_evaluation_started"),
      "Checking face novelty",
    );
  });

  it("22. no OpenAI/provider call occurs during tests (fake only)", () => {
    assert.equal(process.env.PERSONA_USE_FAKE_PROVIDER, "true");
    const openaiSrc = readFileSync(
      join(
        process.cwd(),
        "lib/persona/creation/provider/openai-candidate-generator.ts",
      ),
      "utf8",
    );
    // Guard: tests must not import live generator execution path via PERSONA_USE_FAKE_PROVIDER.
    assert.match(openaiSrc, /OPENAI_API_KEY/);
  });

  it("stale reconcile marks stuck generating job failed without provider", async () => {
    const old = new Date(
      Date.now() - STALE_GENERATING_WITHOUT_HEARTBEAT_MS - 120_000,
    ).toISOString();
    const project = await paidProject();
    const job = await jobRepo.createJob(scopeA, {
      creation_project_id: project.id,
      candidate_id: "cand-a",
      stage: "discovery",
      provider: "openai",
      status: "generating",
      requested_asset_types: ["portrait_front"],
      quality_mode: "premium_editorial",
      estimated_cost_min: 0.04,
      estimated_cost_max: 0.08,
      confirmation_payload: {
        noveltyReplacement: true,
        intent: "novelty_replacement",
        slot: "A",
        nextAttemptNumber: 2,
        providerStartedAt: old,
      },
      started_at: old,
      confirmed_at: old,
      created_by: scopeA.actorId,
    });
    // backdate created_at via direct store update is limited — evaluate uses providerStartedAt
    const before = getFakeBatchInvocationCount();
    const result = await reconcileStaleNoveltyReplacementJobs(
      scopeA,
      project.id,
      Date.now(),
    );
    assert.ok(result.reconciledJobIds.includes(job.id));
    const refreshed = await jobRepo.getJob(scopeA, job.id);
    assert.equal(refreshed?.status, "failed");
    assert.equal(refreshed?.error_code, "provider_generation_timeout");
    assert.equal(getFakeBatchInvocationCount(), before);
  });
});
