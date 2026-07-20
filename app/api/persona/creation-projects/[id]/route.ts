import { requirePersonaScope, jsonOk, jsonError, dict } from "../../_utils";
import {
  confirmAndStartCandidateGeneration,
  ensureManualCandidateSlots,
  estimateCreationCost,
  getCreationProject,
  getCreationProviderSetup,
  listCandidates,
  listGenerationJobsForProject,
  preparePaidGenerationConfirmation,
  updateCreationProject,
} from "@/lib/persona/creation/creation-service";
import { getQualityModeProfile } from "@/lib/persona/creation/quality-modes";

type Ctx = { params: Promise<{ id: string }> };

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
    const candidates = await listCandidates(gate.scope, id);
    return jsonOk({ project, candidates });
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
      const estimate = await estimateCreationCost(gate.scope, id);
      const project = await getCreationProject(gate.scope, id);
      return jsonOk({
        estimate,
        quality: getQualityModeProfile(project.quality_mode),
        costLabel: "estimated",
      });
    }
    if (body.action === "prepare_confirmation") {
      const prepared = await preparePaidGenerationConfirmation(gate.scope, id);
      return jsonOk(prepared);
    }
    if (body.action === "prepare_manual") {
      const candidates = await ensureManualCandidateSlots(gate.scope, id);
      return jsonOk({ candidates });
    }
    if (body.action === "generate") {
      const result = await confirmAndStartCandidateGeneration(gate.scope, id, {
        costConfirmed: Boolean(body.costConfirmed),
        retryConfirmed: Boolean(body.retryConfirmed),
        confirmationToken:
          typeof body.confirmationToken === "string"
            ? body.confirmationToken
            : undefined,
      });
      return jsonOk(result);
    }
    const project = await updateCreationProject(gate.scope, id, body as never);
    return jsonOk({ project });
  } catch (error) {
    return jsonError(error, dict.persona.errors.unexpected);
  }
}
