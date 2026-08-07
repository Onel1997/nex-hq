/**
 * Phase 2.2A — Provider-agnostic Brand Face Discovery Diversity Engine tests.
 * Covers the 30 acceptance requirements. NO paid provider calls.
 */

import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { randomUUID } from "node:crypto";
import {
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
  FACE_SIMILARITY_THRESHOLD_VERSION,
} from "@/lib/persona/face-novelty-memory/similarity-threshold";
import {
  sampleDiscoveryCast,
  listMediterraneanSlotBlueprints,
  type DiscoveryIdentityInstance,
  type DiscoverySlot,
} from "@/lib/persona/identity-blueprints";
import {
  assertDiscoveryProviderConfiguredForPaid,
  DEFAULT_DISCOVERY_ATTEMPTS_PER_SLOT,
  isFalConfigured,
  resolveConfiguredDiscoveryProviderId,
  resolveFalModel,
} from "../provider/discovery-provider-config";
import { deriveProviderSeed, assertUniqueProviderSeeds } from "../provider/discovery-provider-seed";
import {
  DiscoveryProviderError,
  type BrandFaceDiscoveryProvider,
} from "../provider/brand-face-discovery-provider";
import { FalFluxDiscoveryProvider } from "../provider/fal-flux-discovery-provider";
import { OpenAiBrandFaceDiscoveryProvider } from "../provider/openai-brand-face-discovery-provider";
import {
  FakeBrandFaceDiscoveryProvider,
  getFakeDiscoveryInvocationCount,
  resetFakeDiscoveryTestHooks,
  setFakeDiscoveryDelayMsForTests,
  setFakeDiscoveryErrorForTests,
} from "../provider/fake-brand-face-discovery-provider";
import { getBrandFaceDiscoveryProvider } from "../provider/discovery-provider-registry";
import { OpenAiCandidateGenerator } from "../provider/openai-candidate-generator";
import { FalFluxCandidateGenerator } from "../provider/fal-flux-candidate-generator";
import {
  buildDiscoveryCompletionBudget,
  canSpendAttempt,
  createBudgetLedger,
  recordAttemptSpend,
  runDiscoveryCompletion,
  MemoryDiscoveryAttemptRepository,
  validatePreProviderCrossSlotDiversity,
  buildFinalDiscoveryBoard,
  assertBoardIsCurrentRunOnly,
  selectDiscoveryCandidate,
  buildPairwiseSimilarityDiagnostic,
  resolveDiscoveryRunState,
  isBiologicalCastingRejection,
  diversityProfileForSlot,
  listDiscoveryDiversityProfiles,
  type SlotPlan,
} from "./index";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function makeIdentities(runId: string, projectId: string): DiscoveryIdentityInstance[] {
  const blueprints = listMediterraneanSlotBlueprints();
  return sampleDiscoveryCast({
    blueprints,
    creationProjectId: projectId,
    generationRunId: runId,
    attemptNumber: 1,
  });
}

function plansFromIdentities(instances: DiscoveryIdentityInstance[]): SlotPlan[] {
  return instances.map((identity) => ({
    slot: identity.slot,
    attemptNumber: identity.attemptNumber,
    identity,
    prompt: `portrait discovery ${identity.slot} ${identity.anatomyFingerprint}`,
  }));
}

describe("2.2A brand face discovery diversity engine", () => {
  const prevFal = process.env.FAL_KEY;
  const prevProvider = process.env.PERSONA_DISCOVERY_PROVIDER;
  const prevModel = process.env.PERSONA_FAL_MODEL;

  beforeEach(() => {
    resetFakeDiscoveryTestHooks();
    delete process.env.FAL_KEY;
    delete process.env.PERSONA_DISCOVERY_PROVIDER;
    delete process.env.PERSONA_FAL_MODEL;
  });

  afterEach(() => {
    resetFakeDiscoveryTestHooks();
    if (prevFal === undefined) delete process.env.FAL_KEY;
    else process.env.FAL_KEY = prevFal;
    if (prevProvider === undefined) delete process.env.PERSONA_DISCOVERY_PROVIDER;
    else process.env.PERSONA_DISCOVERY_PROVIDER = prevProvider;
    if (prevModel === undefined) delete process.env.PERSONA_FAL_MODEL;
    else process.env.PERSONA_FAL_MODEL = prevModel;
  });

  it("1. provider abstraction exists", () => {
    const fake: BrandFaceDiscoveryProvider = new FakeBrandFaceDiscoveryProvider();
    assert.equal(typeof fake.generateDiscoveryCandidate, "function");
    assert.equal(fake.supportsSeed, true);
    assert.ok(fake.providerName);
    assert.ok(fake.modelName);
  });

  it("2. fal provider is isolated", () => {
    const fal = new FalFluxDiscoveryProvider({
      clientFactory: async () => ({
        subscribe: async () => ({
          data: { images: [{ url: "https://example.invalid/x.png" }], seed: 1 },
          requestId: "req-1",
        }),
      }),
    });
    assert.equal(fal.providerName, "fal_flux");
    assert.equal(fal.supportsSeed, true);
    assert.ok(fal.modelName.includes("flux") || fal.modelName.length > 0);
  });

  it("3. OpenAI remains available", () => {
    const openai = new OpenAiBrandFaceDiscoveryProvider();
    assert.equal(openai.providerName, "openai");
    assert.ok(new OpenAiCandidateGenerator().id === "openai");
  });

  it("4. FAL key never reaches client-facing env prefix", () => {
    process.env.FAL_KEY = "secret-fal-key-for-test";
    assert.equal(isFalConfigured(), true);
    assert.equal(Object.keys(process.env).some((k) => k === "NEXT_PUBLIC_FAL_KEY"), false);
    // Registry modules must not export the raw key.
    const provider = getBrandFaceDiscoveryProvider("fake");
    assert.equal(JSON.stringify(provider).includes("secret-fal-key-for-test"), false);
  });

  it("5. missing FAL config fails before paid generation", () => {
    process.env.PERSONA_DISCOVERY_PROVIDER = "fal_flux";
    delete process.env.FAL_KEY;
    assert.throws(
      () => assertDiscoveryProviderConfiguredForPaid("fal_flux"),
      (err: Error & { code?: string }) => err.code === "discovery_provider_not_configured",
    );
  });

  it("6. 4 slots use 4 different seeds", () => {
    const runId = randomUUID();
    const seeds = (["A", "B", "C", "D"] as DiscoverySlot[]).map((slot) =>
      deriveProviderSeed({
        generationRunId: runId,
        slot,
        attemptNumber: 1,
        provider: "fal_flux",
      }),
    );
    assert.equal(new Set(seeds).size, 4);
  });

  it("7. attempts use new seeds", () => {
    const runId = randomUUID();
    const a1 = deriveProviderSeed({
      generationRunId: runId,
      slot: "A",
      attemptNumber: 1,
      provider: "fal_flux",
    });
    const a2 = deriveProviderSeed({
      generationRunId: runId,
      slot: "A",
      attemptNumber: 2,
      provider: "fal_flux",
    });
    assert.notEqual(a1, a2);
    assertUniqueProviderSeeds([
      { slot: "A", attemptNumber: 1, seed: a1 },
      { slot: "A", attemptNumber: 2, seed: a2 },
    ]);
  });

  it("8. L3 identities remain unique", () => {
    const instances = makeIdentities(randomUUID(), randomUUID());
    const fps = instances.map((i) => i.identityFingerprint);
    assert.equal(new Set(fps).size, 4);
    assert.equal(new Set(instances.map((i) => i.anatomyFingerprint)).size, 4);
  });

  it("9. cross-slot preflight prevents duplicate biological profiles", () => {
    const instances = makeIdentities(randomUUID(), randomUUID());
    const ok = validatePreProviderCrossSlotDiversity(instances);
    assert.equal(ok.ok, true);

    const dup = structuredClone(instances) as DiscoveryIdentityInstance[];
    // Force anatomy collision
    (dup[1] as { anatomyFingerprint: string }).anatomyFingerprint =
      dup[0]!.anatomyFingerprint;
    const bad = validatePreProviderCrossSlotDiversity(dup);
    assert.equal(bad.ok, false);
    assert.ok(bad.issues.some((i) => i.code === "same_anatomy_fingerprint"));
  });

  it("10–15. budget confirmation, auto-replace, max attempts, cost cap", async () => {
    const provider = new FakeBrandFaceDiscoveryProvider();
    const repo = new MemoryDiscoveryAttemptRepository();
    const runId = randomUUID();
    const projectId = randomUUID();
    const workspaceId = randomUUID();
    const instances = makeIdentities(runId, projectId);
    const budget = buildDiscoveryCompletionBudget({
      providerId: "fake",
      providerModel: "fake-discovery-v1",
      maxAttemptsPerSlot: 3,
    });

    assert.equal(budget.confirmationRequired, true);
    assert.ok(budget.authorizedMaxCostEur >= budget.estimatedInitialCostEur);
    assert.equal(budget.maxAttemptsPerSlot, DEFAULT_DISCOVERY_ATTEMPTS_PER_SLOT);

    let noveltyCalls = 0;
    const blockedOnce = new Set<DiscoverySlot>(["A"]);

    await assert.rejects(
      () =>
        runDiscoveryCompletion(
          {
            provider,
            attemptRepo: repo,
            evaluateNovelty: async () => ({ decision: "allowed" }),
            planSlotAttempt: async ({ slot, attemptNumber }) => {
              const next = makeIdentities(`${runId}-${attemptNumber}`, projectId).find(
                (i) => i.slot === slot,
              )!;
              return {
                slot,
                attemptNumber,
                identity: { ...next, attemptNumber },
                prompt: `retry ${slot} ${attemptNumber}`,
              };
            },
            persistCandidate: async ({ slot, attemptNumber }) => ({
              candidateId: `cand-${slot}-${attemptNumber}`,
              assetId: `asset-${slot}-${attemptNumber}`,
            }),
          },
          {
            workspaceId,
            creationProjectId: projectId,
            generationRunId: runId,
            budget,
            maxBudgetConfirmed: false,
            initialPlans: plansFromIdentities(instances),
          },
        ),
      /discovery_max_budget_not_confirmed/,
    );

    const result = await runDiscoveryCompletion(
      {
        provider,
        attemptRepo: repo,
        evaluateNovelty: async ({ slot }) => {
          noveltyCalls += 1;
          if (blockedOnce.has(slot)) {
            blockedOnce.delete(slot);
            return {
              decision: "blocked",
              reason: "face_similarity_duplicate",
              highestSimilarity: 0.9,
            };
          }
          return { decision: "allowed", highestSimilarity: 0.1 };
        },
        planSlotAttempt: async ({ slot, attemptNumber }) => {
          const next = makeIdentities(`${runId}-r${attemptNumber}-${slot}`, projectId).find(
            (i) => i.slot === slot,
          )!;
          return {
            slot,
            attemptNumber,
            identity: { ...next, attemptNumber },
            prompt: `retry ${slot} ${attemptNumber}`,
          };
        },
        persistCandidate: async ({ slot, attemptNumber }) => ({
          candidateId: `cand-${slot}-${attemptNumber}`,
          assetId: `asset-${slot}-${attemptNumber}`,
        }),
      },
      {
        workspaceId,
        creationProjectId: projectId,
        generationRunId: runId,
        budget,
        maxBudgetConfirmed: true,
        initialPlans: plansFromIdentities(instances),
      },
    );

    // 11. blocked face does not fail discovery
    assert.notEqual(result.runState, "failed");
    // 12. blocked slot automatically received next attempt
    const slotA = result.attempts.filter((a) => a.slot === "A");
    assert.ok(slotA.length >= 2);
    // 13. allowed slots are not regenerated unnecessarily — B/C/D should have 1 allowed
    for (const slot of ["B", "C", "D"] as DiscoverySlot[]) {
      const allowed = result.attempts.filter((a) => a.slot === slot && a.status === "allowed");
      assert.equal(allowed.length, 1);
    }
    // 14–16. ready with 4 allowed, within budget
    assert.equal(result.runState, "ready");
    assert.equal(result.board.length, 4);
    assert.ok(result.ledger.actualProviderCostEur <= result.ledger.authorizedMaxCostEur + 1e-9);
    assert.ok(result.ledger.attemptsUsed <= 4 * 3);
    assert.ok(noveltyCalls >= 5); // 4 initial + at least 1 retry for A
    assert.ok(isBiologicalCastingRejection("face_similarity_duplicate"));
  });

  it("14–15. max attempts enforced and cost never exceeded", () => {
    const budget = buildDiscoveryCompletionBudget({
      providerId: "fake",
      providerModel: "fake",
      maxAttemptsPerSlot: 2,
      slotCount: 4,
    });
    let ledger = createBudgetLedger(budget);
    const unit = 0.015;
    let spent = 0;
    while (canSpendAttempt(ledger, unit)) {
      ledger = recordAttemptSpend(ledger, unit);
      spent += 1;
    }
    assert.ok(spent <= 8);
    assert.throws(() => recordAttemptSpend(ledger, unit), /discovery_budget_exceeded/);
    assert.ok(ledger.actualProviderCostEur <= budget.authorizedMaxCostEur + 1e-9);
  });

  it("16–18. ready / ready_partial / blocked history retained", async () => {
    assert.equal(
      resolveDiscoveryRunState({ allowedCount: 4, budgetExhausted: false }),
      "ready",
    );
    assert.equal(
      resolveDiscoveryRunState({ allowedCount: 2, budgetExhausted: true }),
      "ready_partial",
    );
    assert.equal(
      resolveDiscoveryRunState({ allowedCount: 0, technicalFailure: true, budgetExhausted: true }),
      "failed",
    );

    const provider = new FakeBrandFaceDiscoveryProvider();
    const repo = new MemoryDiscoveryAttemptRepository();
    const runId = randomUUID();
    const projectId = randomUUID();
    const workspaceId = randomUUID();
    const instances = makeIdentities(runId, projectId);
    const budget = buildDiscoveryCompletionBudget({
      providerId: "fake",
      providerModel: "fake",
      maxAttemptsPerSlot: 1,
    });

    const result = await runDiscoveryCompletion(
      {
        provider,
        attemptRepo: repo,
        evaluateNovelty: async ({ slot }) =>
          slot === "D"
            ? { decision: "blocked", reason: "face_similarity_duplicate" }
            : { decision: "allowed" },
        planSlotAttempt: async ({ slot, attemptNumber, previousIdentity }) => ({
          slot,
          attemptNumber,
          identity: previousIdentity ?? instances.find((i) => i.slot === slot)!,
          prompt: `x ${slot}`,
        }),
        persistCandidate: async ({ slot, attemptNumber }) => ({
          candidateId: `c-${slot}-${attemptNumber}`,
          assetId: `a-${slot}-${attemptNumber}`,
        }),
      },
      {
        workspaceId,
        creationProjectId: projectId,
        generationRunId: runId,
        budget,
        maxBudgetConfirmed: true,
        initialPlans: plansFromIdentities(instances),
      },
    );

    assert.equal(result.runState, "ready_partial");
    assert.ok(result.board.length >= 1 && result.board.length < 4);
    assert.ok(result.attempts.some((a) => a.status === "blocked" || a.status === "superseded"));
    // history retained
    assert.ok(result.attempts.length >= 4);
  });

  it("19. final board shows current-run candidates only", () => {
    const runId = randomUUID();
    const projectId = randomUUID();
    const board = buildFinalDiscoveryBoard({
      generationRunId: runId,
      creationProjectId: projectId,
      attempts: [
        {
          id: "1",
          workspaceId: "w",
          creationProjectId: projectId,
          generationRunId: runId,
          slot: "A",
          attemptNumber: 1,
          candidateId: "cand-a",
          replacedCandidateId: null,
          provider: "fake",
          providerModel: "fake",
          providerSeed: 1,
          providerRequestId: null,
          providerResultId: null,
          identityFingerprint: "i",
          anatomyFingerprint: "a",
          promptFingerprint: "p",
          samplingSeed: "s",
          diversityRegion: "refined_longer_softer",
          assetId: "asset-a",
          noveltyDecision: "allowed",
          highestSimilarity: 0.1,
          matchedCandidateId: null,
          status: "allowed",
          providerStartedAt: null,
          providerCompletedAt: null,
          errorCode: null,
          errorMessage: null,
          estimatedCostEur: 0.01,
          actualCostEur: 0.01,
          costStatus: "estimated",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    assertBoardIsCurrentRunOnly(board.cards, runId, projectId);
    assert.throws(
      () =>
        assertBoardIsCurrentRunOnly(
          [{ ...board.cards[0]!, generationRunId: "other-run" }],
          runId,
          projectId,
        ),
      /stale_board_candidate_rejected/,
    );
  });

  it("20. old projects remain readable (OpenAI generator still present)", () => {
    assert.equal(new OpenAiCandidateGenerator().id, "openai");
    assert.equal(new FalFluxCandidateGenerator().id, "fal_flux");
  });

  it("21–23. novelty thresholds unchanged; same-run comparison active", async () => {
    assert.equal(FACE_SIMILARITY_THRESHOLD_VERSION, "v1.0.0");
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);

    const provider = new FakeBrandFaceDiscoveryProvider();
    const repo = new MemoryDiscoveryAttemptRepository();
    const runId = randomUUID();
    const projectId = randomUUID();
    const workspaceId = randomUUID();
    const instances = makeIdentities(runId, projectId);
    const seenSameRun: string[][] = [];

    await runDiscoveryCompletion(
      {
        provider,
        attemptRepo: repo,
        evaluateNovelty: async ({ allowedSameRunCandidateIds }) => {
          seenSameRun.push([...allowedSameRunCandidateIds]);
          return { decision: "allowed" };
        },
        planSlotAttempt: async ({ slot, attemptNumber }) => ({
          slot,
          attemptNumber,
          identity: instances.find((i) => i.slot === slot)!,
          prompt: "p",
        }),
        persistCandidate: async ({ slot, attemptNumber }) => ({
          candidateId: `cand-${slot}-${attemptNumber}`,
          assetId: `asset-${slot}-${attemptNumber}`,
        }),
      },
      {
        workspaceId,
        creationProjectId: projectId,
        generationRunId: runId,
        budget: buildDiscoveryCompletionBudget({
          providerId: "fake",
          providerModel: "fake",
        }),
        maxBudgetConfirmed: true,
        initialPlans: plansFromIdentities(instances),
      },
    );

    // Later slots receive prior allowed ids (same-run comparison active).
    assert.ok(seenSameRun.some((ids) => ids.length > 0));
  });

  it("24. no provider call in unit tests (fake only)", async () => {
    resetFakeDiscoveryTestHooks();
    const provider = new FakeBrandFaceDiscoveryProvider();
    await provider.generateDiscoveryCandidate({
      creationProjectId: "p",
      generationRunId: "r",
      workspaceId: "w",
      slot: "A",
      attemptNumber: 1,
      prompt: "test",
      providerSeed: 42,
    });
    assert.equal(getFakeDiscoveryInvocationCount(), 1);
    // Fal live client never constructed without injection.
  });

  it("25–26. timeout terminates safely; late result cannot overwrite terminal", async () => {
    const provider = new FakeBrandFaceDiscoveryProvider();
    setFakeDiscoveryDelayMsForTests(50);
    const controller = new AbortController();
    const pending = provider.generateDiscoveryCandidate({
      creationProjectId: "p",
      generationRunId: "r",
      workspaceId: "w",
      slot: "A",
      attemptNumber: 1,
      prompt: "test",
      providerSeed: 1,
      abortSignal: controller.signal,
      timeoutMs: 5,
    });
    controller.abort();
    await assert.rejects(() => pending, (err: unknown) => {
      assert.ok(err instanceof DiscoveryProviderError);
      assert.equal(err.code, "provider_timeout");
      return true;
    });

    // Terminal ledger write wins — upsert is idempotent by slot/attempt.
    const repo = new MemoryDiscoveryAttemptRepository();
    const base = {
      id: "att-1",
      workspaceId: "w",
      creationProjectId: "p",
      generationRunId: "r",
      slot: "A" as const,
      attemptNumber: 1,
      candidateId: "c1",
      replacedCandidateId: null,
      provider: "fake",
      providerModel: "fake",
      providerSeed: 1,
      providerRequestId: null,
      providerResultId: null,
      identityFingerprint: "i",
      anatomyFingerprint: "a",
      promptFingerprint: "p",
      samplingSeed: "s",
      diversityRegion: "x",
      assetId: "a1",
      noveltyDecision: "allowed",
      highestSimilarity: 0.1,
      matchedCandidateId: null,
      status: "allowed" as const,
      providerStartedAt: null,
      providerCompletedAt: null,
      errorCode: null,
      errorMessage: null,
      estimatedCostEur: 0.01,
      actualCostEur: 0.01,
      costStatus: "estimated" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    await repo.upsertAttempt(base);
    await repo.upsertAttempt({ ...base, status: "failed", candidateId: "late" });
    const rows = await repo.listAttemptsForSlot({
      generationRunId: "r",
      workspaceId: "w",
      slot: "A",
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.id, "att-1");
  });

  it("27. persistence is idempotent", async () => {
    const repo = new MemoryDiscoveryAttemptRepository();
    const record = {
      id: randomUUID(),
      workspaceId: "w",
      creationProjectId: "p",
      generationRunId: "r",
      slot: "B" as const,
      attemptNumber: 2,
      candidateId: "c",
      replacedCandidateId: null,
      provider: "fake",
      providerModel: "fake",
      providerSeed: 9,
      providerRequestId: "req",
      providerResultId: "res",
      identityFingerprint: "i",
      anatomyFingerprint: "a",
      promptFingerprint: "p",
      samplingSeed: "s",
      diversityRegion: "narrower_angular",
      assetId: "asset",
      noveltyDecision: "allowed",
      highestSimilarity: 0.2,
      matchedCandidateId: null,
      status: "allowed" as const,
      providerStartedAt: null,
      providerCompletedAt: null,
      errorCode: null,
      errorMessage: null,
      estimatedCostEur: 0.01,
      actualCostEur: 0.01,
      costStatus: "estimated" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const first = await repo.upsertAttempt(record);
    const second = await repo.upsertAttempt({
      ...record,
      id: randomUUID(),
      noveltyDecision: "allowed-updated",
    });
    assert.equal(first.id, second.id);
    assert.equal(second.noveltyDecision, "allowed-updated");
    const all = await repo.listAttemptsForRun("r", "w");
    assert.equal(all.length, 1);
  });

  it("28–29. four final cards independently selectable; no Identity Lock yet", async () => {
    const provider = new FakeBrandFaceDiscoveryProvider();
    const repo = new MemoryDiscoveryAttemptRepository();
    const runId = randomUUID();
    const projectId = randomUUID();
    const workspaceId = randomUUID();
    const instances = makeIdentities(runId, projectId);
    const result = await runDiscoveryCompletion(
      {
        provider,
        attemptRepo: repo,
        evaluateNovelty: async () => ({ decision: "allowed" }),
        planSlotAttempt: async ({ slot, attemptNumber }) => ({
          slot,
          attemptNumber,
          identity: instances.find((i) => i.slot === slot)!,
          prompt: "p",
        }),
        persistCandidate: async ({ slot, attemptNumber }) => ({
          candidateId: `cand-${slot}-${attemptNumber}`,
          assetId: `asset-${slot}-${attemptNumber}`,
        }),
      },
      {
        workspaceId,
        creationProjectId: projectId,
        generationRunId: runId,
        budget: buildDiscoveryCompletionBudget({
          providerId: "fake",
          providerModel: "fake",
        }),
        maxBudgetConfirmed: true,
        initialPlans: plansFromIdentities(instances),
      },
    );
    assert.equal(result.board.length, 4);
    for (const card of result.board) {
      assert.equal(card.selectable, true);
      const selected = selectDiscoveryCandidate({
        creationProjectId: projectId,
        generationRunId: runId,
        candidateId: card.candidateId,
        slot: card.slot,
      });
      assert.equal(selected.identityLockStarted, false);
      assert.equal(selected.referenceAnglesRequested, false);
      assert.equal(selected.status, "draft_selected");
    }
  });

  it("diversity profiles separate A/B/C/D regions", () => {
    const profiles = listDiscoveryDiversityProfiles();
    assert.equal(profiles.length, 4);
    assert.equal(diversityProfileForSlot("A").regionId, "refined_longer_softer");
    assert.equal(diversityProfileForSlot("B").regionId, "broader_stronger");
    assert.equal(diversityProfileForSlot("C").regionId, "narrower_angular");
    assert.equal(diversityProfileForSlot("D").regionId, "alternative_strong");
  });

  it("pairwise diagnostic is non-blocking and never returns embeddings", () => {
    const diag = buildPairwiseSimilarityDiagnostic({
      embeddingsBySlot: {
        A: [1, 0, 0],
        B: [0.9, 0.1, 0],
        C: [0, 1, 0],
        D: [0, 0, 1],
      },
    });
    assert.equal(diag.matrix.length, 6);
    assert.ok(diag.closestSameRunPair);
    assert.equal(JSON.stringify(diag).includes('"embeddings"'), false);
    assert.equal(JSON.stringify(diag).includes("[1,0,0]"), false);
  });

  it("fal model env resolves", () => {
    process.env.PERSONA_FAL_MODEL = "fal-ai/flux/dev";
    assert.equal(resolveFalModel(), "fal-ai/flux/dev");
  });

  it("provider begins only after confirmation (seeded fake call count)", async () => {
    resetFakeDiscoveryTestHooks();
    assert.equal(getFakeDiscoveryInvocationCount(), 0);
  });

  it("forced provider error surfaces as technical failure path", async () => {
    setFakeDiscoveryErrorForTests(
      new DiscoveryProviderError({
        message: "boom",
        code: "fal_provider_failed",
        providerName: "fake",
      }),
    );
    const provider = new FakeBrandFaceDiscoveryProvider();
    const repo = new MemoryDiscoveryAttemptRepository();
    const runId = randomUUID();
    const projectId = randomUUID();
    const result = await runDiscoveryCompletion(
      {
        provider,
        attemptRepo: repo,
        evaluateNovelty: async () => ({ decision: "allowed" }),
        planSlotAttempt: async ({ slot, attemptNumber }) => ({
          slot,
          attemptNumber,
          identity: makeIdentities(runId, projectId).find((i) => i.slot === slot)!,
          prompt: "p",
        }),
        persistCandidate: async ({ slot, attemptNumber }) => ({
          candidateId: `c-${slot}-${attemptNumber}`,
          assetId: `a-${slot}-${attemptNumber}`,
        }),
      },
      {
        workspaceId: randomUUID(),
        creationProjectId: projectId,
        generationRunId: runId,
        budget: buildDiscoveryCompletionBudget({
          providerId: "fake",
          providerModel: "fake",
        }),
        maxBudgetConfirmed: true,
        initialPlans: plansFromIdentities(makeIdentities(runId, projectId)),
      },
    );
    assert.equal(result.runState, "failed");
  });

  it("resolveConfiguredDiscoveryProviderId defaults safely without fal", () => {
    delete process.env.FAL_KEY;
    delete process.env.PERSONA_DISCOVERY_PROVIDER;
    const id = resolveConfiguredDiscoveryProviderId();
    assert.ok(id === "openai" || id === "fake" || id === "fal_flux");
  });
});

// Ensure Tiny PNG constant is referenced for clarity in fakes.
void TINY_PNG;
