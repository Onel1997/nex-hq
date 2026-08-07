/**
 * Embedding repository — load and persist face embeddings.
 * Server-side only. Never expose embeddings to the client.
 *
 * Embeddings are stored as JSONB arrays in the novelty records table.
 * They are loaded only to build the comparison set for a new candidate.
 */

import type { StoredEmbeddingRef } from "./local-face-embedding-evaluator";
import type { FaceDetectionStatus } from "./similarity-threshold";
import {
  isEmbeddingEligibleForComparison,
  normalizeHistoricalProtectionStatus,
  type HistoricalFaceProtectionStatus,
  type NoveltyLiveEvidenceShape,
} from "./historical-protection";

export interface EmbeddingUpdate {
  noveltyRecordId: string;
  workspaceId: string;
  embedding: number[];
  embeddingDimension: number;
  embeddingModel: string;
  embeddingVersion: string;
  detectionConfidence: number;
  faceCount: number;
  detectionStatus: FaceDetectionStatus;
  similarityThresholdVersion: string;
  /** Optional eligibility context (memory repo + audit). */
  assetId?: string;
  candidateId?: string;
  creationProjectId?: string;
  historicalProtectionStatus?: HistoricalFaceProtectionStatus;
  liveEvaluationEvidence?: NoveltyLiveEvidenceShape;
}

export type LoadEmbeddingsOptions = {
  /** When set, same-run allowed faces from this project also enter the pool. */
  currentCreationProjectId?: string;
};

export interface EmbeddingRepository {
  /** Persist an embedding for a novelty record. Called once after extraction. */
  saveEmbedding(update: EmbeddingUpdate): Promise<void>;
  /** Load embeddings eligible for biological comparison. */
  loadEmbeddingsForWorkspace(
    workspaceId: string,
    archetypeId?: string,
    options?: LoadEmbeddingsOptions,
  ): Promise<StoredEmbeddingRef[]>;
  /** Check if a record already has a stored embedding. */
  hasEmbedding(noveltyRecordId: string, workspaceId: string): Promise<boolean>;
}

type MemoryEmbeddingRow = EmbeddingUpdate & {
  archetypeId?: string;
  assetId?: string;
  candidateId?: string;
  creationProjectId?: string;
  historicalProtectionStatus?: HistoricalFaceProtectionStatus;
  liveEvaluationEvidence?: NoveltyLiveEvidenceShape;
};

/** In-memory embedding repository — for tests. Never stores real biometrics. */
export class MemoryEmbeddingRepository implements EmbeddingRepository {
  private readonly embeddings = new Map<string, MemoryEmbeddingRow>();

  async saveEmbedding(update: EmbeddingUpdate): Promise<void> {
    const existing = this.embeddings.get(update.noveltyRecordId);
    this.embeddings.set(update.noveltyRecordId, {
      ...(existing ?? {}),
      ...update,
    });
  }

  async loadEmbeddingsForWorkspace(
    workspaceId: string,
    _archetypeId?: string,
    options?: LoadEmbeddingsOptions,
  ): Promise<StoredEmbeddingRef[]> {
    const results: StoredEmbeddingRef[] = [];
    for (const [id, e] of this.embeddings) {
      if (e.workspaceId !== workspaceId) continue;
      if (
        !isEmbeddingEligibleForComparison({
          liveEvaluationEvidence: e.liveEvaluationEvidence,
          historicalProtectionStatus: normalizeHistoricalProtectionStatus(
            e.historicalProtectionStatus,
          ),
          creationProjectId: e.creationProjectId,
          currentCreationProjectId: options?.currentCreationProjectId,
        })
      ) {
        continue;
      }
      results.push({
        assetId: e.assetId ?? id,
        candidateId: e.candidateId ?? id,
        embedding: e.embedding,
      });
    }
    return results;
  }

  async hasEmbedding(noveltyRecordId: string, workspaceId: string): Promise<boolean> {
    const e = this.embeddings.get(noveltyRecordId);
    return !!(e && e.workspaceId === workspaceId);
  }

  /** Test helper: store with asset/candidate + Phase 2.2G eligibility context. */
  saveWithContext(
    update: EmbeddingUpdate & {
      assetId: string;
      candidateId: string;
      creationProjectId?: string;
      historicalProtectionStatus?: HistoricalFaceProtectionStatus;
      liveEvaluationEvidence?: NoveltyLiveEvidenceShape;
    },
  ): void {
    this.embeddings.set(update.noveltyRecordId, { ...update });
  }
}
