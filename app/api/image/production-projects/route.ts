import { jsonError, jsonOk, requirePersonaScope } from "@/app/api/persona/_utils";
import { listImageProductionProjects } from "@/lib/image/production-project/service";

export async function GET() {
  const gated = await requirePersonaScope();
  if (!gated.ok) return gated.response;
  try {
    return jsonOk({
      success: true,
      projects: await listImageProductionProjects(gated.scope),
    });
  } catch (error) {
    return jsonError(error);
  }
}
