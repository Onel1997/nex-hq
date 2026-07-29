/**
 * Supabase novelty repository — production persistence.
 *
 * Uses the admin client + application-layer workspace scoping.
 * RLS on persona_face_novelty_records enforces workspace isolation at DB level
 * in addition to the application-layer checks here.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { PersonaDomainError } from "../domain/errors";
import type { FaceNoveltyRecord, FaceNoveltyState } from "./types";
import type { NoveltyRecordFilter, NoveltyRepository } from "./novelty-repository";

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : v == null ? fallback : String(v);
}
function nullableStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  return str(v);
}
function throwDb(error: { message: string } | null, msg: string) {
  if (error) throw new PersonaDomainError(msg, "VALIDATION", { message: error.message });
}

function mapRecord(row: Record<string, unknown>): FaceNoveltyRecord {
  return {
    id: str(row.id),
    workspaceId: str(row.workspace_id),
    archetypeId: str(row.archetype_id),
    creationProjectId: str(row.creation_project_id),
    candidateId: str(row.candidate_id),
    assetId: str(row.asset_id),
    state: str(row.state) as FaceNoveltyState,
    identityFingerprint: str(row.identity_fingerprint),
    visualFingerprint: nullableStr(row.visual_fingerprint),
    perceptualHash: nullableStr(row.perceptual_hash),
    storageObjectKey: nullableStr(row.storage_object_key),
    imageChecksum: nullableStr(row.image_checksum),
    embeddingVersion: nullableStr(row.embedding_version),
    sourceProvider: str(row.source_provider),
    sourceModel: str(row.source_model),
    createdAt: str(row.created_at),
    firstShownAt: nullableStr(row.first_shown_at),
    exhaustedAt: nullableStr(row.exhausted_at),
    savedAt: nullableStr(row.saved_at),
    approvedAt: nullableStr(row.approved_at),
    shortlistedAt: nullableStr(row.shortlisted_at),
    rejectedAt: nullableStr(row.rejected_at),
  };
}

const TABLE = "persona_face_novelty_records";

export class SupabaseNoveltyRepository implements NoveltyRepository {
  async upsert(record: FaceNoveltyRecord): Promise<void> {
    const client = createAdminClient();
    const { error } = await client.from(TABLE).upsert({
      id: record.id,
      workspace_id: record.workspaceId,
      archetype_id: record.archetypeId,
      creation_project_id: record.creationProjectId,
      candidate_id: record.candidateId,
      asset_id: record.assetId,
      state: record.state,
      identity_fingerprint: record.identityFingerprint,
      visual_fingerprint: record.visualFingerprint ?? null,
      perceptual_hash: record.perceptualHash ?? null,
      storage_object_key: record.storageObjectKey ?? null,
      image_checksum: record.imageChecksum ?? null,
      embedding_version: record.embeddingVersion ?? null,
      source_provider: record.sourceProvider,
      source_model: record.sourceModel,
      created_at: record.createdAt,
      first_shown_at: record.firstShownAt ?? null,
      exhausted_at: record.exhaustedAt ?? null,
      saved_at: record.savedAt ?? null,
      approved_at: record.approvedAt ?? null,
      shortlisted_at: record.shortlistedAt ?? null,
      rejected_at: record.rejectedAt ?? null,
    });
    throwDb(error, "Failed to upsert face novelty record");
  }

  async updateState(
    id: string,
    workspaceId: string,
    state: FaceNoveltyState,
    timestamps?: Partial<
      Pick<
        FaceNoveltyRecord,
        "firstShownAt" | "exhaustedAt" | "savedAt" | "approvedAt" | "shortlistedAt" | "rejectedAt"
      >
    >,
  ): Promise<void> {
    const client = createAdminClient();
    const update: Record<string, unknown> = { state };
    if (timestamps?.firstShownAt !== undefined) update.first_shown_at = timestamps.firstShownAt;
    if (timestamps?.exhaustedAt !== undefined) update.exhausted_at = timestamps.exhaustedAt;
    if (timestamps?.savedAt !== undefined) update.saved_at = timestamps.savedAt;
    if (timestamps?.approvedAt !== undefined) update.approved_at = timestamps.approvedAt;
    if (timestamps?.shortlistedAt !== undefined) update.shortlisted_at = timestamps.shortlistedAt;
    if (timestamps?.rejectedAt !== undefined) update.rejected_at = timestamps.rejectedAt;
    const { error } = await client
      .from(TABLE)
      .update(update)
      .eq("id", id)
      .eq("workspace_id", workspaceId);
    throwDb(error, "Failed to update face novelty record state");
  }

  async findMany(filter: NoveltyRecordFilter): Promise<FaceNoveltyRecord[]> {
    const client = createAdminClient();
    let query = client.from(TABLE).select("*").eq("workspace_id", filter.workspaceId);
    if (filter.archetypeId) query = query.eq("archetype_id", filter.archetypeId);
    if (filter.states && filter.states.length > 0) query = query.in("state", filter.states);
    const { data, error } = await query;
    throwDb(error, "Failed to query face novelty records");
    return (data ?? []).map((row) => mapRecord(row as Record<string, unknown>));
  }

  async findByCandidateId(
    candidateId: string,
    workspaceId: string,
  ): Promise<FaceNoveltyRecord | null> {
    const client = createAdminClient();
    const { data, error } = await client
      .from(TABLE)
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("candidate_id", candidateId)
      .maybeSingle();
    throwDb(error, "Failed to find face novelty record by candidateId");
    if (!data) return null;
    return mapRecord(data as Record<string, unknown>);
  }

  async findByAssetId(assetId: string, workspaceId: string): Promise<FaceNoveltyRecord | null> {
    const client = createAdminClient();
    const { data, error } = await client
      .from(TABLE)
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("asset_id", assetId)
      .maybeSingle();
    throwDb(error, "Failed to find face novelty record by assetId");
    if (!data) return null;
    return mapRecord(data as Record<string, unknown>);
  }
}
