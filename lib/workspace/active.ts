import {
  getWorkspaceConfig,
  listWorkspaces,
} from "@/brain/workspaces/registry";
import type { WorkspaceDefinition } from "@/brain/workspaces/types";

function readWorkspaceSlugFromEnv(): string | undefined {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_NEXHQ_WORKSPACE_SLUG;
  }
  return (
    process.env.NEXHQ_WORKSPACE_SLUG ??
    process.env.NEXT_PUBLIC_NEXHQ_WORKSPACE_SLUG
  );
}

/**
 * Resolve the active workspace slug from environment configuration.
 * Server: NEXHQ_WORKSPACE_SLUG. Client: NEXT_PUBLIC_NEXHQ_WORKSPACE_SLUG.
 */
export function getActiveWorkspaceSlug(): string {
  const slug = readWorkspaceSlugFromEnv()?.trim();
  if (!slug) {
    const available = listWorkspaces()
      .map((w) => w.slug)
      .join(", ");
    throw new Error(
      `Active workspace not configured. Set NEXHQ_WORKSPACE_SLUG (server) and NEXT_PUBLIC_NEXHQ_WORKSPACE_SLUG (client). Available workspaces: ${available}`,
    );
  }
  return slug;
}

/** Active workspace definition resolved from the workspace registry. */
export function getActiveWorkspace(): WorkspaceDefinition {
  return getWorkspaceConfig(getActiveWorkspaceSlug());
}
