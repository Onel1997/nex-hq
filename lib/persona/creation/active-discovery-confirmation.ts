/**
 * Phase 2.1E.6 — Active discovery confirmation resolution.
 *
 * A consumed / cancelled / expired / superseded token must never be exposed
 * to the client as usable. project.last_confirmation_token alone is not proof.
 */

import type {
  PersonaGenerationConfirmation,
  PersonaGenerationJob,
} from "../domain/creation-types";
import { isConfirmationCancelledOrExpired } from "./paid-generation-guard";
import { isInitialDiscoveryJob } from "./discovery-lifecycle";

export type ActiveConfirmationStatus =
  | "ready"
  | "consumed"
  | "expired"
  | "cancelled"
  | "missing";

export type ActiveDiscoveryConfirmation = {
  activeConfirmationToken: string | null;
  activeConfirmationStatus: ActiveConfirmationStatus;
  confirmationId: string | null;
  generationJobId: string | null;
};

function isInitialDiscoveryConfirmation(
  confirmation: Pick<PersonaGenerationConfirmation, "payload">,
): boolean {
  const payload = confirmation.payload ?? {};
  if (payload.noveltyReplacement === true) return false;
  if (payload.intent === "novelty_replacement") return false;
  if (payload.castingPhase === "a2_validation") return false;
  if (payload.jobType === "novelty_replacement") return false;
  // initial / retry / a1_discovery / missing castingPhase on legacy discovery
  return (
    payload.jobType === "initial_discovery" ||
    payload.castingPhase === "a1_discovery" ||
    payload.intent === "initial" ||
    payload.intent === "retry" ||
    payload.intent == null
  );
}

function confirmationExpired(confirmation: PersonaGenerationConfirmation): boolean {
  const payload = confirmation.payload ?? {};
  if (payload.expired === true) return true;
  const expiredAt = payload.expired_at ?? payload.expiredAt;
  if (typeof expiredAt === "string" && expiredAt.trim()) {
    const ts = Date.parse(expiredAt);
    if (Number.isFinite(ts) && ts <= Date.now()) return true;
  }
  return false;
}

function confirmationCancelled(confirmation: PersonaGenerationConfirmation): boolean {
  const payload = confirmation.payload ?? {};
  if (payload.cancelled === true) return true;
  const cleanup = payload.incident_cleanup as { status?: string } | undefined;
  return cleanup?.status === "cancelled" || cleanup?.status === "expired";
}

/**
 * Resolve the single usable initial-discovery confirmation for a project.
 * Never returns a consumed/cancelled/expired token as activeConfirmationToken.
 */
export function resolveActiveDiscoveryConfirmation(args: {
  projectId: string;
  confirmations: PersonaGenerationConfirmation[];
  jobs: PersonaGenerationJob[];
  /** Optional stale pointer — never treated as proof of usability. */
  lastConfirmationToken?: string | null;
}): ActiveDiscoveryConfirmation {
  const { projectId, confirmations, jobs } = args;
  const jobById = new Map(jobs.map((j) => [j.id, j]));

  const discoveryConfirmations = confirmations
    .filter(
      (c) =>
        c.creation_project_id === projectId && isInitialDiscoveryConfirmation(c),
    )
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  let sawConsumed = false;
  let sawExpired = false;
  let sawCancelled = false;

  for (const confirmation of discoveryConfirmations) {
    if (confirmation.consumed_at) {
      sawConsumed = true;
      continue;
    }
    if (confirmationExpired(confirmation) || isConfirmationCancelledOrExpired(confirmation)) {
      if (confirmationCancelled(confirmation)) sawCancelled = true;
      else sawExpired = true;
      continue;
    }
    if (confirmationCancelled(confirmation)) {
      sawCancelled = true;
      continue;
    }

    const jobId = confirmation.generation_job_id;
    const job = jobId ? jobById.get(jobId) : undefined;
    if (!job || !isInitialDiscoveryJob(job)) {
      continue;
    }
    if (job.status === "cancelled") {
      sawCancelled = true;
      continue;
    }
    if (job.status !== "pending_confirmation") {
      // Linked job already left pending — token is not usable for a new start.
      if (job.status === "failed" || job.status === "completed") {
        // Typically consumed already; treat as non-active.
        continue;
      }
      continue;
    }

    return {
      activeConfirmationToken: confirmation.confirmation_token,
      activeConfirmationStatus: "ready",
      confirmationId: confirmation.id,
      generationJobId: job.id,
    };
  }

  // Stale project pointer must never become the returned token.
  void args.lastConfirmationToken;

  if (sawConsumed) {
    return {
      activeConfirmationToken: null,
      activeConfirmationStatus: "consumed",
      confirmationId: null,
      generationJobId: null,
    };
  }
  if (sawCancelled) {
    return {
      activeConfirmationToken: null,
      activeConfirmationStatus: "cancelled",
      confirmationId: null,
      generationJobId: null,
    };
  }
  if (sawExpired) {
    return {
      activeConfirmationToken: null,
      activeConfirmationStatus: "expired",
      confirmationId: null,
      generationJobId: null,
    };
  }
  return {
    activeConfirmationToken: null,
    activeConfirmationStatus: "missing",
    confirmationId: null,
    generationJobId: null,
  };
}

/** Pure UI gate: generation confirm requires an active (unconsumed) token. */
export function canSubmitDiscoveryConfirmation(args: {
  activeConfirmationToken: string | null;
  activeConfirmationStatus: ActiveConfirmationStatus | null | undefined;
  costConfirmed: boolean;
  busy?: boolean;
}): boolean {
  if (args.busy) return false;
  if (!args.costConfirmed) return false;
  if (args.activeConfirmationStatus !== "ready") return false;
  return Boolean(args.activeConfirmationToken?.trim());
}
