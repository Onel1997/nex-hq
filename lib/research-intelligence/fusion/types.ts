import type { FusionManifest, UnifiedResearchIntelligence } from "../types";

export const FUSION_ENGINE_VERSION = "5.0.0";

export interface FusionEngineConfig {
  /** Enables weighted signal ranking in downstream recommendation layer. */
  enableWeighting?: boolean;
}

export interface FusionInput {
  generatedAt: string;
}

export interface FusionOutput {
  intelligence: UnifiedResearchIntelligence;
  manifest: FusionManifest;
}
