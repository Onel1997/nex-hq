/**
 * Supabase persistence for Phase 2.4A identity lock snapshots.
 */

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type { IdentityLockRepository } from "./repository";
import type {
  CreateIdentityLockSnapshotInput,
  IdentityLockProvenanceCounts,
  LockedCanonicalReferenceSnapshot,
  PersonaIdentityLockSnapshot,
} from "./types";
import { IDENTITY_LOCK_POLICY_VERSION } from "./types";
import { coerceUuidOrNull } from "./uuid";

function mapSnapshot(row: Record<string, unknown>): PersonaIdentityLockSnapshot {
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    persona_id: String(row.persona_id),
    source_candidate_id:
      row.source_candidate_id == null ? null : String(row.source_candidate_id),
    source_creation_project_id:
      row.source_creation_project_id == null
        ? null
        : String(row.source_creation_project_id),
    master_reference_asset_id: String(row.master_reference_asset_id),
    master_checksum: String(row.master_checksum),
    front_asset_id: String(row.front_asset_id),
    three_quarter_left_asset_id: String(row.three_quarter_left_asset_id),
    three_quarter_right_asset_id: String(row.three_quarter_right_asset_id),
    left_profile_asset_id: String(row.left_profile_asset_id),
    right_profile_asset_id: String(row.right_profile_asset_id),
    canonical_references: (row.canonical_references ??
      []) as LockedCanonicalReferenceSnapshot[],
    identity_lock_version: Number(row.identity_lock_version ?? 1),
    identity_locked_at: String(row.identity_locked_at),
    identity_locked_by:
      row.identity_locked_by == null ? null : String(row.identity_locked_by),
    identity_review_id:
      row.identity_review_id == null ? null : String(row.identity_review_id),
    identity_reviewed_at:
      row.identity_reviewed_at == null ? null : String(row.identity_reviewed_at),
    identity_reviewed_by:
      row.identity_reviewed_by == null ? null : String(row.identity_reviewed_by),
    reference_package_version: String(row.reference_package_version),
    reference_package_fingerprint: String(row.reference_package_fingerprint),
    provenance_counts: (row.provenance_counts ??
      {}) as IdentityLockProvenanceCounts,
    policy_version:
      (row.policy_version as typeof IDENTITY_LOCK_POLICY_VERSION) ??
      IDENTITY_LOCK_POLICY_VERSION,
    created_at: String(row.created_at),
  };
}

function toError(error: {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}) {
  const err = new Error(error.message);
  Object.assign(err, {
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
  return err;
}

export class SupabaseIdentityLockRepository implements IdentityLockRepository {
  readonly kind = "supabase" as const;

  async createSnapshot(
    scope: WorkspaceScope,
    input: CreateIdentityLockSnapshotInput,
  ): Promise<PersonaIdentityLockSnapshot> {
    const db = createAdminClient();
    const id = randomUUID();
    const now = new Date().toISOString();
    const payload = {
      id,
      workspace_id: scope.workspaceId,
      persona_id: input.persona_id,
      source_candidate_id: coerceUuidOrNull(input.source_candidate_id),
      source_creation_project_id: coerceUuidOrNull(
        input.source_creation_project_id,
      ),
      master_reference_asset_id: input.master_reference_asset_id,
      master_checksum: input.master_checksum || "",
      front_asset_id: input.front_asset_id,
      three_quarter_left_asset_id: input.three_quarter_left_asset_id,
      three_quarter_right_asset_id: input.three_quarter_right_asset_id,
      left_profile_asset_id: input.left_profile_asset_id,
      right_profile_asset_id: input.right_profile_asset_id,
      canonical_references: input.canonical_references,
      identity_lock_version: input.identity_lock_version,
      identity_locked_at: input.identity_locked_at,
      // Column is uuid — never persist labels like "workspace-user".
      identity_locked_by: coerceUuidOrNull(input.identity_locked_by),
      identity_review_id: input.identity_review_id,
      identity_reviewed_at: input.identity_reviewed_at,
      identity_reviewed_by: input.identity_reviewed_by,
      reference_package_version: input.reference_package_version,
      reference_package_fingerprint: input.reference_package_fingerprint,
      provenance_counts: input.provenance_counts,
      policy_version: input.policy_version,
      created_at: now,
    };
    const { data, error } = await db
      .from("persona_identity_lock_snapshots")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw toError(error);
    return mapSnapshot(data as Record<string, unknown>);
  }

  async getLatestSnapshotForPersona(
    scope: WorkspaceScope,
    personaId: string,
  ): Promise<PersonaIdentityLockSnapshot | null> {
    const db = createAdminClient();
    const { data, error } = await db
      .from("persona_identity_lock_snapshots")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .eq("persona_id", personaId)
      .order("identity_lock_version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      const code = String(error.code ?? "");
      if (
        code === "PGRST205" ||
        /persona_identity_lock_snapshots/i.test(error.message)
      ) {
        return null;
      }
      throw toError(error);
    }
    return data ? mapSnapshot(data as Record<string, unknown>) : null;
  }

  async getSnapshotByVersion(
    scope: WorkspaceScope,
    personaId: string,
    lockVersion: number,
  ): Promise<PersonaIdentityLockSnapshot | null> {
    const db = createAdminClient();
    const { data, error } = await db
      .from("persona_identity_lock_snapshots")
      .select("*")
      .eq("workspace_id", scope.workspaceId)
      .eq("persona_id", personaId)
      .eq("identity_lock_version", lockVersion)
      .maybeSingle();
    if (error) {
      const code = String(error.code ?? "");
      if (
        code === "PGRST205" ||
        /persona_identity_lock_snapshots/i.test(error.message)
      ) {
        return null;
      }
      throw toError(error);
    }
    return data ? mapSnapshot(data as Record<string, unknown>) : null;
  }
}
