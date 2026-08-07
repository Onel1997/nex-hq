/**
 * Live evaluator resolver — server-only.
 *
 * Returns a LocalFaceEmbeddingEvaluator loaded with all prior workspace
 * embeddings.  Never returns NullFaceSimilarityEvaluator for live discovery.
 *
 * If the evaluator cannot be initialised this function throws — callers must
 * not silently swallow the error and fall back to the null evaluator.
 *
 * Import this ONLY from server-side modules (API routes, server actions,
 * creation-service.ts).  Never import in client bundles.
 */

import type { FaceSimilarityEvaluator } from "./types";
import { LocalFaceEmbeddingEvaluator } from "./local-face-embedding-evaluator";
import { SupabaseEmbeddingRepository } from "./supabase-embedding-repository";
import type { StoredEmbeddingRef } from "./local-face-embedding-evaluator";

export interface LiveEvaluatorConfig {
  workspaceId: string;
  archetypeId: string;
  /** Map<assetId, signedUrl> for the candidate image being evaluated. */
  imageSourceMap?: Map<string, string>;
  /**
   * Phase 2.2G — current discovery project id so same-run allowed faces
   * remain in the biological comparison pool.
   */
  currentCreationProjectId?: string;
}

/**
 * Build the live LocalFaceEmbeddingEvaluator with prior embeddings loaded
 * from the Supabase workspace.
 *
 * Throws if:
 *   - workspace or archetypeId are missing
 *   - the embedding repository is unreachable
 *   - (model load failures surface lazily on first evaluate() call)
 */
export async function buildLiveFaceEvaluator(
  config: LiveEvaluatorConfig,
): Promise<FaceSimilarityEvaluator> {
  if (!config.workspaceId) {
    throw new Error(
      "Face novelty: workspaceId required for live evaluator — cannot use null fallback",
    );
  }
  if (!config.archetypeId) {
    throw new Error(
      "Face novelty: archetypeId required for live evaluator — cannot use null fallback",
    );
  }

  const embeddingRepo = new SupabaseEmbeddingRepository();
  let priorEmbeddings: StoredEmbeddingRef[];
  try {
    priorEmbeddings = await embeddingRepo.loadEmbeddingsForWorkspace(
      config.workspaceId,
      config.archetypeId,
      { currentCreationProjectId: config.currentCreationProjectId },
    );
  } catch (err) {
    throw new Error(
      `Face novelty: failed to load prior embeddings for workspace ${config.workspaceId} — ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return new LocalFaceEmbeddingEvaluator(priorEmbeddings, config.imageSourceMap);
}

/**
 * Assert that an evaluator is NOT the null/disabled fallback.
 * Called at the point of live discovery to enforce the invariant.
 */
export function assertLiveFaceEvaluatorNotNull(
  evaluator: FaceSimilarityEvaluator,
  context: string,
): void {
  if (evaluator.constructor?.name === "NullFaceSimilarityEvaluator") {
    throw new Error(
      `Face novelty violation: NullFaceSimilarityEvaluator must not be used during live discovery (context: ${context})`,
    );
  }
}
