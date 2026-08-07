/**
 * Phase 2.2A — Discovery Completion Engine.
 *
 * After max-budget confirmation:
 * - generate A/B/C/D independently
 * - evaluate novelty (injected)
 * - auto-replace only blocked slots within authorized budget
 * - never regenerate allowed slots
 * - biological rejection ≠ technical failure
 *
 * No paid provider calls in unit tests — inject FakeBrandFaceDiscoveryProvider.
 */

import { randomUUID } from "node:crypto";
import type { DiscoveryIdentityInstance, DiscoverySlot } from "@/lib/persona/identity-blueprints";
import type { BrandFaceDiscoveryProvider } from "../provider/brand-face-discovery-provider";
import { deriveProviderSeed } from "../provider/discovery-provider-seed";
import type { DiscoveryProviderId } from "../provider/discovery-provider-config";
import {
  canSpendAttempt,
  createBudgetLedger,
  recordAttemptSpend,
  type DiscoveryBudgetLedger,
  type DiscoveryCompletionBudget,
} from "./completion-budget";
import { diversityProfileForSlot } from "./diversity-profiles";
import {
  isBiologicalCastingRejection,
  resolveDiscoveryRunState,
  type DiscoveryRunState,
} from "./run-states";
import type {
  DiscoveryAttemptRecord,
  DiscoveryAttemptRepository,
  DiscoveryRunLedger,
} from "./attempt-types";
import { buildFinalDiscoveryBoard, type FinalBoardCard } from "./board-final-slots";

export type NoveltyEvalDecision = {
  decision: "allowed" | "blocked" | "failed";
  reason?: string | null;
  highestSimilarity?: number | null;
  matchedCandidateId?: string | null;
  /** Phase 2.2E — fresh embedding status for this paid attempt. */
  embeddingStatus?: "created" | "reused" | "missing" | null;
  /** Phase 2.2E — closest prior Euclidean distance. */
  euclideanDistance?: number | null;
  matchedProjectId?: string | null;
  matchedSameRun?: boolean | null;
};

export type SlotPlan = {
  slot: DiscoverySlot;
  attemptNumber: number;
  identity: DiscoveryIdentityInstance;
  prompt: string;
  negativePrompt?: string;
};

export type CompletionEngineDeps = {
  provider: BrandFaceDiscoveryProvider;
  attemptRepo: DiscoveryAttemptRepository;
  /** Novelty evaluator — must not weaken thresholds; injected for tests. */
  evaluateNovelty: (input: {
    slot: DiscoverySlot;
    attemptNumber: number;
    candidateId: string;
    assetId: string;
    /** Phase 2.2E — actual sampled L3 identity for this attempt (not static blueprint). */
    identity: DiscoveryIdentityInstance;
    imageBytes: Buffer;
    allowedSameRunCandidateIds: string[];
  }) => Promise<NoveltyEvalDecision>;
  /** Build next L3+prompt plan for a slot attempt (local, €0). */
  planSlotAttempt: (input: {
    slot: DiscoverySlot;
    attemptNumber: number;
    previousIdentity?: DiscoveryIdentityInstance | null;
  }) => Promise<SlotPlan>;
  /** Persist candidate/asset from provider bytes; returns ids. */
  persistCandidate: (input: {
    slot: DiscoverySlot;
    attemptNumber: number;
    identity: DiscoveryIdentityInstance;
    providerResult: Awaited<
      ReturnType<BrandFaceDiscoveryProvider["generateDiscoveryCandidate"]>
    >;
  }) => Promise<{ candidateId: string; assetId: string }>;
  now?: () => string;
};

export type RunDiscoveryCompletionInput = {
  workspaceId: string;
  creationProjectId: string;
  generationRunId: string;
  budget: DiscoveryCompletionBudget;
  /** Must be true — provider begins only after explicit max-budget confirmation. */
  maxBudgetConfirmed: boolean;
  initialPlans: SlotPlan[];
  /**
   * Phase 2.2A.1 — resume from persisted attempts after refresh.
   * Skips allowed slots and does not rebill completed provider requests.
   */
  resume?: boolean;
};

export type RunDiscoveryCompletionResult = {
  runState: DiscoveryRunState;
  ledger: DiscoveryBudgetLedger;
  attempts: DiscoveryAttemptRecord[];
  board: FinalBoardCard[];
  allowedSlots: DiscoverySlot[];
  blockedHistoryCount: number;
};

const SLOTS: DiscoverySlot[] = ["A", "B", "C", "D"];

export async function runDiscoveryCompletion(
  deps: CompletionEngineDeps,
  input: RunDiscoveryCompletionInput,
): Promise<RunDiscoveryCompletionResult> {
  if (!input.maxBudgetConfirmed) {
    throw new Error("discovery_max_budget_not_confirmed");
  }

  const now = deps.now ?? (() => new Date().toISOString());
  let ledger = createBudgetLedger(input.budget);
  const providerId = input.budget.providerId as DiscoveryProviderId;
  // Charge against the confirmed budget band (not a separate provider quote).
  const unitCost =
    (input.budget.estimatedUnitMinEur + input.budget.estimatedUnitMaxEur) / 2 ||
    (deps.provider.estimateUnitCostEur().min +
      deps.provider.estimateUnitCostEur().max) /
      2;

  const allowedBySlot = new Map<
    DiscoverySlot,
    { candidateId: string; assetId: string; attemptNumber: number }
  >();
  const identityBySlot = new Map<DiscoverySlot, DiscoveryIdentityInstance>();
  let technicalFailure = false;

  // Phase 2.2A.1 — refresh recovery: restore allowed slots + spend ledger.
  const priorAttempts = await deps.attemptRepo.listAttemptsForRun(
    input.generationRunId,
    input.workspaceId,
  );
  const priorLedger = await deps.attemptRepo.getRunLedger(
    input.generationRunId,
    input.workspaceId,
  );
  if (
    input.resume &&
    priorLedger &&
    (priorLedger.runState === "ready" ||
      priorLedger.runState === "ready_partial" ||
      priorLedger.runState === "failed")
  ) {
    const board = buildFinalDiscoveryBoard({
      generationRunId: input.generationRunId,
      creationProjectId: input.creationProjectId,
      attempts: priorAttempts,
    });
    return {
      runState: priorLedger.runState,
      ledger: {
        estimatedInitialCostEur: priorLedger.estimatedInitialCostEur,
        authorizedMaxCostEur: priorLedger.authorizedMaxCostEur,
        actualProviderCostEur: priorLedger.actualProviderCostEur,
        attemptsUsed: priorLedger.attemptsUsed,
        remainingAuthorizedAttempts: priorLedger.remainingAuthorizedAttempts,
        maxAttemptsPerSlot: priorLedger.maxAttemptsPerSlot,
        costStatus: priorLedger.costStatus,
      },
      attempts: priorAttempts,
      board: board.cards,
      allowedSlots: board.cards.map((c) => c.slot),
      blockedHistoryCount: board.historyBlocked.length,
    };
  }

  for (const attempt of priorAttempts) {
    if (
      attempt.status === "allowed" &&
      attempt.candidateId &&
      !allowedBySlot.has(attempt.slot)
    ) {
      allowedBySlot.set(attempt.slot, {
        candidateId: attempt.candidateId,
        assetId: attempt.assetId ?? "",
        attemptNumber: attempt.attemptNumber,
      });
    }
  }

  if (priorLedger && priorLedger.attemptsUsed > 0) {
    ledger = {
      estimatedInitialCostEur: priorLedger.estimatedInitialCostEur,
      authorizedMaxCostEur: priorLedger.authorizedMaxCostEur,
      actualProviderCostEur: priorLedger.actualProviderCostEur,
      attemptsUsed: priorLedger.attemptsUsed,
      remainingAuthorizedAttempts: priorLedger.remainingAuthorizedAttempts,
      maxAttemptsPerSlot: priorLedger.maxAttemptsPerSlot,
      costStatus: priorLedger.costStatus,
    };
  } else if (priorAttempts.length > 0) {
    // Reconstruct spend from completed billed attempts (providerRequestId set).
    let used = 0;
    let spent = 0;
    for (const a of priorAttempts) {
      if (a.providerRequestId || a.status === "allowed" || a.status === "blocked" || a.status === "superseded") {
        used += 1;
        spent += a.actualCostEur ?? a.estimatedCostEur ?? unitCost;
      }
    }
    ledger = {
      ...ledger,
      attemptsUsed: used,
      actualProviderCostEur: Number(spent.toFixed(4)),
      remainingAuthorizedAttempts: Math.max(
        0,
        input.budget.slotCount * input.budget.maxAttemptsPerSlot - used,
      ),
    };
  }

  await deps.attemptRepo.upsertRunLedger({
    generationRunId: input.generationRunId,
    creationProjectId: input.creationProjectId,
    workspaceId: input.workspaceId,
    runState: "generating",
    provider: providerId,
    providerModel: input.budget.providerModel,
    estimatedInitialCostEur: ledger.estimatedInitialCostEur,
    authorizedMaxCostEur: ledger.authorizedMaxCostEur,
    actualProviderCostEur: ledger.actualProviderCostEur,
    maxAttemptsPerSlot: ledger.maxAttemptsPerSlot,
    attemptsUsed: ledger.attemptsUsed,
    remainingAuthorizedAttempts: ledger.remainingAuthorizedAttempts,
    costStatus: "estimated",
    updatedAt: now(),
  });

  // Initial plans must be 4 unique slots.
  const planBySlot = new Map<DiscoverySlot, SlotPlan>();
  for (const plan of input.initialPlans) {
    planBySlot.set(plan.slot, plan);
    identityBySlot.set(plan.slot, plan.identity);
  }
  for (const slot of SLOTS) {
    if (!planBySlot.has(slot)) {
      throw new Error(`missing_initial_plan_for_slot_${slot}`);
    }
  }

  async function persistLedger(state: DiscoveryRunState): Promise<DiscoveryRunLedger> {
    return deps.attemptRepo.upsertRunLedger({
      generationRunId: input.generationRunId,
      creationProjectId: input.creationProjectId,
      workspaceId: input.workspaceId,
      runState: state,
      provider: providerId,
      providerModel: input.budget.providerModel,
      estimatedInitialCostEur: ledger.estimatedInitialCostEur,
      authorizedMaxCostEur: ledger.authorizedMaxCostEur,
      actualProviderCostEur: ledger.actualProviderCostEur,
      maxAttemptsPerSlot: ledger.maxAttemptsPerSlot,
      attemptsUsed: ledger.attemptsUsed,
      remainingAuthorizedAttempts: ledger.remainingAuthorizedAttempts,
      costStatus: "estimated",
      updatedAt: now(),
    });
  }

  async function runOneAttempt(plan: SlotPlan, replacedCandidateId: string | null) {
    // Idempotency: never rebill an attempt that already has a provider request id.
    const existingForSlot = await deps.attemptRepo.listAttemptsForSlot({
      generationRunId: input.generationRunId,
      workspaceId: input.workspaceId,
      slot: plan.slot,
    });
    const sameAttempt = existingForSlot.find((a) => a.attemptNumber === plan.attemptNumber);
    if (sameAttempt?.providerRequestId) {
      if (sameAttempt.status === "allowed" && sameAttempt.candidateId) {
        allowedBySlot.set(plan.slot, {
          candidateId: sameAttempt.candidateId,
          assetId: sameAttempt.assetId ?? "",
          attemptNumber: sameAttempt.attemptNumber,
        });
      }
      return { status: sameAttempt.status as "allowed" | "blocked" | "failed", attempt: sameAttempt };
    }

    if (!canSpendAttempt(ledger, unitCost)) {
      return { status: "budget_exhausted" as const };
    }

    const providerSeed = deriveProviderSeed({
      generationRunId: input.generationRunId,
      slot: plan.slot,
      attemptNumber: plan.attemptNumber,
      provider: providerId,
      creationProjectId: input.creationProjectId,
    });

    const attemptId = sameAttempt?.id ?? randomUUID();
    const baseAttempt: DiscoveryAttemptRecord = {
      id: attemptId,
      workspaceId: input.workspaceId,
      creationProjectId: input.creationProjectId,
      generationRunId: input.generationRunId,
      slot: plan.slot,
      attemptNumber: plan.attemptNumber,
      candidateId: null,
      replacedCandidateId,
      provider: providerId,
      providerModel: input.budget.providerModel,
      providerSeed,
      providerRequestId: null,
      providerResultId: null,
      identityFingerprint: plan.identity.identityFingerprint,
      anatomyFingerprint: plan.identity.anatomyFingerprint,
      promptFingerprint: plan.identity.promptFingerprint,
      samplingSeed: plan.identity.samplingSeed,
      diversityRegion: diversityProfileForSlot(plan.slot).regionId,
      assetId: null,
      noveltyDecision: null,
      highestSimilarity: null,
      matchedCandidateId: null,
      embeddingStatus: null,
      euclideanDistance: null,
      matchedProjectId: null,
      matchedSameRun: null,
      status: "generating",
      providerStartedAt: now(),
      providerCompletedAt: null,
      errorCode: null,
      errorMessage: null,
      estimatedCostEur: unitCost,
      actualCostEur: null,
      costStatus: "estimated",
      createdAt: sameAttempt?.createdAt ?? now(),
      updatedAt: now(),
    };
    await deps.attemptRepo.upsertAttempt(baseAttempt);

    try {
      ledger = recordAttemptSpend(ledger, unitCost);
      const providerResult = await deps.provider.generateDiscoveryCandidate({
        creationProjectId: input.creationProjectId,
        generationRunId: input.generationRunId,
        workspaceId: input.workspaceId,
        slot: plan.slot,
        attemptNumber: plan.attemptNumber,
        prompt: plan.prompt,
        negativePrompt: plan.negativePrompt,
        providerSeed,
      });

      // Phase 2.2E.2 — persist paid provider evidence BEFORE candidate/asset
      // writes so a successful FLUX call is never lost if persistence fails.
      const afterProvider: DiscoveryAttemptRecord = {
        ...baseAttempt,
        providerRequestId: providerResult.providerRequestId,
        providerResultId: providerResult.providerResultId,
        providerSeed: providerResult.providerSeed,
        providerStartedAt: providerResult.providerStartedAt,
        providerCompletedAt: providerResult.providerCompletedAt,
        actualCostEur: providerResult.estimatedCostEur,
        costStatus: providerResult.costStatus,
        status: "evaluating",
        updatedAt: now(),
      };
      await deps.attemptRepo.upsertAttempt(afterProvider);

      await deps.attemptRepo.upsertRunLedger({
        ...(await persistLedger("evaluating")),
      });

      const persisted = await deps.persistCandidate({
        slot: plan.slot,
        attemptNumber: plan.attemptNumber,
        identity: plan.identity,
        providerResult,
      });

      const novelty = await deps.evaluateNovelty({
        slot: plan.slot,
        attemptNumber: plan.attemptNumber,
        candidateId: persisted.candidateId,
        assetId: persisted.assetId,
        identity: plan.identity,
        imageBytes: providerResult.imageBytes,
        allowedSameRunCandidateIds: [...allowedBySlot.values()].map((v) => v.candidateId),
      });

      let status: DiscoveryAttemptRecord["status"] = "allowed";
      if (novelty.decision === "blocked") status = "blocked";
      if (novelty.decision === "failed") status = "failed";

      // Biological rejection is normal casting rejection — not technical failure.
      if (
        novelty.decision === "failed" &&
        !isBiologicalCastingRejection(novelty.reason)
      ) {
        technicalFailure = true;
      }

      const updated: DiscoveryAttemptRecord = {
        ...afterProvider,
        candidateId: persisted.candidateId,
        assetId: persisted.assetId,
        noveltyDecision: novelty.reason ?? novelty.decision,
        highestSimilarity: novelty.highestSimilarity ?? null,
        matchedCandidateId: novelty.matchedCandidateId ?? null,
        embeddingStatus: novelty.embeddingStatus ?? null,
        euclideanDistance: novelty.euclideanDistance ?? null,
        matchedProjectId: novelty.matchedProjectId ?? null,
        matchedSameRun: novelty.matchedSameRun ?? null,
        status,
        updatedAt: now(),
      };
      await deps.attemptRepo.upsertAttempt(updated);

      if (status === "allowed") {
        allowedBySlot.set(plan.slot, {
          candidateId: persisted.candidateId,
          assetId: persisted.assetId,
          attemptNumber: plan.attemptNumber,
        });
      }

      return { status, attempt: updated };
    } catch (error) {
      const code =
        error instanceof Error && "code" in error
          ? String((error as { code?: string }).code ?? "provider_failed")
          : "provider_failed";
      const isTimeout = code === "provider_timeout";
      // Preserve any provider request id already written before this failure.
      const latestForSlot = await deps.attemptRepo.listAttemptsForSlot({
        generationRunId: input.generationRunId,
        workspaceId: input.workspaceId,
        slot: plan.slot,
      });
      const current =
        latestForSlot.find((a) => a.attemptNumber === plan.attemptNumber) ??
        baseAttempt;
      const providerAlreadyCompleted = Boolean(current.providerRequestId);

      // Phase 2.2E.2 — post-provider persistence/eval errors fail THIS attempt
      // only. Do not abort the run or erase already-allowed slots (e.g. B).
      if (!providerAlreadyCompleted) {
        technicalFailure = true;
      }

      await deps.attemptRepo.upsertAttempt({
        ...current,
        status: isTimeout ? "timeout" : "failed",
        errorCode: code,
        errorMessage: error instanceof Error ? error.message : "provider failed",
        providerCompletedAt: current.providerCompletedAt ?? now(),
        updatedAt: now(),
      });
      return { status: "failed" as const };
    }
  }

  // Round 1 — generate missing slots only (skip already allowed on resume).
  for (const slot of SLOTS) {
    if (allowedBySlot.has(slot)) continue;
    const slotAttempts = priorAttempts.filter((a) => a.slot === slot);
    if (slotAttempts.some((a) => a.providerRequestId && a.attemptNumber === 1)) {
      // Attempt 1 already billed — do not regenerate; leave for resolve loop.
      continue;
    }
    const plan = planBySlot.get(slot)!;
    await runOneAttempt(plan, null);
    if (technicalFailure) break;
  }

  // Auto-resolve blocked slots within budget — never regenerate allowed slots.
  while (!technicalFailure && allowedBySlot.size < 4) {
    const blockedSlots = SLOTS.filter((s) => !allowedBySlot.has(s));
    if (blockedSlots.length === 0) break;

    let progressed = false;
    await persistLedger("resolving_duplicates");

    for (const slot of blockedSlots) {
      if (allowedBySlot.has(slot)) continue;
      const priorAttempts = await deps.attemptRepo.listAttemptsForSlot({
        generationRunId: input.generationRunId,
        workspaceId: input.workspaceId,
        slot,
      });
      const last = priorAttempts[priorAttempts.length - 1];
      const nextAttempt = (last?.attemptNumber ?? 0) + 1;
      if (nextAttempt > ledger.maxAttemptsPerSlot) continue;
      if (!canSpendAttempt(ledger, unitCost)) continue;

      // Supersede previous blocked attempt in history (retain row).
      if (last && last.status === "blocked") {
        await deps.attemptRepo.upsertAttempt({
          ...last,
          status: "superseded",
          updatedAt: now(),
        });
      }

      const plan = await deps.planSlotAttempt({
        slot,
        attemptNumber: nextAttempt,
        previousIdentity: identityBySlot.get(slot) ?? null,
      });
      identityBySlot.set(slot, plan.identity);
      const result = await runOneAttempt(plan, last?.candidateId ?? null);
      if (result.status !== "budget_exhausted") progressed = true;
      if (technicalFailure) break;
    }

    if (!progressed) break;
  }

  const budgetExhausted =
    ledger.remainingAuthorizedAttempts <= 0 ||
    !canSpendAttempt(ledger, unitCost) ||
    SLOTS.every((slot) => {
      if (allowedBySlot.has(slot)) return true;
      // exhausted attempts for this slot
      return false; // checked below
    });

  // Per-slot attempt exhaustion check for run state.
  let anyUnresolvedWithBudget = false;
  for (const slot of SLOTS) {
    if (allowedBySlot.has(slot)) continue;
    const prior = await deps.attemptRepo.listAttemptsForSlot({
      generationRunId: input.generationRunId,
      workspaceId: input.workspaceId,
      slot,
    });
    const attempts = prior.length;
    if (attempts < ledger.maxAttemptsPerSlot && canSpendAttempt(ledger, unitCost)) {
      anyUnresolvedWithBudget = true;
    }
  }

  const runState = resolveDiscoveryRunState({
    allowedCount: allowedBySlot.size,
    technicalFailure,
    budgetExhausted: budgetExhausted || !anyUnresolvedWithBudget,
  });

  await persistLedger(runState);
  const attempts = await deps.attemptRepo.listAttemptsForRun(
    input.generationRunId,
    input.workspaceId,
  );
  const board = buildFinalDiscoveryBoard({
    generationRunId: input.generationRunId,
    creationProjectId: input.creationProjectId,
    attempts,
  });

  return {
    runState,
    ledger,
    attempts,
    board: board.cards,
    allowedSlots: [...allowedBySlot.keys()],
    blockedHistoryCount: board.historyBlocked.length,
  };
}
