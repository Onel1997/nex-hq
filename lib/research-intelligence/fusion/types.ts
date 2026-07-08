import type { FusionManifest, UnifiedResearchIntelligence } from "../types";

export const FUSION_ENGINE_VERSION = "5.0.0";

export interface FusionEngineConfig {
  /** Reserved for Phase 5.1+ provider weighting — not used in Phase 5.0. */
  enableWeighting?: boolean;
}

export interface FusionInput {
  generatedAt: string;
}

export interface FusionOutput {
  intelligence: UnifiedResearchIntelligence;
  manifest: FusionManifest;
}
