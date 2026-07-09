"use client";

/**
 * @deprecated Level-2 navigation lives in ContextSidebar (dashboard shell).
 * Kept for type exports and backward-compatible imports.
 */
import type { AgentId } from "@/lib/constants/agents";

export type WorkspaceNavActiveId = AgentId | "commerce";

interface WorkspaceNavProps {
  activeId: WorkspaceNavActiveId;
}

export function WorkspaceNav(_props: WorkspaceNavProps) {
  return null;
}
