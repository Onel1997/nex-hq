/**
 * Phase 2.5B.3 — Novelty replacement persist failure + stuck loading fix.
 * Fake / memory only — zero paid provider calls.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { DEFAULT_DISCOVERY_PROVIDER } from "@/lib/persona/creation/provider/discovery-provider-config";
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
  resetMemoryGenerationJobStoreForTests,
  setCreationRepositoryForTests,
  setGenerationJobRepositoryForTests,
  setPersonaRepositoryForTests,
  getFakeBatchInvocationCount,
  resetFakeBatchInvocationCount,
  UI_CHECKBOX_ATTESTATION,
  createNoveltyReplacementPollController,
  isTerminalNoveltyReplacementStatus,
  NOVELTY_REPLACEMENT_TERMINAL_STATUSES,
  REPLACEMENT_PERSIST_FAILED_USER_MESSAGE,
  supersededCandidateNumber,
  resolveBoardSlotNumber,
  boardSlotLabel,
  SUPERSEDED_CANDIDATE_NUMBER_BASE,
} from "@/lib/persona";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import {
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
  FACE_SIMILARITY_THRESHOLD_VERSION,
  FACE_SIMILARITY_EVALUATOR_VERSION,
} from "@/lib/persona/face-novelty-memory/similarity-threshold";
import { NOVELTY_REPLACEMENT_REASON } from "./novelty-replacement";
import { isCandidateNumberUniqueViolation } from "./novelty-replacement";
import { finalizeNoveltyReplacementJob } from "./novelty-replacement-execution";
import { hasTerminalReplacementResult } from "./novelty-replacement-result";

const scopeA: WorkspaceScope = {
  workspaceId: PERSONA_TEST_WORKSPACE_ID,
  actorId: "tester-2-5b3",
};

function uiOpts(token: string) {
  return {
    costConfirmed: true,
    confirmationToken: token,
    userConfirmedAt: new Date().toISOString(),
    attestation: UI_CHECKBOX_ATTESTATION,
  };
}

describe("Phase 2.5B.3 — novelty persist failure + UI terminal contract", () => {
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
    setCreationRepositoryForTests(creationRepo);
    setGenerationJobRepositoryForTests(jobRepo);
    setPersonaRepositoryForTests(new MemoryPersonaRepository());
    resetMemoryGenerationJobStoreForTests();
    resetFakeBatchInvocationCount();
  });

  afterEach(() => {
    setCreationRepositoryForTests(null);
    setGenerationJobRepositoryForTests(null);
    setPersonaRepositoryForTests(null);
    resetFakeBatchInvocationCount();
    if (previousOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAiKey;
  });

  async function seedBlockedSlotD() {
    const project = await createCreationProject(scopeA, {
      name: "Urban 2.5B.3",
      description: "arch-urban-community-hero",
      gender_presentation: "Male",
      age_range: "21-25",
      height_range: "180 cm",
      body_type: "Athletic",
      skin_tone_direction: "Deep",
      face_shape_direction: "Defined",
      hair_direction: "Short",
      facial_hair_direction: "None",
      eye_direction: "Brown",
      expression_direction: "Warm",
      personality: "Community",
      fashion_style: "Streetwear",
      brand_role: "primary_male",
      visual_keywords: "urban",
      excluded_features: "logos",
      preferred_brand_looks: "Urban",
      preferred_outfits: "Street",
      intended_usage: "image_and_video",
      candidate_count: 4,
      provider_mode: "image_provider",
      quality_mode: "premium_editorial",
      additional_description: "",
      status: "draft",
    } as never);
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id, {});
    const generated = await confirmAndStartCandidateGeneration(scopeA, project.id, {
      ...uiOpts(prepared.confirmation.confirmation_token),
    });
    const candidates = generated.candidates ?? [];
    assert.ok(candidates.length >= 4);
    const allowed = candidates.filter((c) => c.candidate_number <= 3);
    const blocked = candidates.find((c) => c.candidate_number === 4)!;
    await creationRepo.updateCandidate(scopeA, blocked.id, {
      status: "novelty_blocked",
      generation_settings: {
        ...(blocked.generation_settings ?? {}),
        identityAttemptNumber: 1,
        discoveryIdentity: {
          ...((blocked.generation_settings?.discoveryIdentity as object) ?? {}),
          attemptNumber: 1,
        },
        faceNoveltyLiveDebug: {
          finalDecision: "blocked",
          requiresReplacementConfirmation: true,
          hardRejectReason: NOVELTY_REPLACEMENT_REASON,
          faceDetectionStatus: "performed",
          similarity: FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
          thresholdVersion: FACE_SIMILARITY_THRESHOLD_VERSION,
          evaluatorVersion: FACE_SIMILARITY_EVALUATOR_VERSION,
          closestPriorCandidateId: allowed[0]?.id,
        },
      },
      rejection_reason: NOVELTY_REPLACEMENT_REASON,
    });
    const refreshed = await creationRepo.getCandidate(scopeA, blocked.id);
    assert.ok(refreshed);
    return { project, blocked: refreshed!, allowed };
  }

  it("1. A/B/C/D board slot helpers + superseded numbers are structurally distinct", () => {
    assert.equal(SUPERSEDED_CANDIDATE_NUMBER_BASE, 1000);
    assert.equal(supersededCandidateNumber({ boardSlotNumber: 4, attemptNumber: 1 }), 1401);
    assert.equal(supersededCandidateNumber({ boardSlotNumber: 4, attemptNumber: 2 }), 1402);
    assert.equal(boardSlotLabel(4), "D");
    assert.notEqual(
      supersededCandidateNumber({ boardSlotNumber: 1, attemptNumber: 1 }),
      supersededCandidateNumber({ boardSlotNumber: 2, attemptNumber: 1 }),
    );
  });

  it("2. unique (project, candidate_number) is enforced in memory repo", async () => {
    const { project, blocked } = await seedBlockedSlotD();
    await assert.rejects(
      () =>
        creationRepo.createCandidate(scopeA, {
          creation_project_id: project.id,
          candidate_number: blocked.candidate_number,
          candidate_name: "dup",
          status: "generating",
          provider: "fake",
          provider_job_id: blocked.provider_job_id,
          generation_seed: "x",
          generation_prompt: "",
          negative_prompt: "",
          generation_settings: {},
          identity_summary: "",
          distinguishing_features: "",
          visual_strengths: "",
          visual_risks: "",
          brand_fit_score: null,
          identity_consistency_score: null,
          realism_score: null,
          video_suitability_score: null,
          user_rating: null,
          user_notes: "",
          rejection_reason: "",
          actual_generation_cost: 0,
          parent_candidate_id: blocked.id,
        }),
      (e: unknown) =>
        e instanceof PersonaDomainError && isCandidateNumberUniqueViolation(e),
    );
  });

  it("3–5. replacement frees slot number, persists D only, leaves A/B/C untouched", async () => {
    const { project, blocked, allowed } = await seedBlockedSlotD();
    const beforeCalls = getFakeBatchInvocationCount();
    const abcSnapshot = await Promise.all(
      allowed.map(async (c) => {
        const row = await creationRepo.getCandidate(scopeA, c.id);
        return {
          id: row!.id,
          status: row!.status,
          primary: row!.primary_preview_asset_id,
          number: row!.candidate_number,
        };
      }),
    );

    const prepared = await prepareNoveltyReplacementConfirmation(
      scopeA,
      project.id,
      { candidateId: blocked.id },
    );
    assert.equal(prepared.requiresPaidProviderCall, true);
    assert.equal(prepared.recoverFromStashedAsset, false);

    const result = await confirmNoveltyReplacementGeneration(
      scopeA,
      project.id,
      { candidateId: blocked.id, ...uiOpts(prepared.confirmation.confirmation_token) },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const replacement = await creationRepo.getCandidate(scopeA, result.newCandidateId);
    assert.ok(replacement);
    assert.equal(replacement!.candidate_number, 4);
    assert.equal(resolveBoardSlotNumber(replacement!), 4);

    const prior = await creationRepo.getCandidate(scopeA, blocked.id);
    assert.ok(prior);
    assert.equal(prior!.candidate_number, 1401);
    assert.equal(prior!.generation_settings?.boardSupersededByReplacement, true);
    assert.equal(resolveBoardSlotNumber(prior!), 4);

    for (const snap of abcSnapshot) {
      const c = await creationRepo.getCandidate(scopeA, snap.id);
      assert.ok(c);
      assert.equal(c!.id, snap.id);
      assert.equal(c!.status, snap.status);
      assert.equal(c!.primary_preview_asset_id, snap.primary);
      assert.equal(c!.candidate_number, snap.number);
    }

    assert.equal(getFakeBatchInvocationCount(), beforeCalls + 1);
    const job = await jobRepo.getJob(scopeA, result.replacementJobId);
    assert.ok(job);
    assert.ok(hasTerminalReplacementResult(job!));
    assert.ok(job!.confirmation_payload?.providerAssetStash);
  });

  it("6. provider succeeds + unique conflict → terminal failed with structured code", async () => {
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
        slot: "D",
        providerStartedAt: new Date().toISOString(),
        providerCompletedAt: new Date().toISOString(),
      },
      started_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
    });
    const updated = await finalizeNoveltyReplacementJob({
      scope: scopeA,
      jobRepo,
      job,
      terminalStatus: "failed",
      outcomeStatus: "failed",
      attemptNumber: 2,
      currentStage: "job_terminal_status_persisted",
      checkpoints: ["provider_payload_validated", "job_terminal_status_persisted"],
      providerStartedAt: String(job.confirmation_payload?.providerStartedAt),
      providerCompletedAt: new Date().toISOString(),
      safeErrorCode: "candidate_persist_exception",
      safeErrorMessage: REPLACEMENT_PERSIST_FAILED_USER_MESSAGE,
      finalCandidateStatus: "novelty_failed",
      providerMayHaveCompleted: true,
    });
    assert.equal(updated.status, "failed");
    assert.equal(updated.error_code, "candidate_persist_exception");
    assert.ok(hasTerminalReplacementResult(updated));
    assert.equal(
      updated.confirmation_payload?.finalCandidateStatus,
      "novelty_failed",
    );
  });

  it("7–8. terminal statuses stop poll controller; no second provider call on stop", async () => {
    for (const status of NOVELTY_REPLACEMENT_TERMINAL_STATUSES) {
      assert.equal(isTerminalNoveltyReplacementStatus(status), true);
    }
    assert.equal(isTerminalNoveltyReplacementStatus("generating"), false);

    let polls = 0;
    const controller = createNoveltyReplacementPollController({
      intervalMs: 10,
      timeoutMs: 500,
      now: () => Date.now(),
      poll: async () => {
        polls += 1;
        return { terminal: true, serverState: "failed" };
      },
      reconcile: async () => ({ serverState: "failed" }),
      onTimeoutMessage: () => {
        assert.fail("should not timeout when terminal");
      },
    });
    const outcome = await controller.start();
    assert.equal(outcome, "terminal");
    assert.equal(polls, 1);
    assert.equal(getFakeBatchInvocationCount(), 0);
  });

  it("9. stashed asset recovery skips provider and does not duplicate A/B/C", async () => {
    const { project, blocked, allowed } = await seedBlockedSlotD();
    const failedJob = await jobRepo.createJob(scopeA, {
      creation_project_id: project.id,
      candidate_id: blocked.id,
      stage: project.generation_stage,
      provider: "fake",
      status: "failed",
      requested_asset_types: ["portrait_front"],
      quality_mode: project.quality_mode,
      estimated_cost_min: 0.04,
      estimated_cost_max: 0.08,
      confirmation_payload: {
        noveltyReplacement: true,
        intent: "novelty_replacement",
        slot: "D",
        candidateId: blocked.id,
        providerCompletedAt: new Date().toISOString(),
        providerStartedAt: new Date().toISOString(),
        providerAssetStash: {
          storagePath: `workspace/${scopeA.workspaceId}/persona-creation/${project.id}/replacement-jobs/job-stash/portrait.png`,
          mimeType: "image/png",
          assetType: "portrait_front",
          width: 1,
          height: 1,
          checksum: "abc",
          fileSizeBytes: 68,
          providerOutputId: null,
        },
        safeErrorCode: "candidate_persist_exception",
      },
      error_code: "candidate_persist_exception",
      completed_at: new Date().toISOString(),
      created_by: scopeA.actorId,
    });
    assert.ok(failedJob.id);

    const beforeCalls = getFakeBatchInvocationCount();
    const prepared = await prepareNoveltyReplacementConfirmation(
      scopeA,
      project.id,
      { candidateId: blocked.id },
    );
    assert.equal(prepared.recoverFromStashedAsset, true);
    assert.equal(prepared.requiresPaidProviderCall, false);
    assert.equal(prepared.estimate.estimatedMax, 0);

    const result = await confirmNoveltyReplacementGeneration(
      scopeA,
      project.id,
      { candidateId: blocked.id, ...uiOpts(prepared.confirmation.confirmation_token) },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(getFakeBatchInvocationCount(), beforeCalls);

    for (const a of allowed) {
      const c = await creationRepo.getCandidate(scopeA, a.id);
      assert.equal(c!.status, "ready");
      assert.equal(c!.candidate_number, a.candidate_number);
    }

    const replacement = await creationRepo.getCandidate(
      scopeA,
      result.newCandidateId,
    );
    assert.ok(replacement);
    assert.equal(replacement!.candidate_number, 4);
  });

  it("10. OpenAI remains default discovery provider; no FLUX fallback in routing config", () => {
    assert.equal(DEFAULT_DISCOVERY_PROVIDER, "openai");
    const configSrc = readFileSync(
      join(process.cwd(), "lib/persona/creation/provider/discovery-provider-config.ts"),
      "utf8",
    );
    assert.match(
      configSrc,
      /export const DEFAULT_DISCOVERY_PROVIDER: DiscoveryProviderId = "openai"/,
    );
    assert.doesNotMatch(
      configSrc,
      /export const DEFAULT_DISCOVERY_PROVIDER: DiscoveryProviderId = "fal_flux"/,
    );
  });

  it("11. PATCH confirm maps ok:false to HTTP 422 (surfaced structurally)", () => {
    const route = readFileSync(
      join(process.cwd(), "app/api/persona/creation-projects/[id]/route.ts"),
      "utf8",
    );
    assert.match(route, /confirm_novelty_replacement/);
    assert.match(route, /ok: false/);
    assert.match(route, /422/);
  });

  it("12. UI treats terminal failure statuses and keeps Retry Candidate D affordance", () => {
    const views = readFileSync(
      join(process.cwd(), "components/persona/persona-creator-views.tsx"),
      "utf8",
    );
    const board = readFileSync(
      join(process.cwd(), "components/persona/candidate-board.tsx"),
      "utf8",
    );
    assert.match(views, /isTerminalNoveltyReplacementStatus/);
    assert.match(views, /REPLACEMENT_PERSIST_FAILED_USER_MESSAGE/);
    assert.match(views, /phase === "failed"/);
    assert.match(board, /Retry Candidate/);
    assert.match(board, /onRetryFailedReplacement/);
    assert.equal(getFakeBatchInvocationCount(), 0);
  });
});
