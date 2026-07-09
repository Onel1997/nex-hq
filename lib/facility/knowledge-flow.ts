import type { AgentId } from "@/lib/constants/agents";
import { AGENT_IDS } from "@/lib/constants/agents";
import type {
  FacilityEvent,
  KnowledgeFlowPhase,
  KnowledgeFlowSequence,
} from "@/lib/facility/types";

const FLOW_EVENT_TYPES = new Set([
  "report.approved",
  "task.execution.completed",
  "task.completed",
  "ceo.final_report.generated",
  "ceo.final_report.completed",
]);

const SCENE_FLOW_AGENT_IDS = new Set(
  AGENT_IDS.filter((id): id is Exclude<AgentId, "ceo"> => id !== "ceo"),
);

function resolveFlowAgent(event: FacilityEvent): Exclude<AgentId, "ceo"> | null {
  if (SCENE_FLOW_AGENT_IDS.has(event.actorId as Exclude<AgentId, "ceo">)) {
    return event.actorId as Exclude<AgentId, "ceo">;
  }

  // Human actors (e.g. workspace-user on report.approved) are not scene nodes.
  if (event.actorType === "human" || event.actorId === "workspace-user") {
    return null;
  }

  return null;
}

const PHASE_MS: Record<Exclude<KnowledgeFlowPhase, "complete">, number> = {
  "lab-to-nexus": 2200,
  "nexus-absorb": 1400,
  "nexus-to-ceo": 1800,
};

export function matchKnowledgeFlow(
  event: FacilityEvent,
): Omit<KnowledgeFlowSequence, "phase" | "startedAt"> | null {
  if (!FLOW_EVENT_TYPES.has(event.type)) return null;

  if (
    event.type === "ceo.final_report.generated" ||
    event.type === "ceo.final_report.completed"
  ) {
    return {
      id: `flow-ceo-${event.id}`,
      agentId: "ceo",
      label: "Executive Decision Package",
    };
  }

  const agentId = resolveFlowAgent(event);
  if (!agentId) return null;

  const label =
    event.type === "report.approved"
      ? `${capitalize(agentId)} Report Integrated`
      : `${capitalize(agentId)} Output Received`;

  return {
    id: `flow-${agentId}-${event.id}`,
    agentId,
    label,
  };
}

export function createKnowledgeFlow(
  partial: Omit<KnowledgeFlowSequence, "phase" | "startedAt">,
): KnowledgeFlowSequence {
  return {
    ...partial,
    phase: "lab-to-nexus",
    startedAt: Date.now(),
  };
}

export function advanceKnowledgeFlowPhase(
  flow: KnowledgeFlowSequence,
): KnowledgeFlowPhase {
  switch (flow.phase) {
    case "lab-to-nexus":
      return "nexus-absorb";
    case "nexus-absorb":
      return "nexus-to-ceo";
    case "nexus-to-ceo":
      return "complete";
    default:
      return "complete";
  }
}

export function phaseDuration(phase: KnowledgeFlowPhase): number {
  if (phase === "complete") return 0;
  return PHASE_MS[phase];
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
