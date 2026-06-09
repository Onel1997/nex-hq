import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import type { AgentId } from "@/lib/constants/agents";
import type { FacilityEvent } from "@/lib/facility/types";
import { createAdminClient } from "@/lib/supabase/admin";

const FACILITY_EVENT_TYPES = [
  "task.created",
  "task.assigned",
  "task.status_changed",
  "task.completed",
  "task.execution.started",
  "task.execution.completed",
  "task.execution.failed",
  "task.review.completed",
  "report.approved",
  "report.rejected",
  "report.revision_requested",
  "ceo.final_report.started",
  "ceo.final_report.generated",
  "ceo.final_report.completed",
  "record.created",
  "record.updated",
] as const;

function summarizeEvent(
  eventType: string,
  actorType: string,
  actorId: string,
  domain: string | null,
): string {
  const actor = actorType === "agent" ? actorId : actorType;
  const domainLabel = domain ? ` · ${domain}` : "";

  switch (eventType) {
    case "task.execution.started":
      return `${actor} started execution${domainLabel}`;
    case "task.execution.completed":
      return `${actor} completed execution${domainLabel}`;
    case "task.execution.failed":
      return `${actor} execution failed${domainLabel}`;
    case "task.status_changed":
      return `${actor} updated task status${domainLabel}`;
    case "task.assigned":
      return `${actor} assigned task${domainLabel}`;
    case "task.created":
      return `${actor} created task${domainLabel}`;
    case "task.completed":
      return `${actor} completed task${domainLabel}`;
    case "task.review.completed":
      return `Task review completed${domainLabel}`;
    case "report.approved":
      return `Report approved${domainLabel}`;
    case "report.rejected":
      return `Report rejected${domainLabel}`;
    case "report.revision_requested":
      return `Revision requested${domainLabel}`;
    case "ceo.final_report.started":
      return "CEO final report synthesis started";
    case "ceo.final_report.generated":
      return "CEO final report generated";
    case "ceo.final_report.completed":
      return "CEO final report completed";
    case "record.created":
      return `New ${domain ?? "record"} created`;
    case "record.updated":
      return `${domain ?? "Record"} updated`;
    default:
      return `${eventType}${domainLabel}`;
  }
}

function mapEventRow(row: {
  id: string;
  event_type: string;
  created_at: string;
  actor_type: string;
  actor_id: string;
  domain: string | null;
}): FacilityEvent {
  return {
    id: row.id,
    type: row.event_type,
    timestamp: row.created_at,
    actorType: row.actor_type,
    actorId: row.actor_id,
    domain: row.domain,
    summary: summarizeEvent(
      row.event_type,
      row.actor_type,
      row.actor_id,
      row.domain,
    ),
  };
}

/** Fetch events for a specific agent actor. */
export async function getAgentEvents(
  agentId: AgentId,
  limit = 30,
): Promise<FacilityEvent[]> {
  const { workspace } = await ensureWorkspaceBrainSeeded();
  const db = createAdminClient();

  const { data, error } = await db
    .from("brain_events")
    .select("id, event_type, created_at, actor_type, actor_id, domain")
    .eq("workspace_id", workspace.id)
    .eq("actor_id", agentId)
    .in("event_type", [...FACILITY_EVENT_TYPES])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load agent events: ${error.message}`);
  }

  return (data ?? []).map(mapEventRow);
}

/** Fetch events newer than a given timestamp (for SSE incremental updates). */
export async function getFacilityEventsSince(
  since: string,
  limit = 50,
): Promise<FacilityEvent[]> {
  const { workspace } = await ensureWorkspaceBrainSeeded();
  const db = createAdminClient();

  const { data, error } = await db
    .from("brain_events")
    .select("id, event_type, created_at, actor_type, actor_id, domain")
    .eq("workspace_id", workspace.id)
    .in("event_type", [...FACILITY_EVENT_TYPES])
    .gt("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load facility events since: ${error.message}`);
  }

  return (data ?? []).map(mapEventRow);
}

/** Fetch the latest Brain audit events for the facility stream panel. */
export async function getFacilityEvents(limit = 20): Promise<FacilityEvent[]> {
  const { workspace } = await ensureWorkspaceBrainSeeded();
  const db = createAdminClient();

  const { data, error } = await db
    .from("brain_events")
    .select("id, event_type, created_at, actor_type, actor_id, domain")
    .eq("workspace_id", workspace.id)
    .in("event_type", [...FACILITY_EVENT_TYPES])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load facility events: ${error.message}`);
  }

  return (data ?? []).map(mapEventRow);
}
