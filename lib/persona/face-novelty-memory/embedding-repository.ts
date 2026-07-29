/**
 * Embedding repository — load and persist face embeddings.
 * Server-side only. Never expose embeddings to the client.
 *
 * Embeddings are stored as JSONB arrays in the novelty records table.
 * They are loaded only to build the comparison set for a new candidate.
 */

import type { StoredEmbeddingRef } from "./local-face-embedding-evaluator";
import type { FaceDetectionStatus } from "./similarity-threshold";

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
}

export interface EmbeddingRepository {
  /** Persist an embedding for a novelty record. Called once after extraction. */
  saveEmbedding(update: EmbeddingUpdate): Promise<void>;
  /** Load all embeddings for the given workspace (for comparison). */
  loadEmbeddingsForWorkspace(
    workspaceId: string,
    archetypeId?: string,
  ): Promise<StoredEmbeddingRef[]>;
  /** Check if a record already has a stored embedding. */
  hasEmbedding(noveltyRecordId: string, workspaceId: string): Promise<boolean>;
}

/** In-memory embedding repository — for tests. Never stores real biometrics. */
export class MemoryEmbeddingRepository implements EmbeddingRepository {
  private readonly embeddings = new Map<
    string,
    EmbeddingUpdate & { archetypeId?: string; assetId?: string; candidateId?: string }
  >();

  async saveEmbedding(update: EmbeddingUpdate): Promise<void> {
    this.embeddings.set(update.noveltyRecordId, { ...update });
  }

  async loadEmbeddingsForWorkspace(
    workspaceId: string,
    _archetypeId?: string,
  ): Promise<StoredEmbeddingRef[]> {
    const results: StoredEmbeddingRef[] = [];
    for (const [id, e] of this.embeddings) {
      if (e.workspaceId !== workspaceId) continue;
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

  /** Test helper: store with asset/candidate context. */
  saveWithContext(
    update: EmbeddingUpdate & { assetId: string; candidateId: string },
  ): void {
    this.embeddings.set(update.noveltyRecordId, { ...update });
  }
}
