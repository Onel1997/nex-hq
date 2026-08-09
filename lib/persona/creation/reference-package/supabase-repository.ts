/**
 * Supabase persistence for Stage B Reference Package.
 */

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type { ReferencePackageRepository } from "./repository";
import type {
  CreateReferencePackageAttemptInput,
  CreateReferencePackageSessionInput,
  ReferencePackageAttempt,
  ReferencePackageSession,
  UpdateReferencePackageAttemptInput,
  UpdateReferencePackageSessionInput,
} from "./types";
import type { ReferencePackageAttemptStatus } from "./slots";
import type { IdentityConsistencyDecision } from "./identity-consistency";
import type { ReferencePackageSlot } from "./slots";
import type { ReferencePackageSessionStatus } from "./types";

function mapSession(row: Record<string, unknown>): ReferencePackageSession {
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    persona_id: String(row.persona_id),
    master_reference_id: String(row.master_reference_id),
    status: row.status as ReferencePackageSessionStatus,
    provider: "openai",
    confirmation_token:
      row.confirmation_token == null ? null : String(row.confirmation_token),
    estimate_hash: row.estimate_hash == null ? null : String(row.estimate_hash),
    estimated_cost_min: Number(row.estimated_cost_min ?? 0),
    estimated_cost_max: Number(row.estimated_cost_max ?? 0),
    max_authorized_spend: Number(row.max_authorized_spend ?? 0),
    image_count: Number(row.image_count ?? 0),
    confirmed_at: row.confirmed_at == null ? null : String(row.confirmed_at),
    consumed_at: row.consumed_at == null ? null : String(row.consumed_at),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapSlot(value: unknown): ReferencePackageSlot | null {
  if (
    value === "front" ||
    value === "three_quarter_left" ||
    value === "three_quarter_right" ||
    value === "left_profile" ||
    value === "right_profile"
  ) {
    return value;
  }
  return null;
}

function mapAttempt(row: Record<string, unknown>): ReferencePackageAttempt {
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    persona_id: String(row.persona_id),
    session_id: String(row.session_id),
    master_reference_id: String(row.master_reference_id),
    reference_slot: row.reference_slot as ReferencePackageSlot,
    effective_slot: mapSlot(row.effective_slot),
    reassigned_from: mapSlot(row.reassigned_from),
    reassigned_at: row.reassigned_at == null ? null : String(row.reassigned_at),
    reassigned_by: row.reassigned_by == null ? null : String(row.reassigned_by),
    angle_review_source:
      row.angle_review_source === "user" || row.angle_review_source === "system"
        ? row.angle_review_source
        : null,
    angle_review_decision:
      row.angle_review_decision === "confirmed" ||
      row.angle_review_decision === "rejected"
        ? row.angle_review_decision
        : null,
    provider: "openai",
    provider_request_id:
      row.provider_request_id == null ? null : String(row.provider_request_id),
    generated_asset_id:
      row.generated_asset_id == null ? null : String(row.generated_asset_id),
    status: row.status as ReferencePackageAttemptStatus,
    identity_decision:
      row.identity_decision == null
        ? null
        : (row.identity_decision as IdentityConsistencyDecision),
    identity_distance:
      row.identity_distance == null ? null : Number(row.identity_distance),
    identity_similarity:
      row.identity_similarity == null ? null : Number(row.identity_similarity),
    angle_direction:
      row.angle_direction === "correct" ||
      row.angle_direction === "incorrect" ||
      row.angle_direction === "uncertain"
        ? row.angle_direction
        : null,
    detected_orientation:
      row.detected_orientation === "image_left" ||
      row.detected_orientation === "image_right" ||
      row.detected_orientation === "frontal" ||
      row.detected_orientation === "profile_left" ||
      row.detected_orientation === "profile_right" ||
      row.detected_orientation === "uncertain"
        ? row.detected_orientation
        : null,
    detected_yaw_degrees:
      row.detected_yaw_degrees == null ? null : Number(row.detected_yaw_degrees),
    cost_eur: row.cost_eur == null ? null : Number(row.cost_eur),
    error_message:
      row.error_message == null ? null : String(row.error_message),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export class SupabaseReferencePackageRepository
  implements ReferencePackageRepository
{
  readonly kind = "supabase" as const;

  async createSession(
    scope: WorkspaceScope,
    input: CreateReferencePackageSessionInput,
  ): Promise<ReferencePackageSession> {
    const db = createAdminClient();
    const id = randomUUID();
    const { data, error } = await db
      .from("persona_reference_package_sessions")
      .insert({
        id,
        workspace_id: scope.workspaceId,
        persona_id: input.persona_id,
        master_reference_id: input.master_reference_id,
        status: "pending_confirmation",
        provider: "openai",
        confirmation_token: input.confirmation_token,
        estimate_hash: input.estimate_hash,
        estimated_cost_min: input.estimated_cost_min,
        estimated_cost_max: input.estimated_cost_max,
        max_authorized_spend: input.max_authorized_spend,
        image_count: input.image_count,
      })
      .select("*")
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create reference package session");
    }
    return mapSession(data as Record<string, unknown>);
  }

  async getSession(
    scope: WorkspaceScope,
    id: string,
  ): Promise<ReferencePackageSession | null> {
    const db = createAdminClient();
    const { data, error } = await db
      .from("persona_reference_package_sessions")
      .select("*")
      .eq("id", id)
      .eq("workspace_id", scope.workspaceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapSession(data as Record<string, unknown>) : null;
  }

  async getLatestSessionForPersona(
    scope: WorkspaceScope,
    personaId: string,
  ): Promise<ReferencePackageSession | null> {
    const db = createAdminClient();
    const { data, error } = await db
      .from("persona_reference_package_sessions")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .eq("persona_id", personaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapSession(data as Record<string, unknown>) : null;
  }

  async findSessionByToken(
    scope: WorkspaceScope,
    token: string,
  ): Promise<ReferencePackageSession | null> {
    const db = createAdminClient();
    const { data, error } = await db
      .from("persona_reference_package_sessions")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .eq("confirmation_token", token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapSession(data as Record<string, unknown>) : null;
  }

  async updateSession(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateReferencePackageSessionInput,
  ): Promise<ReferencePackageSession> {
    const db = createAdminClient();
    const { data, error } = await db
      .from("persona_reference_package_sessions")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("workspace_id", scope.workspaceId)
      .select("*")
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? "Failed to update session");
    }
    return mapSession(data as Record<string, unknown>);
  }

  async createAttempt(
    scope: WorkspaceScope,
    input: CreateReferencePackageAttemptInput,
  ): Promise<ReferencePackageAttempt> {
    const db = createAdminClient();
    const id = randomUUID();
    const { data, error } = await db
      .from("persona_reference_package_attempts")
      .insert({
        id,
        workspace_id: scope.workspaceId,
        persona_id: input.persona_id,
        session_id: input.session_id,
        master_reference_id: input.master_reference_id,
        reference_slot: input.reference_slot,
        provider: "openai",
        status: input.status ?? "queued",
      })
      .select("*")
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create attempt");
    }
    return mapAttempt(data as Record<string, unknown>);
  }

  async updateAttempt(
    scope: WorkspaceScope,
    id: string,
    patch: UpdateReferencePackageAttemptInput,
  ): Promise<ReferencePackageAttempt> {
    const db = createAdminClient();
    const { data, error } = await db
      .from("persona_reference_package_attempts")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("workspace_id", scope.workspaceId)
      .select("*")
      .single();
    if (error || !data) {
      throw new Error(error?.message ?? "Failed to update attempt");
    }
    return mapAttempt(data as Record<string, unknown>);
  }

  async listAttemptsForPersona(
    scope: WorkspaceScope,
    personaId: string,
  ): Promise<ReferencePackageAttempt[]> {
    const db = createAdminClient();
    const { data, error } = await db
      .from("persona_reference_package_attempts")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .eq("persona_id", personaId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapAttempt(row as Record<string, unknown>));
  }

  async listAttemptsForSession(
    scope: WorkspaceScope,
    sessionId: string,
  ): Promise<ReferencePackageAttempt[]> {
    const db = createAdminClient();
    const { data, error } = await db
      .from("persona_reference_package_attempts")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapAttempt(row as Record<string, unknown>));
  }
}
