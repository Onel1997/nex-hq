import type { AgentId } from "@/lib/constants/agents";
import type { TransmissionEvent } from "@/lib/facility/types";

interface TransmissionDef {
  from: AgentId;
  to: AgentId;
  edgeId: string;
  label: string;
  eventTypes: string[];
}

const TRANSMISSION_DEFS: TransmissionDef[] = [
  {
    from: "research",
    to: "designer",
    edgeId: "research-designer",
    label: "Trend Report Delivered",
    eventTypes: ["task.completed", "report.approved", "task.execution.completed"],
  },
  {
    from: "designer",
    to: "marketing",
    edgeId: "designer-marketing",
    label: "Collection Approved",
    eventTypes: ["report.approved", "task.completed"],
  },
  {
    from: "marketing",
    to: "ceo",
    edgeId: "ceo-marketing",
    label: "Campaign Ready",
    eventTypes: ["task.completed", "report.approved", "task.execution.completed"],
  },
  {
    from: "content",
    to: "marketing",
    edgeId: "marketing-content",
    label: "Content Package Complete",
    eventTypes: ["task.completed", "report.approved"],
  },
  {
    from: "image",
    to: "marketing",
    edgeId: "marketing-content",
    label: "Visual Assets Delivered",
    eventTypes: ["task.completed", "report.approved"],
  },
  {
    from: "ceo",
    to: "research",
    edgeId: "ceo-research",
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
      if (actorId === def.to || actorId === def.from) {
        return {
          from: def.from,
          to: def.to,
          edgeId: def.edgeId,
          label: def.label,
        };
      }
      continue;
    }

    if (actorId === def.from || actorId === def.to || actorId === "ceo") {
      return {
        from: def.from,
        to: def.to,
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
