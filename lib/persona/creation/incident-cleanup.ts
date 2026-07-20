/**
 * Incident orphan cleanup — cancel unused pending_confirmation jobs and expire tokens.
 * Never deletes evidence; preserves audit lineage in payload fields.
 */

import type {
  PersonaGenerationConfirmation,
  PersonaGenerationJob,
} from "../domain/creation-types";
import type { WorkspaceScope } from "../domain/types";
import {
  INCIDENT_CLASSIFICATION,
  INCIDENT_ORPHAN_CANCEL_ERROR_CODE,
} from "./incident-constants";
import type { PersonaGenerationJobRepository } from "./generation-job-repository";

export type IncidentCleanupResult = {
  orphanJobsFound: number;
  orphanJobsCancelled: number;
  unusedConfirmationsFound: number;
  unusedConfirmationsExpired: number;
  incidentJobsClassified: number;
  preservedCompletedJobIds: string[];
};

export function isOrphanPendingJob(job: PersonaGenerationJob): boolean {
  return job.status === "pending_confirmation";
}

export function isCompletedIncidentJob(job: PersonaGenerationJob): boolean {
  return (
    job.status === "completed" ||
    job.status === "partially_completed" ||
    job.status === "failed"
  );
}

export function isUnusedConfirmation(
  confirmation: PersonaGenerationConfirmation,
): boolean {
  if (confirmation.consumed_at) return false;
  const payload = confirmation.payload ?? {};
  const cleanup = payload.incident_cleanup as { status?: string } | undefined;
  return cleanup?.status !== "cancelled" && cleanup?.status !== "expired";
}

export function buildOrphanJobCancellationPatch(nowIso: string): Partial<PersonaGenerationJob> {
  return {
    status: "cancelled",
    cancelled_at: nowIso,
    error_code: INCIDENT_ORPHAN_CANCEL_ERROR_CODE,
    error_message: "Unbenutzte Debug-Bestätigung — kein Provider-Aufruf.",
  };
}

export function buildExpiredConfirmationPatch(
  nowIso: string,
  existingPayload: Record<string, unknown>,
): { payload: Record<string, unknown>; consumed_at: string } {
  return {
    payload: {
      ...existingPayload,
      expired: true,
      incident_cleanup: {
        status: "cancelled",
        reason: INCIDENT_ORPHAN_CANCEL_ERROR_CODE,
        cancelled_at: nowIso,
        note: "Unused confirmation invalidated during incident cleanup.",
      },
    },
    consumed_at: nowIso,
  };
}

export function buildIncidentClassificationPatch(
  existingPayload: Record<string, unknown>,
  nowIso: string,
): Record<string, unknown> {
  return {
    ...existingPayload,
    incident_classification: {
      ...INCIDENT_CLASSIFICATION,
      classified_at: nowIso,
    },
  };
}

/** Pure planning step — used by tests and cleanup executor. */
export function planIncidentCleanup(args: {
  jobs: PersonaGenerationJob[];
  confirmations: PersonaGenerationConfirmation[];
}): {
  jobsToCancel: PersonaGenerationJob[];
  confirmationsToExpire: PersonaGenerationConfirmation[];
  jobsToClassify: PersonaGenerationJob[];
} {
  const completedIds = new Set(
    args.jobs.filter(isCompletedIncidentJob).map((j) => j.id),
  );

  const jobsToCancel = args.jobs.filter(isOrphanPendingJob);
  const orphanJobIds = new Set(jobsToCancel.map((j) => j.id));
  const orphanTokens = new Set(
    jobsToCancel
      .map((j) => j.confirmation_token)
      .filter((t): t is string => Boolean(t)),
  );

  const confirmationsToExpire = args.confirmations.filter((c) => {
    if (c.consumed_at) return false;
    if (!isUnusedConfirmation(c)) return false;
    if (c.generation_job_id && completedIds.has(c.generation_job_id)) {
      return false;
    }
    if (c.generation_job_id && orphanJobIds.has(c.generation_job_id)) return true;
    if (orphanTokens.has(c.confirmation_token)) return true;
    return false;
  });

  const jobsToClassify = args.jobs.filter(
    (j) =>
      isCompletedIncidentJob(j) &&
      !(j.confirmation_payload?.incident_classification as { preserved?: boolean } | undefined)
        ?.preserved,
  );

  return { jobsToCancel, confirmationsToExpire, jobsToClassify };
}

export function summarizeCleanupResult(args: {
  jobsToCancel: PersonaGenerationJob[];
  confirmationsToExpire: PersonaGenerationConfirmation[];
  jobsToClassify: PersonaGenerationJob[];
  preservedCompletedJobIds: string[];
}): IncidentCleanupResult {
  return {
    orphanJobsFound: args.jobsToCancel.length,
    orphanJobsCancelled: args.jobsToCancel.length,
    unusedConfirmationsFound: args.confirmationsToExpire.length,
    unusedConfirmationsExpired: args.confirmationsToExpire.length,
    incidentJobsClassified: args.jobsToClassify.length,
    preservedCompletedJobIds: args.preservedCompletedJobIds,
  };
}

export async function executeIncidentCleanup(
  scope: WorkspaceScope,
  projectId: string,
  repo: PersonaGenerationJobRepository,
): Promise<IncidentCleanupResult> {
  const nowIso = new Date().toISOString();
  const jobs = await repo.listJobsForProject(scope, projectId);
  const confirmations = await repo.listConfirmationsForProject(scope, projectId);
  const { jobsToCancel, confirmationsToExpire, jobsToClassify } = planIncidentCleanup({
    jobs,
    confirmations,
  });

  for (const job of jobsToCancel) {
    await repo.updateJob(scope, job.id, buildOrphanJobCancellationPatch(nowIso));
  }

  for (const confirmation of confirmationsToExpire) {
    const patch = buildExpiredConfirmationPatch(nowIso, confirmation.payload ?? {});
    await repo.updateConfirmationByToken(scope, confirmation.confirmation_token, patch);
  }

  for (const job of jobsToClassify) {
    await repo.updateJob(scope, job.id, {
      confirmation_payload: buildIncidentClassificationPatch(
        job.confirmation_payload ?? {},
        nowIso,
      ),
    });
  }

  return summarizeCleanupResult({
    jobsToCancel,
    confirmationsToExpire,
    jobsToClassify,
    preservedCompletedJobIds: jobs
      .filter(isCompletedIncidentJob)
      .map((j) => j.id),
  });
}
