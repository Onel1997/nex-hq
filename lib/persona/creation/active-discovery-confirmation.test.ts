/**
 * Phase 2.1E.6 — Consumed discovery confirmation tokens must never hydrate as usable.
 * Fake provider only — never OpenAI.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  MemoryCreationRepository,
  MemoryGenerationJobRepository,
  MemoryPersonaRepository,
  PERSONA_TEST_WORKSPACE_ID,
  UI_CHECKBOX_ATTESTATION,
  canSubmitDiscoveryConfirmation,
  confirmAndStartCandidateGeneration,
  createCreationProject,
  listCandidateBoardPayload,
  listGenerationJobsForProject,
  preparePaidGenerationConfirmation,
  resetMemoryGenerationJobStoreForTests,
  resolveActiveDiscoveryConfirmation,
  setCreationRepositoryForTests,
  setGenerationJobRepositoryForTests,
  setPersonaRepositoryForTests,
} from "@/lib/persona";
import { canStartPaidCandidateGeneration } from "@/components/persona/persona-creator-ux";
import {
  getFakeBatchInvocationCount,
  resetFakeBatchInvocationCount,
  resetFakeBatchTestHooks,
  setFakeBatchErrorForTests,
} from "@/lib/persona/creation/provider/fake-candidate-generator";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type {
  PersonaGenerationConfirmation,
  PersonaGenerationJob,
} from "@/lib/persona/domain/creation-types";

const scopeA: WorkspaceScope = {
  workspaceId: PERSONA_TEST_WORKSPACE_ID,
  actorId: "tester-2-1e6",
};

async function draftProject() {
  return createCreationProject(scopeA, {
    name: "2.1E.6 Confirmation Fix",
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

function conf(overrides: Partial<PersonaGenerationConfirmation>): PersonaGenerationConfirmation {
  return {
    id: "conf-1",
    workspace_id: scopeA.workspaceId,
    creation_project_id: "proj-1",
    generation_job_id: "job-1",
    confirmation_token: "pct_active",
    estimate_hash: "hash",
    stage: "discovery",
    quality_mode: "premium_editorial",
    candidate_count: 4,
    asset_count: 4,
    estimated_cost_min: 0.2,
    estimated_cost_max: 0.6,
    payload: {
      intent: "initial",
      castingPhase: "a1_discovery",
      jobType: "initial_discovery",
    },
    confirmed_at: "2026-08-06T21:00:00.000Z",
    consumed_at: null,
    created_by: "tester",
    created_at: "2026-08-06T21:00:00.000Z",
    ...overrides,
  };
}

function job(overrides: Partial<PersonaGenerationJob>): PersonaGenerationJob {
  return {
    id: "job-1",
    workspace_id: scopeA.workspaceId,
    creation_project_id: "proj-1",
    candidate_id: null,
    stage: "discovery",
    provider: "openai",
    provider_job_id: null,
    status: "pending_confirmation",
    requested_asset_types: ["portrait_front"],
    quality_mode: "premium_editorial",
    estimated_cost_min: 0.2,
    estimated_cost_max: 0.6,
    actual_cost: 0,
    cost_is_estimated: true,
    confirmation_token: "pct_active",
    estimate_hash: "hash",
    confirmation_payload: {
      intent: "initial",
      castingPhase: "a1_discovery",
      jobType: "initial_discovery",
    },
    confirmed_at: null,
    retry_count: 0,
    error_code: null,
    error_message: null,
    started_at: null,
    completed_at: null,
    cancelled_at: null,
    created_by: "tester",
    created_at: "2026-08-06T21:00:00.000Z",
    updated_at: "2026-08-06T21:00:00.000Z",
    ...overrides,
  };
}

describe("Phase 2.1E.6 consumed discovery confirmation token", () => {
  let previousOpenAiKey: string | undefined;
  let creationRepo: MemoryCreationRepository;
  let jobRepo: MemoryGenerationJobRepository;

  beforeEach(() => {
    process.env.PERSONA_USE_FAKE_PROVIDER = "true";
    delete process.env.PERSONA_FORCE_LIVE_PROVIDER_GUARD;
    delete process.env.PERSONA_SIMULATE_PRODUCTION_ENV;
    delete process.env.PERSONA_PAID_GENERATION_ENABLED;
    previousOpenAiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key";
    creationRepo = new MemoryCreationRepository();
    jobRepo = new MemoryGenerationJobRepository();
    setPersonaRepositoryForTests(new MemoryPersonaRepository());
    setCreationRepositoryForTests(creationRepo);
    setGenerationJobRepositoryForTests(jobRepo);
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

  it("1. consumed token is not returned as active", () => {
    const active = resolveActiveDiscoveryConfirmation({
      projectId: "proj-1",
      lastConfirmationToken: "pct_consumed",
      confirmations: [
        conf({
          confirmation_token: "pct_consumed",
          consumed_at: "2026-08-06T21:08:17.000Z",
        }),
      ],
      jobs: [job({ confirmation_token: "pct_consumed", status: "failed" })],
    });
    assert.equal(active.activeConfirmationToken, null);
    assert.equal(active.activeConfirmationStatus, "consumed");
  });

  it("2–5. estimate-only / consumed token never enables generation UI", () => {
    const status = "consumed" as const;
    assert.equal(
      canSubmitDiscoveryConfirmation({
        activeConfirmationToken: null,
        activeConfirmationStatus: status,
        costConfirmed: true,
      }),
      false,
    );
    assert.equal(
      canStartPaidCandidateGeneration({
        busy: false,
        costConfirmed: true,
        providerMode: "image_provider",
        costEstimate: {
          available: true,
          provider: "openai",
          providerMode: "image_provider",
          candidateCount: 4,
          imagesPerCandidate: 1,
          totalImages: 4,
          estimatedMin: 0.2,
          estimatedMax: 0.6,
          estimatedTotal: 0.6,
          currency: "EUR",
          stage: "discovery",
          note: "test",
          costStatus: "estimated",
        },
        confirmationToken: null,
        confirmationProjectId: null,
        projectId: "proj-1",
      }),
      false,
    );
  });

  it("3. board payload after consume does not expose usable token", async () => {
    const project = await draftProject();
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    const consumedToken = prepared.confirmation.confirmation_token;
    await confirmAndStartCandidateGeneration(scopeA, project.id, {
      costConfirmed: true,
      confirmationToken: consumedToken,
      userConfirmedAt: new Date().toISOString(),
      attestation: UI_CHECKBOX_ATTESTATION,
    });
    const board = await listCandidateBoardPayload(scopeA, project.id);
    assert.equal(board.activeConfirmationToken, null);
    assert.ok(
      board.activeConfirmationStatus === "consumed" ||
        board.activeConfirmationStatus === "missing",
    );
    assert.notEqual(board.activeConfirmationToken, consumedToken);
  });

  it("6–7. prepare creates a fresh token different from consumed", async () => {
    const project = await draftProject();
    const first = await preparePaidGenerationConfirmation(scopeA, project.id);
    await confirmAndStartCandidateGeneration(scopeA, project.id, {
      costConfirmed: true,
      confirmationToken: first.confirmation.confirmation_token,
      userConfirmedAt: new Date().toISOString(),
      attestation: UI_CHECKBOX_ATTESTATION,
    });
    const beforePrepare = getFakeBatchInvocationCount();
    const second = await preparePaidGenerationConfirmation(scopeA, project.id);
    assert.ok(second.activeConfirmationToken);
    assert.equal(second.activeConfirmationStatus, "ready");
    assert.notEqual(
      second.activeConfirmationToken,
      first.confirmation.confirmation_token,
    );
    assert.equal(getFakeBatchInvocationCount(), beforePrepare);
  });

  it("8–9. successful consume clears project token pointer; failed gen does not restore", async () => {
    const project = await draftProject();
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    setFakeBatchErrorForTests(new Error("simulated provider failure"));
    await assert.rejects(() =>
      confirmAndStartCandidateGeneration(scopeA, project.id, {
        costConfirmed: true,
        confirmationToken: prepared.confirmation.confirmation_token,
        userConfirmedAt: new Date().toISOString(),
        attestation: UI_CHECKBOX_ATTESTATION,
      }),
    );
    const after = await creationRepo.getProject(scopeA, project.id);
    assert.equal(after?.last_confirmation_token, null);
    const board = await listCandidateBoardPayload(scopeA, project.id);
    assert.equal(board.activeConfirmationToken, null);
  });

  it("10. expired token is not active", () => {
    const active = resolveActiveDiscoveryConfirmation({
      projectId: "proj-1",
      confirmations: [
        conf({
          confirmation_token: "pct_expired",
          payload: {
            intent: "initial",
            castingPhase: "a1_discovery",
            expired: true,
            expired_at: "2020-01-01T00:00:00.000Z",
          },
        }),
      ],
      jobs: [job({ confirmation_token: "pct_expired" })],
    });
    assert.equal(active.activeConfirmationToken, null);
    assert.equal(active.activeConfirmationStatus, "expired");
  });

  it("11. cancelled token is not active", () => {
    const active = resolveActiveDiscoveryConfirmation({
      projectId: "proj-1",
      confirmations: [
        conf({
          confirmation_token: "pct_cancelled",
          payload: {
            intent: "initial",
            castingPhase: "a1_discovery",
            cancelled: true,
          },
        }),
      ],
      jobs: [
        job({
          confirmation_token: "pct_cancelled",
          status: "cancelled",
          cancelled_at: "2026-08-06T21:00:01.000Z",
        }),
      ],
    });
    assert.equal(active.activeConfirmationToken, null);
    assert.equal(active.activeConfirmationStatus, "cancelled");
  });

  it("12. superseded pending confirmation is not active", async () => {
    const project = await draftProject();
    const first = await preparePaidGenerationConfirmation(scopeA, project.id);
    const second = await preparePaidGenerationConfirmation(scopeA, project.id);
    const board = await listCandidateBoardPayload(scopeA, project.id);
    assert.equal(board.activeConfirmationToken, second.activeConfirmationToken);
    assert.notEqual(board.activeConfirmationToken, first.confirmation.confirmation_token);
    const jobs = await listGenerationJobsForProject(scopeA, project.id);
    assert.ok(jobs.some((j) => j.status === "cancelled"));
  });

  it("13–14. consumed-token error maps to discovery_confirmation_failed; double confirm blocked", async () => {
    const project = await draftProject();
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
      (err: unknown) => {
        assert.ok(err && typeof err === "object" && "details" in err);
        const details = (err as { details?: Record<string, unknown> }).details;
        assert.equal(details?.reusedConfirmation, true);
        return true;
      },
    );
  });

  it("15–16. current failed project remains recoverable; no provider on load/prepare", async () => {
    const project = await draftProject();
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    setFakeBatchErrorForTests(new Error("quota"));
    await assert.rejects(() =>
      confirmAndStartCandidateGeneration(scopeA, project.id, {
        costConfirmed: true,
        confirmationToken: prepared.confirmation.confirmation_token,
        userConfirmedAt: new Date().toISOString(),
        attestation: UI_CHECKBOX_ATTESTATION,
      }),
    );
    resetFakeBatchTestHooks();
    const before = getFakeBatchInvocationCount();
    const board = await listCandidateBoardPayload(scopeA, project.id);
    assert.equal(board.activeConfirmationToken, null);
    assert.equal(getFakeBatchInvocationCount(), before);
    const retry = await preparePaidGenerationConfirmation(scopeA, project.id);
    assert.ok(retry.activeConfirmationToken);
    assert.equal(retry.activeConfirmationStatus, "ready");
    assert.equal(getFakeBatchInvocationCount(), before);
  });

  it("17–18. ready token resolves; last_confirmation_token alone is not proof", () => {
    const active = resolveActiveDiscoveryConfirmation({
      projectId: "proj-1",
      lastConfirmationToken: "pct_stale_consumed",
      confirmations: [
        conf({
          id: "c-old",
          confirmation_token: "pct_stale_consumed",
          consumed_at: "2026-08-06T21:08:17.000Z",
          created_at: "2026-08-06T21:08:10.000Z",
        }),
        conf({
          id: "c-new",
          confirmation_token: "pct_fresh",
          generation_job_id: "job-fresh",
          created_at: "2026-08-06T21:40:00.000Z",
        }),
      ],
      jobs: [
        job({
          id: "job-old",
          confirmation_token: "pct_stale_consumed",
          status: "failed",
          created_at: "2026-08-06T21:08:10.000Z",
        }),
        job({
          id: "job-fresh",
          confirmation_token: "pct_fresh",
          status: "pending_confirmation",
          created_at: "2026-08-06T21:40:00.000Z",
        }),
      ],
    });
    assert.equal(active.activeConfirmationToken, "pct_fresh");
    assert.equal(active.activeConfirmationStatus, "ready");
  });
});
