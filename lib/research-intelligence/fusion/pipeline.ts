import { evaluateResearchIntelligence } from "../evaluation";
import { assembleIntelligenceBundle } from "../intelligence/bundle";
import type { NormalizationContext } from "../normalization/context";
import type { ProviderIntelligenceEnvelope } from "../normalization/envelope";
import { createNormalizerRegistry, type NormalizerRegistry } from "../normalization/registry";
import type { RecommendationIntelligence, ResearchReasoningIntelligence, UnifiedResearchIntelligence } from "../types";
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
  reasoning: ResearchReasoningIntelligence;
  recommendations: RecommendationIntelligence;
  bundleProviderCount: number;
  bundleSignalCount: number;
}

/**
 * Orchestrates the Phase 5.0 intelligence stack:
 *
 * Provider envelopes → Normalization → Intelligence bundle → Fusion
 *
 * Phase 5.1: confidence scoring and reasoning.
 * Phase 5.2: recommendations applied after evaluation.
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
    const fused = this.fusion.fuse(normalized, { generatedAt });
    const evaluated = evaluateResearchIntelligence(fused, {
      workspaceId: context.workspaceId,
      locale: context.locale,
      generatedAt,
    });

    return {
      intelligence: evaluated.intelligence,
      reasoning: evaluated.reasoning,
      recommendations: evaluated.recommendations,
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
