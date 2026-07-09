import type { AgentId } from "@/lib/constants/agents";

/** Read at call time — Next.js must not rely on import-time env snapshots. */
function parseAutoExecutionEnabled(raw: string | undefined): boolean {
  if (raw === undefined || raw === null || raw.trim() === "") return false;
  const lower = raw.trim().toLowerCase();
  return lower === "true" || lower === "1" || lower === "yes";
}

/** Agents that auto-execute when assigned (V1 safety gate). */
export const AUTO_EXECUTABLE_AGENT_IDS = [
  "research",
  "designer",
  "marketing",
] as const;

export type AutoExecutableAgentId = (typeof AUTO_EXECUTABLE_AGENT_IDS)[number];

/** Agents supported by the executor but requiring manual trigger. */
export const MANUAL_EXECUTION_AGENT_IDS = [
  "content",
  "image",
  "shopify",
] as const;

export type ManualExecutionAgentId = (typeof MANUAL_EXECUTION_AGENT_IDS)[number];

export function isAutoExecutionEnabled(): boolean {
  return parseAutoExecutionEnabled(process.env.AUTO_EXECUTION_ENABLED);
}

/** Diagnostic helper — surfaces raw env value during delegation audits. */
export function getAutoExecutionConfig(): {
  enabled: boolean;
  raw: string | undefined;
} {
  const raw = process.env.AUTO_EXECUTION_ENABLED;
  return { enabled: parseAutoExecutionEnabled(raw), raw };
}

export function isAutoExecutableAgent(
  agentId: AgentId | null | undefined,
): agentId is AutoExecutableAgentId {
  return (
    agentId !== null &&
    agentId !== undefined &&
    (AUTO_EXECUTABLE_AGENT_IDS as readonly string[]).includes(agentId)
  );
}

export function isManualExecutionAgent(
  agentId: AgentId | null | undefined,
): agentId is ManualExecutionAgentId {
  return (
    agentId !== null &&
    agentId !== undefined &&
    (MANUAL_EXECUTION_AGENT_IDS as readonly string[]).includes(agentId)
  );
}
