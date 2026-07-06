export type AnalysisStatus = "idle" | "analyzing" | "complete" | "unavailable" | "error";

export type TypographyStyle =
  | "Luxury"
  | "Editorial"
  | "Streetwear"
  | "Vintage"
  | "Technical"
  | "Minimal"
  | "Bold"
  | "Industrial";

export type GraphicStyleLabel =
  | "Typography driven"
  | "Illustration"
  | "Minimal"
  | "Technical"
  | "Grunge"
  | "Vintage"
  | "Luxury"
  | "Badge"
  | "Monogram"
  | "Editorial"
  | "Streetwear"
  | "Mixed";

export type PrintPlacement =
  | "Center chest"
  | "Back panel"
  | "Sleeve"
  | "Oversized front"
  | "Pocket"
  | "Full back"
  | "Unknown";

export interface ColorSwatch {
  hex: string;
  rgb: [number, number, number];
  role: "primary" | "secondary" | "accent" | "neutral" | "background";
  percentage: number;
}

export interface TypographyBlock {
  role: "headline" | "subheadline" | "supporting" | "unknown";
  content: string;
  fontSize?: number;
  fontFamily?: string;
  letterSpacing?: string;
  alignment?: string;
}

export interface TypographyAnalysis {
  detected: boolean;
  style: TypographyStyle;
  blocks: TypographyBlock[];
  hierarchyScore: number;
  letterSpacing: "Tight" | "Normal" | "Wide" | "Unknown";
  alignment: "Left" | "Center" | "Right" | "Mixed" | "Unknown";
  summary: string;
}

export interface ColorPaletteAnalysis {
  swatches: ColorSwatch[];
  contrastScore: number;
  printFriendliness: number;
  summary: string;
}

export interface CompositionAnalysis {
  balanceScore: number;
  negativeSpacePercent: number;
  visualWeight: "Light" | "Balanced" | "Heavy";
  focalPoint: { x: number; y: number; label: string };
  readingDirection: "Top-down" | "Center-out" | "Left-right" | "Radial";
  alignment: "Symmetric" | "Asymmetric" | "Centered";
  symmetryScore: number;
  qualityScore: number;
  summary: string;
}

export interface GraphicStyleAnalysis {
  primary: GraphicStyleLabel;
  secondary?: GraphicStyleLabel;
  badges: GraphicStyleLabel[];
  summary: string;
}

export interface PrintAnalysis {
  placement: PrintPlacement;
  coveragePercent: number;
  maxPrintSize: string;
  coverageLabel: "Low" | "Medium" | "High" | "Oversized";
  summary: string;
}

export interface CommercialAnalysis {
  luxuryFeel: number;
  commercialPotential: number;
  brandConsistency: number;
  trendPotential: number;
  productionRisk: number;
  manufacturingDifficulty: number;
  summary: string;
}

export interface BrandDnaAnalysis {
  overallScore: number;
  traits: Array<{
    label: string;
    score: number;
    match: boolean;
  }>;
  summary: string;
}

export interface CreativeAnalysis {
  targetAudience: string;
  emotion: string;
  storytelling: string;
  complexity: "Low" | "Medium" | "High";
  luxuryPositioning: number;
  visualHierarchy: number;
  manufacturingComplexity: number;
}

export interface AnalysisSuggestion {
  id: string;
  message: string;
  optional: true;
}

export interface ArtworkAnalysisResult {
  status: AnalysisStatus;
  error?: string;
  typography: TypographyAnalysis;
  colorPalette: ColorPaletteAnalysis;
  composition: CompositionAnalysis;
  graphicStyle: GraphicStyleAnalysis;
  print: PrintAnalysis;
  commercial: CommercialAnalysis;
  brandDna: BrandDnaAnalysis;
  creative: CreativeAnalysis;
  suggestions: AnalysisSuggestion[];
  analyzedAt?: string;
}

export interface ArtworkPixelData {
  width: number;
  height: number;
  imageData: ImageData;
}
