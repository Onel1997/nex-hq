import type { AgentId } from "@/lib/constants/agents";

/** Stable studio identity colors shared by navigation and workspace chrome. */
export const AGENT_IDENTITY_COLORS: Record<AgentId, string> = {
  ceo: "#FFD166",
  research: "#A855F7",
  designer: "#22D3EE",
  marketing: "#F59E0B",
  content: "#3B82F6",
  shopify: "#22C55E",
  image: "#EC4899",
};

export function getAgentColor(agentId: AgentId): string {
  return AGENT_IDENTITY_COLORS[agentId];
}
