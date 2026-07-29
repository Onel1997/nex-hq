/**
 * Face-similarity provider architecture — Layer B novelty.
 *
 * This adapter interface is ready for a real face-embedding provider.
 * The default implementation returns `not_available` honestly.
 *
 * DO NOT connect a paid provider here.  No OpenAI / external vision calls.
 * Future adapters may include:
 *   - dedicated face-embedding model
 *   - local face-recognition embedding
 *   - external vision provider (requires explicit cost review)
 *
 * Do not use OpenAI text scoring as a proxy for face similarity.
 */

import type {
  CandidateAssetReference,
  FaceSimilarityEvaluator,
  FaceSimilarityResult,
} from "./types";

/**
 * Null evaluator — always returns not_available.
 * Used until a real face-similarity provider is wired.
 */
export class NullFaceSimilarityEvaluator implements FaceSimilarityEvaluator {
  readonly method = "none";
  readonly version = "0.0.0";

  async evaluate(_input: {
    candidateAsset: CandidateAssetReference;
    comparisonAssets: CandidateAssetReference[];
  }): Promise<FaceSimilarityResult> {
    return {
      status: "not_available",
      method: this.method,
    };
  }
}

/**
 * Resolve the active face-similarity evaluator.
 *
 * Currently always returns NullFaceSimilarityEvaluator.
 * Future: check env flag or registry for a real adapter.
 */
export function resolveFaceSimilarityEvaluator(): FaceSimilarityEvaluator {
  return new NullFaceSimilarityEvaluator();
}
