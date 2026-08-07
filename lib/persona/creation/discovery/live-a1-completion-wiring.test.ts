/**
 * Phase 2.2A.1 — Live A1 Completion Engine wiring tests.
 * FakeBrandFaceDiscoveryProvider only — no paid fal/OpenAI calls.
 */

import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { randomUUID } from "node:crypto";
import {
  FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD,
  FACE_SIMILARITY_THRESHOLD_VERSION,
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
  setFakeDiscoveryErrorForTests,
} from "../provider/fake-brand-face-discovery-provider";
import { OpenAiCandidateGenerator } from "../provider/openai-candidate-generator";
import { deriveProviderSeed } from "../provider/discovery-provider-seed";
import { MemoryDiscoveryAttemptRepository } from "./attempt-repository";
import { buildDiscoveryCompletionBudget } from "./completion-budget";
import { selectDiscoveryCandidate } from "./selection-handoff";
import {
  shouldUseDiscoveryCompletionEngine,
  runOfficialBrandFaceA1DiscoveryCompletion,
  buildDiscoveryProgressSnapshot,
} from "./live-a1-completion-orchestrator";
import type { SlotPlan } from "./completion-engine";

const WS = "ws-live-a1-completion";

function makeScope() {
  return { workspaceId: WS, actorId: "actor-1" };
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

function plansFromInstances(
  instances: DiscoveryIdentityInstance[],
): SlotPlan[] {
  return instances.map((identity) => ({
    slot: identity.slot,
    attemptNumber: identity.attemptNumber,
    identity,
    prompt: `portrait ${identity.slot} ${identity.anatomyFingerprint}`,
  }));
}

describe("2.2A.1 live A1 discovery completion wiring", () => {
  beforeEach(() => {
    resetFakeDiscoveryTestHooks();
    setCreationRepositoryForTests(new MemoryCreationRepository());
  });

  afterEach(() => {
    resetFakeDiscoveryTestHooks();
    setCreationRepositoryForTests(null);
  });

  it("1. confirm path selects completion engine for OBF + fal_flux", () => {
    assert.equal(
      shouldUseDiscoveryCompletionEngine({
        castingPhase: "a1_discovery",
        officialBrandFace: true,
        providerId: "fal_flux",
      }),
      true,
    );
    assert.equal(
      shouldUseDiscoveryCompletionEngine({
        castingPhase: "a1_discovery",
        officialBrandFace: true,
        providerId: "openai",
      }),
      false,
    );
    assert.equal(
      shouldUseDiscoveryCompletionEngine({
        castingPhase: "a2_validation",
        officialBrandFace: true,
        providerId: "fal_flux",
      }),
      false,
    );
  });

  it("2–12. runOfficialBrandFaceA1DiscoveryCompletion invokes engine with auto-retry", async () => {
    const project = await makeObfProject();
    const runId = randomUUID();
    const provider = new FakeBrandFaceDiscoveryProvider();
    const attemptRepo = new MemoryDiscoveryAttemptRepository();
    const budget = buildDiscoveryCompletionBudget({
      providerId: "fake",
      providerModel: "fake-discovery-v1",
      maxAttemptsPerSlot: 3,
    });
    // Force providerId fal_flux on budget for wiring semantics while using fake provider impl.
    const falBudget = { ...budget, providerId: "fal_flux" as const };

    const blockedOnce = new Set<DiscoverySlot>(["A", "C"]);
    const providerCallsBefore = getFakeDiscoveryInvocationCount();

    await assert.rejects(
      () =>
        runOfficialBrandFaceA1DiscoveryCompletion({
          scope: makeScope(),
          project,
          generationRunId: runId,
          budget: falBudget,
          maxBudgetConfirmed: false,
          provider,
          attemptRepo,
          creationRepoKind: "memory",
          testMode: true,
          evaluateNovelty: async () => ({ decision: "allowed" }),
        }),
      /maximum discovery budget|max_budget/i,
    );
    assert.equal(getFakeDiscoveryInvocationCount(), providerCallsBefore);

    const blueprints = listMediterraneanSlotBlueprints();
    const result = await runOfficialBrandFaceA1DiscoveryCompletion({
      scope: makeScope(),
      project,
      generationRunId: runId,
      budget: falBudget,
      maxBudgetConfirmed: true,
      provider,
      attemptRepo,
      creationRepoKind: "memory",
      testMode: true,
      planSlotAttempt: async ({ slot, attemptNumber }) => {
        const instances = sampleDiscoveryCast({
          blueprints,
          creationProjectId: project.id,
          generationRunId: `${runId}-attempt-${attemptNumber}`,
          attemptNumber,
        });
        const identity = instances.find((i) => i.slot === slot)!;
        return {
          slot,
          attemptNumber,
          identity: { ...identity, attemptNumber },
          prompt: `retry ${slot} ${attemptNumber} ${identity.anatomyFingerprint}`,
        };
      },
      evaluateNovelty: async ({ slot }) => {
        if (blockedOnce.has(slot)) {
          blockedOnce.delete(slot);
          return {
            decision: "blocked",
            reason: "face_similarity_duplicate",
            highestSimilarity: 0.92,
          };
        }
        return { decision: "allowed", highestSimilarity: 0.12 };
      },
    });

    assert.equal(result.invokedCompletionEngine, true);
    assert.equal(result.runState, "ready");
    assert.equal(result.board.length, 4);

    // 3–4 unique seeds for initial attempts
    const attempt1Seeds = result.attempts
      .filter((a) => a.attemptNumber === 1)
      .map((a) => a.providerSeed);
    assert.equal(new Set(attempt1Seeds).size, 4);

    // 4–6 auto retry A and C; B/D not regenerated beyond 1 allowed
    const slotA = result.attempts.filter((a) => a.slot === "A");
    const slotC = result.attempts.filter((a) => a.slot === "C");
    assert.ok(slotA.length >= 2);
    assert.ok(slotC.length >= 2);
    assert.equal(
      result.attempts.filter((a) => a.slot === "B" && a.status === "allowed").length,
      1,
    );
    assert.equal(
      result.attempts.filter((a) => a.slot === "D" && a.status === "allowed").length,
      1,
    );

    // 8–9 attempt 2 new identity + seed
    const a1 = slotA.find((a) => a.attemptNumber === 1)!;
    const a2 = slotA.find((a) => a.attemptNumber === 2)!;
    assert.notEqual(a1.providerSeed, a2.providerSeed);
    assert.notEqual(a1.anatomyFingerprint, a2.anatomyFingerprint);

    // 10 rejected preserved in history
    assert.ok(
      result.attempts.some(
        (a) =>
          (a.status === "blocked" || a.status === "superseded") &&
          a.noveltyDecision === "face_similarity_duplicate",
      ),
    );

    // 11 biological reject did not fail run
    assert.notEqual(result.runState, "failed");

    // 15 budget not exceeded
    assert.ok(
      result.ledger.actualProviderCostEur <=
        result.ledger.authorizedMaxCostEur + 1e-9,
    );

    // 19 attempts persisted
    const stored = await attemptRepo.listAttemptsForRun(runId, WS);
    assert.ok(stored.length >= 6);

    // 20 board current-run only
    for (const card of result.board) {
      assert.equal(card.generationRunId, runId);
      assert.equal(card.creationProjectId, project.id);
      assert.equal(card.selectable, true);
      assert.equal(card.noveltyStatus, "allowed");
    }

    // 21–22 selection without identity lock
    const selected = selectDiscoveryCandidate({
      creationProjectId: project.id,
      generationRunId: runId,
      candidateId: result.board[0]!.candidateId,
      slot: result.board[0]!.slot,
    });
    assert.equal(selected.identityLockStarted, false);
    assert.equal(selected.referenceAnglesRequested, false);
  });

  it("13. exhausted attempts with 3 faces → ready_partial", async () => {
    const project = await makeObfProject();
    const runId = randomUUID();
    const provider = new FakeBrandFaceDiscoveryProvider();
    const attemptRepo = new MemoryDiscoveryAttemptRepository();
    const blueprints = listMediterraneanSlotBlueprints();
    const result = await runOfficialBrandFaceA1DiscoveryCompletion({
      scope: makeScope(),
      project,
      generationRunId: runId,
      budget: {
        ...buildDiscoveryCompletionBudget({
          providerId: "fake",
          providerModel: "fake",
          maxAttemptsPerSlot: 1,
        }),
        providerId: "fal_flux",
      },
      maxBudgetConfirmed: true,
      provider,
      attemptRepo,
      creationRepoKind: "memory",
      testMode: true,
      planSlotAttempt: async ({ slot, attemptNumber }) => {
        const identity = sampleDiscoveryCast({
          blueprints,
          creationProjectId: project.id,
          generationRunId: `${runId}-attempt-${attemptNumber}`,
          attemptNumber,
        }).find((i) => i.slot === slot)!;
        return {
          slot,
          attemptNumber,
          identity,
          prompt: `p ${slot}`,
        };
      },
      evaluateNovelty: async ({ slot }) =>
        slot === "D"
          ? { decision: "blocked", reason: "face_similarity_duplicate" }
          : { decision: "allowed" },
    });
    assert.equal(result.runState, "ready_partial");
    assert.ok(result.board.length >= 1 && result.board.length < 4);
  });

  it("14. provider error → failed", async () => {
    setFakeDiscoveryErrorForTests(new Error("boom"));
    const project = await makeObfProject();
    const result = await runOfficialBrandFaceA1DiscoveryCompletion({
      scope: makeScope(),
      project,
      generationRunId: randomUUID(),
      budget: {
        ...buildDiscoveryCompletionBudget({
          providerId: "fake",
          providerModel: "fake",
        }),
        providerId: "fal_flux",
      },
      maxBudgetConfirmed: true,
      provider: new FakeBrandFaceDiscoveryProvider(),
      attemptRepo: new MemoryDiscoveryAttemptRepository(),
      creationRepoKind: "memory",
      testMode: true,
      evaluateNovelty: async () => ({ decision: "allowed" }),
      planSlotAttempt: async ({ slot, attemptNumber }) => {
        const identity = sampleDiscoveryCast({
          blueprints: listMediterraneanSlotBlueprints(),
          creationProjectId: project.id,
          generationRunId: `fail-attempt-${attemptNumber}`,
          attemptNumber,
        }).find((i) => i.slot === slot)!;
        return { slot, attemptNumber, identity, prompt: "p" };
      },
    });
    assert.equal(result.runState, "failed");
  });

  it("17–18. refresh does not repeat allowed slots / no duplicate paid call", async () => {
    const project = await makeObfProject();
    const runId = randomUUID();
    const provider = new FakeBrandFaceDiscoveryProvider();
    const attemptRepo = new MemoryDiscoveryAttemptRepository();
    const blueprints = listMediterraneanSlotBlueprints();
    const plan = async ({
      slot,
      attemptNumber,
    }: {
      slot: DiscoverySlot;
      attemptNumber: number;
    }) => {
      const identity = sampleDiscoveryCast({
        blueprints,
        creationProjectId: project.id,
        generationRunId: `${runId}-attempt-${attemptNumber}`,
        attemptNumber,
      }).find((i) => i.slot === slot)!;
      return { slot, attemptNumber, identity, prompt: `p ${slot} ${attemptNumber}` };
    };

    const first = await runOfficialBrandFaceA1DiscoveryCompletion({
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
      attemptRepo,
      creationRepoKind: "memory",
      testMode: true,
      planSlotAttempt: plan,
      evaluateNovelty: async () => ({ decision: "allowed" }),
    });
    assert.equal(first.runState, "ready");
    const callsAfterFirst = getFakeDiscoveryInvocationCount();

    const second = await runOfficialBrandFaceA1DiscoveryCompletion({
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
      resume: true,
      provider,
      attemptRepo,
      creationRepoKind: "memory",
      testMode: true,
      planSlotAttempt: plan,
      evaluateNovelty: async () => ({ decision: "allowed" }),
    });
    assert.equal(second.runState, "ready");
    assert.equal(getFakeDiscoveryInvocationCount(), callsAfterFirst);
    assert.equal(second.board.length, 4);
  });

  it("23. thresholds unchanged", () => {
    assert.equal(FACE_SIMILARITY_THRESHOLD_VERSION, "v1.0.0");
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
  });

  it("24. OpenAI path remains available separately", () => {
    assert.equal(new OpenAiCandidateGenerator().id, "openai");
    assert.equal(
      shouldUseDiscoveryCompletionEngine({
        castingPhase: "a1_discovery",
        officialBrandFace: true,
        providerId: "openai",
      }),
      false,
    );
  });

  it("progress snapshot uses human-facing copy", () => {
    const snap = buildDiscoveryProgressSnapshot({
      attempts: [
        { slot: "A", attemptNumber: 2, status: "generating" },
        { slot: "B", attemptNumber: 1, status: "allowed" },
        { slot: "C", attemptNumber: 1, status: "evaluating" },
        { slot: "D", attemptNumber: 1, status: "allowed" },
      ],
      maxAttemptsPerSlot: 3,
      runState: "resolving_duplicates",
    });
    assert.equal(snap.headline, "Finding 4 distinct Brand Faces");
    assert.equal(snap.readyCount, 2);
    assert.ok(snap.slots.find((s) => s.slot === "B")?.label.includes("accepted"));
    assert.ok(snap.slots.find((s) => s.slot === "A")?.label.includes("attempt"));
  });

  it("25. unique seeds for A1–D1", () => {
    const runId = randomUUID();
    const seeds = (["A", "B", "C", "D"] as const).map((slot) =>
      deriveProviderSeed({
        generationRunId: runId,
        slot,
        attemptNumber: 1,
        provider: "fal_flux",
      }),
    );
    assert.equal(new Set(seeds).size, 4);
  });
});

void plansFromInstances;
