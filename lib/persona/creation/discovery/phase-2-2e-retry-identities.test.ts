/**
 * Phase 2.2E — Real L3 retry identities + attempt-level novelty.
 *
 * Proves retries sample new L3 people, mint independent candidate/asset
 * records, persist fresh embeddings, and never reuse attempt-1 biology.
 * FakeBrandFaceDiscoveryProvider only — no paid fal/OpenAI calls.
 */

import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { randomUUID } from "node:crypto";
import {
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
  FACE_SIMILARITY_THRESHOLD_VERSION,
  FACE_SIMILARITY_EVALUATOR_VERSION,
} from "@/lib/persona/face-novelty-memory/similarity-threshold";
import {
  listMediterraneanSlotBlueprints,
  sampleDiscoveryCast,
  type DiscoveryIdentityInstance,
  type DiscoverySlot,
} from "@/lib/persona/identity-blueprints";
import { creationProjectInputFromArchetype } from "@/lib/brand-face-selection/creation-project-mapper";
import {
  getIdentityDnaForArchetype,
  loadBrandArchetypeCatalog,
} from "@/lib/brand-archetypes";
import {
  setCreationRepositoryForTests,
  getCreationRepository,
} from "../creation-factory";
import { MemoryCreationRepository } from "../memory-creation-repository";
import {
  FakeBrandFaceDiscoveryProvider,
  getFakeDiscoveryInvocationCount,
  resetFakeDiscoveryTestHooks,
} from "../provider/fake-brand-face-discovery-provider";
import { MemoryDiscoveryAttemptRepository } from "./attempt-repository";
import { buildDiscoveryCompletionBudget } from "./completion-budget";
import { buildFinalDiscoveryBoard } from "./board-final-slots";
import { runOfficialBrandFaceA1DiscoveryCompletion } from "./live-a1-completion-orchestrator";
import { runDiscoveryCompletion, type SlotPlan } from "./completion-engine";
import {
  MemoryNoveltyRepository,
  MemoryEmbeddingRepository,
  registerGeneratedCandidate,
  checkAndRegisterCandidate,
  buildIdentityFingerprint,
  evaluateDiscoveryNovelty,
  loadDiscoveryHistory,
} from "@/lib/persona/face-novelty-memory";
import type { FaceSimilarityEvaluator } from "@/lib/persona/face-novelty-memory/types";
import { filterCandidatesForGenerationRun } from "../casting-data-integrity";

const WS = "ws-phase-2-2e";

function makeScope() {
  return { workspaceId: WS, actorId: "actor-2-2e" };
}

async function makeObfProject() {
  setCreationRepositoryForTests(new MemoryCreationRepository());
  const catalog = loadBrandArchetypeCatalog();
  const archetype =
    catalog.archetypes.find((a) => a.id.includes("mediterranean")) ??
    catalog.archetypes[0]!;
  const dna = getIdentityDnaForArchetype(catalog, archetype);
  const input = creationProjectInputFromArchetype({
    archetype,
    dna,
    providerMode: "image_provider",
  });
  return getCreationRepository().createProject(makeScope(), input);
}

function samplePlan(input: {
  projectId: string;
  runId: string;
  slot: DiscoverySlot;
  attemptNumber: number;
}): SlotPlan {
  // One cast per (run, attempt) so A/B/C/D stay anatomically diverse.
  const identity = sampleDiscoveryCast({
    blueprints: listMediterraneanSlotBlueprints(),
    creationProjectId: input.projectId,
    generationRunId: `${input.runId}-attempt-${input.attemptNumber}`,
    attemptNumber: input.attemptNumber,
  }).find((i) => i.slot === input.slot)!;
  return {
    slot: input.slot,
    attemptNumber: input.attemptNumber,
    identity: { ...identity, attemptNumber: input.attemptNumber },
    prompt: `2.2e ${input.slot} a${input.attemptNumber} ${identity.anatomyFingerprint}`,
  };
}

describe("Phase 2.2E — real L3 retry identities + attempt novelty", () => {
  beforeEach(() => {
    resetFakeDiscoveryTestHooks();
    setCreationRepositoryForTests(new MemoryCreationRepository());
  });

  afterEach(() => {
    resetFakeDiscoveryTestHooks();
    setCreationRepositoryForTests(null);
  });

  it("1–5. A1/A2/A3 get distinct L3 fingerprints, seeds, candidates, assets", async () => {
    const project = await makeObfProject();
    const runId = randomUUID();
    const provider = new FakeBrandFaceDiscoveryProvider();
    const attemptRepo = new MemoryDiscoveryAttemptRepository();
    const blockedUntil = new Map<DiscoverySlot, number>([
      ["A", 2], // block attempts 1 and 2 → need A3
    ]);

    const result = await runOfficialBrandFaceA1DiscoveryCompletion({
      scope: makeScope(),
      project,
      generationRunId: runId,
      budget: {
        ...buildDiscoveryCompletionBudget({
          providerId: "fake",
          providerModel: "fake-discovery-v1",
          maxAttemptsPerSlot: 3,
        }),
        providerId: "fal_flux",
      },
      maxBudgetConfirmed: true,
      provider,
      attemptRepo,
      creationRepoKind: "memory",
      testMode: true,
      planSlotAttempt: async ({ slot, attemptNumber }) =>
        samplePlan({
          projectId: project.id,
          runId,
          slot,
          attemptNumber,
        }),
      evaluateNovelty: async ({ slot, identity }) => {
        const remaining = blockedUntil.get(slot) ?? 0;
        if (remaining > 0) {
          blockedUntil.set(slot, remaining - 1);
          return {
            decision: "blocked",
            reason: "face_similarity_duplicate",
            highestSimilarity: 0.91,
            matchedCandidateId: "prior-hist",
            embeddingStatus: "created",
            euclideanDistance: 0.12,
            matchedProjectId: "other-project",
            matchedSameRun: false,
          };
        }
        return {
          decision: "allowed",
          highestSimilarity: 0.11,
          embeddingStatus: "created",
          euclideanDistance: 0.82,
          matchedCandidateId: null,
          matchedProjectId: null,
          matchedSameRun: false,
          reason: identity.identityFingerprint ? "allowed" : "missing",
        };
      },
    });

    assert.equal(result.runState, "ready");
    const slotA = result.attempts
      .filter((a) => a.slot === "A")
      .sort((a, b) => a.attemptNumber - b.attemptNumber);
    assert.equal(slotA.length, 3);

    const fps = slotA.map((a) => a.identityFingerprint);
    const anatomy = slotA.map((a) => a.anatomyFingerprint);
    const seeds = slotA.map((a) => a.providerSeed);
    const sampling = slotA.map((a) => a.samplingSeed);
    const candidates = slotA.map((a) => a.candidateId);
    const assets = slotA.map((a) => a.assetId);

    assert.equal(new Set(fps).size, 3, "distinct L3 identity fingerprints");
    assert.equal(new Set(anatomy).size, 3, "distinct anatomy fingerprints");
    assert.equal(new Set(seeds).size, 3, "distinct provider seeds");
    assert.equal(new Set(sampling).size, 3, "distinct sampling seeds");
    // Phase 2.2E.2 — one logical candidate per slot; separate assets per attempt.
    assert.equal(new Set(candidates).size, 1, "one logical candidate for slot A");
    assert.equal(new Set(assets).size, 3, "distinct asset ids");
    assert.equal(new Set(slotA.map((a) => a.promptFingerprint)).size, 3);

    const repo = getCreationRepository();
    const cands = await repo.listCandidates(makeScope(), project.id);
    const slotACandidates = cands.filter((c) => c.candidate_number === 1);
    assert.equal(
      slotACandidates.length,
      1,
      "no second candidate_number=1 row",
    );
    assert.equal(slotACandidates[0]!.id, candidates[0]);
    assert.equal(
      slotACandidates[0]!.primary_preview_asset_id,
      assets[2],
      "logical candidate points at latest attempt asset",
    );

    for (const slot of ["B", "C", "D"] as DiscoverySlot[]) {
      const attempts = result.attempts.filter((a) => a.slot === slot);
      assert.equal(attempts.length, 1);
      assert.equal(attempts[0]!.status, "allowed");
    }
  });

  it("6–7. fresh embedding extraction per attempt; attempt-1 never reused", async () => {
    const noveltyRepo = new MemoryNoveltyRepository();
    const embRepo = new MemoryEmbeddingRepository();
    const WS_EMB = "ws-emb-2-2e";
    const candidateId = "cand-reuse-path";
    const vectors = {
      a1: Array.from({ length: 128 }, (_, i) => (i === 0 ? 1 : 0)),
      a2: Array.from({ length: 128 }, (_, i) => (i === 1 ? 1 : 0)),
    };

    const makeEvaluator = (vec: number[]): FaceSimilarityEvaluator => ({
      async evaluate() {
        return {
          status: "performed" as const,
          method: "local-face-embedding-v1",
          isDuplicate: false,
          similarity: 0.1,
          _embedding: vec,
          _detectionStatus: "performed",
          _faceCount: 1,
          _detectionConfidence: 0.99,
          _closestDistance: 0.9,
        } as Awaited<ReturnType<FaceSimilarityEvaluator["evaluate"]>> &
          Record<string, unknown>;
      },
    });

    const historyEmpty = await loadDiscoveryHistory(noveltyRepo, WS_EMB, "arch");
    const first = await checkAndRegisterCandidate(
      noveltyRepo,
      historyEmpty,
      {
        workspaceId: WS_EMB,
        archetypeId: "arch",
        creationProjectId: "proj",
        candidateId,
        assetId: "asset-a1",
        identityFingerprint: "l3-fp-a1",
        sourceProvider: "fake",
        sourceModel: "fake",
      },
      {
        evaluator: makeEvaluator(vectors.a1),
        embeddingRepo: embRepo,
        forceFreshEmbedding: true,
        evaluatorActive: true,
      },
    );
    assert.equal(first.embeddingStatus, "created");
    assert.equal(await embRepo.hasEmbedding(first.recordId, WS_EMB), true);

    const historyAfter = await loadDiscoveryHistory(noveltyRepo, WS_EMB, "arch");
    const second = await checkAndRegisterCandidate(
      noveltyRepo,
      historyAfter,
      {
        workspaceId: WS_EMB,
        archetypeId: "arch",
        creationProjectId: "proj",
        candidateId,
        assetId: "asset-a2",
        identityFingerprint: "l3-fp-a2",
        sourceProvider: "fake",
        sourceModel: "fake",
      },
      {
        evaluator: makeEvaluator(vectors.a2),
        embeddingRepo: embRepo,
        forceFreshEmbedding: true,
        evaluatorActive: true,
      },
    );
    assert.equal(second.embeddingStatus, "created");
    assert.equal(second.recordId, first.recordId);
    assert.notEqual(second.embeddingStatus, "reused");

    const thirdVec = Array.from({ length: 128 }, (_, i) => (i === 2 ? 1 : 0));
    const history3 = await loadDiscoveryHistory(noveltyRepo, WS_EMB, "arch");
    const third = await checkAndRegisterCandidate(
      noveltyRepo,
      history3,
      {
        workspaceId: WS_EMB,
        archetypeId: "arch",
        creationProjectId: "proj",
        candidateId,
        assetId: "asset-a3",
        identityFingerprint: "l3-fp-a3",
        sourceProvider: "fake",
        sourceModel: "fake",
      },
      {
        evaluator: makeEvaluator(thirdVec),
        embeddingRepo: embRepo,
        forceFreshEmbedding: false,
        evaluatorActive: true,
      },
    );
    assert.equal(third.embeddingStatus, "created");
  });

  it("8. real fingerprint duplicate still blocks", async () => {
    const repo = new MemoryNoveltyRepository();
    const fp = "l3-identical-reuse";
    await registerGeneratedCandidate(repo, {
      workspaceId: WS,
      archetypeId: "arch",
      creationProjectId: "p1",
      candidateId: "c-old",
      assetId: "a-old",
      identityFingerprint: fp,
      sourceProvider: "fake",
      sourceModel: "fake",
    });
    const shown = await repo.findByCandidateId("c-old", WS);
    assert.ok(shown);
    await repo.updateState(shown.id, WS, "exhausted", {
      exhaustedAt: new Date().toISOString(),
    });

    const history = await loadDiscoveryHistory(repo, WS, "arch");
    assert.ok(history.forbiddenIdentityFingerprints.has(fp));

    const evaluation = await evaluateDiscoveryNovelty({
      candidateId: "c-new",
      assetId: "a-new",
      creationProjectId: "p2",
      identityFingerprint: fp,
      assetRef: { candidateId: "c-new", assetId: "a-new" },
      history,
    });
    assert.equal(evaluation.hardReject, true);
    assert.equal(
      evaluation.hardRejectReason,
      "identity_fingerprint_already_consumed",
    );
  });

  it("9. face_similarity_duplicate triggers fresh L3 retry", async () => {
    const project = await makeObfProject();
    const runId = randomUUID();
    const provider = new FakeBrandFaceDiscoveryProvider();
    const attemptRepo = new MemoryDiscoveryAttemptRepository();
    const identities: DiscoveryIdentityInstance[] = [];
    let blockedOnce = true;
    const callsBefore = getFakeDiscoveryInvocationCount();

    const result = await runOfficialBrandFaceA1DiscoveryCompletion({
      scope: makeScope(),
      project,
      generationRunId: runId,
      budget: {
        ...buildDiscoveryCompletionBudget({
          providerId: "fake",
          providerModel: "fake",
          maxAttemptsPerSlot: 3,
        }),
        providerId: "fal_flux",
      },
      maxBudgetConfirmed: true,
      provider,
      attemptRepo,
      creationRepoKind: "memory",
      testMode: true,
      planSlotAttempt: async ({ slot, attemptNumber }) => {
        const plan = samplePlan({
          projectId: project.id,
          runId,
          slot,
          attemptNumber,
        });
        if (slot === "A") identities.push(plan.identity);
        return plan;
      },
      evaluateNovelty: async ({ slot }) => {
        if (slot === "A" && blockedOnce) {
          blockedOnce = false;
          return {
            decision: "blocked",
            reason: "face_similarity_duplicate",
            highestSimilarity: 0.88,
            embeddingStatus: "created",
            euclideanDistance: 0.2,
          };
        }
        return {
          decision: "allowed",
          embeddingStatus: "created",
          euclideanDistance: 0.7,
        };
      },
    });

    assert.equal(result.runState, "ready");
    assert.ok(getFakeDiscoveryInvocationCount() > callsBefore + 4);
    assert.ok(identities.length >= 2);
    assert.notEqual(
      identities[0]!.identityFingerprint,
      identities[1]!.identityFingerprint,
    );
    const aAttempts = result.attempts.filter((a) => a.slot === "A");
    assert.ok(aAttempts.length >= 2);
    assert.ok(
      aAttempts.some(
        (a) =>
          (a.status === "superseded" || a.status === "blocked") &&
          a.noveltyDecision === "face_similarity_duplicate",
      ),
    );
    assert.ok(aAttempts.some((a) => a.status === "allowed"));
  });

  it("10. allowed slot never regenerates", async () => {
    const project = await makeObfProject();
    const runId = randomUUID();

    const result = await runOfficialBrandFaceA1DiscoveryCompletion({
      scope: makeScope(),
      project,
      generationRunId: runId,
      budget: {
        ...buildDiscoveryCompletionBudget({
          providerId: "fake",
          providerModel: "fake",
          maxAttemptsPerSlot: 3,
        }),
        providerId: "fal_flux",
      },
      maxBudgetConfirmed: true,
      provider: new FakeBrandFaceDiscoveryProvider(),
      attemptRepo: new MemoryDiscoveryAttemptRepository(),
      creationRepoKind: "memory",
      testMode: true,
      planSlotAttempt: async ({ slot, attemptNumber }) =>
        samplePlan({
          projectId: project.id,
          runId,
          slot,
          attemptNumber,
        }),
      evaluateNovelty: async ({ slot }) =>
        slot === "A"
          ? {
              decision: "blocked",
              reason: "face_similarity_duplicate",
              embeddingStatus: "created",
            }
          : { decision: "allowed", embeddingStatus: "created" },
    });

    assert.ok(result.attempts.filter((a) => a.slot === "A").length >= 2);
    assert.equal(result.attempts.filter((a) => a.slot === "B").length, 1);
    assert.equal(result.attempts.filter((a) => a.slot === "C").length, 1);
    assert.equal(result.attempts.filter((a) => a.slot === "D").length, 1);
    assert.equal(
      result.attempts.filter((a) => a.slot === "B" && a.status === "allowed")
        .length,
      1,
    );
  });

  it("11. attempt evidence never overwritten across attempt numbers", async () => {
    const repo = new MemoryDiscoveryAttemptRepository();
    const runId = randomUUID();
    const projectId = randomUUID();
    const a1 = {
      id: randomUUID(),
      workspaceId: WS,
      creationProjectId: projectId,
      generationRunId: runId,
      slot: "A" as const,
      attemptNumber: 1,
      candidateId: "c1",
      replacedCandidateId: null,
      provider: "fake",
      providerModel: "fake",
      providerSeed: 11,
      providerRequestId: "req-1",
      providerResultId: "res-1",
      identityFingerprint: "fp-1",
      anatomyFingerprint: "an-1",
      promptFingerprint: "pr-1",
      samplingSeed: "ss-1",
      diversityRegion: "r",
      assetId: "asset-1",
      noveltyDecision: "face_similarity_duplicate",
      highestSimilarity: 0.9,
      matchedCandidateId: "m1",
      embeddingStatus: "created" as const,
      euclideanDistance: 0.15,
      matchedProjectId: "proj-other",
      matchedSameRun: false,
      status: "superseded" as const,
      providerStartedAt: null,
      providerCompletedAt: null,
      errorCode: null,
      errorMessage: null,
      estimatedCostEur: 0.04,
      actualCostEur: 0.04,
      costStatus: "estimated" as const,
      createdAt: "2026-08-07T10:00:00.000Z",
      updatedAt: "2026-08-07T10:00:00.000Z",
    };
    const a2 = {
      ...a1,
      id: randomUUID(),
      attemptNumber: 2,
      candidateId: "c2",
      providerSeed: 22,
      providerRequestId: "req-2",
      identityFingerprint: "fp-2",
      anatomyFingerprint: "an-2",
      promptFingerprint: "pr-2",
      samplingSeed: "ss-2",
      assetId: "asset-2",
      noveltyDecision: "allowed",
      highestSimilarity: 0.1,
      matchedCandidateId: null,
      euclideanDistance: 0.8,
      matchedProjectId: null,
      matchedSameRun: false,
      status: "allowed" as const,
      createdAt: "2026-08-07T10:01:00.000Z",
      updatedAt: "2026-08-07T10:01:00.000Z",
    };
    await repo.upsertAttempt(a1);
    await repo.upsertAttempt(a2);
    await repo.upsertAttempt({
      ...a2,
      noveltyDecision: "allowed-refresh",
      highestSimilarity: 0.05,
    });
    const rows = await repo.listAttemptsForSlot({
      generationRunId: runId,
      workspaceId: WS,
      slot: "A",
    });
    assert.equal(rows.length, 2);
    const kept = rows.find((r) => r.attemptNumber === 1)!;
    assert.equal(kept.identityFingerprint, "fp-1");
    assert.equal(kept.assetId, "asset-1");
    assert.equal(kept.noveltyDecision, "face_similarity_duplicate");
    assert.equal(kept.euclideanDistance, 0.15);
    assert.equal(kept.embeddingStatus, "created");
    assert.equal(kept.matchedSameRun, false);
  });

  it("12. final board shows latest allowed attempt only", () => {
    const runId = randomUUID();
    const projectId = randomUUID();
    const base = {
      id: "x",
      workspaceId: WS,
      creationProjectId: projectId,
      generationRunId: runId,
      slot: "A" as const,
      attemptNumber: 1,
      candidateId: "cand-blocked",
      replacedCandidateId: null,
      provider: "fake",
      providerModel: "fake",
      providerSeed: 1,
      providerRequestId: "r1",
      providerResultId: null,
      identityFingerprint: "i1",
      anatomyFingerprint: "a1",
      promptFingerprint: "p1",
      samplingSeed: "s1",
      diversityRegion: "r",
      assetId: "asset-blocked",
      noveltyDecision: "face_similarity_duplicate",
      highestSimilarity: 0.9,
      matchedCandidateId: null,
      embeddingStatus: "created" as const,
      euclideanDistance: 0.1,
      matchedProjectId: null,
      matchedSameRun: false,
      status: "superseded" as const,
      providerStartedAt: null,
      providerCompletedAt: null,
      errorCode: null,
      errorMessage: null,
      estimatedCostEur: 0.04,
      actualCostEur: 0.04,
      costStatus: "estimated" as const,
      createdAt: "t1",
      updatedAt: "t1",
    };
    const board = buildFinalDiscoveryBoard({
      generationRunId: runId,
      creationProjectId: projectId,
      attempts: [
        base,
        {
          ...base,
          id: "y",
          attemptNumber: 2,
          candidateId: "cand-allowed",
          assetId: "asset-allowed",
          identityFingerprint: "i2",
          status: "allowed",
          noveltyDecision: "allowed",
          highestSimilarity: 0.2,
        },
        {
          ...base,
          id: "z",
          slot: "B",
          attemptNumber: 1,
          candidateId: "cand-b",
          assetId: "asset-b",
          status: "allowed",
          noveltyDecision: "allowed",
        },
      ],
    });
    const cardA = board.cards.find((c) => c.slot === "A")!;
    assert.equal(cardA.candidateId, "cand-allowed");
    assert.equal(cardA.assetId, "asset-allowed");
    assert.equal(cardA.generationAttempt, 2);
    assert.ok(board.historyBlocked.some((h) => h.candidateId === "cand-blocked"));
    assert.equal(
      board.cards.some((c) => c.candidateId === "cand-blocked"),
      false,
    );
  });

  it("13–14. threshold stays 0.45; evaluator version unchanged", () => {
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
    assert.equal(FACE_SIMILARITY_THRESHOLD_VERSION, "v1.0.0");
    assert.equal(
      FACE_SIMILARITY_EVALUATOR_VERSION,
      "local-vladmandic-1.7.x-v1",
    );
  });

  it("15. no paid provider calls — fake only", async () => {
    const project = await makeObfProject();
    const runId = randomUUID();
    const provider = new FakeBrandFaceDiscoveryProvider();
    assert.equal(provider.providerName, "fake");
    const before = getFakeDiscoveryInvocationCount();
    await runOfficialBrandFaceA1DiscoveryCompletion({
      scope: makeScope(),
      project,
      generationRunId: runId,
      budget: {
        ...buildDiscoveryCompletionBudget({
          providerId: "fake",
          providerModel: "fake",
        }),
        providerId: "fal_flux",
      },
      maxBudgetConfirmed: true,
      provider,
      attemptRepo: new MemoryDiscoveryAttemptRepository(),
      creationRepoKind: "memory",
      testMode: true,
      planSlotAttempt: async ({ slot, attemptNumber }) =>
        samplePlan({ projectId: project.id, runId, slot, attemptNumber }),
      evaluateNovelty: async () => ({
        decision: "allowed",
        embeddingStatus: "created",
      }),
    });
    assert.ok(getFakeDiscoveryInvocationCount() > before);
    assert.equal(provider.providerName, "fake");
  });

  it("static legacy blueprint fingerprint is NOT used for completion novelty", async () => {
    const project = await makeObfProject();
    const runId = randomUUID();
    const attemptRepo = new MemoryDiscoveryAttemptRepository();
    const seenFingerprints: string[] = [];

    const legacyStatic = buildIdentityFingerprint({
      archetypeId: "legacy",
      blueprintId: "slot-A",
      runVariationToken: runId,
      faceGeometry: "static",
      jawShape: "static",
      noseShape: "static",
      eyeShape: "static",
    });

    await runOfficialBrandFaceA1DiscoveryCompletion({
      scope: makeScope(),
      project,
      generationRunId: runId,
      budget: {
        ...buildDiscoveryCompletionBudget({
          providerId: "fake",
          providerModel: "fake",
          maxAttemptsPerSlot: 2,
        }),
        providerId: "fal_flux",
      },
      maxBudgetConfirmed: true,
      provider: new FakeBrandFaceDiscoveryProvider(),
      attemptRepo,
      creationRepoKind: "memory",
      testMode: true,
      planSlotAttempt: async ({ slot, attemptNumber }) =>
        samplePlan({ projectId: project.id, runId, slot, attemptNumber }),
      evaluateNovelty: async ({ identity }) => {
        seenFingerprints.push(identity.identityFingerprint);
        return { decision: "allowed", embeddingStatus: "created" };
      },
    });

    assert.ok(seenFingerprints.length >= 4);
    for (const fp of seenFingerprints) {
      assert.notEqual(fp, legacyStatic);
      assert.ok(fp.length > 0);
    }
    const stored = await attemptRepo.listAttemptsForRun(runId, WS);
    for (const row of stored) {
      assert.ok(seenFingerprints.includes(row.identityFingerprint));
    }
  });

  it("board filter excludes superseded retry parents", async () => {
    const project = await makeObfProject();
    const runId = randomUUID();
    const repo = getCreationRepository();
    const parent = await repo.createCandidate(makeScope(), {
      creation_project_id: project.id,
      candidate_number: 1,
      candidate_name: "A1",
      status: "novelty_blocked",
      provider: "fake",
      provider_job_id: runId,
      generation_seed: "1",
      generation_prompt: "",
      negative_prompt: "",
      generation_settings: {
        boardSupersededByReplacement: true,
        replacedByCandidateId: "child",
      },
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
      rejection_reason: "face_similarity_duplicate",
      actual_generation_cost: 0.04,
    });
    const child = await repo.createCandidate(makeScope(), {
      creation_project_id: project.id,
      candidate_number: 1,
      candidate_name: "A2",
      status: "ready",
      provider: "fake",
      provider_job_id: runId,
      generation_seed: "2",
      generation_prompt: "",
      negative_prompt: "",
      generation_settings: { discoveryAttemptNumber: 2 },
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
      actual_generation_cost: 0.04,
      parent_candidate_id: parent.id,
    });
    const filtered = filterCandidatesForGenerationRun([parent, child], runId);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]!.id, child.id);
  });

  it("completion engine persists 2.2E evidence fields on attempts", async () => {
    const runId = randomUUID();
    const projectId = randomUUID();
    const workspaceId = randomUUID();
    const repo = new MemoryDiscoveryAttemptRepository();
    const blueprints = listMediterraneanSlotBlueprints();
    const instances = sampleDiscoveryCast({
      blueprints,
      creationProjectId: projectId,
      generationRunId: runId,
      attemptNumber: 1,
    });
    const plans: SlotPlan[] = instances.map((identity) => ({
      slot: identity.slot,
      attemptNumber: 1,
      identity,
      prompt: `p ${identity.slot}`,
    }));

    const result = await runDiscoveryCompletion(
      {
        provider: new FakeBrandFaceDiscoveryProvider(),
        attemptRepo: repo,
        planSlotAttempt: async ({ slot, attemptNumber }) =>
          samplePlan({ projectId, runId, slot, attemptNumber }),
        persistCandidate: async ({ slot, attemptNumber }) => ({
          // One logical candidate id per slot; distinct assets per attempt.
          candidateId: `cand-${slot}`,
          assetId: `asset-${slot}-${attemptNumber}`,
        }),
        evaluateNovelty: async ({ attemptNumber }) =>
          attemptNumber === 1
            ? {
                decision: "blocked" as const,
                reason: "face_similarity_duplicate",
                highestSimilarity: 0.85,
                matchedCandidateId: "match-1",
                embeddingStatus: "created" as const,
                euclideanDistance: 0.22,
                matchedProjectId: "other",
                matchedSameRun: false,
              }
            : {
                decision: "allowed" as const,
                highestSimilarity: 0.12,
                embeddingStatus: "created" as const,
                euclideanDistance: 0.77,
                matchedCandidateId: null,
                matchedProjectId: null,
                matchedSameRun: false,
              },
      },
      {
        workspaceId,
        creationProjectId: projectId,
        generationRunId: runId,
        budget: buildDiscoveryCompletionBudget({
          providerId: "fake",
          providerModel: "fake",
          maxAttemptsPerSlot: 3,
        }),
        maxBudgetConfirmed: true,
        initialPlans: plans,
      },
    );

    assert.equal(result.runState, "ready");
    const blocked = result.attempts.find(
      (a) => a.noveltyDecision === "face_similarity_duplicate",
    );
    assert.ok(blocked);
    assert.equal(blocked.embeddingStatus, "created");
    assert.equal(blocked.euclideanDistance, 0.22);
    assert.equal(blocked.matchedProjectId, "other");
    assert.equal(blocked.matchedSameRun, false);

    const allowed = result.attempts.find(
      (a) => a.status === "allowed" && a.slot === blocked.slot,
    )!;
    assert.equal(allowed.candidateId, blocked.candidateId, "same logical candidate");
    assert.notEqual(allowed.assetId, blocked.assetId);
    assert.notEqual(allowed.identityFingerprint, blocked.identityFingerprint);
  });

  it("2.2E.2 providerRequestId persisted before persist failure; B survives", async () => {
    const runId = randomUUID();
    const projectId = randomUUID();
    const workspaceId = randomUUID();
    const attemptRepo = new MemoryDiscoveryAttemptRepository();
    const blueprints = listMediterraneanSlotBlueprints();
    const instances = sampleDiscoveryCast({
      blueprints,
      creationProjectId: projectId,
      generationRunId: runId,
      attemptNumber: 1,
    });
    const plans: SlotPlan[] = instances.map((identity) => ({
      slot: identity.slot,
      attemptNumber: 1,
      identity,
      prompt: `p ${identity.slot}`,
    }));
    const logicalIds: Record<string, string> = {
      A: "cand-A",
      B: "cand-B",
      C: "cand-C",
      D: "cand-D",
    };

    const result = await runDiscoveryCompletion(
      {
        provider: new FakeBrandFaceDiscoveryProvider(),
        attemptRepo,
        planSlotAttempt: async ({ slot, attemptNumber }) =>
          samplePlan({ projectId, runId, slot, attemptNumber }),
        persistCandidate: async ({ slot, attemptNumber }) => {
          if (slot === "A" && attemptNumber === 2) {
            const err = new Error(
              'Kandidat anlegen fehlgeschlagen: duplicate key value violates unique constraint "persona_candidates_creation_project_id_candidate_number_key"',
            );
            (err as { code?: string }).code = "VALIDATION";
            throw err;
          }
          return {
            candidateId: logicalIds[slot]!,
            assetId: `asset-${slot}-${attemptNumber}`,
          };
        },
        evaluateNovelty: async ({ slot, attemptNumber }) => {
          if (slot === "A" && attemptNumber === 1) {
            return {
              decision: "blocked",
              reason: "face_similarity_duplicate",
              embeddingStatus: "created",
            };
          }
          return { decision: "allowed", embeddingStatus: "created" };
        },
      },
      {
        workspaceId,
        creationProjectId: projectId,
        generationRunId: runId,
        budget: buildDiscoveryCompletionBudget({
          providerId: "fake",
          providerModel: "fake",
          maxAttemptsPerSlot: 3,
        }),
        maxBudgetConfirmed: true,
        initialPlans: plans,
      },
    );

    // B (and C/D) remain allowed; run is not wiped to empty failed board.
    assert.ok(result.allowedSlots.includes("B"));
    assert.ok(result.board.some((c) => c.slot === "B"));
    assert.notEqual(result.runState, "failed");

    const a2 = result.attempts.find(
      (a) => a.slot === "A" && a.attemptNumber === 2,
    )!;
    assert.equal(a2.status, "failed");
    assert.ok(
      a2.providerRequestId,
      "paid FLUX request id must survive persist failure",
    );
    assert.match(a2.errorMessage ?? "", /duplicate key|candidate_number/i);

    const a1 = result.attempts.find(
      (a) => a.slot === "A" && a.attemptNumber === 1,
    )!;
    assert.equal(a1.noveltyDecision, "face_similarity_duplicate");
    assert.ok(a1.assetId);
  });

  it("2.2E.2 live orchestrator reuses slot candidate_number on retry", async () => {
    const project = await makeObfProject();
    const runId = randomUUID();
    let aBlocked = true;

    const result = await runOfficialBrandFaceA1DiscoveryCompletion({
      scope: makeScope(),
      project,
      generationRunId: runId,
      budget: {
        ...buildDiscoveryCompletionBudget({
          providerId: "fake",
          providerModel: "fake",
          maxAttemptsPerSlot: 3,
        }),
        providerId: "fal_flux",
      },
      maxBudgetConfirmed: true,
      provider: new FakeBrandFaceDiscoveryProvider(),
      attemptRepo: new MemoryDiscoveryAttemptRepository(),
      creationRepoKind: "memory",
      testMode: true,
      planSlotAttempt: async ({ slot, attemptNumber }) =>
        samplePlan({ projectId: project.id, runId, slot, attemptNumber }),
      evaluateNovelty: async ({ slot }) => {
        if (slot === "A" && aBlocked) {
          aBlocked = false;
          return {
            decision: "blocked",
            reason: "face_similarity_duplicate",
            embeddingStatus: "created",
          };
        }
        return { decision: "allowed", embeddingStatus: "created" };
      },
    });

    assert.equal(result.runState, "ready");
    const scope = makeScope();
    const cands = await getCreationRepository().listCandidates(scope, project.id);
    assert.equal(cands.filter((c) => c.candidate_number === 1).length, 1);
    assert.equal(cands.filter((c) => c.candidate_number === 2).length, 1);
    assert.equal(cands.filter((c) => c.candidate_number === 3).length, 1);
    assert.equal(cands.filter((c) => c.candidate_number === 4).length, 1);

    const aAttempts = result.attempts.filter((a) => a.slot === "A");
    assert.ok(aAttempts.length >= 2);
    assert.equal(
      new Set(aAttempts.map((a) => a.candidateId).filter(Boolean)).size,
      1,
    );
    assert.equal(
      new Set(aAttempts.map((a) => a.assetId).filter(Boolean)).size,
      aAttempts.length,
    );

    const assets = await getCreationRepository().listCandidateAssets(
      scope,
      aAttempts[0]!.candidateId!,
    );
    assert.ok(assets.length >= 2);
  });
});
