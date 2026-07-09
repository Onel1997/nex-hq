export type {
  AiDesignerInput,
  AiDesignerResult,
  CommercialDirectionInput,
  CompositionLanguageProfile,
  CreativeDirectionSpec,
  DesignConcept,
  DesignConceptReview,
  FashionLanguageProfile,
  HeroFocusSpec,
  MockupPromptSpec,
  NegativeSpaceProfileSpec,
  OrnamentLanguageProfile,
  PremiumImagePromptSpec,
  ProductionNotesSpec,
  RenderDeliverable,
  RenderDeliverableKind,
  RenderPlan,
  ResearchContext,
  SymbolLanguageProfile,
  TypographyLanguageProfile,
} from "@/lib/design/ai-designer/types";

export { buildBrandDnaProfile, type BrandDnaProfile } from "@/lib/design/ai-designer/brand-dna";
export { buildFashionLanguage } from "@/lib/design/ai-designer/fashion-language";
export { buildCompositionLanguage } from "@/lib/design/ai-designer/composition-builder";
export {
  buildCreativeDirection,
  buildTypographyLanguage,
  buildSymbolLanguage,
  buildOrnamentLanguage,
} from "@/lib/design/ai-designer/style-builder";
export {
  generateDesignConcept,
  attachPromptsToConcept,
} from "@/lib/design/ai-designer/concept-generator";
export {
  buildImagePrompts,
  buildMockupPrompts,
  buildAllPrompts,
} from "@/lib/design/ai-designer/prompt-builder";
export { buildRenderPlan } from "@/lib/design/ai-designer/render-plan";
export { reviewDesignConcept } from "@/lib/design/ai-designer/review";
export {
  runAiDesigner,
  createDesignConcept,
  conceptToStudioBrief,
} from "@/lib/design/ai-designer/designer";

/**
 * Phase 2 — AI Designer
 *
 * Primary creative engine. Produces DesignConcept blueprints.
 * Does NOT generate SVG or images.
 *
 * Master artwork pipeline (Design Studio V2):
 *   DesignConcept → Fashion Design Engine → GPT Image → Commercial Review
 *   @see lib/design/fashion-design-engine
 *
 * Future vector pipeline:
 *   TypographySpec / LayoutSpec / GraphicSpec → SVG export (Phase 3)
 */
