import { assembleIntelligenceBundle } from "../intelligence/bundle";
import type { NormalizationContext } from "../normalization/context";
import type { ProviderIntelligenceEnvelope } from "../normalization/envelope";
import { createNormalizerRegistry, type NormalizerRegistry } from "../normalization/registry";
import type { UnifiedResearchIntelligence } from "../types";
import { createFusionEngine, type FusionEngine } from "./engine";
import type { FusionEngineConfig } from "./types";

export interface ResearchIntelligencePipelineConfig {
  fusion?: FusionEngineConfig;
}

export interface PipelineRunInput {
  envelopes: ProviderIntelligenceEnvelope[];
  context?: Partial<NormalizationContext>;
}

export interface PipelineRunResult {
  intelligence: UnifiedResearchIntelligence;
  bundleProviderCount: number;
  bundleSignalCount: number;
}

/**
 * Orchestrates the Phase 5.0 intelligence stack:
 *
 * Provider envelopes → Normalization → Intelligence bundle → Fusion
 *
 * Reasoning and Recommendation layers are NOT invoked in Phase 5.0.
 */
export class ResearchIntelligencePipeline {
  private readonly normalizers: NormalizerRegistry;
  private readonly fusion: FusionEngine;

  constructor(
    normalizers: NormalizerRegistry = createNormalizerRegistry(),
    fusion: FusionEngine = createFusionEngine(),
  ) {
    this.normalizers = normalizers;
    this.fusion = fusion;
  }

  static create(
    config: ResearchIntelligencePipelineConfig = {},
  ): ResearchIntelligencePipeline {
    return new ResearchIntelligencePipeline(
      createNormalizerRegistry(),
      createFusionEngine(config.fusion),
    );
  }

  withNormalizers(normalizers: NormalizerRegistry): ResearchIntelligencePipeline {
    return new ResearchIntelligencePipeline(normalizers, this.fusion);
  }

  run(input: PipelineRunInput): PipelineRunResult {
    const generatedAt = input.context?.generatedAt ?? new Date().toISOString();
    const context: NormalizationContext = {
      workspaceId: input.context?.workspaceId,
      locale: input.context?.locale ?? "en",
      region: input.context?.region ?? "DE",
      requestedDomains: input.context?.requestedDomains,
      generatedAt,
    };

    const normalized = this.normalizers.normalizeMany(input.envelopes, context);
    const bundle = assembleIntelligenceBundle(normalized);
    const intelligence = this.fusion.fuse(normalized, { generatedAt });

    return {
      intelligence,
      bundleProviderCount: bundle.providerCount,
      bundleSignalCount: bundle.signalCount,
    };
  }
}

export function runResearchIntelligencePipeline(
  input: PipelineRunInput,
  config?: ResearchIntelligencePipelineConfig,
): PipelineRunResult {
  return ResearchIntelligencePipeline.create(config).run(input);
}
