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
/** Allow OpenAI + novelty evaluation to finish for single-slot replacement. */
export const maxDuration = 180;

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
      const prepared = await preparePaidGenerationConfirmation(gate.scope, id, {
        castingPhase,
        candidateIds,
      });
      return jsonOk({ success: true, ...prepared });
    }
    if (body.action === "prepare_manual") {
      const candidates = await ensureManualCandidateSlots(gate.scope, id);
      return jsonOk({ success: true, candidates });
    }
    if (body.action === "generate") {
      assertPaidGenerationHttpRequestAllowed(request);
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
