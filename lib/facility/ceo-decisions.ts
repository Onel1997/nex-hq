import type { AgentId } from "@/lib/constants/agents";
import { AGENT_CATALOG } from "@/lib/constants/agents";
import type { CeoDecision, FacilityEvent } from "@/lib/facility/types";

const AGENT_SHORT: Record<AgentId, string> = {
  ceo: "CEO",
  research: "Research",
  designer: "Design",
  marketing: "Marketing",
  content: "Content",
  image: "Image",
  shopify: "Shopify",
};

function isAgentId(id: string): id is AgentId {
  return id in AGENT_CATALOG;
}

export function matchCeoDecision(
  event: FacilityEvent,
): Omit<CeoDecision, "id" | "timestamp"> | null {
  switch (event.type) {
    case "task.assigned": {
      if (!isAgentId(event.actorId) && isAgentId(event.domain ?? "")) {
        const target = event.domain as AgentId;
        if (target === "ceo") return null;
        return {
          label: `${AGENT_SHORT[target]} Assigned`,
          type: "assign",
          targetAgentId: target,
        };
      }
      if (event.actorId === "ceo" && event.domain && isAgentId(event.domain)) {
        const target = event.domain as AgentId;
        if (target === "ceo") return null;
        return {
          label: `${AGENT_SHORT[target]} Assigned`,
          type: "assign",
          targetAgentId: target,
        };
      }
      return null;
    }
    case "task.created": {
      if (event.actorId === "ceo") {
        return { label: "Objective Delegated", type: "assign" };
      }
      return null;
    }
    case "task.execution.started": {
      if (event.actorId === "ceo") return null;
      if (isAgentId(event.actorId)) {
        return {
          label: `${AGENT_SHORT[event.actorId]} Activated`,
          type: "assign",
          targetAgentId: event.actorId,
        };
      }
      return null;
    }
    case "report.approved":
      if (event.actorId === "ceo" || event.type.includes("final")) {
        return { label: "Final Report Approved", type: "verdict" };
      }
      return { label: "Review Requested", type: "review" };
    case "report.rejected":
    case "report.revision_requested":
      return { label: "Revision Required", type: "review" };
    case "ceo.final_report.generated":
    case "ceo.final_report.completed":
      return { label: "Strategy Synthesized", type: "verdict" };
    default:
      return null;
  }
}

export function createCeoDecision(
  partial: Omit<CeoDecision, "id" | "timestamp">,
): CeoDecision {
  return {
    ...partial,
    id: `ceo-decision-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };
}
