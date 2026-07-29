/**
 * Supabase embedding repository — server-only.
 * Stores and loads face embeddings via the admin client.
 * Embeddings are NEVER returned to the client.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { PersonaDomainError } from "../domain/errors";
import type { EmbeddingRepository, EmbeddingUpdate } from "./embedding-repository";
import type { StoredEmbeddingRef } from "./local-face-embedding-evaluator";

const TABLE = "persona_face_novelty_records";

function throwDb(error: { message: string } | null, msg: string) {
  if (error) throw new PersonaDomainError(msg, "VALIDATION", { message: error.message });
}

export class SupabaseEmbeddingRepository implements EmbeddingRepository {
  async saveEmbedding(update: EmbeddingUpdate): Promise<void> {
    const client = createAdminClient();
    const { error } = await client
      .from(TABLE)
      .update({
        face_embedding: update.embedding,
        face_embedding_dimension: update.embeddingDimension,
        face_embedding_model: update.embeddingModel,
        face_embedding_version: update.embeddingVersion,
        face_embedding_created_at: new Date().toISOString(),
        face_detection_confidence: update.detectionConfidence,
        face_count: update.faceCount,
        face_detection_status: update.detectionStatus,
        similarity_threshold_version: update.similarityThresholdVersion,
      })
      .eq("id", update.noveltyRecordId)
      .eq("workspace_id", update.workspaceId);
    throwDb(error, "Failed to save face embedding");
  }

  async loadEmbeddingsForWorkspace(
    workspaceId: string,
    archetypeId?: string,
  ): Promise<StoredEmbeddingRef[]> {
    const client = createAdminClient();
    let query = client
      .from(TABLE)
      .select("asset_id, candidate_id, face_embedding")
      .eq("workspace_id", workspaceId)
      .not("face_embedding", "is", null)
      // Only compare against shown/exhausted/saved/approved/shortlisted/rejected
      .in("state", ["shown", "shortlisted", "saved", "rejected", "exhausted", "approved"]);

    if (archetypeId) {
      query = query.eq("archetype_id", archetypeId);
    }

    const { data, error } = await query;
    throwDb(error, "Failed to load face embeddings for workspace");
    if (!data) return [];

    return data
      .filter((row) => Array.isArray(row.face_embedding) && row.face_embedding.length > 0)
      .map((row) => ({
        assetId: String(row.asset_id),
        candidateId: String(row.candidate_id),
        embedding: row.face_embedding as number[],
      }));
  }

  async hasEmbedding(noveltyRecordId: string, workspaceId: string): Promise<boolean> {
    const client = createAdminClient();
    const { data, error } = await client
      .from(TABLE)
      .select("id")
      .eq("id", noveltyRecordId)
      .eq("workspace_id", workspaceId)
      .not("face_embedding", "is", null)
      .maybeSingle();
    throwDb(error, "Failed to check embedding existence");
    return !!data;
  }
}
