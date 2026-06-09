import type { AgentId } from "@/lib/constants/agents";
import type { TransmissionEvent } from "@/lib/facility/types";

interface TransmissionDef {
  from: AgentId;
  to: AgentId | "brain";
  edgeId: string;
  label: string;
  eventTypes: string[];
}

/** Knowledge stream transmissions — always route through Nexus edges. */
const TRANSMISSION_DEFS: TransmissionDef[] = [
  {
    from: "research",
    to: "brain",
    edgeId: "research-brain",
    label: "Trend Report Delivered",
    eventTypes: ["task.completed", "report.approved", "task.execution.completed"],
  },
  {
    from: "designer",
    to: "brain",
    edgeId: "designer-brain",
    label: "Collection Approved",
    eventTypes: ["report.approved", "task.completed"],
  },
  {
    from: "marketing",
    to: "brain",
    edgeId: "marketing-brain",
    label: "Campaign Ready",
    eventTypes: ["task.completed", "report.approved", "task.execution.completed"],
  },
  {
    from: "content",
    to: "brain",
    edgeId: "content-brain",
    label: "Content Package Complete",
    eventTypes: ["task.completed", "report.approved"],
  },
  {
    from: "image",
    to: "brain",
    edgeId: "image-brain",
    label: "Visual Assets Delivered",
    eventTypes: ["task.completed", "report.approved"],
  },
  {
    from: "shopify",
    to: "brain",
    edgeId: "shopify-brain",
    label: "Commerce Sync Complete",
    eventTypes: ["task.completed", "report.approved"],
  },
  {
    from: "ceo",
    to: "brain",
    edgeId: "ceo-brain",
    label: "Goal Delegated",
    eventTypes: ["task.created", "task.assigned", "task.execution.started"],
  },
];

export function matchTransmission(
  eventType: string,
  actorId: string,
): Omit<TransmissionEvent, "id" | "timestamp"> | null {
  for (const def of TRANSMISSION_DEFS) {
    if (!def.eventTypes.includes(eventType)) continue;

    if (eventType === "task.assigned" || eventType === "task.execution.started") {
      if (actorId === def.from || actorId === "ceo") {
        return {
          from: def.from,
          to: def.to as AgentId,
          edgeId: def.edgeId,
          label: def.label,
        };
      }
      continue;
    }

    if (actorId === def.from || actorId === "ceo") {
      return {
        from: def.from,
        to: def.to as AgentId,
        edgeId: def.edgeId,
        label: def.label,
      };
    }
  }
  return null;
}

export function createTransmission(
  partial: Omit<TransmissionEvent, "id" | "timestamp">,
): TransmissionEvent {
  return {
    ...partial,
    id: `${partial.edgeId}-${Date.now()}`,
    timestamp: Date.now(),
  };
}
