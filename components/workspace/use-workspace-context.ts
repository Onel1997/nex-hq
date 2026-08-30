"use client";

import { useWorkspaceInspector } from "@/components/workspace/use-workspace-inspector";
import type { AgentId } from "@/lib/constants/agents";

/** Live lab context for workspace right panel and timeline. */
export function useWorkspaceContext(agentId: AgentId) {
  return useWorkspaceInspector(agentId);
}
