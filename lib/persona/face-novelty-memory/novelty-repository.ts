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

export interface NoveltyRecordFilter {
  workspaceId: string;
  archetypeId?: string;
  states?: FaceNoveltyState[];
}

export interface NoveltyRepository {
  /** Persist a new record.  Record id must be provided by caller (uuid). */
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

/** In-memory implementation — suitable for tests and ephemeral server routes. */
export class MemoryNoveltyRepository implements NoveltyRepository {
  private readonly records = new Map<string, FaceNoveltyRecord>();

  async upsert(record: FaceNoveltyRecord): Promise<void> {
    this.records.set(record.id, { ...record });
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

  async findMany(filter: NoveltyRecordFilter): Promise<FaceNoveltyRecord[]> {
    const results: FaceNoveltyRecord[] = [];
    for (const record of this.records.values()) {
      if (record.workspaceId !== filter.workspaceId) continue;
      if (filter.archetypeId && record.archetypeId !== filter.archetypeId) continue;
      if (filter.states && !filter.states.includes(record.state)) continue;
      results.push({ ...record });
    }
    return results;
  }

  async findByCandidateId(
    candidateId: string,
    workspaceId: string,
  ): Promise<FaceNoveltyRecord | null> {
    for (const record of this.records.values()) {
      if (record.candidateId === candidateId && record.workspaceId === workspaceId) {
        return { ...record };
      }
    }
    return null;
  }

  async findByAssetId(assetId: string, workspaceId: string): Promise<FaceNoveltyRecord | null> {
    for (const record of this.records.values()) {
      if (record.assetId === assetId && record.workspaceId === workspaceId) {
        return { ...record };
      }
    }
    return null;
  }
}
