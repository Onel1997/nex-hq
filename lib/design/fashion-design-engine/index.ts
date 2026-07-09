/**
 * Fashion Design Engine V2 — internal AI fashion design system for premium streetwear.
 *
 * Powers master artwork generation behind the existing Design Studio workflow.
 * User-facing flow unchanged: Research → Directions → Winner → Master Artwork → Commercial Review → Print Ready.
 */

export { runFashionDesignEngine, type RunFashionDesignEngineOptions } from "./pipeline";
export { buildMasterArtworkPromptFromEngine } from "./prompt-builder";
export { buildResearchHandoffContext, type ResearchHandoffContext } from "./research-handoff";
export {
  FASHION_ENGINE_UI_STEPS,
  createFashionEngineProgress,
  advanceFashionEngineProgress,
  startFashionEngineProgress,
} from "./progress";
export { FASHION_ENGINE_VERSION } from "./types";

export type {
  FashionDesignEngineInput,
  FashionDesignEngineResult,
  FashionEngineAgentId,
  FashionEngineProgressStep,
  CreativeDesignBrief,
  LayoutSpec,
  TypographySpec,
  GraphicSpec,
  CompositionSpec,
  PrintSpec,
  FashionCommercialAssessment,
  TypographyBlock,
  FontRecommendation,
  PanelLayout,
  GraphicSymbol,
  LineSystem,
  PrintProductionMetadata,
} from "./types";

export {
  runCreativeDirectorAgent,
  runArtDirectorAgent,
  runTypographyDesignerAgent,
  runGraphicDesignerAgent,
  runCompositionEngine,
  runFashionCommercialDirectorAgent,
  runPrintProductionAgent,
} from "./agents";
