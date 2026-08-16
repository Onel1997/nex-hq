/**
 * Phase 2.1E.2 — Novelty replacement job lifecycle, stale recovery, elapsed time.
 * No prompts, tokens, signed URLs, or embeddings. No automatic paid retries.
 */

import type { PersonaGenerationJob } from "../domain/creation-types";

export const NOVELTY_REPLACEMENT_POLL_INTERVAL_MS = 2000;
export const NOVELTY_REPLACEMENT_POLL_TIMEOUT_MS = 120_000;
export const NOVELTY_REPLACEMENT_TIMEOUT_MESSAGE =
  "Generation is taking longer than expected. Server status: generating." as const;

export function formatNoveltyReplacementTimeoutMessage(
  serverState: string,
): string {
  return `Generation is taking longer than expected. Server status: ${serverState}.`;
}

/** Confirmed but provider never started → stale after this window. */
export const STALE_CONFIRMED_WITHOUT_PROVIDER_MS = 2 * 60 * 1000;
/** Generating without heartbeat/state change → stale. */
export const STALE_GENERATING_WITHOUT_HEARTBEAT_MS = 10 * 60 * 1000;
/** Evaluating without state change → stale. */
export const STALE_EVALUATING_WITHOUT_CHANGE_MS = 5 * 60 * 1000;
/** Absolute ceiling for any active-looking replacement job. */
export const STALE_ABSOLUTE_ACTIVE_MS = 30 * 60 * 1000;

export const REPLACEMENT_JOB_STALE_CODE = "replacement_job_stale" as const;
export const REPLACEMENT_JOB_STALE_MESSAGE =
  "The previous face-generation job stopped unexpectedly and is no longer running." as const;

export type NoveltyReplacementOutcomeStatus =
  | "allowed"
  | "blocked"
  | "exhausted"
  | "failed"
  | "generating";

export type NoveltyReplacementSlotState =
  | "idle"
  | "pending_confirmation"
  | "generating"
  | "evaluating"
  | "allowed"
  | "blocked"
  | "exhausted"
  | "failed";

export type NoveltyReplacementCheckpoint =
  | "request_received"
  | "confirmation_validated"
  | "job_marked_generating"
  | "replacement_job_loaded"
  | "provider_request_started"
  | "provider_generation_started"
  | "provider_timeout"
  | "provider_response_received"
  | "provider_generation_completed"
  | "provider_payload_validated"
  | "provider_asset_stashed"
  | "candidate_slot_renumbered"
  | "candidate_row_created"
  | "candidate_created"
  | "asset_upload_started"
  | "asset_upload_completed"
  | "asset_row_created"
  | "asset_created"
  | "novelty_evaluation_started"
  | "face_detection_completed"
  | "embedding_created"
  | "comparisons_completed"
  | "novelty_decision_persisted"
  | "novelty_evaluation_completed"
  | "candidate_status_persisted"
  | "job_terminal_status_persisted"
  | "API_response_returned"
  | "response_returned"
  | "board_payload_observed_terminal_result";

/** Canonical terminal statuses for replacement pollers (job + outcome + persist). */
export const NOVELTY_REPLACEMENT_TERMINAL_STATUSES = [
  "completed",
  "failed",
  "cancelled",
  "partially_completed",
  "novelty_failed",
  "provider_failed",
  "persist_failed",
] as const;

export type NoveltyReplacementTerminalStatus =
  (typeof NOVELTY_REPLACEMENT_TERMINAL_STATUSES)[number];

export function isTerminalNoveltyReplacementStatus(
  status: string | null | undefined,
): boolean {
  if (!status) return false;
  return (NOVELTY_REPLACEMENT_TERMINAL_STATUSES as readonly string[]).includes(
    status,
  );
}

export const REPLACEMENT_PERSIST_FAILED_USER_MESSAGE =
  "Replacement failed after provider generation. The generated result could not be saved. No additional generation will start automatically." as const;

export type NoveltyReplacementSuccessResponse = {
  ok: true;
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
  message?: string;
  checkpoints?: NoveltyReplacementCheckpoint[];
};

export type NoveltyReplacementFailureResponse = {
  ok: false;
  status: "failed";
  projectId?: string;
  slot?: string;
  previousCandidateId?: string;
  newCandidateId?: string | null;
  replacementJobId?: string | null;
  attemptNumber?: number;
  providerStarted?: boolean;
  providerCompleted?: boolean;
  safeErrorCode: string;
  safeErrorMessage: string;
  durationMs?: number;
  checkpoints?: NoveltyReplacementCheckpoint[];
};

export type NoveltyReplacementHttpResponse =
  | NoveltyReplacementSuccessResponse
  | NoveltyReplacementFailureResponse;

/** Safe active/in-flight job DTO for board / client resume. */
export type ActiveNoveltyReplacementDto = {
  jobId: string;
  slot: string;
  candidateId: string;
  attemptNumber: number;
  maxAttempts: number;
  /** Explicit server slot lifecycle state — never inferred as generating from terminal jobs. */
  slotState: NoveltyReplacementSlotState;
  state: NoveltyReplacementSlotState;
  currentStage: string | null;
  stageLabel: string;
  lastHeartbeatAt: string | null;
  providerStartedAt: string | null;
  providerCompletedAt: string | null;
  newCandidateId: string | null;
  noveltyDecision: string | null;
  finalCandidateStatus: string | null;
  safeErrorCode: string | null;
  safeErrorMessage: string | null;
  startedAt: string | null;
  elapsedDisplay: string;
  waitingToStart: boolean;
  recoveredFromStaleState?: boolean;
  providerMayHaveCompleted?: boolean;
};

export function isNoveltyReplacementJob(job: {
  confirmation_payload?: Record<string, unknown> | null;
}): boolean {
  const payload = job.confirmation_payload;
  if (!payload || typeof payload !== "object") return false;
  return (
    payload.noveltyReplacement === true ||
    payload.intent === "novelty_replacement"
  );
}

export function parseIsoMs(value: string | null | undefined): number | null {
  if (!value || typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** Readable elapsed: 42s, 2m 14s. Never returns huge raw seconds for UI. */
export function formatElapsedMs(elapsedMs: number): string {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return "0s";
  const totalSec = Math.floor(elapsedMs / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return `${hours}h ${remMin}m`;
}

/**
 * Elapsed display for a replacement job.
 * Starts from providerStartedAt only. Missing startedAt → waiting state.
 */
export function computeReplacementElapsed(input: {
  providerStartedAt: string | null | undefined;
  nowMs?: number;
  terminal?: boolean;
  frozenElapsedMs?: number | null;
}): { waitingToStart: boolean; elapsedMs: number; display: string } {
  const nowMs = input.nowMs ?? Date.now();
  if (input.terminal && input.frozenElapsedMs != null && input.frozenElapsedMs >= 0) {
    return {
      waitingToStart: false,
      elapsedMs: input.frozenElapsedMs,
      display: formatElapsedMs(input.frozenElapsedMs),
    };
  }
  const startedMs = parseIsoMs(input.providerStartedAt ?? null);
  if (startedMs == null) {
    return { waitingToStart: true, elapsedMs: 0, display: "Waiting to start" };
  }
  const elapsedMs = Math.max(0, nowMs - startedMs);
  // Reject impossible values (> absolute stale ceiling * 2 → treat as corrupt)
  if (elapsedMs > STALE_ABSOLUTE_ACTIVE_MS * 4) {
    return {
      waitingToStart: false,
      elapsedMs: 0,
      display: "Waiting to start",
    };
  }
  return {
    waitingToStart: false,
    elapsedMs,
    display: formatElapsedMs(elapsedMs),
  };
}

function payloadString(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const v = payload[key];
  return typeof v === "string" && v.trim() ? v : null;
}

function payloadBool(payload: Record<string, unknown>, key: string): boolean {
  return payload[key] === true;
}

/**
 * Whether the job payload already has a terminal result — must never resume as generating.
 */
export function hasTerminalReplacementResult(
  job: Pick<PersonaGenerationJob, "status" | "completed_at" | "confirmation_payload">,
): boolean {
  if (
    job.status === "completed" ||
    job.status === "partially_completed" ||
    job.status === "failed" ||
    job.status === "cancelled"
  ) {
    return true;
  }
  if (job.completed_at) return true;
  const payload = job.confirmation_payload ?? {};
  if (payload.failedAt || payload.completedAt) return true;
  if (payload.providerCompletedAt && (payload.noveltyDecision || payload.finalCandidateStatus)) {
    return true;
  }
  if (payload.noveltyDecision || payload.finalCandidateStatus) return true;
  if (payload.recoveredFromStaleState === true) return true;
  if (payload.safeErrorCode === REPLACEMENT_JOB_STALE_CODE) return true;
  return false;
}

/**
 * Strict active phases: confirmed/generating/evaluating only, without terminal markers.
 * pending_confirmation is NOT generating.
 */
export function resolveReplacementLifecyclePhase(
  job: PersonaGenerationJob,
): NoveltyReplacementSlotState | "confirmed" {
  const payload = job.confirmation_payload ?? {};
  if (hasTerminalReplacementResult(job)) {
    const finalStatus = payloadString(payload, "finalCandidateStatus");
    if (finalStatus === "ready") return "allowed";
    if (payload.slotExhausted === true) return "exhausted";
    if (finalStatus === "novelty_blocked") return "blocked";
    if (
      job.status === "failed" ||
      payload.safeErrorCode ||
      payload.failedAt ||
      payload.recoveredFromStaleState === true
    ) {
      return "failed";
    }
    if (job.status === "completed" || job.status === "partially_completed") {
      return finalStatus === "novelty_blocked" ? "blocked" : "allowed";
    }
    return "failed";
  }

  if (job.status === "pending_confirmation") {
    return "pending_confirmation";
  }

  if (payloadBool(payload, "noveltyEvaluationStarted") && !payload.noveltyDecision) {
    return "evaluating";
  }

  if (
    job.status === "generating" ||
    job.status === "queued" ||
    Boolean(payload.providerStartedAt)
  ) {
    return "generating";
  }

  if (job.confirmed_at || payload.confirmedAt) {
    return "confirmed";
  }

  return "idle";
}

export function isGenuinelyActiveReplacementPhase(
  phase: NoveltyReplacementSlotState | "confirmed",
): boolean {
  return (
    phase === "confirmed" ||
    phase === "generating" ||
    phase === "evaluating"
  );
}

/**
 * Determine if an active-looking job is stale based on timestamps.
 * Does not start provider calls.
 */
export const PROVIDER_GENERATION_TIMEOUT_MS = 180_000;

/**
 * Whether a generating replacement has exceeded the provider deadline.
 * Used by status reconciliation and active-job filtering — no provider calls.
 */
export function isProviderGenerationOverdue(
  job: Pick<PersonaGenerationJob, "status" | "completed_at" | "confirmation_payload" | "started_at">,
  nowMs = Date.now(),
  timeoutMs = PROVIDER_GENERATION_TIMEOUT_MS,
): boolean {
  if (hasTerminalReplacementResult(job)) return false;
  const payload = job.confirmation_payload ?? {};
  if (payload.providerCompletedAt) return false;
  const providerStartedAt =
    payloadString(payload as Record<string, unknown>, "providerStartedAt") ??
    job.started_at;
  if (!providerStartedAt) return false;
  const stage = payloadString(payload as Record<string, unknown>, "currentStage");
  const stillRequesting =
    stage == null ||
    stage === "provider_request_started" ||
    stage === "provider_generation_started" ||
    stage === "job_marked_generating" ||
    stage === "replacement_job_loaded" ||
    stage === "confirmation_validated" ||
    stage === "request_received";
  if (!stillRequesting) return false;
  const startedMs = parseIsoMs(providerStartedAt);
  if (startedMs == null) return false;
  return nowMs - startedMs > timeoutMs;
}

export function evaluateReplacementJobStaleness(
  job: PersonaGenerationJob,
  nowMs = Date.now(),
): { stale: boolean; reason: string | null } {
  const phase = resolveReplacementLifecyclePhase(job);
  if (!isGenuinelyActiveReplacementPhase(phase)) {
    return { stale: false, reason: null };
  }

  if (isProviderGenerationOverdue(job, nowMs)) {
    return { stale: true, reason: "provider_generation_timeout" };
  }

  const payload = job.confirmation_payload ?? {};
  const providerStartedAt = payloadString(payload, "providerStartedAt");
  // Prefer explicit heartbeats, then provider start — never treat a fresh updated_at
  // alone as proof the provider is still alive when providerStartedAt is ancient.
  const lastHeartbeatAt =
    payloadString(payload, "lastHeartbeatAt") ??
    payloadString(payload, "lastStateChangeAt") ??
    providerStartedAt ??
    job.started_at ??
    job.confirmed_at ??
    job.created_at ??
    job.updated_at;
  const confirmedAt = job.confirmed_at ?? payloadString(payload, "confirmedAt");
  const anchorMs =
    parseIsoMs(providerStartedAt) ??
    parseIsoMs(confirmedAt) ??
    parseIsoMs(job.started_at) ??
    parseIsoMs(job.created_at) ??
    nowMs;
  const ageMs = Math.max(0, nowMs - anchorMs);
  const sinceHeartbeatMs = Math.max(
    0,
    nowMs - (parseIsoMs(lastHeartbeatAt) ?? anchorMs),
  );

  if (ageMs > STALE_ABSOLUTE_ACTIVE_MS) {
    return {
      stale: true,
      reason: "absolute_active_timeout",
    };
  }

  if (phase === "confirmed" && !providerStartedAt) {
    const confirmedMs = parseIsoMs(confirmedAt) ?? anchorMs;
    if (nowMs - confirmedMs > STALE_CONFIRMED_WITHOUT_PROVIDER_MS) {
      return { stale: true, reason: "confirmed_without_provider" };
    }
  }

  if (phase === "generating" && sinceHeartbeatMs > STALE_GENERATING_WITHOUT_HEARTBEAT_MS) {
    return { stale: true, reason: "generating_without_heartbeat" };
  }

  if (phase === "evaluating" && sinceHeartbeatMs > STALE_EVALUATING_WITHOUT_CHANGE_MS) {
    return { stale: true, reason: "evaluating_without_change" };
  }

  return { stale: false, reason: null };
}

export function buildStaleFailurePayload(
  existing: Record<string, unknown>,
  nowIso: string,
): Record<string, unknown> {
  return {
    ...existing,
    status: "failed",
    safeErrorCode: REPLACEMENT_JOB_STALE_CODE,
    safeErrorMessage: REPLACEMENT_JOB_STALE_MESSAGE,
    failedAt: nowIso,
    recoveredFromStaleState: true,
    noveltyDecision: existing.noveltyDecision ?? null,
    finalCandidateStatus: existing.finalCandidateStatus ?? "novelty_failed",
  };
}

export function toActiveNoveltyReplacementDto(
  job: PersonaGenerationJob,
  nowMs = Date.now(),
): ActiveNoveltyReplacementDto | null {
  if (!isNoveltyReplacementJob(job)) return null;
  const payload = job.confirmation_payload ?? {};
  const phase = resolveReplacementLifecyclePhase(job);
  if (!isGenuinelyActiveReplacementPhase(phase)) return null;

  const slot = payloadString(payload, "slot") ?? "?";
  const candidateId =
    payloadString(payload, "candidateId") ?? job.candidate_id ?? "";
  const attemptNumber =
    typeof payload.nextAttemptNumber === "number"
      ? payload.nextAttemptNumber
      : typeof payload.attemptNumber === "number"
        ? payload.attemptNumber
        : job.retry_count || 1;
  const maxAttempts =
    typeof payload.maxAttempts === "number" ? payload.maxAttempts : 4;
  const providerStartedAt =
    payloadString(payload, "providerStartedAt") ?? job.started_at;
  const elapsed = computeReplacementElapsed({
    providerStartedAt,
    nowMs,
  });
  const slotState: NoveltyReplacementSlotState =
    phase === "confirmed" ? "generating" : phase;
  const currentStage =
    payloadString(payload, "currentStage") ??
    payloadString(payload, "lastCheckpoint");

  return {
    jobId: job.id,
    slot,
    candidateId,
    attemptNumber,
    maxAttempts,
    slotState,
    state: slotState,
    currentStage,
    stageLabel: stageLabelForCheckpoint(currentStage),
    lastHeartbeatAt: payloadString(payload, "lastHeartbeatAt"),
    providerStartedAt,
    providerCompletedAt: payloadString(payload, "providerCompletedAt"),
    newCandidateId: payloadString(payload, "newCandidateId"),
    noveltyDecision: payloadString(payload, "noveltyDecision"),
    finalCandidateStatus: payloadString(payload, "finalCandidateStatus"),
    safeErrorCode: payloadString(payload, "safeErrorCode") ?? job.error_code,
    safeErrorMessage:
      payloadString(payload, "safeErrorMessage") ?? job.error_message,
    startedAt: providerStartedAt ?? job.started_at ?? job.confirmed_at,
    elapsedDisplay: elapsed.display,
    waitingToStart: elapsed.waitingToStart,
    recoveredFromStaleState: payload.recoveredFromStaleState === true,
    providerMayHaveCompleted:
      payload.providerMayHaveCompleted === true ||
      Boolean(payloadString(payload, "providerCompletedAt")),
  };
}

/**
 * Read only genuinely active replacement jobs (after stale filtering by caller).
 * pending_confirmation without provider start is excluded from generating UI.
 */
export function readActiveNoveltyReplacements(
  jobs: PersonaGenerationJob[],
  nowMs = Date.now(),
): ActiveNoveltyReplacementDto[] {
  const active: ActiveNoveltyReplacementDto[] = [];
  for (const job of jobs) {
    if (!isNoveltyReplacementJob(job)) continue;
    if (hasTerminalReplacementResult(job)) continue;
    const stale = evaluateReplacementJobStaleness(job, nowMs);
    if (stale.stale) continue;
    const phase = resolveReplacementLifecyclePhase(job);
    // pending_confirmation must never appear as generating.
    if (phase === "pending_confirmation" || phase === "idle") continue;
    if (!isGenuinelyActiveReplacementPhase(phase)) continue;
    const dto = toActiveNoveltyReplacementDto(job, nowMs);
    if (dto) active.push(dto);
  }
  return active;
}

/**
 * Per-slot explicit state for the board (server source of truth).
 */
export function resolveSlotReplacementStates(
  jobs: PersonaGenerationJob[],
  nowMs = Date.now(),
): Record<string, NoveltyReplacementSlotState> {
  const bySlot: Record<
    string,
    { state: NoveltyReplacementSlotState; createdAt: string }
  > = {};

  for (const job of jobs) {
    if (!isNoveltyReplacementJob(job)) continue;
    const payload = job.confirmation_payload ?? {};
    const slot = payloadString(payload, "slot");
    if (!slot) continue;
    let state = resolveReplacementLifecyclePhase(job);
    if (isGenuinelyActiveReplacementPhase(state)) {
      const stale = evaluateReplacementJobStaleness(job, nowMs);
      if (stale.stale) state = "failed";
    }
    const mapped: NoveltyReplacementSlotState =
      state === "confirmed" ? "generating" : state;
    const prev = bySlot[slot];
    if (!prev || job.created_at >= prev.createdAt) {
      bySlot[slot] = { state: mapped, createdAt: job.created_at };
    }
  }

  const out: Record<string, NoveltyReplacementSlotState> = {};
  for (const [slot, row] of Object.entries(bySlot)) {
    out[slot] = row.state;
  }
  return out;
}

export function mapFinalStatusToOutcome(input: {
  finalCandidateStatus: string;
  slotExhausted: boolean;
}): NoveltyReplacementSuccessResponse["status"] | "failed" {
  if (input.slotExhausted) return "exhausted";
  if (input.finalCandidateStatus === "ready") return "allowed";
  if (input.finalCandidateStatus === "novelty_blocked") return "blocked";
  return "failed";
}

export function outcomeMessage(
  status: NoveltyReplacementOutcomeStatus | NoveltyReplacementSlotState,
): string {
  switch (status) {
    case "allowed":
      return "New face passed novelty protection.";
    case "blocked":
      return "New face was still too similar.";
    case "exhausted":
      return "Slot exhausted after 4 attempts. Start a new discovery.";
    case "generating":
    case "evaluating":
      return "Generating image and checking face novelty...";
    case "failed":
      return "Previous generation stopped unexpectedly.";
    case "pending_confirmation":
    case "idle":
      return "";
    default:
      return "";
  }
}

export function logNoveltyReplacementCheckpoint(
  checkpoint: NoveltyReplacementCheckpoint,
  fields: Record<string, string | number | boolean | null | undefined>,
): void {
  if (process.env.NODE_ENV === "production") return;
  console.info("[novelty-replacement]", checkpoint, fields);
}

/** Human-readable stage labels for the board (safe, no secrets). */
export function stageLabelForCheckpoint(
  checkpoint: NoveltyReplacementCheckpoint | string | null | undefined,
): string {
  switch (checkpoint) {
    case "request_received":
    case "confirmation_validated":
    case "job_marked_generating":
    case "replacement_job_loaded":
    case "provider_request_started":
    case "provider_generation_started":
      return "Requesting image";
    case "provider_timeout":
      return "Image generation timed out";
    case "provider_response_received":
    case "provider_generation_completed":
    case "provider_payload_validated":
    case "candidate_row_created":
    case "candidate_created":
    case "asset_upload_started":
      return "Saving image";
    case "asset_upload_completed":
    case "asset_row_created":
    case "asset_created":
    case "novelty_evaluation_started":
    case "face_detection_completed":
    case "embedding_created":
    case "comparisons_completed":
      return "Checking face novelty";
    case "novelty_decision_persisted":
    case "novelty_evaluation_completed":
    case "candidate_status_persisted":
    case "job_terminal_status_persisted":
    case "API_response_returned":
    case "response_returned":
    case "board_payload_observed_terminal_result":
      return "Finalizing result";
    default:
      return "Generating image and checking face novelty...";
  }
}
