import { requirePersonaScope, jsonOk, jsonError, dict } from "../../../_utils";
import {
  listCandidatesForProject,
  listGenerationJobsForProject,
} from "@/lib/persona/creation/creation-service";

type Ctx = { params: Promise<{ id: string }> };

/** Project-scoped candidate retrieval — never returns cross-project rows. */
export async function GET(_request: Request, ctx: Ctx) {
  const gate = await requirePersonaScope();
  if (!gate.ok) return gate.response;
  const { id: projectId } = await ctx.params;

  if (!projectId?.trim()) {
    return jsonError(new Error("creationProjectId is required"), dict.persona.errors.unexpected);
  }

  try {
    const candidates = await listCandidatesForProject(gate.scope, projectId);
    const jobs = await listGenerationJobsForProject(gate.scope, projectId);
    return jsonOk({
      projectId,
      candidates,
      jobs,
      cache: "no-store",
    });
  } catch (error) {
    return jsonError(error, dict.persona.errors.unexpected);
  }
}
