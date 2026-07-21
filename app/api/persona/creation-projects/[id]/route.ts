import { requirePersonaScope, jsonOk, jsonError, dict } from "../../_utils";
import { PersonaDomainError } from "@/lib/persona";
import { assertPaidGenerationHttpRequestAllowed } from "@/lib/persona/creation/paid-generation-guard";
import {
  confirmAndStartCandidateGeneration,
  ensureManualCandidateSlots,
  estimateCreationCost,
  getCreationProject,
  getCreationProviderSetup,
  getIncidentProjectSummary,
  listCandidateBoardPreviews,
  listCandidates,
  listGenerationJobsForProject,
  preparePaidGenerationConfirmation,
  updateCreationProject,
} from "@/lib/persona/creation/creation-service";
import { getQualityModeProfile } from "@/lib/persona/creation/quality-modes";

type Ctx = { params: Promise<{ id: string }> };

const PATCH_ACTIONS = new Set([
  "estimate",
  "prepare_confirmation",
  "prepare_manual",
  "generate",
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
    const candidates = await listCandidates(gate.scope, id);
    const jobs = await listGenerationJobsForProject(gate.scope, id);
    const incident = await getIncidentProjectSummary(gate.scope, id);
    const candidatePreviews = await listCandidateBoardPreviews(gate.scope, id);
    return jsonOk({ project, candidates, jobs, incident, candidatePreviews });
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
