import type { DesignStudioBrief, IntelligenceHandoffContext } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";
import type { FashionKnowledgePipelineResult } from "@/lib/design/fashion-knowledge/types";

/* ── Phase 3: Future vector pipeline interfaces ───────────────── */

/** Structured typography for SVG/vector rendering — never AI image text. */
export interface TypographySpec {
  /** Primary headline text blocks. */
  blocks: TypographyBlock[];
  /** Recommended font families (system or licensed). */
  fontRecommendations: FontRecommendation[];
  hierarchy: TypographyHierarchy;
  tracking: TypographyTracking;
  kerning: TypographyKerning;
  /** Luxury streetwear typography rules applied. */
  luxuryRules: string[];
  /** Explicit: do not render via image generation. */
  renderMode: "vector-only";
}

export interface TypographyBlock {
  id: string;
  role: "hero" | "secondary" | "micro" | "collection";
  content: string;
  fontFamily: string;
  fontWeight: number;
  fontSizeMm: number;
  letterSpacingMm: number;
  lineHeight: number;
  textTransform: "uppercase" | "lowercase" | "none";
  alignment: "left" | "center" | "right";
  opacity: number;
  /** Optional absolute position in panel mm — used by design quality layer templates. */
  positionMm?: { x: number; y: number };
  /** Optional rotation in degrees for spine / editorial layouts. */
  rotationDeg?: number;
}

export interface FontRecommendation {
  family: string;
  category: "editorial-serif" | "minimal-sans" | "condensed-grotesk" | "wide-tracked-sans";
  usage: string;
  luxurySignal: string;
}

export interface TypographyHierarchy {
  primary: string;
  secondary?: string;
  tertiary?: string;
  visualWeightDistribution: string;
}

export interface TypographyTracking {
  hero: string;
  secondary: string;
  micro: string;
  rationale: string;
}

export interface TypographyKerning {
  headlinePairs: string[];
  globalAdjustment: string;
  opticalBalance: string;
}

/** Print placement and garment layout specification. */
export interface LayoutSpec {
  printArea: "front" | "back" | "spine-back" | "left-chest" | "upper-back";
  frontLayout?: PanelLayout;
  backLayout?: PanelLayout;
  garmentBalance: GarmentBalance;
  negativeSpace: NegativeSpaceLayout;
  visualHierarchy: VisualHierarchyStep[];
  oversizedFitNotes: string[];
}

export interface PanelLayout {
  anchor: string;
  boundingBoxMm: { width: number; height: number };
  offsetFromCollarMm: number;
  offsetFromCenterMm: number;
  rotationDeg: number;
  safeMarginMm: number;
}

export interface GarmentBalance {
  visualWeight: "heavy-top" | "balanced" | "heavy-center" | "light-minimal";
  droppedShoulderCompensation: string;
  oversizedDrapeNotes: string;
}

export interface NegativeSpaceLayout {
  targetRatio: string;
  breathingZones: string[];
  forbiddenZones: string[];
}

export interface VisualHierarchyStep {
  order: number;
  element: string;
  rationale: string;
}

/** Reusable graphic language — symbols, lines, textures. Not raster images. */
export interface GraphicSpec {
  language: string;
  symbols: GraphicSymbol[];
  lineSystems: LineSystem[];
  textures: TextureEffect[];
  abstractElements: AbstractGraphicElement[];
  distressedEffects: DistressedEffect[];
  colorApplication: GraphicColorApplication[];
  designInstructions: string[];
}

export interface GraphicSymbol {
  id: string;
  name: string;
  abstraction: "geometric" | "organic" | "typographic-adjacent" | "architectural";
  meaning: string;
  strokeWidthMm: number;
  dimensionsMm: { width: number; height: number };
}

export interface LineSystem {
  id: string;
  type: "perimeter" | "axis" | "arc" | "grid" | "fragment";
  count: number;
  strokeWidthMm: number;
  spacingMm: number;
  opacity: number;
}

export interface TextureEffect {
  id: string;
  type: "grain" | "distress" | "halftone" | "tonal-fade" | "none";
  intensityPercent: number;
  application: string;
}

export interface AbstractGraphicElement {
  id: string;
  geometry: string;
  dimensionsMm: string;
  coordinates: string;
  layerOrder: number;
}

export interface DistressedEffect {
  enabled: boolean;
  intensityPercent: number;
  edgeTreatment: string;
  rationale: string;
}

export interface GraphicColorApplication {
  color: string;
  hex?: string;
  usage: string;
  opacity: number;
}

/** Balanced composition across typography, graphics, and whitespace. */
export interface CompositionSpec {
  score: number;
  balance: "symmetrical" | "asymmetrical";
  focalPoint: string;
  proportions: CompositionProportions;
  whitespaceDistribution: string;
  typographyGraphicRatio: string;
  garmentFitScore: number;
  issues: string[];
  recommendations: string[];
}

export interface CompositionProportions {
  typographyShare: number;
  graphicShare: number;
  negativeSpaceShare: number;
}

/** Future print/SVG production metadata — export not implemented yet. */
export interface PrintSpec {
  /** Future: SVG document reference. */
  futureSvgPath?: string;
  printDimensionsMm: { width: number; height: number };
  safeMarginsMm: { top: number; right: number; bottom: number; left: number };
  transparentAsset: boolean;
  productionMethod: string;
  colorCount: number;
  dpi: number;
  metadata: PrintProductionMetadata;
  /** Placeholder — vector export pipeline not yet wired. */
  vectorPipelineReady: boolean;
}

export interface PrintProductionMetadata {
  designId: string;
  product: string;
  color: string;
  printArea: string;
  inkColors: string[];
  bleedMm: number;
  registrationNotes: string[];
}

/* ── Agent outputs ───────────────────────────────────────────── */

export interface CreativeDesignBrief {
  emotionalCore: string;
  story: string;
  designPhilosophy: string;
  originalityAnalysis: OriginalityAnalysis;
  brandDnaValidation: BrandDnaValidation;
  moodKeywords: string[];
  antiPatterns: string[];
  collectionRole: string;
  targetEmotion: string;
}

export interface OriginalityAnalysis {
  score: number;
  uniqueElements: string[];
  competitorRisks: string[];
  differentiation: string;
}

export interface BrandDnaValidation {
  score: number;
  matches: string[];
  conflicts: string[];
  passed: boolean;
}

export interface FashionCommercialAssessment {
  overall: number;
  approved: boolean;
  dimensions: FashionCommercialDimension[];
  explanations: string[];
  milaeneDna: number;
  commercialPotential: number;
  originality: number;
  printability: number;
  fashionRelevance: number;
  socialMediaAppeal: number;
  podCompatibility: number;
}

export interface FashionCommercialDimension {
  id: string;
  label: string;
  score: number;
  explanation: string;
}

/* ── Pipeline types ────────────────────────────────────────────── */

export const FASHION_ENGINE_VERSION = "2.0.0";

export type FashionEngineAgentId =
  | "research-handoff"
  | "creative-director"
  | "art-director"
  | "typography-designer"
  | "graphic-designer"
  | "composition-engine"
  | "commercial-director"
  | "print-production"
  | "image-generation";

export interface FashionEngineProgressStep {
  id: FashionEngineAgentId;
  label: string;
  status: "pending" | "running" | "complete";
  completedAt?: string;
}

export interface FashionDesignEngineInput {
  brief: DesignStudioBrief;
  concept: DesignConcept;
  designDirection?: string;
  intelligenceContext?: IntelligenceHandoffContext;
}

/** Complete output from the internal Fashion Design Engine pipeline. */
export interface FashionDesignEngineResult {
  engineVersion: typeof FASHION_ENGINE_VERSION;
  input: Pick<FashionDesignEngineInput, "brief" | "designDirection"> & {
    conceptId: string;
    conceptTitle: string;
  };
  creativeBrief: CreativeDesignBrief;
  layoutSpec: LayoutSpec;
  typographySpec: TypographySpec;
  graphicSpec: GraphicSpec;
  compositionSpec: CompositionSpec;
  commercialAssessment: FashionCommercialAssessment;
  printSpec: PrintSpec;
  /** Structured prompt for GPT image step — creative thinking already done. */
  imageGenerationPrompt: string;
  progress: FashionEngineProgressStep[];
  completedAt: string;
  /** Fashion knowledge pipeline result — populated when knowledge layer runs. */
  fashionKnowledge?: FashionKnowledgePipelineResult;
}
