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
  | "reference.identity_override_approved"
  | "reference.mirror_salvage_created"
  | "reference.accepted_replacement_generated"
  | "reference.accepted_replacement_rejected"
  | "reference.accepted_replacement_approved"
  | "persona.primary_reference_changed"
  | "persona_creation_project.created"
  | "candidate_generation.started"
  | "candidate_generation.completed"
  | "candidate_generation.failed"
  | "candidate_generation.cancelled"
  | "candidate.shortlisted"
  | "candidate.rejected"
  | "candidate.selected"
  | "candidate.converted_to_persona"
  | "identity_review.completed"
  | "persona.identity_locked"
  | "persona.image_use_approved"
  | "persona.video_use_approved"
  | "persona.brand_cast_approved"
  | "face_novelty.historical_protection_promoted";

export async function logPersonaAuditEvent(params: {
  workspaceId: string;
  eventType: PersonaAuditEventType;
  recordId?: string;
  actorId?: string | null;
  payload?: Record<string, unknown>;
}): Promise<string> {
  const id = randomUUID();
  try {
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
  } catch (error) {
    // Best-effort — unit tests / missing env must not break domain flows.
    console.error("[Persona Audit] skipped", {
      eventType: params.eventType,
      error: error instanceof Error ? error.message : error,
    });
  }
  return id;
}
