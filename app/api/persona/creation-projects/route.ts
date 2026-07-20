import { requirePersonaScope, jsonOk, jsonError, dict } from "../_utils";
import {
  createCreationProject,
  createSafeTestRunProject,
  getCreationProviderSetup,
  listCreationPresets,
  listCreationProjects,
} from "@/lib/persona/creation/creation-service";

export async function GET(request: Request) {
  const gate = await requirePersonaScope();
  if (!gate.ok) return gate.response;

  try {
    const url = new URL(request.url);
    if (url.searchParams.get("presets") === "1") {
      return jsonOk({ presets: listCreationPresets() });
    }
    if (url.searchParams.get("setup") === "1") {
      return jsonOk({ setup: await getCreationProviderSetup(gate.scope) });
    }
    const projects = await listCreationProjects(gate.scope);
    return jsonOk({ projects });
  } catch (error) {
    return jsonError(error, dict.persona.errors.unexpected);
  }
}

export async function POST(request: Request) {
  const gate = await requirePersonaScope();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (body.action === "create_safe_test_run") {
      const project = await createSafeTestRunProject(gate.scope);
      return jsonOk({ success: true, project }, 201);
    }
    const project = await createCreationProject(gate.scope, body as never);
    return jsonOk({ project }, 201);
  } catch (error) {
    return jsonError(error, dict.persona.errors.unexpected);
  }
}
