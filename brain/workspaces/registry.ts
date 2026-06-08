import { MILAENE_WORKSPACE } from "./milaene";
import { NEXAGENCY_WORKSPACE } from "./nex-agency";
import { NEXTRENDS_WORKSPACE } from "./nex-trends";
import type { WorkspaceDefinition } from "./types";

export const WORKSPACE_REGISTRY: Record<string, WorkspaceDefinition> = {
  [MILAENE_WORKSPACE.slug]: MILAENE_WORKSPACE,
  [NEXTRENDS_WORKSPACE.slug]: NEXTRENDS_WORKSPACE,
  [NEXAGENCY_WORKSPACE.slug]: NEXAGENCY_WORKSPACE,
};

export function getWorkspaceConfig(slug: string): WorkspaceDefinition {
  const config = WORKSPACE_REGISTRY[slug];
  if (!config) {
    throw new Error(`Unknown workspace: ${slug}`);
  }
  return config;
}

export function listWorkspaces(): WorkspaceDefinition[] {
  return Object.values(WORKSPACE_REGISTRY);
}
