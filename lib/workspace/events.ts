import type { AgentId } from "@/lib/constants/agents";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveWorkspace } from "@/brain/seed";
import type {
  WorkspaceEvent,
  WorkspaceEventCategory,
  WorkspaceEventPriority,
} from "@/lib/workspace/inspector-types";

const WORKSPACE_EVENT_TYPES = [
  "task.created", "task.assigned", "task.status_changed", "task.completed",
  "task.execution.started", "task.execution.completed", "task.execution.failed",
  "task.review.completed", "report.approved", "report.rejected",
  "report.revision_requested", "ceo.final_report.started",
  "ceo.final_report.generated", "ceo.final_report.completed",
  "record.created", "record.updated",
] as const;

function summarizeEvent(eventType: string, actorType: string, actorId: string, domain: string | null): string {
  const actor = actorType === "agent" ? actorId : actorType;
  const domainLabel = domain ? ` · ${domain}` : "";
  const labels: Record<string, string> = {
    "task.execution.started": `${actor} started execution${domainLabel}`,
    "task.execution.completed": `${actor} completed execution${domainLabel}`,
    "task.execution.failed": `${actor} execution failed${domainLabel}`,
    "task.status_changed": `${actor} updated task status${domainLabel}`,
    "task.assigned": `${actor} assigned task${domainLabel}`,
    "task.created": `${actor} created task${domainLabel}`,
    "task.completed": `${actor} completed task${domainLabel}`,
    "task.review.completed": `Task review completed${domainLabel}`,
    "report.approved": `Report approved${domainLabel}`,
    "report.rejected": `Report rejected${domainLabel}`,
    "report.revision_requested": `Revision requested${domainLabel}`,
    "ceo.final_report.started": "CEO final report synthesis started",
    "ceo.final_report.generated": "CEO final report generated",
    "ceo.final_report.completed": "CEO final report completed",
    "record.created": `New ${domain ?? "record"} created`,
    "record.updated": `${domain ?? "Record"} updated`,
  };
  return labels[eventType] ?? `${eventType}${domainLabel}`;
}

function categorizeEvent(eventType: string): WorkspaceEventCategory {
  if (eventType.startsWith("ceo.")) return "ceo";
  if (eventType.startsWith("report.")) return "report";
  if (eventType === "task.created" || eventType === "task.assigned") return "delegation";
  if (eventType.startsWith("task.")) return "task";
  return "system";
}

function prioritizeEvent(eventType: string): WorkspaceEventPriority {
  if (eventType.includes("final_report") || eventType === "report.approved") return "critical";
  if (eventType.includes("failed") || eventType === "report.rejected") return "high";
  return "normal";
}

export async function getAgentEvents(agentId: AgentId, limit = 30): Promise<WorkspaceEvent[]> {
  const workspace = await resolveWorkspace();
  const { data, error } = await createAdminClient()
    .from("brain_events")
    .select("id, event_type, created_at, actor_type, actor_id, domain")
    .eq("workspace_id", workspace.id)
    .eq("actor_id", agentId)
    .in("event_type", [...WORKSPACE_EVENT_TYPES])
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw new Error(`Failed to load agent events: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.event_type,
    timestamp: row.created_at,
    actorType: row.actor_type,
    actorId: row.actor_id,
    domain: row.domain,
    summary: summarizeEvent(row.event_type, row.actor_type, row.actor_id, row.domain),
    category: categorizeEvent(row.event_type),
    priority: prioritizeEvent(row.event_type),
  }));
}
