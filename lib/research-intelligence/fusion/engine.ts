import { evaluateResearchIntelligence } from "../evaluation";
import { buildContributionManifest } from "../normalization/interfaces";
import type { NormalizedProviderIntelligence } from "../normalization/interfaces";
import {
  mergeDomainSlices,
  mergeSignals,
} from "../intelligence/bundle";
import {
  emptyConfidenceIntelligence,
  emptyRecommendationIntelligence,
  UNIFIED_INTELLIGENCE_VERSION,
} from "../types";
import type { FusionManifest, UnifiedResearchIntelligence } from "../types";
import type { FusionEngineConfig, FusionInput } from "./types";
import { FUSION_ENGINE_VERSION } from "./types";

function buildManifest(
  normalized: NormalizedProviderIntelligence[],
  generatedAt: string,
): FusionManifest {
  const contributions = normalized.map(buildContributionManifest);
  const liveProviderCount = normalized.filter(
    (item) => item.provenance.mode === "live",
  ).length;

  return {
    engineVersion: FUSION_ENGINE_VERSION,
    generatedAt,
    providerCount: normalized.length,
    liveProviderCount,
    simulatedProviderCount: normalized.length - liveProviderCount,
    contributions,
  };
}

/**
 * Provider-agnostic fusion core.
 *
 * Accepts ONLY normalized intelligence — never raw provider payloads,
 * never provider-specific branches, never adapter imports.
 *
 * Phase 5.0: structural assembly (concatenation + dedupe).
 * Confidence scoring is applied by the evaluation layer after fusion.
 */
export class FusionEngine {
  constructor(private readonly config: FusionEngineConfig = {}) {}

  fuse(
    normalized: NormalizedProviderIntelligence[],
    input: FusionInput,
  ): UnifiedResearchIntelligence {
    void this.config;

    const domains = mergeDomainSlices(normalized);
    const manifest = buildManifest(normalized, input.generatedAt);

    return {
      version: UNIFIED_INTELLIGENCE_VERSION,
      generatedAt: input.generatedAt,
      manifest,
      signals: mergeSignals(normalized),
      trends: domains.trends,
      market: domains.market,
      commercial: domains.commercial,
      brand: domains.brand,
      confidence: emptyConfidenceIntelligence(),
      recommendations: emptyRecommendationIntelligence(),
    };
  }
}

export function createFusionEngine(
  config?: FusionEngineConfig,
): FusionEngine {
  return new FusionEngine(config);
}

export function fuseNormalizedIntelligence(
  normalized: NormalizedProviderIntelligence[],
  generatedAt: string = new Date().toISOString(),
): UnifiedResearchIntelligence {
  const fused = createFusionEngine().fuse(normalized, { generatedAt });
  return evaluateResearchIntelligence(fused, { generatedAt }).intelligence;
}
