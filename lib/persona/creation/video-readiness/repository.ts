import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import {
  videoIdentityReviewEvidenceSchema,
  type VideoIdentityReviewEvidence,
} from "./types";

export interface VideoIdentityReviewRepository {
  readonly kind: "memory" | "supabase";
  getByOperationId(
    scope: WorkspaceScope,
    operationId: string,
  ): Promise<VideoIdentityReviewEvidence | null>;
  listForPersona(
    scope: WorkspaceScope,
    personaId: string,
  ): Promise<VideoIdentityReviewEvidence[]>;
  create(
    scope: WorkspaceScope,
    evidence: Omit<VideoIdentityReviewEvidence, "createdAt">,
  ): Promise<VideoIdentityReviewEvidence>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryVideoIdentityReviewRepository
  implements VideoIdentityReviewRepository
{
  readonly kind = "memory" as const;
  private readonly rows = new Map<string, VideoIdentityReviewEvidence>();

  async getByOperationId(scope: WorkspaceScope, operationId: string) {
    const row = this.rows.get(operationId) ?? null;
    return row?.workspaceId === scope.workspaceId ? clone(row) : null;
  }

  async listForPersona(scope: WorkspaceScope, personaId: string) {
    return [...this.rows.values()]
      .filter(
        (row) =>
          row.workspaceId === scope.workspaceId && row.personaId === personaId,
      )
      .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))
      .map(clone);
  }

  async create(
    scope: WorkspaceScope,
    evidence: Omit<VideoIdentityReviewEvidence, "createdAt">,
  ) {
    const parsed = videoIdentityReviewEvidenceSchema.parse({
      ...evidence,
      workspaceId: scope.workspaceId,
    });
    const existing = this.rows.get(parsed.operationId);
    if (existing) return clone(existing);
    const row = { ...parsed, createdAt: new Date().toISOString() };
    this.rows.set(row.operationId, row);
    return clone(row);
  }
}

function mapEvent(row: Record<string, unknown>): VideoIdentityReviewEvidence {
  const parsed = videoIdentityReviewEvidenceSchema.parse(row.payload);
  return { ...parsed, createdAt: String(row.created_at) };
}

export class SupabaseVideoIdentityReviewRepository
  implements VideoIdentityReviewRepository
{
  readonly kind = "supabase" as const;

  async getByOperationId(scope: WorkspaceScope, operationId: string) {
    const { data, error } = await createAdminClient()
      .from("brain_events")
      .select("id, payload, created_at")
      .eq("id", operationId)
      .eq("workspace_id", scope.workspaceId)
      .in("event_type", [
        "persona.video_identity_review_approved",
        "persona.video_identity_review_rejected",
      ])
      .maybeSingle();
    if (error) throw error;
    return data ? mapEvent(data as Record<string, unknown>) : null;
  }

  async listForPersona(scope: WorkspaceScope, personaId: string) {
    const { data, error } = await createAdminClient()
      .from("brain_events")
      .select("id, payload, created_at")
      .eq("workspace_id", scope.workspaceId)
      .eq("record_id", personaId)
      .in("event_type", [
        "persona.video_identity_review_approved",
        "persona.video_identity_review_rejected",
      ])
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapEvent(row as Record<string, unknown>));
  }

  async create(
    scope: WorkspaceScope,
    evidence: Omit<VideoIdentityReviewEvidence, "createdAt">,
  ) {
    const parsed = videoIdentityReviewEvidenceSchema.parse({
      ...evidence,
      workspaceId: scope.workspaceId,
    });
    const { data, error } = await createAdminClient().rpc(
      "record_persona_video_identity_review",
      {
        p_workspace_id: scope.workspaceId,
        p_persona_id: parsed.personaId,
        p_operation_id: parsed.operationId,
        p_reviewer_id: parsed.reviewerId,
        p_evidence: parsed,
      },
    );
    if (error) throw error;
    const result = data as { evidence?: unknown; createdAt?: unknown } | null;
    return {
      ...videoIdentityReviewEvidenceSchema.parse(result?.evidence),
      createdAt: String(result?.createdAt),
    };
  }
}

let testOverride: VideoIdentityReviewRepository | null = null;
let memorySingleton: MemoryVideoIdentityReviewRepository | null = null;

export function setVideoIdentityReviewRepositoryForTests(
  repository: VideoIdentityReviewRepository | null,
) {
  testOverride = repository;
}

export function getVideoIdentityReviewRepository(): VideoIdentityReviewRepository {
  if (testOverride) return testOverride;
  if (isSupabaseConfigured()) return new SupabaseVideoIdentityReviewRepository();
  if (!memorySingleton) memorySingleton = new MemoryVideoIdentityReviewRepository();
  return memorySingleton;
}
