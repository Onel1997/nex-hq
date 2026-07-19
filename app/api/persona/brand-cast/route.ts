import { requirePersonaScope, jsonOk, jsonError, dict } from "../_utils";
import {
  getBrandCastMilestoneProgress,
  getOrCreateBrandCastRequirements,
} from "@/lib/persona/creation/creation-service";
import { getCreationRepository } from "@/lib/persona/creation/creation-factory";

export async function GET() {
  const gate = await requirePersonaScope();
  if (!gate.ok) return gate.response;

  try {
    const progress = await getBrandCastMilestoneProgress(gate.scope);
    return jsonOk({ progress });
  } catch (error) {
    return jsonError(error, dict.persona.errors.unexpected);
  }
}

export async function PATCH(request: Request) {
  const gate = await requirePersonaScope();
  if (!gate.ok) return gate.response;

  try {
    await getOrCreateBrandCastRequirements(gate.scope);
    const body = (await request.json()) as {
      required_male_approved?: number;
      required_female_approved?: number;
      milestone_label?: string;
      active?: boolean;
    };
    const requirements = await getCreationRepository().upsertBrandCastRequirements(
      gate.scope,
      body,
    );
    const progress = await getBrandCastMilestoneProgress(gate.scope);
    return jsonOk({ requirements, progress });
  } catch (error) {
    return jsonError(error, dict.persona.errors.unexpected);
  }
}
