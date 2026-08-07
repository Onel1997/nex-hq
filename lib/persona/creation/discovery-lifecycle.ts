/**
 * Phase 2.1E.5 — Initial A1 discovery project lifecycle.
 *
 * Derives an explicit UX state so empty boards never look like completed casting.
 * Does not change L3, evaluator, novelty thresholds, or replacement execution.
 */

import type {
  PersonaCreationProject,
  PersonaGenerationJob,
} from "../domain/creation-types";

/** Explicit discovery lifecycle — never imply completion from an empty board. */
export type DiscoveryProjectState =
  | "draft"
  | "estimate_ready"
  | "pending_confirmation"
  | "generating"
  | "review"
  | "failed"
  | "cancelled";

export type DiscoveryWorkflowCheckpoint =
  | "new_discovery_clicked"
  | "project_created"
  | "estimate_prepare_started"
  | "estimate_prepare_completed"
  | "confirmation_ui_opened"
  | "confirmation_submitted"
  | "confirmation_validated"
  | "generation_job_created"
  | "generation_started"
  | "project_reloaded"
  | "board_opened";

export const DISCOVERY_SAFE_ERROR_CODES = {
  estimate_failed: "discovery_estimate_failed",
  confirmation_failed: "discovery_confirmation_failed",
  job_creation_failed: "generation_job_creation_failed",
  generation_start_failed: "discovery_generation_start_failed",
} as const;

export type DiscoverySafeErrorCode =
  (typeof DISCOVERY_SAFE_ERROR_CODES)[keyof typeof DISCOVERY_SAFE_ERROR_CODES];

export type DiscoveryLifecycleSnapshot = {
  state: DiscoveryProjectState;
  /** Completed/partially_completed board-scoping run (candidates only). */
  boardGenerationRunId: string | null;
  /** Latest initial-discovery job including pending/generating/failed. */
  activeInitialDiscoveryJobId: string | null;
  /** Latest executed initial-discovery job (queued → terminal), including failed. */
  executedDiscoveryRunId: string | null;
  pendingConfirmationJobId: string | null;
  failedJobId: string | null;
  failedErrorMessage: string | null;
  failedErrorCode: string | null;
  estimatePrepared: boolean;
  confirmationTokenPresent: boolean;
  hasCompletedBoardRun: boolean;
  notStarted: boolean;
  message: string;
  primaryAction:
    | "prepare_estimate"
    | "continue_confirmation"
    | "wait_generation"
    | "open_board"
    | "retry_failed"
    | "none";
};

function isNoveltyReplacementJob(job: {
  confirmation_payload?: Record<string, unknown> | null;
}): boolean {
  const payload = job.confirmation_payload;
  if (!payload || typeof payload !== "object") return false;
  return (
    payload.noveltyReplacement === true ||
    payload.intent === "novelty_replacement"
  );
}

/** Initial A1 discovery jobs only — never replacement / A2-only intents. */
export function isInitialDiscoveryJob(job: {
  status?: string;
  confirmation_payload?: Record<string, unknown> | null;
  stage?: string;
}): boolean {
  if (isNoveltyReplacementJob(job)) return false;
  const payload = job.confirmation_payload;
  if (payload && typeof payload === "object") {
    if (payload.intent === "novelty_replacement") return false;
    if (payload.jobType === "novelty_replacement") return false;
    if (payload.castingPhase === "a2_validation") return false;
    if (
      payload.jobType === "initial_discovery" ||
      payload.castingPhase === "a1_discovery" ||
      payload.intent === "initial" ||
      payload.intent === "retry"
    ) {
      return true;
    }
  }
  // Legacy jobs without payload — treat discovery-stage non-replacement as initial.
  return job.stage === "discovery" || job.stage == null;
}

function sortJobsNewestFirst<T extends { created_at: string }>(jobs: T[]): T[] {
  return jobs.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function listInitialDiscoveryJobs<
  T extends Pick<PersonaGenerationJob, "id" | "status" | "created_at"> & {
    confirmation_payload?: Record<string, unknown> | null;
    stage?: string;
    error_message?: string | null;
    error_code?: string | null;
  },
>(jobs: T[]): T[] {
  return sortJobsNewestFirst(jobs.filter((j) => isInitialDiscoveryJob(j)));
}

const EXECUTED_STATUSES = new Set([
  "queued",
  "generating",
  "partially_completed",
  "completed",
  "failed",
]);

const BOARD_RUN_STATUSES = new Set(["completed", "partially_completed"]);

/**
 * Latest completed/partial discovery run for candidate-board scoping.
 * Unchanged semantics vs resolveCurrentGenerationRunId for non-replacement jobs.
 */
export function resolveBoardGenerationRunId(
  jobs: Array<
    Pick<PersonaGenerationJob, "id" | "status" | "created_at"> & {
      confirmation_payload?: Record<string, unknown> | null;
      stage?: string;
    }
  >,
): string | null {
  const completed = listInitialDiscoveryJobs(jobs).filter((j) =>
    BOARD_RUN_STATUSES.has(j.status),
  );
  return completed[0]?.id ?? null;
}

/** Latest executed initial discovery job id (includes failed). */
export function resolveExecutedDiscoveryRunId(
  jobs: Array<
    Pick<PersonaGenerationJob, "id" | "status" | "created_at"> & {
      confirmation_payload?: Record<string, unknown> | null;
      stage?: string;
    }
  >,
): string | null {
  const executed = listInitialDiscoveryJobs(jobs).filter((j) =>
    EXECUTED_STATUSES.has(j.status),
  );
  return executed[0]?.id ?? null;
}

export function resolveActiveInitialDiscoveryJob<
  T extends Pick<PersonaGenerationJob, "id" | "status" | "created_at"> & {
    confirmation_payload?: Record<string, unknown> | null;
    stage?: string;
    error_message?: string | null;
    error_code?: string | null;
  },
>(jobs: T[]): T | null {
  const initial = listInitialDiscoveryJobs(jobs);
  const active = initial.find(
    (j) =>
      j.status === "pending_confirmation" ||
      j.status === "queued" ||
      j.status === "generating",
  );
  if (active) return active;
  const failed = initial.find((j) => j.status === "failed");
  if (failed) return failed;
  const completed = initial.find((j) => BOARD_RUN_STATUSES.has(j.status));
  return completed ?? null;
}

export function resolveDiscoveryProjectState(
  project: Pick<
    PersonaCreationProject,
    | "status"
    | "last_confirmation_token"
    | "last_estimate_hash"
    | "last_estimate_at"
    | "cost_confirmed_at"
  >,
  jobs: Array<
    Pick<PersonaGenerationJob, "id" | "status" | "created_at"> & {
      confirmation_payload?: Record<string, unknown> | null;
      stage?: string;
      error_message?: string | null;
      error_code?: string | null;
    }
  >,
): DiscoveryLifecycleSnapshot {
  const initial = listInitialDiscoveryJobs(jobs);
  const pending = initial.find((j) => j.status === "pending_confirmation") ?? null;
  const generating =
    initial.find((j) => j.status === "queued" || j.status === "generating") ?? null;
  const failed = initial.find((j) => j.status === "failed") ?? null;
  const boardGenerationRunId = resolveBoardGenerationRunId(jobs);
  const executedDiscoveryRunId = resolveExecutedDiscoveryRunId(jobs);
  const active = resolveActiveInitialDiscoveryJob(jobs);
  const estimatePrepared = Boolean(
    project.last_estimate_hash ||
      project.last_estimate_at ||
      project.last_confirmation_token ||
      pending,
  );
  const confirmationTokenPresent = Boolean(
    project.last_confirmation_token || pending?.id,
  );

  if (project.status === "cancelled" || project.status === "archived") {
    return {
      state: "cancelled",
      boardGenerationRunId,
      activeInitialDiscoveryJobId: active?.id ?? null,
      executedDiscoveryRunId,
      pendingConfirmationJobId: pending?.id ?? null,
      failedJobId: failed?.id ?? null,
      failedErrorMessage: failed?.error_message ?? null,
      failedErrorCode: failed?.error_code ?? null,
      estimatePrepared,
      confirmationTokenPresent,
      hasCompletedBoardRun: Boolean(boardGenerationRunId),
      notStarted: false,
      message: "Discovery was cancelled.",
      primaryAction: "none",
    };
  }

  if (project.status === "generating" || generating) {
    return {
      state: "generating",
      boardGenerationRunId,
      activeInitialDiscoveryJobId: generating?.id ?? active?.id ?? null,
      executedDiscoveryRunId: generating?.id ?? executedDiscoveryRunId,
      pendingConfirmationJobId: pending?.id ?? null,
      failedJobId: failed?.id ?? null,
      failedErrorMessage: failed?.error_message ?? null,
      failedErrorCode: failed?.error_code ?? null,
      estimatePrepared,
      confirmationTokenPresent,
      hasCompletedBoardRun: Boolean(boardGenerationRunId),
      notStarted: false,
      message: "Discovery generation is in progress.",
      primaryAction: "wait_generation",
    };
  }

  if (project.status === "review" || project.status === "selected" || boardGenerationRunId) {
    return {
      state: "review",
      boardGenerationRunId,
      activeInitialDiscoveryJobId: active?.id ?? null,
      executedDiscoveryRunId,
      pendingConfirmationJobId: pending?.id ?? null,
      failedJobId: failed?.id ?? null,
      failedErrorMessage: failed?.error_message ?? null,
      failedErrorCode: failed?.error_code ?? null,
      estimatePrepared,
      confirmationTokenPresent,
      hasCompletedBoardRun: Boolean(boardGenerationRunId),
      notStarted: false,
      message: "Discovery candidates are ready for review.",
      primaryAction: "open_board",
    };
  }

  // Fresh pending confirmation after a failed run = recoverable continue path.
  if (pending) {
    const pendingIsNewer =
      !failed || pending.created_at.localeCompare(failed.created_at) >= 0;
    if (pendingIsNewer || project.status === "draft" || project.status === "ready") {
      return {
        state: "pending_confirmation",
        boardGenerationRunId: null,
        activeInitialDiscoveryJobId: pending.id,
        executedDiscoveryRunId: failed?.id ?? executedDiscoveryRunId,
        pendingConfirmationJobId: pending.id,
        failedJobId: failed?.id ?? null,
        failedErrorMessage: failed?.error_message ?? null,
        failedErrorCode: failed?.error_code ?? null,
        estimatePrepared: true,
        confirmationTokenPresent: true,
        hasCompletedBoardRun: false,
        notStarted: true,
        message:
          "Discovery has not started yet. Confirm the estimate to begin generation.",
        primaryAction: "continue_confirmation",
      };
    }
  }

  if (project.status === "failed" || failed) {
    return {
      state: "failed",
      boardGenerationRunId,
      activeInitialDiscoveryJobId: failed?.id ?? active?.id ?? null,
      executedDiscoveryRunId: failed?.id ?? executedDiscoveryRunId,
      pendingConfirmationJobId: pending?.id ?? null,
      failedJobId: failed?.id ?? null,
      failedErrorMessage: failed?.error_message ?? null,
      failedErrorCode: failed?.error_code ?? null,
      estimatePrepared,
      confirmationTokenPresent,
      hasCompletedBoardRun: false,
      notStarted: false,
      message:
        failed?.error_message?.trim() ||
        "Discovery generation failed. Prepare a new estimate to retry.",
      primaryAction: "retry_failed",
    };
  }

  if (estimatePrepared && project.last_confirmation_token) {
    return {
      state: "estimate_ready",
      boardGenerationRunId: null,
      activeInitialDiscoveryJobId: active?.id ?? null,
      executedDiscoveryRunId: null,
      pendingConfirmationJobId: null,
      failedJobId: null,
      failedErrorMessage: null,
      failedErrorCode: null,
      estimatePrepared: true,
      confirmationTokenPresent,
      hasCompletedBoardRun: false,
      notStarted: true,
      message: "Discovery has not started yet. Confirm the estimate to begin generation.",
      primaryAction: "continue_confirmation",
    };
  }

  return {
    state: "draft",
    boardGenerationRunId: null,
    activeInitialDiscoveryJobId: null,
    executedDiscoveryRunId: null,
    pendingConfirmationJobId: null,
    failedJobId: null,
    failedErrorMessage: null,
    failedErrorCode: null,
    estimatePrepared: false,
    confirmationTokenPresent: false,
    hasCompletedBoardRun: false,
    notStarted: true,
    message: "Discovery has not started yet.",
    primaryAction: "prepare_estimate",
  };
}

export function logDiscoveryCheckpoint(
  checkpoint: DiscoveryWorkflowCheckpoint,
  payload: Record<string, unknown> = {},
): void {
  if (process.env.NODE_ENV === "production" && process.env.PERSONA_DEBUG !== "1") {
    return;
  }
  console.info("[persona-discovery]", checkpoint, payload);
}

export function shouldOpenCandidateBoardForDiscovery(
  snapshot: DiscoveryLifecycleSnapshot,
): boolean {
  return (
    snapshot.state === "review" ||
    snapshot.state === "generating" ||
    Boolean(snapshot.boardGenerationRunId)
  );
}
