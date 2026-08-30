/**
 * Phase 2.1E.3 — Novelty replacement pipeline execution helpers.
 * Stage timeouts, heartbeats, terminal finalization, in-process locks.
 * No OpenAI / provider calls at import time.
 */

import type { PersonaGenerationJob } from "../domain/creation-types";
import type { WorkspaceScope } from "../domain/types";
import type { PersonaGenerationJobRepository } from "./generation-job-repository";
import {
  type NoveltyReplacementCheckpoint,
  type NoveltyReplacementFailureResponse,
  type NoveltyReplacementSuccessResponse,
  isProviderGenerationOverdue,
  logNoveltyReplacementCheckpoint,
  mapFinalStatusToOutcome,
  outcomeMessage,
  PROVIDER_GENERATION_TIMEOUT_MS,
  stageLabelForCheckpoint,
} from "./novelty-replacement-result";

export { stageLabelForCheckpoint, isProviderGenerationOverdue, PROVIDER_GENERATION_TIMEOUT_MS };

export const ASSET_UPLOAD_TIMEOUT_MS = 30_000;
export const NOVELTY_EVALUATION_TIMEOUT_MS = 60_000;
export const RESULT_PERSISTENCE_TIMEOUT_MS = 15_000;

export const PROVIDER_GENERATION_TIMEOUT_CODE =
  "provider_generation_timeout" as const;
export const ASSET_UPLOAD_TIMEOUT_CODE = "asset_upload_timeout" as const;
export const NOVELTY_EVALUATION_TIMEOUT_CODE =
  "novelty_evaluation_timeout" as const;
export const RESULT_PERSISTENCE_TIMEOUT_CODE =
  "result_persistence_timeout" as const;

export const PROVIDER_GENERATION_TIMEOUT_MESSAGE =
  "Image generation did not finish within the allowed time." as const;
export const ASSET_UPLOAD_TIMEOUT_MESSAGE =
  "Saving the generated image timed out." as const;
export const NOVELTY_EVALUATION_TIMEOUT_MESSAGE =
  "Face novelty evaluation timed out." as const;
export const RESULT_PERSISTENCE_TIMEOUT_MESSAGE =
  "Saving the generation result timed out." as const;

export type NoveltyReplacementStageTimeoutCode =
  | typeof PROVIDER_GENERATION_TIMEOUT_CODE
  | typeof ASSET_UPLOAD_TIMEOUT_CODE
  | typeof NOVELTY_EVALUATION_TIMEOUT_CODE
  | typeof RESULT_PERSISTENCE_TIMEOUT_CODE;

export type NoveltyReplacementStageTimeouts = {
  providerMs: number;
  uploadMs: number;
  noveltyMs: number;
  persistMs: number;
};

export const DEFAULT_NOVELTY_REPLACEMENT_STAGE_TIMEOUTS: NoveltyReplacementStageTimeouts =
  {
    providerMs: PROVIDER_GENERATION_TIMEOUT_MS,
    uploadMs: ASSET_UPLOAD_TIMEOUT_MS,
    noveltyMs: NOVELTY_EVALUATION_TIMEOUT_MS,
    persistMs: RESULT_PERSISTENCE_TIMEOUT_MS,
  };

let stageTimeoutOverridesForTests: Partial<NoveltyReplacementStageTimeouts> | null =
  null;

export function setNoveltyReplacementStageTimeoutsForTests(
  overrides: Partial<NoveltyReplacementStageTimeouts> | null,
): void {
  stageTimeoutOverridesForTests = overrides;
}

export function resolveNoveltyReplacementStageTimeouts(
  overrides?: Partial<NoveltyReplacementStageTimeouts> | null,
): NoveltyReplacementStageTimeouts {
  return {
    ...DEFAULT_NOVELTY_REPLACEMENT_STAGE_TIMEOUTS,
    ...(stageTimeoutOverridesForTests ?? {}),
    ...(overrides ?? {}),
  };
}

export class NoveltyReplacementStageTimeoutError extends Error {
  readonly safeErrorCode: NoveltyReplacementStageTimeoutCode;
  readonly safeErrorMessage: string;
  readonly stage: string;

  constructor(input: {
    safeErrorCode: NoveltyReplacementStageTimeoutCode;
    safeErrorMessage: string;
    stage: string;
  }) {
    super(input.safeErrorMessage);
    this.name = "NoveltyReplacementStageTimeoutError";
    this.safeErrorCode = input.safeErrorCode;
    this.safeErrorMessage = input.safeErrorMessage;
    this.stage = input.stage;
  }
}

export class ProviderGenerationTimeoutError extends NoveltyReplacementStageTimeoutError {
  constructor() {
    super({
      safeErrorCode: PROVIDER_GENERATION_TIMEOUT_CODE,
      safeErrorMessage: PROVIDER_GENERATION_TIMEOUT_MESSAGE,
      stage: "provider_timeout",
    });
    this.name = "ProviderGenerationTimeoutError";
  }
}

export type ProviderDeadlineState = "active" | "timed_out" | "completed";

export type ProviderLateResultInfo = {
  receivedAt: string;
  ok: boolean;
  /** Safe provider request id when available — no image bytes/prompts. */
  providerRequestId?: string | null;
};

/**
 * Real provider deadline: execution starts inside the helper, AbortSignal is
 * created before execute, and only the first terminal transition wins.
 * Late provider settlement never flips job state — callers quarantine via onLateResult.
 */
export async function executeProviderWithDeadline<T>(input: {
  timeoutMs: number;
  abortController?: AbortController;
  execute: (signal: AbortSignal) => Promise<T>;
  onTimeout?: () => void | Promise<void>;
  onLateResult?: (info: ProviderLateResultInfo) => void | Promise<void>;
  extractProviderRequestId?: (value: T) => string | null | undefined;
}): Promise<T> {
  const controller = input.abortController ?? new AbortController();
  let state: ProviderDeadlineState = "active";
  let timer: ReturnType<typeof setTimeout> | undefined;

  type Gate =
    | { kind: "ok"; value: T }
    | { kind: "err"; error: unknown };
  let settledOnce = false;
  let settleGate!: (result: Gate) => void;
  const gate = new Promise<Gate>((resolve) => {
    settleGate = (result) => {
      if (settledOnce) return;
      settledOnce = true;
      resolve(result);
    };
  });

  const clearTimerOnce = () => {
    if (timer != null) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  timer = setTimeout(() => {
    if (state !== "active") return;
    state = "timed_out";
    clearTimerOnce();
    try {
      controller.abort();
    } catch {
      // ignore abort errors
    }
    void Promise.resolve(input.onTimeout?.()).catch(() => {});
    settleGate({
      kind: "err",
      error: new ProviderGenerationTimeoutError(),
    });
  }, input.timeoutMs);

  let providerPromise: Promise<T>;
  try {
    // Start execution INSIDE the helper so the deadline owns the promise.
    providerPromise = Promise.resolve(input.execute(controller.signal));
  } catch (syncErr) {
    clearTimerOnce();
    if (state === "active") state = "completed";
    throw syncErr;
  }

  void providerPromise.then(
    (value) => {
      if (state === "active") {
        state = "completed";
        clearTimerOnce();
        settleGate({ kind: "ok", value });
        return;
      }
      if (state === "timed_out") {
        void Promise.resolve(
          input.onLateResult?.({
            receivedAt: new Date().toISOString(),
            ok: true,
            providerRequestId: input.extractProviderRequestId?.(value) ?? null,
          }),
        ).catch(() => {});
      }
    },
    (error) => {
      if (state === "active") {
        state = "completed";
        clearTimerOnce();
        settleGate({ kind: "err", error });
        return;
      }
      if (state === "timed_out") {
        void Promise.resolve(
          input.onLateResult?.({
            receivedAt: new Date().toISOString(),
            ok: false,
            providerRequestId: null,
          }),
        ).catch(() => {});
      }
    },
  );

  const settled = await gate;
  if (settled.kind === "ok") return settled.value;
  throw settled.error;
}

const activeReplacementLocks = new Set<string>();

export function replacementLockKey(projectId: string, slot: string): string {
  return `${projectId}:${slot}`;
}

export function tryAcquireNoveltyReplacementLock(
  projectId: string,
  slot: string,
): boolean {
  const key = replacementLockKey(projectId, slot);
  if (activeReplacementLocks.has(key)) return false;
  activeReplacementLocks.add(key);
  return true;
}

export function releaseNoveltyReplacementLock(
  projectId: string,
  slot: string,
): void {
  activeReplacementLocks.delete(replacementLockKey(projectId, slot));
}

export function clearNoveltyReplacementLocksForTests(): void {
  activeReplacementLocks.clear();
}

export function isNoveltyReplacementLockHeldForTests(
  projectId: string,
  slot: string,
): boolean {
  return activeReplacementLocks.has(replacementLockKey(projectId, slot));
}

export async function withNoveltyReplacementStageTimeout<T>(input: {
  stage: string;
  timeoutMs: number;
  safeErrorCode: NoveltyReplacementStageTimeoutCode;
  safeErrorMessage: string;
  abortController?: AbortController | null;
  run: (signal: AbortSignal | undefined) => Promise<T>;
}): Promise<T> {
  const controller = input.abortController ?? new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try {
        controller.abort();
      } catch {
        // ignore abort errors
      }
      reject(
        new NoveltyReplacementStageTimeoutError({
          safeErrorCode: input.safeErrorCode,
          safeErrorMessage: input.safeErrorMessage,
          stage: input.stage,
        }),
      );
    }, input.timeoutMs);
  });

  try {
    return await Promise.race([
      input.run(controller.signal),
      timeoutPromise,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type FinalizeNoveltyReplacementJobInput = {
  scope: WorkspaceScope;
  jobRepo: PersonaGenerationJobRepository;
  job: PersonaGenerationJob;
  terminalStatus: "completed" | "failed";
  outcomeStatus:
    | "allowed"
    | "blocked"
    | "exhausted"
    | "failed"
    | "stale_failed";
  attemptNumber: number;
  currentStage: NoveltyReplacementCheckpoint;
  checkpoints: NoveltyReplacementCheckpoint[];
  providerStartedAt: string | null;
  providerCompletedAt: string | null;
  providerRequestId?: string | null;
  providerOutputId?: string | null;
  newCandidateId?: string | null;
  noveltyDecision?: string | null;
  finalCandidateStatus?: string | null;
  slotExhausted?: boolean;
  actualCost?: number;
  safeErrorCode?: string | null;
  safeErrorMessage?: string | null;
  candidateCreatedAt?: string | null;
  assetCreatedAt?: string | null;
  noveltyStartedAt?: string | null;
  noveltyCompletedAt?: string | null;
  recoveredFromStaleState?: boolean;
  recoveredFromExistingAsset?: boolean;
  providerMayHaveCompleted?: boolean;
};

export async function finalizeNoveltyReplacementJob(
  input: FinalizeNoveltyReplacementJobInput,
): Promise<PersonaGenerationJob> {
  const nowIso = new Date().toISOString();
  const existing = input.job.confirmation_payload ?? {};
  const isFailure =
    input.terminalStatus === "failed" ||
    input.outcomeStatus === "failed" ||
    input.outcomeStatus === "stale_failed";

  const confirmation_payload: Record<string, unknown> = {
    ...existing,
    currentStage: input.currentStage,
    lastCheckpoint: input.currentStage,
    checkpoints: input.checkpoints,
    lastHeartbeatAt: nowIso,
    lastStateChangeAt: nowIso,
    attemptNumber: input.attemptNumber,
    nextAttemptNumber: input.attemptNumber,
    providerStartedAt:
      input.providerStartedAt ?? existing.providerStartedAt ?? null,
    providerCompletedAt:
      input.providerCompletedAt ?? existing.providerCompletedAt ?? null,
    providerRequestId:
      input.providerRequestId ?? existing.providerRequestId ?? null,
    providerOutputId:
      input.providerOutputId ?? existing.providerOutputId ?? null,
    newCandidateId: input.newCandidateId ?? existing.newCandidateId ?? null,
    noveltyDecision:
      input.noveltyDecision ?? existing.noveltyDecision ?? null,
    finalCandidateStatus:
      input.finalCandidateStatus ?? existing.finalCandidateStatus ?? null,
    slotExhausted: input.slotExhausted ?? existing.slotExhausted ?? false,
    candidateCreatedAt:
      input.candidateCreatedAt ?? existing.candidateCreatedAt ?? null,
    assetCreatedAt: input.assetCreatedAt ?? existing.assetCreatedAt ?? null,
    noveltyStartedAt:
      input.noveltyStartedAt ?? existing.noveltyStartedAt ?? null,
    noveltyCompletedAt:
      input.noveltyCompletedAt ?? existing.noveltyCompletedAt ?? null,
    providerMayHaveCompleted:
      input.providerMayHaveCompleted ??
      Boolean(
        input.providerCompletedAt ?? existing.providerCompletedAt,
      ),
    recoveredFromExistingAsset:
      input.recoveredFromExistingAsset ??
      existing.recoveredFromExistingAsset === true,
  };

  if (isFailure) {
    confirmation_payload.failedAt = nowIso;
    confirmation_payload.completedAt = null;
    confirmation_payload.safeErrorCode =
      input.safeErrorCode ?? existing.safeErrorCode ?? "replacement_failed";
    confirmation_payload.safeErrorMessage =
      input.safeErrorMessage ??
      existing.safeErrorMessage ??
      "Generate New Face failed.";
    if (
      input.outcomeStatus === "stale_failed" ||
      input.recoveredFromStaleState
    ) {
      confirmation_payload.recoveredFromStaleState = true;
      confirmation_payload.status = "failed";
    }
  } else {
    confirmation_payload.completedAt = nowIso;
    confirmation_payload.failedAt = null;
    confirmation_payload.safeErrorCode = null;
    confirmation_payload.safeErrorMessage = null;
  }

  const updated = await input.jobRepo.updateJob(input.scope, input.job.id, {
    status: input.terminalStatus,
    completed_at: nowIso,
    actual_cost:
      input.actualCost ?? input.job.actual_cost ?? 0,
    error_code: isFailure
      ? (input.safeErrorCode ?? "replacement_failed")
      : null,
    error_message: isFailure
      ? (input.safeErrorMessage ?? "Generate New Face failed.")
      : null,
    confirmation_payload,
    retry_count: input.attemptNumber,
  });

  logNoveltyReplacementCheckpoint("job_terminal_status_persisted", {
    replacementJobId: input.job.id,
    status: input.outcomeStatus,
    finalCandidateStatus: input.finalCandidateStatus ?? null,
    safeErrorCode: input.safeErrorCode ?? null,
  });

  return updated;
}

export async function persistNoveltyReplacementCheckpoint(input: {
  scope: WorkspaceScope;
  jobRepo: PersonaGenerationJobRepository;
  jobId: string;
  existingPayload: Record<string, unknown>;
  checkpoint: NoveltyReplacementCheckpoint;
  checkpoints: NoveltyReplacementCheckpoint[];
  extra?: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const nowIso = new Date().toISOString();
  if (!input.checkpoints.includes(input.checkpoint)) {
    input.checkpoints.push(input.checkpoint);
  }
  const confirmation_payload: Record<string, unknown> = {
    ...input.existingPayload,
    ...(input.extra ?? {}),
    currentStage: input.checkpoint,
    lastCheckpoint: input.checkpoint,
    checkpoints: [...input.checkpoints],
    lastHeartbeatAt: nowIso,
    lastStateChangeAt: nowIso,
  };
  await input.jobRepo.updateJob(input.scope, input.jobId, {
    confirmation_payload,
  });
  logNoveltyReplacementCheckpoint(input.checkpoint, {
    replacementJobId: input.jobId,
    currentStage: input.checkpoint,
  });
  return confirmation_payload;
}

export type NoveltyReplacementJobStatusDto = {
  jobId: string;
  projectId: string;
  slot: string | null;
  attemptNumber: number | null;
  status: string;
  currentStage: string | null;
  lastHeartbeatAt: string | null;
  providerStartedAt: string | null;
  providerCompletedAt: string | null;
  candidateId: string | null;
  noveltyDecision: string | null;
  finalCandidateStatus: string | null;
  safeErrorCode: string | null;
  safeErrorMessage: string | null;
  stageLabel: string;
  providerMayHaveCompleted: boolean;
  recoveredFromStaleState: boolean;
  recoveredFromExistingAsset: boolean;
};

export function toNoveltyReplacementJobStatusDto(
  job: PersonaGenerationJob,
  projectId: string,
): NoveltyReplacementJobStatusDto {
  const payload = job.confirmation_payload ?? {};
  const currentStage =
    typeof payload.currentStage === "string"
      ? payload.currentStage
      : typeof payload.lastCheckpoint === "string"
        ? payload.lastCheckpoint
        : null;
  const providerCompletedAt =
    typeof payload.providerCompletedAt === "string"
      ? payload.providerCompletedAt
      : null;
  return {
    jobId: job.id,
    projectId,
    slot: typeof payload.slot === "string" ? payload.slot : null,
    attemptNumber:
      typeof payload.nextAttemptNumber === "number"
        ? payload.nextAttemptNumber
        : typeof payload.attemptNumber === "number"
          ? payload.attemptNumber
          : job.retry_count || null,
    status: job.status,
    currentStage,
    lastHeartbeatAt:
      typeof payload.lastHeartbeatAt === "string"
        ? payload.lastHeartbeatAt
        : null,
    providerStartedAt:
      typeof payload.providerStartedAt === "string"
        ? payload.providerStartedAt
        : job.started_at,
    providerCompletedAt,
    candidateId:
      typeof payload.newCandidateId === "string"
        ? payload.newCandidateId
        : null,
    noveltyDecision:
      typeof payload.noveltyDecision === "string"
        ? payload.noveltyDecision
        : null,
    finalCandidateStatus:
      typeof payload.finalCandidateStatus === "string"
        ? payload.finalCandidateStatus
        : null,
    safeErrorCode:
      typeof payload.safeErrorCode === "string"
        ? payload.safeErrorCode
        : job.error_code,
    safeErrorMessage:
      typeof payload.safeErrorMessage === "string"
        ? payload.safeErrorMessage
        : job.error_message,
    stageLabel: stageLabelForCheckpoint(currentStage),
    providerMayHaveCompleted:
      payload.providerMayHaveCompleted === true || Boolean(providerCompletedAt),
    recoveredFromStaleState: payload.recoveredFromStaleState === true,
    recoveredFromExistingAsset: payload.recoveredFromExistingAsset === true,
  };
}

export function buildSuccessResponse(input: {
  status: "allowed" | "blocked" | "exhausted";
  projectId: string;
  slot: string;
  previousCandidateId: string;
  newCandidateId: string;
  replacementJobId: string;
  attemptNumber: number;
  maxAttempts: number;
  noveltyDecision: string | null;
  finalCandidateStatus: string;
  providerStarted: boolean;
  providerCompleted: boolean;
  durationMs: number;
  checkpoints: NoveltyReplacementCheckpoint[];
}): NoveltyReplacementSuccessResponse {
  return {
    ok: true,
    status: input.status,
    projectId: input.projectId,
    slot: input.slot,
    previousCandidateId: input.previousCandidateId,
    newCandidateId: input.newCandidateId,
    replacementJobId: input.replacementJobId,
    attemptNumber: input.attemptNumber,
    maxAttempts: input.maxAttempts,
    noveltyDecision: input.noveltyDecision,
    finalCandidateStatus: input.finalCandidateStatus,
    providerStarted: input.providerStarted,
    providerCompleted: input.providerCompleted,
    durationMs: input.durationMs,
    message: outcomeMessage(input.status),
    checkpoints: input.checkpoints,
  };
}

export function buildFailureResponse(input: {
  projectId: string;
  slot?: string;
  previousCandidateId?: string;
  newCandidateId?: string | null;
  replacementJobId?: string | null;
  attemptNumber?: number;
  providerStarted?: boolean;
  providerCompleted?: boolean;
  providerMayHaveCompleted?: boolean;
  safeErrorCode: string;
  safeErrorMessage: string;
  durationMs: number;
  checkpoints: NoveltyReplacementCheckpoint[];
}): NoveltyReplacementFailureResponse & {
  providerMayHaveCompleted?: boolean;
} {
  return {
    ok: false,
    status: "failed",
    projectId: input.projectId,
    slot: input.slot,
    previousCandidateId: input.previousCandidateId,
    newCandidateId: input.newCandidateId ?? null,
    replacementJobId: input.replacementJobId ?? null,
    attemptNumber: input.attemptNumber,
    providerStarted: input.providerStarted,
    providerCompleted: input.providerCompleted,
    providerMayHaveCompleted: input.providerMayHaveCompleted,
    safeErrorCode: input.safeErrorCode,
    safeErrorMessage: input.safeErrorMessage,
    durationMs: input.durationMs,
    checkpoints: input.checkpoints,
  };
}

export function resolveOutcomeFromCandidateStatus(input: {
  finalCandidateStatus: string;
  slotExhausted: boolean;
}): "allowed" | "blocked" | "exhausted" | "failed" {
  return mapFinalStatusToOutcome(input);
}

/**
 * Client-side poll controller — single loop, monotonic deadline, no overlaps.
 */
export function createNoveltyReplacementPollController(input: {
  intervalMs: number;
  timeoutMs: number;
  now?: () => number;
  isPollingAllowed?: () => boolean;
  poll: () => Promise<{ terminal: boolean; serverState?: string | null }>;
  reconcile: () => Promise<{ serverState?: string | null }>;
  onTimeoutMessage: (serverState: string) => void;
}): {
  start: () => Promise<"terminal" | "timeout">;
  stop: () => void;
  isRunning: () => boolean;
} {
  const now = input.now ?? (() => Date.now());
  let stopped = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clear = () => {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    isRunning: () => running,
    stop: () => {
      stopped = true;
      running = false;
      clear();
    },
    start: async () => {
      if (running) {
        return "terminal";
      }
      running = true;
      stopped = false;
      const startedAt = now();
      let deadline = startedAt + input.timeoutMs;

      try {
        while (!stopped && now() < deadline) {
          if (input.isPollingAllowed && !input.isPollingAllowed()) {
            const pausedAt = now();
            await new Promise<void>((resolve) => {
              timer = setTimeout(() => {
                timer = null;
                resolve();
              }, input.intervalMs);
            });
            deadline += Math.max(0, now() - pausedAt);
            continue;
          }
          const result = await input.poll();
          if (stopped) break;
          if (result.terminal) {
            return "terminal";
          }
          const remaining = deadline - now();
          if (remaining <= 0) break;
          await new Promise<void>((resolve) => {
            timer = setTimeout(
              () => {
                timer = null;
                resolve();
              },
              Math.min(input.intervalMs, remaining),
            );
          });
        }

        if (!stopped) {
          const reconciled = await input.reconcile();
          input.onTimeoutMessage(
            reconciled.serverState ?? "generating",
          );
          return "timeout";
        }
        return "terminal";
      } finally {
        running = false;
        clear();
      }
    },
  };
}
