import { isSupabaseConfigured, createAdminClient } from "@/lib/supabase/admin";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import {
  referenceRightsEvidencePayloadSchema,
  type ReferenceRightsEvidence,
  type ReferenceRightsEvidencePayload,
} from "./types";

const RIGHTS_EVENT_TYPES = [
  "persona.reference_rights_confirmed",
  "persona.reference_rights_rejected",
] as const;

export interface ReferenceRightsEvidenceRepository {
  readonly kind: "memory" | "supabase";
  getByOperationId(
    scope: WorkspaceScope,
    operationId: string,
  ): Promise<ReferenceRightsEvidence | null>;
  listForPersona(
    scope: WorkspaceScope,
    personaId: string,
  ): Promise<ReferenceRightsEvidence[]>;
  create(
    scope: WorkspaceScope,
    payload: ReferenceRightsEvidencePayload,
  ): Promise<ReferenceRightsEvidence>;
}

function mapEvent(row: Record<string, unknown>): ReferenceRightsEvidence {
  const payload = referenceRightsEvidencePayloadSchema.parse(row.payload);
  return {
    ...payload,
    id: String(row.id),
    createdAt: String(row.created_at),
  };
}

export class MemoryReferenceRightsEvidenceRepository
  implements ReferenceRightsEvidenceRepository
{
  readonly kind = "memory" as const;
  private readonly rows = new Map<string, ReferenceRightsEvidence>();

  async getByOperationId(scope: WorkspaceScope, operationId: string) {
    const row = this.rows.get(operationId) ?? null;
    return row?.workspaceId === scope.workspaceId ? structuredClone(row) : null;
  }

  async listForPersona(scope: WorkspaceScope, personaId: string) {
    return [...this.rows.values()]
      .filter(
        (row) =>
          row.workspaceId === scope.workspaceId && row.personaId === personaId,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((row) => structuredClone(row));
  }

  async create(
    scope: WorkspaceScope,
    payload: ReferenceRightsEvidencePayload,
  ) {
    const existing = this.rows.get(payload.operationId);
    if (existing) {
      if (existing.workspaceId !== scope.workspaceId) {
        throw new Error("Reference-rights operation belongs to another workspace");
      }
      return structuredClone(existing);
    }
    const row: ReferenceRightsEvidence = {
      ...referenceRightsEvidencePayloadSchema.parse(payload),
      id: payload.operationId,
      workspaceId: scope.workspaceId,
      createdAt: new Date().toISOString(),
    };
    this.rows.set(row.id, row);
    return structuredClone(row);
  }
}

export class SupabaseReferenceRightsEvidenceRepository
  implements ReferenceRightsEvidenceRepository
{
  readonly kind = "supabase" as const;

  async getByOperationId(scope: WorkspaceScope, operationId: string) {
    const { data, error } = await createAdminClient()
      .from("brain_events")
      .select("id, workspace_id, event_type, record_id, actor_id, payload, created_at")
      .eq("id", operationId)
      .eq("workspace_id", scope.workspaceId)
      .in("event_type", [...RIGHTS_EVENT_TYPES])
      .maybeSingle();
    if (error) throw error;
    return data ? mapEvent(data as Record<string, unknown>) : null;
  }

  async listForPersona(scope: WorkspaceScope, personaId: string) {
    const { data, error } = await createAdminClient()
      .from("brain_events")
      .select("id, workspace_id, event_type, record_id, actor_id, payload, created_at")
      .eq("workspace_id", scope.workspaceId)
      .eq("record_id", personaId)
      .in("event_type", [...RIGHTS_EVENT_TYPES])
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapEvent(row as Record<string, unknown>));
  }

  async create(
    scope: WorkspaceScope,
    payload: ReferenceRightsEvidencePayload,
  ) {
    const parsed = referenceRightsEvidencePayloadSchema.parse({
      ...payload,
      workspaceId: scope.workspaceId,
    });
    const { data, error } = await createAdminClient()
      .from("brain_events")
      .insert({
        id: parsed.operationId,
        workspace_id: scope.workspaceId,
        event_type:
          parsed.decision === "confirmed"
            ? "persona.reference_rights_confirmed"
            : "persona.reference_rights_rejected",
        domain: "persona_studio",
        record_id: parsed.personaId,
        actor_type: "human",
        actor_id: parsed.decidedBy,
        payload: parsed,
      })
      .select("id, workspace_id, event_type, record_id, actor_id, payload, created_at")
      .single();
    if (error?.code === "23505") {
      const existing = await this.getByOperationId(scope, parsed.operationId);
      if (existing) return existing;
    }
    if (error) throw error;
    return mapEvent(data as Record<string, unknown>);
  }
}

let testOverride: ReferenceRightsEvidenceRepository | null = null;
let memorySingleton: MemoryReferenceRightsEvidenceRepository | null = null;

export function setReferenceRightsEvidenceRepositoryForTests(
  repository: ReferenceRightsEvidenceRepository | null,
) {
  testOverride = repository;
}

export function getReferenceRightsEvidenceRepository(): ReferenceRightsEvidenceRepository {
  if (testOverride) return testOverride;
  if (isSupabaseConfigured()) return new SupabaseReferenceRightsEvidenceRepository();
  if (!memorySingleton) {
    memorySingleton = new MemoryReferenceRightsEvidenceRepository();
  }
  return memorySingleton;
}
