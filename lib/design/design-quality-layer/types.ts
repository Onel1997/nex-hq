import type {
  CompositionSpec,
  FashionDesignEngineResult,
  GraphicSpec,
  LayoutSpec,
  TypographySpec,
} from "@/lib/design/fashion-design-engine/types";

export const DESIGN_QUALITY_LAYER_VERSION = "1.0.0";
export const QUALITY_PASS_THRESHOLD = 80;
export const MAX_QUALITY_ATTEMPTS = 3;

export type CompositionTemplateId =
  | "spine-typography"
  | "luxury-badge"
  | "editorial-back-print"
  | "abstract-perimeter"
  | "vintage-label"
  | "minimal-front-chest"
  | "oversized-center-back";

export interface DesignQualityScore {
  overall: number;
  typographyQuality: number;
  compositionQuality: number;
  brandFit: number;
  fashionRelevance: number;
  commercialStrength: number;
  printReadiness: number;
  kittlBenchmarkScore: number;
  passed: boolean;
  issues: string[];
  recommendations: string[];
}

export interface DesignQualityLayerInput {
  engine: FashionDesignEngineResult;
  generationMode?: "draft" | "production";
  maxAttempts?: number;
}

export interface DesignQualityLayerResult {
  typographySpec: TypographySpec;
  layoutSpec: LayoutSpec;
  graphicSpec: GraphicSpec;
  compositionSpec: CompositionSpec;
  templateId: CompositionTemplateId;
  templateLabel: string;
  qualityScore: DesignQualityScore;
  premiumGraphicsMarkup: string;
  attempts: number;
  /** UI label for export state. */
  exportLabel: "Premium Vector Artwork";
  textSafe: boolean;
  printReadyDraft: boolean;
}

export interface CompositionTemplateContext {
  engine: FashionDesignEngineResult;
  attempt: number;
}

export interface CompositionTemplate {
  id: CompositionTemplateId;
  label: string;
  description: string;
  matches: (ctx: CompositionTemplateContext) => number;
  apply: (ctx: CompositionTemplateContext) => {
    typographySpec: TypographySpec;
    layoutSpec: LayoutSpec;
    graphicSpec: GraphicSpec;
    compositionSpec: CompositionSpec;
  };
}
