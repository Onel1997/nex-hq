"use client";

import { useLabInspector } from "@/components/facility/hooks/use-lab-inspector";
import type { AgentId } from "@/lib/constants/agents";

/** Live lab context for workspace right panel and timeline. */
export function useWorkspaceContext(agentId: AgentId) {
  return useLabInspector(agentId);
}
