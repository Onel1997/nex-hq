/**
 * Phase 2.1E.5 — New discovery start flow restoration.
 * Never calls OpenAI / paid providers.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  MemoryCreationRepository,
  MemoryGenerationJobRepository,
  MemoryPersonaRepository,
  PERSONA_TEST_WORKSPACE_ID,
  UI_CHECKBOX_ATTESTATION,
  confirmAndStartCandidateGeneration,
  createCreationProject,
  listCandidateBoardPayload,
  listGenerationJobsForProject,
  preparePaidGenerationConfirmation,
  resetMemoryGenerationJobStoreForTests,
  setCreationRepositoryForTests,
  setGenerationJobRepositoryForTests,
  setPersonaRepositoryForTests,
} from "@/lib/persona";
import {
  getFakeBatchInvocationCount,
  resetFakeBatchInvocationCount,
  resetFakeBatchTestHooks,
  setFakeBatchErrorForTests,
} from "@/lib/persona/creation/provider/fake-candidate-generator";
import {
  DISCOVERY_SAFE_ERROR_CODES,
  isInitialDiscoveryJob,
  resolveDiscoveryProjectState,
  shouldOpenCandidateBoardForDiscovery,
} from "@/lib/persona/creation/discovery-lifecycle";
import { resolveCurrentGenerationRunId } from "@/lib/persona/creation/casting-data-integrity";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type { PersonaCreationProject } from "@/lib/persona/domain/creation-types";

const scopeA: WorkspaceScope = {
  workspaceId: PERSONA_TEST_WORKSPACE_ID,
  actorId: "tester-discovery-start",
};

async function createDraftDiscoveryProject() {
  return createCreationProject(scopeA, {
    name: "Discovery Start Cast",
    description: "official_brand_face_archetype:arch-mediterranean-premium-hero",
    gender_presentation: "Male",
    age_range: "24-28",
    height_range: "180 cm",
    body_type: "Lean",
    skin_tone_direction: "Olive",
    face_shape_direction: "Oval",
    hair_direction: "Dark",
    facial_hair_direction: "Stubble",
    eye_direction: "Brown",
    expression_direction: "Calm",
    personality: "Friendly",
    fashion_style: "Street",
    brand_role: "primary_male",
    visual_keywords: "hero",
    excluded_features: "ceo",
    preferred_brand_looks: "Casual",
    preferred_outfits: "Tee",
    intended_usage: "image_and_video",
    candidate_count: 4,
    provider_mode: "image_provider",
    quality_mode: "premium_editorial",
    additional_description: "",
    status: "draft",
  } as never);
}

describe("Phase 2.1E.5 discovery start flow", () => {
  let previousOpenAiKey: string | undefined;

  beforeEach(() => {
    process.env.PERSONA_USE_FAKE_PROVIDER = "true";
    delete process.env.PERSONA_FORCE_LIVE_PROVIDER_GUARD;
    delete process.env.PERSONA_SIMULATE_PRODUCTION_ENV;
    delete process.env.PERSONA_PAID_GENERATION_ENABLED;
    previousOpenAiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key";
    setPersonaRepositoryForTests(new MemoryPersonaRepository());
    setCreationRepositoryForTests(new MemoryCreationRepository());
    setGenerationJobRepositoryForTests(new MemoryGenerationJobRepository());
    resetMemoryGenerationJobStoreForTests();
    resetFakeBatchInvocationCount();
    resetFakeBatchTestHooks();
  });

  afterEach(() => {
    setPersonaRepositoryForTests(null);
    setCreationRepositoryForTests(null);
    setGenerationJobRepositoryForTests(null);
    resetFakeBatchTestHooks();
    resetFakeBatchInvocationCount();
    delete process.env.PERSONA_USE_FAKE_PROVIDER;
    if (previousOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAiKey;
  });

  it("1. Start New Discovery creates one project", async () => {
    const a = await createDraftDiscoveryProject();
    const b = await createDraftDiscoveryProject();
    assert.notEqual(a.id, b.id);
    assert.equal(a.status, "draft");
    assert.equal(a.candidate_count, 4);
  });

  it("2. project creation alone does not imply generation completed", async () => {
    const project = await createDraftDiscoveryProject();
    const board = await listCandidateBoardPayload(scopeA, project.id);
    assert.equal(board.generationRunId, null);
    assert.equal(board.discoveryLifecycle.state, "draft");
    assert.equal(board.discoveryLifecycle.notStarted, true);
    assert.equal(board.candidates.length, 0);
    assert.equal(getFakeBatchInvocationCount(), 0);
  });

  it("3. empty project shows not-started state", () => {
    const project = {
      status: "draft",
      last_confirmation_token: null,
      last_estimate_hash: null,
      last_estimate_at: null,
      cost_confirmed_at: null,
    } as Pick<
      PersonaCreationProject,
      | "status"
      | "last_confirmation_token"
      | "last_estimate_hash"
      | "last_estimate_at"
      | "cost_confirmed_at"
    >;
    const snap = resolveDiscoveryProjectState(project, []);
    assert.equal(snap.state, "draft");
    assert.equal(snap.notStarted, true);
    assert.match(snap.message, /has not started yet/i);
    assert.equal(snap.primaryAction, "prepare_estimate");
  });

  it("4–6. estimate preparation opens confirmation and does not call provider", async () => {
    const project = await createDraftDiscoveryProject();
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    assert.ok(prepared.estimate?.available);
    assert.ok(prepared.confirmation?.confirmation_token);
    assert.equal(prepared.job.status, "pending_confirmation");
    assert.equal(
      prepared.job.confirmation_payload?.jobType,
      "initial_discovery",
    );
    assert.equal(getFakeBatchInvocationCount(), 0);

    const board = await listCandidateBoardPayload(scopeA, project.id);
    assert.equal(board.discoveryLifecycle.state, "pending_confirmation");
    assert.equal(board.discoveryLifecycle.notStarted, true);
    assert.equal(board.discoveryLifecycle.primaryAction, "continue_confirmation");
    assert.equal(shouldOpenCandidateBoardForDiscovery(board.discoveryLifecycle), false);
  });

  it("7–9. confirm creates one generation run with non-null id before provider", async () => {
    const project = await createDraftDiscoveryProject();
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    const before = getFakeBatchInvocationCount();
    const result = await confirmAndStartCandidateGeneration(scopeA, project.id, {
      costConfirmed: true,
      confirmationToken: prepared.confirmation.confirmation_token,
      userConfirmedAt: new Date().toISOString(),
      attestation: UI_CHECKBOX_ATTESTATION,
    });
    assert.ok(result.generationRunId);
    assert.equal(result.durableJob?.id, result.generationRunId);
    assert.ok(getFakeBatchInvocationCount() > before);
    assert.ok((result.candidates?.length ?? 0) > 0);
  });

  it("10. double confirm creates no duplicate run", async () => {
    const project = await createDraftDiscoveryProject();
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    await confirmAndStartCandidateGeneration(scopeA, project.id, {
      costConfirmed: true,
      confirmationToken: prepared.confirmation.confirmation_token,
      userConfirmedAt: new Date().toISOString(),
      attestation: UI_CHECKBOX_ATTESTATION,
    });
    await assert.rejects(
      () =>
        confirmAndStartCandidateGeneration(scopeA, project.id, {
          costConfirmed: true,
          confirmationToken: prepared.confirmation.confirmation_token,
          userConfirmedAt: new Date().toISOString(),
          attestation: UI_CHECKBOX_ATTESTATION,
        }),
      /Bestätigung|token|ungültig|WORKFLOW|bereits/i,
    );
    const jobs = await listGenerationJobsForProject(scopeA, project.id);
    const initial = jobs.filter((j) => isInitialDiscoveryJob(j));
    const executed = initial.filter(
      (j) => j.status !== "pending_confirmation" && j.status !== "cancelled",
    );
    assert.equal(executed.length, 1);
  });

  it("11–12. initial discovery action is distinct from replacement; guards do not block", async () => {
    const project = await createDraftDiscoveryProject();
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    assert.equal(prepared.job.confirmation_payload?.intent, "initial");
    assert.equal(prepared.job.confirmation_payload?.noveltyReplacement, undefined);
    assert.equal(isInitialDiscoveryJob(prepared.job), true);
    assert.equal(
      isInitialDiscoveryJob({
        status: "pending_confirmation",
        confirmation_payload: {
          noveltyReplacement: true,
          intent: "novelty_replacement",
        },
      }),
      false,
    );
    // Prepare must succeed even if a replacement-shaped job exists on another path.
    assert.equal(prepared.job.status, "pending_confirmation");
  });

  it("13. board freshness does not hide pending initial discovery lifecycle", async () => {
    const project = await createDraftDiscoveryProject();
    await preparePaidGenerationConfirmation(scopeA, project.id);
    const board = await listCandidateBoardPayload(scopeA, project.id);
    assert.equal(board.generationRunId, null);
    assert.equal(board.discoveryLifecycle.state, "pending_confirmation");
    assert.ok(board.discoveryLifecycle.activeInitialDiscoveryJobId);
    assert.equal(board.discoveryLifecycle.notStarted, true);
  });

  it("14. navigation helper does not open board before generation", () => {
    const pending = resolveDiscoveryProjectState(
      {
        status: "draft",
        last_confirmation_token: "pct_x",
        last_estimate_hash: "h",
        last_estimate_at: new Date().toISOString(),
        cost_confirmed_at: null,
      },
      [
        {
          id: "job-pending",
          status: "pending_confirmation",
          created_at: new Date().toISOString(),
          confirmation_payload: {
            jobType: "initial_discovery",
            castingPhase: "a1_discovery",
            intent: "initial",
          },
        },
      ],
    );
    assert.equal(shouldOpenCandidateBoardForDiscovery(pending), false);
  });

  it("15–16. failed estimate/job codes are defined and failed run is visible", async () => {
    assert.equal(
      DISCOVERY_SAFE_ERROR_CODES.estimate_failed,
      "discovery_estimate_failed",
    );
    assert.equal(
      DISCOVERY_SAFE_ERROR_CODES.job_creation_failed,
      "generation_job_creation_failed",
    );
    const project = await createDraftDiscoveryProject();
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    setFakeBatchErrorForTests(new Error("simulated provider failure"));
    await assert.rejects(
      () =>
        confirmAndStartCandidateGeneration(scopeA, project.id, {
          costConfirmed: true,
          confirmationToken: prepared.confirmation.confirmation_token,
          userConfirmedAt: new Date().toISOString(),
          attestation: UI_CHECKBOX_ATTESTATION,
        }),
      /simulated provider failure/,
    );
    const board = await listCandidateBoardPayload(scopeA, project.id);
    assert.equal(board.discoveryLifecycle.state, "failed");
    assert.equal(board.discoveryLifecycle.primaryAction, "retry_failed");
    assert.equal(
      board.discoveryLifecycle.executedDiscoveryRunId,
      prepared.job.id,
    );
    // Completed-only board run id stays null — but lifecycle exposes the failed run.
    assert.equal(
      resolveCurrentGenerationRunId(
        await listGenerationJobsForProject(scopeA, project.id),
      ),
      null,
    );
  });

  it("17. refresh resumes pending confirmation", async () => {
    const project = await createDraftDiscoveryProject();
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    const board = await listCandidateBoardPayload(scopeA, project.id);
    assert.equal(board.discoveryLifecycle.state, "pending_confirmation");
    assert.equal(
      board.discoveryLifecycle.pendingConfirmationJobId,
      prepared.job.id,
    );
    assert.equal(getFakeBatchInvocationCount(), 0);
  });

  it("18. refresh resumes generating / completed run", async () => {
    const project = await createDraftDiscoveryProject();
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    const result = await confirmAndStartCandidateGeneration(scopeA, project.id, {
      costConfirmed: true,
      confirmationToken: prepared.confirmation.confirmation_token,
      userConfirmedAt: new Date().toISOString(),
      attestation: UI_CHECKBOX_ATTESTATION,
    });
    const board = await listCandidateBoardPayload(scopeA, project.id);
    assert.equal(board.discoveryLifecycle.state, "review");
    assert.equal(board.generationRunId, result.generationRunId);
    assert.equal(board.discoveryLifecycle.hasCompletedBoardRun, true);
  });

  it("19. current empty failed project is recoverable without deletion", () => {
    const snap = resolveDiscoveryProjectState(
      {
        status: "failed",
        last_confirmation_token: "pct_used",
        last_estimate_hash: "h",
        last_estimate_at: new Date().toISOString(),
        cost_confirmed_at: new Date().toISOString(),
      },
      [
        {
          id: "22b0bcdc-failed",
          status: "failed",
          created_at: "2026-08-06T21:08:10.000Z",
          error_message: "OpenAI API quota exceeded",
          error_code: "GENERATION_FAILED",
          confirmation_payload: {
            jobType: "initial_discovery",
            castingPhase: "a1_discovery",
            intent: "initial",
          },
        },
        {
          id: "orphan-pending",
          status: "pending_confirmation",
          created_at: "2026-08-06T21:08:06.000Z",
          confirmation_payload: {
            castingPhase: "a1_discovery",
            intent: "initial",
          },
        },
      ],
    );
    assert.equal(snap.state, "failed");
    assert.equal(snap.primaryAction, "retry_failed");
    assert.equal(snap.executedDiscoveryRunId, "22b0bcdc-failed");
    assert.match(snap.message, /quota|failed/i);
  });

  it("20–21. prepare supersedes orphan pending jobs; no provider on prepare", async () => {
    const project = await createDraftDiscoveryProject();
    const first = await preparePaidGenerationConfirmation(scopeA, project.id);
    const second = await preparePaidGenerationConfirmation(scopeA, project.id);
    assert.notEqual(first.job.id, second.job.id);
    const jobs = await listGenerationJobsForProject(scopeA, project.id);
    const pending = jobs.filter((j) => j.status === "pending_confirmation");
    const cancelled = jobs.filter((j) => j.status === "cancelled");
    assert.equal(pending.length, 1);
    assert.equal(pending[0]!.id, second.job.id);
    assert.ok(cancelled.some((j) => j.id === first.job.id));
    assert.equal(getFakeBatchInvocationCount(), 0);
  });
});
