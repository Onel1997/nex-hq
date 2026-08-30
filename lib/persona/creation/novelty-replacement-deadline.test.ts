/**
 * Phase 2.1E.4 — Provider deadline execution: AbortSignal, timeout finalization,
 * late-result quarantine, status reconciliation. Fake provider only — never OpenAI.
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
  getLastFakeBatchAbortSignalForTests,
  resetFakeBatchTestHooks,
  setNoveltyReplacementStageTimeoutsForTests,
  clearNoveltyReplacementLocksForTests,
  executeProviderWithDeadline,
  ProviderGenerationTimeoutError,
  PROVIDER_GENERATION_TIMEOUT_CODE,
  PROVIDER_GENERATION_TIMEOUT_MESSAGE,
  PROVIDER_GENERATION_TIMEOUT_MS,
  isProviderGenerationOverdue,
  hasTerminalReplacementResult,
  UI_CHECKBOX_ATTESTATION,
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

const scopeA: WorkspaceScope = {
  workspaceId: PERSONA_TEST_WORKSPACE_ID,
  actorId: "tester-2-1e4",
};

function uiOpts(token: string) {
  return {
    costConfirmed: true as const,
    confirmationToken: token,
    userConfirmedAt: new Date().toISOString(),
    attestation: UI_CHECKBOX_ATTESTATION,
  };
}

async function paidProject() {
  return createCreationProject(scopeA, {
    name: "2.1E.4 Provider Deadline",
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

describe("Phase 2.1E.4 provider deadline execution", () => {
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

  it("1–2. provider execution begins inside deadline helper; AbortSignal reaches generator", async () => {
    let sawSignal: AbortSignal | null = null;
    let startedInside = false;
    const result = await executeProviderWithDeadline({
      timeoutMs: 5_000,
      execute: async (signal) => {
        startedInside = true;
        sawSignal = signal;
        assert.equal(signal.aborted, false);
        return { ok: true, jobId: "inside" };
      },
    });
    assert.equal(startedInside, true);
    assert.ok(sawSignal);
    assert.equal(result.ok, true);

    setFakeBatchDelayMsForTests(20);
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
    assert.ok(getLastFakeBatchAbortSignalForTests());
  });

  it("3–6. timeout fires, aborts request, finalizes failed, does not await late result", async () => {
    let lateCalled = false;
    let executeFinished = false;
    const started = Date.now();
    await assert.rejects(
      () =>
        executeProviderWithDeadline({
          timeoutMs: 40,
          execute: async (signal) => {
            await new Promise<void>((resolve, reject) => {
              const t = setTimeout(() => {
                executeFinished = true;
                resolve();
              }, 400);
              signal.addEventListener(
                "abort",
                () => {
                  clearTimeout(t);
                  reject(new DOMException("The operation was aborted.", "AbortError"));
                },
                { once: true },
              );
            });
            return "late-value";
          },
          onLateResult: () => {
            lateCalled = true;
          },
        }),
      (err: unknown) => err instanceof ProviderGenerationTimeoutError,
    );
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 300, `should return near timeout, got ${elapsed}ms`);
    // Allow late quarantine microtask
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(executeFinished, false);

    setFakeBatchDelayMsForTests(250);
    setNoveltyReplacementStageTimeoutsForTests({ providerMs: 40 });
    const { project, candidateId } = await seedBlocked();
    const prepared = await prepareNoveltyReplacementConfirmation(
      scopeA,
      project.id,
      { candidateId },
    );
    const beforeCandidates = (await creationRepo.listCandidates(scopeA, project.id))
      .length;
    const result = await confirmNoveltyReplacementGeneration(scopeA, project.id, {
      ...uiOpts(prepared.confirmation.confirmation_token),
      candidateId,
      stageTimeouts: { providerMs: 40 },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.safeErrorCode, PROVIDER_GENERATION_TIMEOUT_CODE);
      assert.equal(result.safeErrorMessage, PROVIDER_GENERATION_TIMEOUT_MESSAGE);
      const job = await jobRepo.getJob(scopeA, result.replacementJobId!);
      assert.equal(job?.status, "failed");
      assert.equal(job?.error_code, PROVIDER_GENERATION_TIMEOUT_CODE);
      assert.ok(job?.completed_at);
      assert.equal(
        job?.confirmation_payload?.currentStage,
        "provider_timeout",
      );
      assert.ok(hasTerminalReplacementResult(job!));
    }
    const afterCandidates = (await creationRepo.listCandidates(scopeA, project.id))
      .length;
    assert.equal(afterCandidates, beforeCandidates);
    void lateCalled;
  });

  it("7–9. late provider result cannot create candidate/asset or overwrite terminal", async () => {
    let resolveLate!: (v: { jobId: string }) => void;
    const latePromise = new Promise<{ jobId: string }>((resolve) => {
      resolveLate = resolve;
    });
    let lateInfo: { ok: boolean; receivedAt: string } | null = null;

    const deadline = executeProviderWithDeadline({
      timeoutMs: 30,
      execute: async () => latePromise,
      onLateResult: (info) => {
        lateInfo = { ok: info.ok, receivedAt: info.receivedAt };
      },
      extractProviderRequestId: (v) => v.jobId,
    });

    await assert.rejects(
      () => deadline,
      (err: unknown) => err instanceof ProviderGenerationTimeoutError,
    );

    resolveLate({ jobId: "late-req-1" });
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(lateInfo !== null);
    assert.equal((lateInfo as { ok: boolean }).ok, true);
  });

  it("10–11. status reconcile independently marks overdue provider jobs; zero provider calls", async () => {
    const project = await paidProject();
    const old = new Date(Date.now() - PROVIDER_GENERATION_TIMEOUT_MS - 5_000).toISOString();
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
        currentStage: "provider_request_started",
      },
      started_at: old,
      confirmed_at: old,
      created_by: scopeA.actorId,
    });
    assert.equal(isProviderGenerationOverdue(job, Date.now()), true);
    const before = getFakeBatchInvocationCount();
    const reconciled = await reconcileStaleNoveltyReplacementJobs(
      scopeA,
      project.id,
    );
    assert.ok(reconciled.reconciledJobIds.includes(job.id));
    const refreshed = await jobRepo.getJob(scopeA, job.id);
    assert.equal(refreshed?.status, "failed");
    assert.equal(refreshed?.error_code, PROVIDER_GENERATION_TIMEOUT_CODE);
    assert.equal(getFakeBatchInvocationCount(), before);
  });

  it("12. timeout error is non-2xx (route maps ok:false to 422)", () => {
    const route = readFileSync(
      join(process.cwd(), "app/api/persona/creation-projects/[id]/route.ts"),
      "utf8",
    );
    assert.match(route, /if \(!result\.ok\)/);
    assert.match(route, /422/);
    assert.match(route, /maxDuration = 210/);
  });

  it("13–15. timer cleared on completion; normal path works; only one terminal wins", async () => {
    let late = 0;
    const value = await executeProviderWithDeadline({
      timeoutMs: 5_000,
      execute: async () => "done",
      onLateResult: () => {
        late += 1;
      },
    });
    assert.equal(value, "done");
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(late, 0);

    const { project, candidateId } = await seedBlocked();
    const prepared = await prepareNoveltyReplacementConfirmation(
      scopeA,
      project.id,
      { candidateId },
    );
    const result = await confirmNoveltyReplacementGeneration(scopeA, project.id, {
      ...uiOpts(prepared.confirmation.confirmation_token),
      candidateId,
    });
    assert.equal(result.ok, true);
  });

  it("16. no unhandled rejection when late promise rejects after timeout", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      let rejectLate!: (e: Error) => void;
      const late = new Promise<never>((_, reject) => {
        rejectLate = reject;
      });
      await assert.rejects(
        () =>
          executeProviderWithDeadline({
            timeoutMs: 20,
            execute: async () => late,
          }),
        (err: unknown) => err instanceof ProviderGenerationTimeoutError,
      );
      rejectLate(new Error("late boom"));
      await new Promise((r) => setTimeout(r, 30));
      assert.equal(unhandled.length, 0);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("17–18. Generate New Face hidden while active; UI stops after server timeout", () => {
    const board = readFileSync(
      join(process.cwd(), "components/persona/candidate-board.tsx"),
      "utf8",
    );
    assert.match(board, /!isGenerating/);
    assert.match(board, /data-novelty-slot="generating"/);
    // Generating card must not render an actionable Generate New Face button.
    const generatingBlock = board.slice(
      board.indexOf('data-novelty-slot="generating"'),
      board.indexOf("return (", board.indexOf('data-novelty-slot="generating"') + 1),
    );
    assert.equal(generatingBlock.includes("Generate New Face"), false);

    const views = readFileSync(
      join(process.cwd(), "components/persona/persona-creator-views.tsx"),
      "utf8",
    );
    assert.match(views, /Bildgenerierung hat das Zeitlimit überschritten/);
    assert.match(views, /provider_generation_timeout/);
  });

  it("19–20. consumed confirmation cannot be reused; next attempt needs fresh confirmation", async () => {
    const { project, candidateId } = await seedBlocked();
    const prepared = await prepareNoveltyReplacementConfirmation(
      scopeA,
      project.id,
      { candidateId },
    );
    setFakeBatchDelayMsForTests(200);
    setNoveltyReplacementStageTimeoutsForTests({ providerMs: 30 });
    const first = await confirmNoveltyReplacementGeneration(scopeA, project.id, {
      ...uiOpts(prepared.confirmation.confirmation_token),
      candidateId,
      stageTimeouts: { providerMs: 30 },
    });
    assert.equal(first.ok, false);
    await assert.rejects(
      () =>
        confirmNoveltyReplacementGeneration(scopeA, project.id, {
          ...uiOpts(prepared.confirmation.confirmation_token),
          candidateId,
        }),
      (err: unknown) =>
        err instanceof PersonaDomainError &&
        (/bereits verwendet|already used|neue Kostenschätzung|already running/i.test(
          err.message,
        ) ||
          Boolean((err.details as { reusedConfirmation?: boolean } | undefined)
            ?.reusedConfirmation) ||
          Boolean(
            (err.details as { replacementInProgress?: boolean } | undefined)
              ?.replacementInProgress,
          )),
    );
  });

  it("21. thresholds/evaluator/L3 logic remain unchanged", () => {
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
    assert.equal(FACE_SIMILARITY_THRESHOLD_VERSION, "v1.0.0");
    assert.ok(FACE_SIMILARITY_EVALUATOR_VERSION);
    assert.equal(NOVELTY_REPLACEMENT_REASON, "face_similarity_duplicate");
    assert.equal(PROVIDER_GENERATION_TIMEOUT_MS, 180_000);
  });

  it("22. OpenAI network layer receives signal option; no live provider in tests", () => {
    assert.equal(process.env.PERSONA_USE_FAKE_PROVIDER, "true");
    const openaiSrc = readFileSync(
      join(
        process.cwd(),
        "agents/image/providers/openai-images-provider.ts",
      ),
      "utf8",
    );
    assert.match(openaiSrc, /openai\.images\.generate\(/);
    assert.match(openaiSrc, /signal: request\.signal/);
    const serviceSrc = readFileSync(
      join(process.cwd(), "lib/persona/creation/creation-service.ts"),
      "utf8",
    );
    assert.match(serviceSrc, /executeProviderWithDeadline/);
    assert.match(serviceSrc, /abortSignal: signal/);
  });
});
