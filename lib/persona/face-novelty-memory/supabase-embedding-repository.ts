/**
 * Supabase embedding repository — server-only.
 * Stores and loads face embeddings via the admin client.
 * Embeddings are NEVER returned to the client.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { PersonaDomainError } from "../domain/errors";
import type {
  EmbeddingRepository,
  EmbeddingUpdate,
  LoadEmbeddingsOptions,
} from "./embedding-repository";
import type { StoredEmbeddingRef } from "./local-face-embedding-evaluator";
import { resolveHistoricalNoveltyArchetypeFilter } from "./historical-backfill-archetype-filter";
import { isEmbeddingEligibleForComparison } from "./embedding-comparison-eligibility";
import { normalizeHistoricalProtectionStatus } from "./historical-protection";

const TABLE = "persona_face_novelty_records";
const FORBIDDEN_STATES = [
  "shown",
  "shortlisted",
  "saved",
  "rejected",
  "exhausted",
  "approved",
] as const;

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
    options?: LoadEmbeddingsOptions,
  ): Promise<StoredEmbeddingRef[]> {
    const client = createAdminClient();

    // Phase 2.0C.2 — do not apply brand_role as archetype_id (returns empty).
    let matchingForRequested = 0;
    if (archetypeId?.trim()) {
      const { count, error: cErr } = await client
        .from(TABLE)
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("archetype_id", archetypeId.trim())
        .in("state", [...FORBIDDEN_STATES])
        .not("face_embedding", "is", null);
      throwDb(cErr, "Failed to count embeddings for requested archetype");
      matchingForRequested = count ?? 0;
    }
    const resolution = resolveHistoricalNoveltyArchetypeFilter({
      requestedArchetypeId: archetypeId,
      matchingRowCountForRequested: matchingForRequested,
    });

    let query = client
      .from(TABLE)
      .select(
        "asset_id, candidate_id, face_embedding, live_evaluation_evidence, creation_project_id, historical_protection_status",
      )
      .eq("workspace_id", workspaceId)
      .not("face_embedding", "is", null)
      // Candidate rows that may hold embeddings; eligibility filters further.
      .in("state", [...FORBIDDEN_STATES]);

    if (resolution.effectiveArchetypeId) {
      query = query.eq("archetype_id", resolution.effectiveArchetypeId);
    }

    const { data, error } = await query;
    throwDb(error, "Failed to load face embeddings for workspace");
    if (!data) return [];

    return data
      .filter((row) =>
        isEmbeddingEligibleForComparison({
          liveEvaluationEvidence: row.live_evaluation_evidence as
            | { finalDecision?: string }
            | null,
          historicalProtectionStatus: normalizeHistoricalProtectionStatus(
            row.historical_protection_status,
          ),
          creationProjectId:
            typeof row.creation_project_id === "string"
              ? row.creation_project_id
              : null,
          currentCreationProjectId: options?.currentCreationProjectId,
        }),
      )
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
