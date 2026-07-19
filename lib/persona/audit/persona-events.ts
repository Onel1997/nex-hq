/**
 * Audit events for Persona Studio via existing brain_events (no duplicate system).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "node:crypto";

export type PersonaAuditEventType =
  | "persona.created"
  | "persona.submitted_for_review"
  | "persona.approved"
  | "persona.archived"
  | "persona.reference_uploaded"
  | "persona.reference_approved"
  | "persona.reference_rejected"
  | "persona.primary_reference_changed";

export async function logPersonaAuditEvent(params: {
  workspaceId: string;
  eventType: PersonaAuditEventType;
  recordId?: string;
  actorId?: string | null;
  payload?: Record<string, unknown>;
}): Promise<string> {
  const id = randomUUID();
  const db = createAdminClient();
  const { error } = await db.from("brain_events").insert({
    id,
    workspace_id: params.workspaceId,
    event_type: params.eventType,
    domain: "persona_studio",
    record_id: params.recordId ?? null,
    actor_type: "human",
    actor_id: params.actorId ?? "workspace-user",
    payload: params.payload ?? {},
  });

  if (error) {
    console.error("[Persona Audit] failed to log event", {
      eventType: params.eventType,
      error: error.message,
    });
  }
  return id;
}
