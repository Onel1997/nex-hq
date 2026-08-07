/**
 * Face Novelty Memory repository interface + in-memory implementation.
 *
 * The Supabase implementation lives in supabase-novelty-repository.ts.
 * The in-memory implementation is used in tests and server-side only contexts.
 *
 * Security: all methods are workspace-scoped.  Callers must never pass
 * a workspace ID derived from client input — resolve it server-side.
 */

import type { FaceNoveltyRecord, FaceNoveltyState } from "./types";
import type { HistoricalFaceProtectionStatus } from "./historical-protection";
import { normalizeHistoricalProtectionStatus } from "./historical-protection";

export interface NoveltyRecordFilter {
  workspaceId: string;
  archetypeId?: string;
  states?: FaceNoveltyState[];
}

export type HistoricalProtectionUpdate = {
  historicalProtectionStatus: HistoricalFaceProtectionStatus;
  historicalProtectionPromotedAt?: string;
  historicalProtectionReason?: string;
  historicalProtectionSource?: string;
};

export interface NoveltyRepository {
  /**
   * Persist a record. Idempotent on (workspace_id, candidate_id):
   * retries update the existing row rather than inserting a duplicate.
   * Prefer reusing the existing record id when one is already stored.
   */
  upsert(record: FaceNoveltyRecord): Promise<void>;
  /** Update state (and timestamps) of an existing record. */
  updateState(
    id: string,
    workspaceId: string,
    state: FaceNoveltyState,
    timestamps?: Partial<
      Pick<
        FaceNoveltyRecord,
        "firstShownAt" | "exhaustedAt" | "savedAt" | "approvedAt" | "shortlistedAt" | "rejectedAt"
      >
    >,
  ): Promise<void>;
  /** Phase 2.2G — promote / strengthen historical biological protection. */
  updateHistoricalProtection(
    id: string,
    workspaceId: string,
    update: HistoricalProtectionUpdate,
  ): Promise<void>;
  /** Load all records matching the filter. */
  findMany(filter: NoveltyRecordFilter): Promise<FaceNoveltyRecord[]>;
  /** Load one record by candidateId + workspaceId. */
  findByCandidateId(
    candidateId: string,
    workspaceId: string,
  ): Promise<FaceNoveltyRecord | null>;
  /** Load one record by assetId + workspaceId. */
  findByAssetId(assetId: string, workspaceId: string): Promise<FaceNoveltyRecord | null>;
}

function withDefaultProtection(record: FaceNoveltyRecord): FaceNoveltyRecord {
  return {
    ...record,
    historicalProtectionStatus: normalizeHistoricalProtectionStatus(
      record.historicalProtectionStatus,
    ),
  };
}

/** In-memory implementation — suitable for tests and ephemeral server routes. */
export class MemoryNoveltyRepository implements NoveltyRepository {
  private readonly records = new Map<string, FaceNoveltyRecord>();

  /**
   * Upsert by record id, enforcing the same uniqueness as
   * persona_face_novelty_records_workspace_candidate_unique:
   * one row per (workspace_id, candidate_id). Retries update in place.
   */
  async upsert(record: FaceNoveltyRecord): Promise<void> {
    const incoming = withDefaultProtection(record);
    for (const [id, existing] of this.records) {
      if (
        existing.workspaceId === incoming.workspaceId &&
        existing.candidateId === incoming.candidateId &&
        id !== incoming.id
      ) {
        // Same candidate under a different id — fold into the existing row.
        this.records.delete(id);
        this.records.set(id, {
          ...incoming,
          id,
          createdAt: existing.createdAt,
          firstShownAt: incoming.firstShownAt ?? existing.firstShownAt,
          exhaustedAt: incoming.exhaustedAt ?? existing.exhaustedAt,
          savedAt: incoming.savedAt ?? existing.savedAt,
          approvedAt: incoming.approvedAt ?? existing.approvedAt,
          shortlistedAt: incoming.shortlistedAt ?? existing.shortlistedAt,
          rejectedAt: incoming.rejectedAt ?? existing.rejectedAt,
          embeddingVersion: incoming.embeddingVersion ?? existing.embeddingVersion,
          historicalProtectionStatus:
            incoming.historicalProtectionStatus ??
            existing.historicalProtectionStatus ??
            "unprotected",
          historicalProtectionPromotedAt:
            incoming.historicalProtectionPromotedAt ??
            existing.historicalProtectionPromotedAt,
          historicalProtectionReason:
            incoming.historicalProtectionReason ??
            existing.historicalProtectionReason,
          historicalProtectionSource:
            incoming.historicalProtectionSource ??
            existing.historicalProtectionSource,
        });
        return;
      }
    }
    this.records.set(incoming.id, { ...incoming });
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
    const existing = this.records.get(id);
    if (!existing || existing.workspaceId !== workspaceId) return;
    this.records.set(id, { ...existing, state, ...(timestamps ?? {}) });
  }

  async updateHistoricalProtection(
    id: string,
    workspaceId: string,
    update: HistoricalProtectionUpdate,
  ): Promise<void> {
    const existing = this.records.get(id);
    if (!existing || existing.workspaceId !== workspaceId) return;
    this.records.set(id, {
      ...existing,
      historicalProtectionStatus: update.historicalProtectionStatus,
      historicalProtectionPromotedAt: update.historicalProtectionPromotedAt,
      historicalProtectionReason: update.historicalProtectionReason,
      historicalProtectionSource: update.historicalProtectionSource,
    });
  }

  async findMany(filter: NoveltyRecordFilter): Promise<FaceNoveltyRecord[]> {
    const results: FaceNoveltyRecord[] = [];
    for (const record of this.records.values()) {
      if (record.workspaceId !== filter.workspaceId) continue;
      if (filter.archetypeId && record.archetypeId !== filter.archetypeId) continue;
      if (filter.states && !filter.states.includes(record.state)) continue;
      results.push(withDefaultProtection(record));
    }
    return results;
  }

  async findByCandidateId(
    candidateId: string,
    workspaceId: string,
  ): Promise<FaceNoveltyRecord | null> {
    for (const record of this.records.values()) {
      if (record.candidateId === candidateId && record.workspaceId === workspaceId) {
        return withDefaultProtection(record);
      }
    }
    return null;
  }

  async findByAssetId(assetId: string, workspaceId: string): Promise<FaceNoveltyRecord | null> {
    for (const record of this.records.values()) {
      if (record.assetId === assetId && record.workspaceId === workspaceId) {
        return withDefaultProtection(record);
      }
    }
    return null;
  }
}
