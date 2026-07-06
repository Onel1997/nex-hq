import type {
  CompositionSpec,
  FashionCommercialAssessment,
  GraphicSpec,
  LayoutSpec,
  PrintSpec,
  TypographySpec,
} from "@/lib/design/fashion-design-engine/types";

export interface VectorArtworkRenderInput {
  designId: string;
  title: string;
  typographySpec: TypographySpec;
  layoutSpec: LayoutSpec;
  graphicSpec: GraphicSpec;
  compositionSpec: CompositionSpec;
  printSpec: PrintSpec;
  commercialAssessment?: FashionCommercialAssessment;
  /** Include dashed safe-zone guides in SVG (hidden in production export). */
  includeLayoutGuides?: boolean;
}

export interface TypographyValidationIssue {
  code:
    | "missing-text"
    | "extra-text"
    | "spelling-mismatch"
    | "brand-mismatch"
    | "forbidden-text"
    | "image-text"
    | "empty-block";
  message: string;
  expected?: string;
  received?: string;
}

export interface TypographyValidationResult {
  valid: boolean;
  textSafe: boolean;
  blockCount: number;
  renderedTexts: string[];
  expectedTexts: string[];
  issues: TypographyValidationIssue[];
}

export interface VectorCommercialMetadata {
  overallScore: number;
  approved: boolean;
  compositionScore: number;
  explanations: string[];
  inkColors: string[];
  productionMethod: string;
}

export interface VectorArtworkExportState {
  formats: {
    svg: { ready: boolean; mimeType: "image/svg+xml" };
    pngTransparent: { ready: boolean; placeholder: boolean };
    pdf: { ready: false; future: true };
  };
  printSizeMm: { width: number; height: number };
  safeMarginsMm: { top: number; right: number; bottom: number; left: number };
  inkColors: string[];
  dpi: number;
  designId: string;
  generatedAt: string;
  label: "Vector Artwork — Text Safe";
}

export interface VectorArtworkRenderResult {
  svgString: string;
  /** Browser preview — SVG data URL until PNG rasterization is wired. */
  transparentPngPreview?: string;
  width: number;
  height: number;
  printDimensions: { widthMm: number; heightMm: number };
  typographyValidation: TypographyValidationResult;
  commercialMetadata: VectorCommercialMetadata;
  exportState: VectorArtworkExportState;
}

export interface VectorArtworkValidationResult {
  valid: boolean;
  typography: TypographyValidationResult;
  issues: string[];
}
