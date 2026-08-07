import { requirePersonaScope, jsonOk, jsonError, dict } from "../../_utils";
import { PersonaDomainError } from "@/lib/persona";
import { assertPaidGenerationHttpRequestAllowed } from "@/lib/persona/creation/paid-generation-guard";
import {
  confirmAndStartCandidateGeneration,
  confirmNoveltyReplacementGeneration,
  ensureManualCandidateSlots,
  estimateCreationCost,
  getCreationProject,
  getCreationProviderSetup,
  getIncidentProjectSummary,
  getNoveltyReplacementJobStatus,
  listCandidateBoardPayload,
  listGenerationJobsForProject,
  prepareNoveltyReplacementConfirmation,
  preparePaidGenerationConfirmation,
  updateCreationProject,
} from "@/lib/persona/creation/creation-service";
import { getQualityModeProfile } from "@/lib/persona/creation/quality-modes";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
/** Allow provider timeout (180s) + terminal persistence before the route is killed. */
export const maxDuration = 210;

const PATCH_ACTIONS = new Set([
  "estimate",
  "prepare_confirmation",
  "prepare_manual",
  "generate",
  "prepare_novelty_replacement",
  "confirm_novelty_replacement",
  "reconcile_novelty_replacement",
]);

export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requirePersonaScope();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  try {
    const url = new URL(_request.url);
    const project = await getCreationProject(gate.scope, id);
    if (url.searchParams.get("estimate") === "1") {
      const estimate = await estimateCreationCost(gate.scope, id);
      return jsonOk({
        project,
        estimate,
        quality: getQualityModeProfile(project.quality_mode),
        costLabel: "estimated",
      });
    }
    if (url.searchParams.get("setup") === "1") {
      return jsonOk({
        project,
        setup: await getCreationProviderSetup(gate.scope, id),
      });
    }
    if (url.searchParams.get("jobs") === "1") {
      const jobs = await listGenerationJobsForProject(gate.scope, id);
      return jsonOk({ project, jobs });
    }
    if (url.searchParams.get("novelty_replacement_status") === "1") {
      const jobId = url.searchParams.get("jobId") ?? undefined;
      const status = await getNoveltyReplacementJobStatus(
        gate.scope,
        id,
        jobId || undefined,
      );
      return jsonOk({
        jobId: status.status?.jobId ?? null,
        projectId: status.projectId,
        slot: status.status?.slot ?? null,
        attemptNumber: status.status?.attemptNumber ?? null,
        status: status.status?.status ?? null,
        currentStage: status.status?.currentStage ?? null,
        lastHeartbeatAt: status.status?.lastHeartbeatAt ?? null,
        providerStartedAt: status.status?.providerStartedAt ?? null,
        providerCompletedAt: status.status?.providerCompletedAt ?? null,
        candidateId: status.status?.candidateId ?? null,
        noveltyDecision: status.status?.noveltyDecision ?? null,
        finalCandidateStatus: status.status?.finalCandidateStatus ?? null,
        safeErrorCode: status.status?.safeErrorCode ?? null,
        safeErrorMessage: status.status?.safeErrorMessage ?? null,
        stageLabel: status.status?.stageLabel ?? null,
        providerMayHaveCompleted:
          status.status?.providerMayHaveCompleted ?? false,
        reconciledJobIds: status.reconciledJobIds,
      });
    }
    if (url.searchParams.get("incident") === "1") {
      const incident = await getIncidentProjectSummary(gate.scope, id);
      return jsonOk({ project, incident });
    }
    const board = await listCandidateBoardPayload(gate.scope, id);
    const jobs = await listGenerationJobsForProject(gate.scope, id);
    const incident = await getIncidentProjectSummary(gate.scope, id);
    return jsonOk({
      project,
      candidates: board.candidates,
      noveltyFailureSlots: board.noveltyFailureSlots,
      activeNoveltyReplacements: board.activeNoveltyReplacements,
      slotReplacementStates: board.slotReplacementStates,
      jobs,
      incident,
      candidatePreviews: board.candidatePreviews,
      generationRunId: board.generationRunId,
      discoveryLifecycle: board.discoveryLifecycle,
      activeConfirmationToken: board.activeConfirmationToken,
      activeConfirmationStatus: board.activeConfirmationStatus,
      freshness: board.freshness,
    });
  } catch (error) {
    return jsonError(error, dict.persona.errors.unexpected);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requirePersonaScope();
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (body.action === "estimate") {
      const castingPhase =
        body.castingPhase === "a2_validation"
          ? "a2_validation"
          : body.castingPhase === "a1_discovery"
            ? "a1_discovery"
            : undefined;
      const candidateIds = Array.isArray(body.candidateIds)
        ? body.candidateIds.filter((id): id is string => typeof id === "string")
        : undefined;
      const estimate = await estimateCreationCost(gate.scope, id, {
        castingPhase,
        candidateIds,
      });
      const project = await getCreationProject(gate.scope, id);
      return jsonOk({
        estimate,
        quality: getQualityModeProfile(project.quality_mode),
        costLabel: estimate.costStatus ?? "estimated",
      });
    }
    if (body.action === "prepare_confirmation") {
      const castingPhase =
        body.castingPhase === "a2_validation" ? "a2_validation" : undefined;
      const candidateIds = Array.isArray(body.candidateIds)
        ? body.candidateIds.filter((id): id is string => typeof id === "string")
        : undefined;
      try {
        const prepared = await preparePaidGenerationConfirmation(gate.scope, id, {
          castingPhase,
          candidateIds,
        });
        return jsonOk({ success: true, ...prepared });
      } catch (error) {
        if (error instanceof PersonaDomainError) {
          return jsonError(
            new PersonaDomainError(error.message, error.code, {
              ...(error.details ?? {}),
              safeErrorCode: "discovery_estimate_failed",
            }),
          );
        }
        throw error;
      }
    }
    if (body.action === "prepare_manual") {
      const candidates = await ensureManualCandidateSlots(gate.scope, id);
      return jsonOk({ success: true, candidates });
    }
    if (body.action === "generate") {
      assertPaidGenerationHttpRequestAllowed(request);
      try {
        const result = await confirmAndStartCandidateGeneration(gate.scope, id, {
          costConfirmed: Boolean(body.costConfirmed),
          retryConfirmed: Boolean(body.retryConfirmed),
          confirmationToken:
            typeof body.confirmationToken === "string"
              ? body.confirmationToken
              : undefined,
          userConfirmedAt:
            typeof body.userConfirmedAt === "string"
              ? body.userConfirmedAt
              : undefined,
          attestation:
            typeof body.attestation === "string" ? body.attestation : undefined,
          httpRequest: request,
        });
        return jsonOk({ success: true, ...result });
      } catch (error) {
        if (error instanceof PersonaDomainError) {
          const details = (error.details ?? {}) as Record<string, unknown>;
          const safeErrorCode =
            details.reusedConfirmation ||
            details.requiresConfirmationToken ||
            details.requiresCostConfirmation ||
            details.requiresUserConfirmation
              ? "discovery_confirmation_failed"
              : details.durableJobId == null && error.code === "WORKFLOW"
                ? "generation_job_creation_failed"
                : "discovery_generation_start_failed";
          const message =
            details.reusedConfirmation
              ? "This confirmation has already been used. Prepare a new confirmation before starting generation."
              : error.message;
          return jsonError(
            new PersonaDomainError(message, error.code, {
              ...details,
              safeErrorCode,
            }),
          );
        }
        throw error;
      }
    }
    if (body.action === "prepare_novelty_replacement") {
      const candidateId =
        typeof body.candidateId === "string" ? body.candidateId : "";
      if (!candidateId) {
        return jsonError(
          new PersonaDomainError("candidateId is required", "VALIDATION"),
        );
      }
      const prepared = await prepareNoveltyReplacementConfirmation(
        gate.scope,
        id,
        { candidateId },
      );
      return jsonOk({ success: true, ...prepared });
    }
    if (body.action === "confirm_novelty_replacement") {
      assertPaidGenerationHttpRequestAllowed(request);
      const candidateId =
        typeof body.candidateId === "string" ? body.candidateId : "";
      if (!candidateId) {
        return jsonError(
          new PersonaDomainError("candidateId is required", "VALIDATION"),
        );
      }
      try {
        const result = await confirmNoveltyReplacementGeneration(gate.scope, id, {
          candidateId,
          costConfirmed: Boolean(body.costConfirmed),
          confirmationToken:
            typeof body.confirmationToken === "string"
              ? body.confirmationToken
              : undefined,
          userConfirmedAt:
            typeof body.userConfirmedAt === "string"
              ? body.userConfirmedAt
              : undefined,
          attestation:
            typeof body.attestation === "string" ? body.attestation : undefined,
          httpRequest: request,
        });
        if (!result.ok) {
          return jsonOk(result, 422);
        }
        return jsonOk(result);
      } catch (error) {
        if (error instanceof PersonaDomainError) {
          const details = (error.details ?? {}) as Record<string, unknown>;
          return jsonOk(
            {
              ok: false,
              status: "failed" as const,
              projectId: id,
              previousCandidateId: candidateId,
              replacementJobId:
                typeof details.replacementJobId === "string"
                  ? details.replacementJobId
                  : null,
              providerStarted: Boolean(details.providerStarted),
              providerCompleted: Boolean(details.providerCompleted),
              safeErrorCode:
                typeof details.safeErrorCode === "string"
                  ? details.safeErrorCode
                  : error.code,
              safeErrorMessage: error.message,
            },
            error.code === "WORKFLOW" ? 409 : 400,
          );
        }
        throw error;
      }
    }
    if (body.action === "reconcile_novelty_replacement") {
      const jobId =
        typeof body.jobId === "string" ? body.jobId : undefined;
      const status = await getNoveltyReplacementJobStatus(
        gate.scope,
        id,
        jobId,
      );
      return jsonOk({ success: true, ...status });
    }
    if (typeof body.action === "string") {
      return jsonError(
        new PersonaDomainError(
          `Unbekannte Workflow-Aktion: ${body.action}`,
          "VALIDATION",
          { allowedActions: [...PATCH_ACTIONS] },
        ),
      );
    }
    const project = await updateCreationProject(gate.scope, id, body as never);
    return jsonOk({ project });
  } catch (error) {
    return jsonError(error, dict.persona.errors.unexpected);
  }
}
