export { runDesignQualityLayer } from "./pipeline";
export { renderPremiumGraphicSystems, countGraphicElements } from "./graphics/premium-graphics";
export { validateDesignRules, hasBlockingViolations } from "./rules/design-rules";
export { scoreDesignQuality } from "./scoring/quality-score";
export { selectCompositionTemplate, COMPOSITION_TEMPLATES } from "./templates/registry";
export { adjustCompositionForQuality } from "./adjust";

export type {
  CompositionTemplateId,
  DesignQualityScore,
  DesignQualityLayerInput,
  DesignQualityLayerResult,
  CompositionTemplate,
} from "./types";

export {
  DESIGN_QUALITY_LAYER_VERSION,
  QUALITY_PASS_THRESHOLD,
  MAX_QUALITY_ATTEMPTS,
} from "./types";
