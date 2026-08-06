/**
 * Phase 2.1E — Live novelty replacement + Slot A Soft Luxury expansion tests.
 * Uses FakeCandidateGenerator only — never calls OpenAI.
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
  FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD,
  FACE_SIMILARITY_THRESHOLD_VERSION,
  FACE_SIMILARITY_EVALUATOR_VERSION,
} from "@/lib/persona/face-novelty-memory/similarity-threshold";
import {
  countRetryAxisDiffs,
  getMediterraneanSlotBlueprint,
  matchesHistoricalSoftLuxuryCluster,
  MIN_RETRY_AXIS_DIFFS,
  RETRY_DIVERSITY_AXES,
  sampleDiscoveryIdentityInstance,
  SLOT_BLUEPRINT_VERSION,
} from "@/lib/persona/identity-blueprints";
import {
  canRequestNoveltyReplacement,
  MAX_DISCOVERY_IDENTITY_ATTEMPTS,
  NOVELTY_REPLACEMENT_REASON,
  readIdentityAttemptNumber,
  resolveMatchedSameRunSlot,
  SLOT_EXHAUSTED_MESSAGE,
} from "./novelty-replacement";
import { partitionBoardCandidates } from "@/lib/persona/face-novelty-memory/board-visibility";
import { resolveCurrentGenerationRunId } from "./casting-data-integrity";

const scopeA: WorkspaceScope = {
  workspaceId: PERSONA_TEST_WORKSPACE_ID,
  actorId: "tester-2-1e",
};

const SAMPLED_AT = "2026-08-05T16:00:00.000Z";

async function paidProject() {
  return createCreationProject(scopeA, {
    name: "2.1E Novelty Replacement",
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

describe("Phase 2.1E novelty replacement", () => {
  let personaRepo: MemoryPersonaRepository;
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
    setPersonaRepositoryForTests(null);
    setCreationRepositoryForTests(null);
    setGenerationJobRepositoryForTests(null);
    resetMemoryGenerationJobStoreForTests();
    resetFakeBatchInvocationCount();
    if (previousOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAiKey;
  });

  async function seedDiscoveryWithBlockedSlot(slotNumber = 1) {
    const project = await paidProject();
    const prepared = await preparePaidGenerationConfirmation(scopeA, project.id);
    const generated = await confirmAndStartCandidateGeneration(
      scopeA,
      project.id,
      uiOpts(prepared.confirmation.confirmation_token),
    );
    const candidates = generated.candidates ?? [];
    assert.equal(candidates.length, 4);
    const target = candidates.find((c) => c.candidate_number === slotNumber);
    assert.ok(target);
    const blocked = await creationRepo.updateCandidate(scopeA, target!.id, {
      status: "novelty_blocked",
      generation_settings: {
        ...(target!.generation_settings ?? {}),
        identityAttemptNumber: 1,
        discoveryIdentity: {
          ...((target!.generation_settings?.discoveryIdentity as object) ?? {}),
          attemptNumber: 1,
          generationRunId:
            (target!.generation_settings?.discoveryIdentity as { generationRunId?: string })
              ?.generationRunId ?? target!.provider_job_id,
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
          closestPriorCandidateId: candidates.find((c) => c.candidate_number === 2)?.id,
          similarity: 0.82,
        },
      },
    });
    return { project, candidates, blocked: blocked! };
  }

  it("1–8. duplicate retry increments attempt, only blocked slot, confirmation, preserves prior", async () => {
    const { project, candidates, blocked } = await seedDiscoveryWithBlockedSlot(1);
    const beforeCalls = getFakeBatchInvocationCount();
    const allowedIds = candidates
      .filter((c) => c.id !== blocked.id)
      .map((c) => c.id);

    await assert.rejects(
      () =>
        confirmNoveltyReplacementGeneration(scopeA, project.id, {
          candidateId: blocked.id,
          costConfirmed: false,
        }),
      (e: unknown) =>
        e instanceof PersonaDomainError && /Kostenbestätigung/i.test(e.message),
    );
    assert.equal(getFakeBatchInvocationCount(), beforeCalls);

    const prepared = await prepareNoveltyReplacementConfirmation(
      scopeA,
      project.id,
      { candidateId: blocked.id },
    );
    assert.equal(prepared.previousAttemptNumber, 1);
    assert.equal(prepared.nextAttemptNumber, 2);
    assert.equal(prepared.reason, NOVELTY_REPLACEMENT_REASON);
    assert.equal(getFakeBatchInvocationCount(), beforeCalls);

    const result = await confirmNoveltyReplacementGeneration(
      scopeA,
      project.id,
      {
        candidateId: blocked.id,
        ...uiOpts(prepared.confirmation.confirmation_token),
      },
    );

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.attemptNumber, 2);
    assert.equal(result.newCandidateId != null, true);
    const replacement = await creationRepo.getCandidate(
      scopeA,
      result.newCandidateId,
    );
    assert.ok(replacement);
    assert.equal(replacement!.candidate_number, blocked.candidate_number);
    assert.equal(replacement!.parent_candidate_id, blocked.id);
    assert.equal(
      replacement!.generation_settings?.replacementOfCandidateId,
      blocked.id,
    );
    assert.equal(
      readIdentityAttemptNumber(replacement!.generation_settings),
      2,
    );
    assert.equal(replacement!.provider_job_id, blocked.provider_job_id);

    const prior = await creationRepo.getCandidate(scopeA, blocked.id);
    assert.ok(prior);
    assert.equal(prior!.status, "novelty_blocked");
    assert.equal(
      prior!.generation_settings?.boardSupersededByReplacement,
      true,
    );
    assert.equal(
      prior!.generation_settings?.replacedByCandidateId,
      result.newCandidateId,
    );

    for (const id of allowedIds) {
      const c = await creationRepo.getCandidate(scopeA, id);
      assert.ok(c);
      assert.equal(c!.status, "ready");
      assert.notEqual(c!.id, result.newCandidateId);
    }

    assert.equal(getFakeBatchInvocationCount(), beforeCalls + 1);
  });

  it("9–10. max attempts is 4; attempt 4 block exhausts slot", async () => {
    assert.equal(MAX_DISCOVERY_IDENTITY_ATTEMPTS, 4);
    assert.equal(canRequestNoveltyReplacement(4), false);
    assert.equal(canRequestNoveltyReplacement(3), true);

    const { project, blocked } = await seedDiscoveryWithBlockedSlot(1);
    await creationRepo.updateCandidate(scopeA, blocked.id, {
      generation_settings: {
        ...(blocked.generation_settings ?? {}),
        identityAttemptNumber: 4,
        discoveryIdentity: {
          ...((blocked.generation_settings?.discoveryIdentity as object) ?? {}),
          attemptNumber: 4,
        },
      },
    });

    await assert.rejects(
      () =>
        prepareNoveltyReplacementConfirmation(scopeA, project.id, {
          candidateId: blocked.id,
        }),
      (e: unknown) =>
        e instanceof PersonaDomainError &&
        e.message === SLOT_EXHAUSTED_MESSAGE,
    );

    const exhaustedDto = partitionBoardCandidates([
      {
        ...blocked,
        generation_settings: {
          ...(blocked.generation_settings ?? {}),
          identityAttemptNumber: 4,
          discoveryIdentity: { attemptNumber: 4 },
          slotExhausted: true,
          faceNoveltyLiveDebug: {
            finalDecision: "blocked",
            requiresReplacementConfirmation: true,
            hardRejectReason: NOVELTY_REPLACEMENT_REASON,
          },
        },
      },
    ]).failureSlots[0];
    assert.ok(exhaustedDto);
    assert.equal(exhaustedDto!.slotExhausted, true);
    assert.equal(exhaustedDto!.requiresReplacementConfirmation, false);
    assert.match(exhaustedDto!.reason, /Slot exhausted/i);
  });

  it("11. Slot D attempt 2 can use a new L3 sample", () => {
    const bp = getMediterraneanSlotBlueprint("D");
    const a1 = sampleDiscoveryIdentityInstance({
      slotBlueprint: bp,
      creationProjectId: "proj-d",
      generationRunId: "run-d",
      attemptNumber: 1,
      sampledAt: SAMPLED_AT,
    });
    const a2 = sampleDiscoveryIdentityInstance({
      slotBlueprint: bp,
      creationProjectId: "proj-d",
      generationRunId: "run-d",
      attemptNumber: 2,
      sampledAt: SAMPLED_AT,
      previousAttemptSample: {
        faceGeometry: a1.faceGeometry,
        eyeSpacing: a1.eyeSpacing,
        noseBridge: a1.noseBridge,
        noseWidth: a1.noseWidth,
        jaw: a1.jaw,
        hairline: a1.hairline,
        haircut: a1.haircut,
        beardPattern: a1.beardPattern,
        optionalMicroMarks: a1.optionalMicroMarks,
      },
    });
    assert.equal(a2.attemptNumber, 2);
    assert.notEqual(a1.anatomyFingerprint, a2.anatomyFingerprint);
    assert.notEqual(a1.identityFingerprint, a2.identityFingerprint);
    assert.ok(
      countRetryAxisDiffs(
        {
          faceGeometry: a2.faceGeometry,
          eyeSpacing: a2.eyeSpacing,
          noseBridge: a2.noseBridge,
          noseWidth: a2.noseWidth,
          jaw: a2.jaw,
          hairline: a2.hairline,
          haircut: a2.haircut,
          beardPattern: a2.beardPattern,
          optionalMicroMarks: a2.optionalMicroMarks,
        },
        {
          faceGeometry: a1.faceGeometry,
          eyeSpacing: a1.eyeSpacing,
          noseBridge: a1.noseBridge,
          noseWidth: a1.noseWidth,
          jaw: a1.jaw,
          hairline: a1.hairline,
          haircut: a1.haircut,
          beardPattern: a1.beardPattern,
          optionalMicroMarks: a1.optionalMicroMarks,
        },
      ) >= MIN_RETRY_AXIS_DIFFS,
    );
  });

  it("12. same-run matched slot is persisted", async () => {
    const { project, candidates, blocked } = await seedDiscoveryWithBlockedSlot(4);
    const matchedB = candidates.find((c) => c.candidate_number === 2)!;
    const prepared = await prepareNoveltyReplacementConfirmation(
      scopeA,
      project.id,
      { candidateId: blocked.id },
    );
    const result = await confirmNoveltyReplacementGeneration(
      scopeA,
      project.id,
      {
        candidateId: blocked.id,
        ...uiOpts(prepared.confirmation.confirmation_token),
      },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(
      (await creationRepo.getCandidate(scopeA, result.newCandidateId))
        ?.generation_settings?.matchedCandidateId,
      matchedB.id,
    );
    assert.equal(
      (await creationRepo.getCandidate(scopeA, result.newCandidateId))
        ?.generation_settings?.matchedProjectId,
      project.id,
    );
    assert.equal(
      (await creationRepo.getCandidate(scopeA, result.newCandidateId))
        ?.generation_settings?.matchedSlot,
      "B",
    );
    assert.equal(
      (await creationRepo.getCandidate(scopeA, result.newCandidateId))
        ?.generation_settings?.matchedSameRun,
      true,
    );

    const resolved = resolveMatchedSameRunSlot({
      matchedCandidateId: matchedB.id,
      matchedProjectId: project.id,
      currentProjectId: project.id,
      matchedCandidateNumber: 2,
    });
    assert.deepEqual(resolved, { matchedSameRun: true, matchedSlot: "B" });
  });

  it("13–16. Slot A Soft Luxury pools are broader; no forced freckles/narrow/soft-oval", () => {
    const a = getMediterraneanSlotBlueprint("A");
    assert.equal(SLOT_BLUEPRINT_VERSION, "2.1E.0");
    assert.equal(a.version, "2.1E.0");
    assert.ok(a.controlledPools.faceGeometry.length >= 5);
    assert.ok(a.controlledPools.forehead.length >= 5);
    assert.ok(a.controlledPools.eyeSpacing.length >= 5);
    assert.ok(a.controlledPools.noseBridge.length >= 5);
    assert.ok(a.controlledPools.jaw.length >= 5);
    assert.ok(a.controlledPools.hairline.length >= 5);
    assert.ok(a.controlledPools.haircut.length >= 5);
    assert.ok(a.controlledPools.beardPattern.length >= 5);
    assert.ok(a.controlledPools.optionalMicroMarks.includes("none"));
    assert.ok(
      !a.controlledPools.optionalMicroMarks.every((m) =>
        /freckl/i.test(m),
      ),
    );
    assert.ok(
      a.controlledPools.faceGeometry.some((g) => /elongated oval/i.test(g)),
    );
    assert.ok(
      a.controlledPools.faceGeometry.some((g) => /softly angular oval/i.test(g)),
    );
    assert.ok(
      a.controlledPools.noseBridge.some((n) => /medium-width straight/i.test(n)),
    );
    assert.ok(
      a.controlledPools.noseBridge.some((n) => /broader soft bridge/i.test(n)),
    );
    assert.ok(
      !a.controlledPools.faceGeometry.every((g) => /soft oval/i.test(g)),
    );
    assert.ok(
      !a.controlledPools.noseBridge.every((n) => /narrow straight/i.test(n)),
    );
  });

  it("17–19. retry changes ≥5 axes; attempts 3/4 avoid historical cluster; fingerprints change", () => {
    const bp = getMediterraneanSlotBlueprint("A");
    const prev = sampleDiscoveryIdentityInstance({
      slotBlueprint: bp,
      creationProjectId: "proj-a",
      generationRunId: "run-a-div",
      attemptNumber: 1,
      sampledAt: SAMPLED_AT,
    });
    const attempt2 = sampleDiscoveryIdentityInstance({
      slotBlueprint: bp,
      creationProjectId: "proj-a",
      generationRunId: "run-a-div",
      attemptNumber: 2,
      sampledAt: SAMPLED_AT,
      previousAttemptSample: {
        faceGeometry: prev.faceGeometry,
        eyeSpacing: prev.eyeSpacing,
        noseBridge: prev.noseBridge,
        noseWidth: prev.noseWidth,
        jaw: prev.jaw,
        hairline: prev.hairline,
        haircut: prev.haircut,
        beardPattern: prev.beardPattern,
        optionalMicroMarks: prev.optionalMicroMarks,
      },
    });
    assert.ok(
      countRetryAxisDiffs(
        {
          faceGeometry: attempt2.faceGeometry,
          eyeSpacing: attempt2.eyeSpacing,
          noseBridge: attempt2.noseBridge,
          noseWidth: attempt2.noseWidth,
          jaw: attempt2.jaw,
          hairline: attempt2.hairline,
          haircut: attempt2.haircut,
          beardPattern: attempt2.beardPattern,
          optionalMicroMarks: attempt2.optionalMicroMarks,
        },
        {
          faceGeometry: prev.faceGeometry,
          eyeSpacing: prev.eyeSpacing,
          noseBridge: prev.noseBridge,
          noseWidth: prev.noseWidth,
          jaw: prev.jaw,
          hairline: prev.hairline,
          haircut: prev.haircut,
          beardPattern: prev.beardPattern,
          optionalMicroMarks: prev.optionalMicroMarks,
        },
      ) >= MIN_RETRY_AXIS_DIFFS,
    );
    assert.equal(RETRY_DIVERSITY_AXES.length, 9);

    for (const attempt of [3, 4] as const) {
      const sample = sampleDiscoveryIdentityInstance({
        slotBlueprint: bp,
        creationProjectId: "proj-a",
        generationRunId: "run-a-div",
        attemptNumber: attempt,
        sampledAt: SAMPLED_AT,
        previousAttemptSample: {
          faceGeometry: attempt2.faceGeometry,
          eyeSpacing: attempt2.eyeSpacing,
          noseBridge: attempt2.noseBridge,
          noseWidth: attempt2.noseWidth,
          jaw: attempt2.jaw,
          hairline: attempt2.hairline,
          haircut: attempt2.haircut,
          beardPattern: attempt2.beardPattern,
          optionalMicroMarks: attempt2.optionalMicroMarks,
        },
      });
      assert.equal(
        matchesHistoricalSoftLuxuryCluster({
          faceGeometry: sample.faceGeometry,
          noseBridge: sample.noseBridge,
          noseWidth: sample.noseWidth,
          eyeShape: sample.eyeShape,
          jaw: sample.jaw,
          haircut: sample.haircut,
          optionalMicroMarks: sample.optionalMicroMarks,
        }),
        false,
      );
      assert.notEqual(sample.anatomyFingerprint, prev.anatomyFingerprint);
      assert.notEqual(sample.identityFingerprint, prev.identityFingerprint);
      assert.notEqual(sample.promptFingerprint, prev.promptFingerprint);
    }
  });

  it("20–21. thresholds and evaluator version unchanged", () => {
    assert.equal(FACE_SIMILARITY_THRESHOLD_VERSION, "v1.0.0");
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_WARNING_THRESHOLD, 0.55);
    assert.equal(FACE_SIMILARITY_EVALUATOR_VERSION, "local-vladmandic-1.7.x-v1");
    const thresholdSrc = readFileSync(
      join(process.cwd(), "lib/persona/face-novelty-memory/similarity-threshold.ts"),
      "utf8",
    );
    assert.match(thresholdSrc, /FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD = 0\.45/);
    assert.match(thresholdSrc, /FACE_SIMILARITY_THRESHOLD_VERSION = "v1\.0\.0"/);
  });

  it("23. no provider calls during prepare; novelty replacement jobs do not steal board run", async () => {
    const { project, blocked } = await seedDiscoveryWithBlockedSlot(1);
    const jobsBefore = await jobRepo.listJobsForProject(scopeA, project.id);
    const discoveryRunId = resolveCurrentGenerationRunId(jobsBefore);
    assert.ok(discoveryRunId);

    const before = getFakeBatchInvocationCount();
    await prepareNoveltyReplacementConfirmation(scopeA, project.id, {
      candidateId: blocked.id,
    });
    assert.equal(getFakeBatchInvocationCount(), before);

    const prepared = await prepareNoveltyReplacementConfirmation(
      scopeA,
      project.id,
      { candidateId: blocked.id },
    );
    await confirmNoveltyReplacementGeneration(scopeA, project.id, {
      candidateId: blocked.id,
      ...uiOpts(prepared.confirmation.confirmation_token),
    });

    const jobsAfter = await jobRepo.listJobsForProject(scopeA, project.id);
    assert.equal(resolveCurrentGenerationRunId(jobsAfter), discoveryRunId);
  });
});
