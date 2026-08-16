/**
 * Phase 2.5B.8 — Load candidate embedding for freshness scoring (server-only).
 * Soft-fails to null. Never returns embeddings to the client.
 * No image provider calls.
 */

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Load the stored face embedding for a candidate novelty record.
 */
export async function loadCandidateFaceEmbedding(input: {
  workspaceId: string;
  candidateId: string;
}): Promise<number[] | null> {
  const workspaceId = input.workspaceId.trim();
  const candidateId = input.candidateId.trim();
  if (!workspaceId || !candidateId) return null;

  try {
    const client = createAdminClient();
    const { data, error } = await client
      .from("persona_face_novelty_records")
      .select("face_embedding")
      .eq("workspace_id", workspaceId)
      .eq("candidate_id", candidateId)
      .not("face_embedding", "is", null)
      .maybeSingle();

    if (error || !data) return null;
    if (!Array.isArray(data.face_embedding) || data.face_embedding.length === 0) {
      return null;
    }
    return data.face_embedding as number[];
  } catch {
    return null;
  }
}
