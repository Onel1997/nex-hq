/**
 * Phase 2.5B.6 — Load recent Urban discovery embeddings for fresh-face bias.
 * Server-only. Soft-fails to empty (prompt still gets seed facial emphases).
 * No image provider calls.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { URBAN_ARCHETYPE_ID } from "@/lib/persona/identity-blueprints/urban-slot-blueprints";
import { normalizeHistoricalProtectionStatus } from "@/lib/persona/face-novelty-memory/historical-protection";
import type { UrbanFaceEmbeddingSample } from "./urban-fresh-face-dna";

const TABLE = "persona_face_novelty_records";

/**
 * Load unprotected Urban discovery face embeddings for prompt bias.
 * Excludes selected/locked/approved Brand Models (hard path stays separate).
 */
export async function loadUrbanFreshFaceBiasSamples(input: {
  workspaceId: string;
  archetypeId?: string;
  currentCreationProjectId: string;
}): Promise<UrbanFaceEmbeddingSample[]> {
  const workspaceId = input.workspaceId.trim();
  if (!workspaceId) return [];

  try {
    const client = createAdminClient();
    const archetypeId = (input.archetypeId ?? URBAN_ARCHETYPE_ID).trim();
    const { data, error } = await client
      .from(TABLE)
      .select(
        "candidate_id, creation_project_id, face_embedding, historical_protection_status, created_at, face_embedding_created_at",
      )
      .eq("workspace_id", workspaceId)
      .eq("archetype_id", archetypeId)
      .not("face_embedding", "is", null)
      .order("created_at", { ascending: false })
      .limit(80);

    if (error || !data) return [];

    const samples: UrbanFaceEmbeddingSample[] = [];
    for (const row of data) {
      const projectId =
        typeof row.creation_project_id === "string"
          ? row.creation_project_id
          : "";
      if (!projectId || projectId === input.currentCreationProjectId) continue;
      if (!Array.isArray(row.face_embedding) || row.face_embedding.length === 0) {
        continue;
      }
      samples.push({
        creationProjectId: projectId,
        candidateId: String(row.candidate_id ?? ""),
        embedding: row.face_embedding as number[],
        historicalProtectionStatus: normalizeHistoricalProtectionStatus(
          row.historical_protection_status,
        ),
        createdAt:
          (typeof row.face_embedding_created_at === "string"
            ? row.face_embedding_created_at
            : null) ??
          (typeof row.created_at === "string" ? row.created_at : null),
      });
    }
    return samples;
  } catch {
    // Soft-fail — recipe still gets deterministic facial emphases.
    return [];
  }
}
