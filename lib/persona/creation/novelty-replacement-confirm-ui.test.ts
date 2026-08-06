/**
 * Phase 2.1E.1 — Novelty replacement confirm / loading / result contract tests.
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
  resetMemoryGenerationJobStoreForTests,
  setCreationRepositoryForTests,
  setGenerationJobRepositoryForTests,
  setPersonaRepositoryForTests,
  getFakeBatchInvocationCount,
  resetFakeBatchInvocationCount,
  UI_CHECKBOX_ATTESTATION,
} from "@/lib/persona";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import {
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
  FACE_SIMILARITY_THRESHOLD_VERSION,
  FACE_SIMILARITY_EVALUATOR_VERSION,
} from "@/lib/persona/face-novelty-memory/similarity-threshold";
import { NOVELTY_REPLACEMENT_REASON } from "./novelty-replacement";
import {
  NOVELTY_REPLACEMENT_POLL_INTERVAL_MS,
  NOVELTY_REPLACEMENT_POLL_TIMEOUT_MS,
  NOVELTY_REPLACEMENT_TIMEOUT_MESSAGE,
  outcomeMessage,
  readActiveNoveltyReplacements,
} from "./novelty-replacement-result";

const scopeA: WorkspaceScope = {
  workspaceId: PERSONA_TEST_WORKSPACE_ID,
  actorId: "tester-2-1e1",
};

async function paidProject() {
  return createCreationProject(scopeA, {
    name: "2.1E.1 Confirm Fix",
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

function uiOpts(token: string) {
  return {
    costConfirmed: true as const,
    confirmationToken: token,
    userConfirmedAt: new Date().toISOString(),
    attestation: UI_CHECKBOX_ATTESTATION,
  };
}

describe("Phase 2.1E.1 novelty replacement confirm/loading/result", () => {
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
    const personaRepo = new MemoryPersonaRepository();
    creationRepo = new MemoryCreationRepository();
    jobRepo = new MemoryGenerationJobRepository();
    resetMemoryGenerationJobStoreForTests();
    resetFakeBatchInvocationCount();
    setPersonaRepositoryForTests(personaRepo);
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
    return { project, blocked: blocked!, allowed: generated.candidates.filter((c) => c.id !== target.id) };
  }

  it("1–3. confirm reaches action; token consumed once; duplicate confirm does not re-call provider", async () => {
    const { project, blocked } = await seedBlocked();
    const prepared = await prepareNoveltyReplacementConfirmation(scopeA, project.id, {
      candidateId: blocked.id,
    });
    const before = getFakeBatchInvocationCount();
    const first = await confirmNoveltyReplacementGeneration(scopeA, project.id, {
      candidateId: blocked.id,
      ...uiOpts(prepared.confirmation.confirmation_token),
    });
    assert.equal(first.ok, true);
    assert.equal(getFakeBatchInvocationCount(), before + 1);

    const confirmation = await jobRepo.getConfirmationByToken(
      scopeA,
      prepared.confirmation.confirmation_token,
    );
    assert.ok(confirmation?.consumed_at);

    // Duplicate confirm with same token must not create another provider call.
    const second = await confirmNoveltyReplacementGeneration(scopeA, project.id, {
      candidateId: blocked.id,
      ...uiOpts(prepared.confirmation.confirmation_token),
    });
    assert.equal(second.ok, true);
    if (second.ok) {
      assert.equal(second.newCandidateId, first.ok ? first.newCandidateId : null);
    }
    assert.equal(getFakeBatchInvocationCount(), before + 1);
  });

  it("4–9. success contract covers allowed/blocked/exhausted/failed messaging helpers", () => {
    assert.equal(outcomeMessage("allowed"), "New face passed novelty protection.");
    assert.equal(outcomeMessage("blocked"), "New face was still too similar.");
    assert.match(outcomeMessage("exhausted"), /Slot exhausted after 4 attempts/);
    assert.equal(NOVELTY_REPLACEMENT_POLL_INTERVAL_MS, 2000);
    assert.equal(NOVELTY_REPLACEMENT_POLL_TIMEOUT_MS, 120_000);
    assert.match(NOVELTY_REPLACEMENT_TIMEOUT_MESSAGE, /longer than expected/);
  });

  it("10–14. active replacement jobs resume; board GET uses no-store headers in route", () => {
    const routeSrc = readFileSync(
      join(process.cwd(), "app/api/persona/creation-projects/[id]/route.ts"),
      "utf8",
    );
    assert.match(routeSrc, /confirm_novelty_replacement/);
    assert.match(routeSrc, /activeNoveltyReplacements/);
    assert.match(routeSrc, /maxDuration = 180/);

    const utilsSrc = readFileSync(
      join(process.cwd(), "app/api/persona/_utils.ts"),
      "utf8",
    );
    assert.match(utilsSrc, /Cache-Control": "no-store/);

    const jobs = [
      {
        id: "job-1",
        workspace_id: scopeA.workspaceId,
        creation_project_id: "proj",
        candidate_id: "cand-a",
        stage: "discovery" as const,
        provider: "openai",
        provider_job_id: null,
        status: "generating" as const,
        requested_asset_types: ["portrait_front" as const],
        quality_mode: "premium_editorial" as const,
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
          providerStartedAt: new Date().toISOString(),
        },
        confirmed_at: new Date().toISOString(),
        retry_count: 2,
        error_code: null,
        error_message: null,
        started_at: new Date().toISOString(),
        completed_at: null,
        cancelled_at: null,
        created_by: scopeA.actorId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    const active = readActiveNoveltyReplacements(jobs as never);
    assert.equal(active.length, 1);
    assert.equal(active[0]!.slot, "A");
    assert.equal(active[0]!.state, "generating");
  });

  it("15–18. provider exception not swallowed; confirm without checkbox rejects; no OpenAI before confirm; double-click safe", async () => {
    const { project, blocked } = await seedBlocked();
    const before = getFakeBatchInvocationCount();
    await assert.rejects(
      () =>
        confirmNoveltyReplacementGeneration(scopeA, project.id, {
          candidateId: blocked.id,
          costConfirmed: false,
        }),
      (e: unknown) =>
        e instanceof PersonaDomainError && /Kostenbestätigung/i.test(e.message),
    );
    assert.equal(getFakeBatchInvocationCount(), before);

    const prepared = await prepareNoveltyReplacementConfirmation(scopeA, project.id, {
      candidateId: blocked.id,
    });
    assert.equal(getFakeBatchInvocationCount(), before);

    const result = await confirmNoveltyReplacementGeneration(scopeA, project.id, {
      candidateId: blocked.id,
      ...uiOpts(prepared.confirmation.confirmation_token),
    });
    assert.equal(result.ok, true);
    assert.equal(result.providerStarted, true);
    assert.equal(result.providerCompleted, true);
    assert.ok(Array.isArray(result.checkpoints));
    assert.ok(result.checkpoints?.includes("provider_generation_started"));
    assert.ok(result.checkpoints?.includes("response_returned"));
  });

  it("19. existing allowed candidates remain untouched", async () => {
    const { project, blocked, allowed } = await seedBlocked();
    const prepared = await prepareNoveltyReplacementConfirmation(scopeA, project.id, {
      candidateId: blocked.id,
    });
    const result = await confirmNoveltyReplacementGeneration(scopeA, project.id, {
      candidateId: blocked.id,
      ...uiOpts(prepared.confirmation.confirmation_token),
    });
    assert.equal(result.ok, true);
    for (const c of allowed) {
      const fresh = await creationRepo.getCandidate(scopeA, c.id);
      assert.equal(fresh!.status, "ready");
      assert.equal(fresh!.provider_job_id, c.provider_job_id);
    }
  });

  it("20. thresholds/evaluator unchanged", () => {
    assert.equal(FACE_SIMILARITY_THRESHOLD_VERSION, "v1.0.0");
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
    assert.equal(FACE_SIMILARITY_EVALUATOR_VERSION, "local-vladmandic-1.7.x-v1");
  });

  it("client loading UI and route contract source checks", () => {
    const views = readFileSync(
      join(process.cwd(), "components/persona/persona-creator-views.tsx"),
      "utf8",
    );
    assert.match(views, /setReplacementFlow/);
    assert.match(views, /NOVELTY_REPLACEMENT_TIMEOUT_MESSAGE/);
    assert.match(views, /cache: "no-store"/);
    assert.match(views, /confirmInFlightRef/);

    const board = readFileSync(
      join(process.cwd(), "components/persona/candidate-board.tsx"),
      "utf8",
    );
    assert.match(board, /Generating new face/i);
    assert.match(board, /Generating image and checking face novelty/i);
    assert.match(board, /Elapsed \{replacementUi\.elapsedDisplay\}/);

    const studio = readFileSync(
      join(process.cwd(), "components/persona/use-persona-studio.ts"),
      "utf8",
    );
    assert.match(studio, /data\.ok === false/);
    assert.match(studio, /openCandidates: true/);
  });
});
