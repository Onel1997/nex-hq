import type { DesignStudioBrief } from "@/agents/design/studio-brief";

export type CompositionId =
  | "center-chest"
  | "upper-chest"
  | "left-chest"
  | "oversized-front"
  | "oversized-back"
  | "back-shoulder"
  | "bottom-hem"
  | "vertical"
  | "asymmetrical"
  | "dual-print"
  | "minimal";

export type ColorMode =
  | "single"
  | "tone-on-tone"
  | "two-color"
  | "three-color"
  | "high-contrast"
  | "washed-ink"
  | "vintage-ink";

export type PrintEffect =
  | "distressed"
  | "grain"
  | "halftone"
  | "split-lines"
  | "faded"
  | "texture-mask"
  | "outline"
  | "filled";

export type PrimitiveKind =
  | "circle"
  | "ring"
  | "arc"
  | "half-circle"
  | "broken-circle"
  | "parallel-lines"
  | "radial-lines"
  | "cross"
  | "grid"
  | "dots"
  | "organic-blob"
  | "bezier-curve"
  | "noise-pattern"
  | "frame"
  | "rectangle"
  | "rounded-rectangle"
  | "diamond"
  | "star"
  | "minimal-symbol";

export type TypographyRole =
  | "headline"
  | "sub-headline"
  | "caption"
  | "coordinates"
  | "roman-numeral"
  | "quote"
  | "minimal-label"
  | "vertical";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface ColorScheme {
  mode: ColorMode;
  primary: string;
  secondary: string;
  accent: string;
  ink: string;
  background: string;
}

export interface TypographyBlock {
  role: TypographyRole;
  text: string;
  x: number;
  y: number;
  size: number;
  tracking: number;
  lineHeight: number;
  align: "start" | "middle" | "end";
  rotation: number;
  opacity: number;
  weight: number;
  curved?: boolean;
  curveRadius?: number;
}

export interface ShapePlacement {
  kind: PrimitiveKind;
  cx: number;
  cy: number;
  scale: number;
  rotation: number;
  opacity: number;
  strokeWidth: number;
  fillMode: "filled" | "outline" | "both";
}

export type CompositionCandidateId =
  | "minimal-luxury-wordmark"
  | "interrupted-arc-emblem"
  | "editorial-back-print"
  | "asymmetric-chest-mark"
  | "oversized-typography-print"
  | "quiet-luxury-micro-mark"
  | "architectural-frame-layout"
  | "broken-circle-symbol"
  | "technical-streetwear-layout"
  | "gallery-type-system";

export type CompositionSymmetry = "symmetric" | "asymmetric" | "radial";
export type PrintScaleMode = "micro" | "standard" | "oversized";
export type HierarchyMode = "type-first" | "geometry-first" | "balanced";

export interface TypographySystemSpec {
  hierarchy: HierarchyMode;
  headlineScale: number;
  headlineYOffset: number;
  trackingBoost: number;
  includeSubHeadline: boolean;
  includeCoordinates: boolean;
  includeRomanNumeral: boolean;
  includeCapsuleCode: boolean;
  alignment: "center" | "left" | "asymmetric";
  scaleMode: PrintScaleMode;
}

export interface GeometrySystemSpec {
  primaryKind: PrimitiveKind;
  secondaryKinds: PrimitiveKind[];
  scale: number;
  yOffset: number;
  includeDualArcs: boolean;
  includeMissingCenter: boolean;
  includeOuterFrame: boolean;
  includeBrokenCircle: boolean;
}

export interface DetailSystemSpec {
  microDetailCount: number;
  includeFlankLines: boolean;
  includeMicroLines: boolean;
  includeCoordinateMarks: boolean;
  includeVerticalRules: boolean;
  includeCapsuleCode: boolean;
  includeSideRoman: boolean;
  includeEditorialRules: boolean;
}

export interface CompositionCandidateScoreBreakdown {
  briefAlignment: number;
  styleFit: number;
  layoutFit: number;
  hierarchyFit: number;
  negativeSpaceFit: number;
  total: number;
}

export interface CompositionCandidate {
  id: CompositionCandidateId;
  name: string;
  styleFamily: string;
  layoutFamily: CompositionId;
  typographySystem: TypographySystemSpec;
  geometrySystem: GeometrySystemSpec;
  detailSystem: DetailSystemSpec;
  emotionalTone: string;
  negativeSpaceRatio: number;
  visualWeight: number;
  symmetry: CompositionSymmetry;
  printScale: PrintScaleMode;
  scoreBreakdown?: CompositionCandidateScoreBreakdown;
}

export interface DesignSpec {
  composition: CompositionId;
  artboard: Rect;
  safeZone: Rect;
  focalPoint: Point;
  secondaryFocal?: Point;
  primaryShape: ShapePlacement;
  secondaryShapes: ShapePlacement[];
  typography: TypographyBlock[];
  colors: ColorScheme;
  effects: PrintEffect[];
  seed: number;
  compositionCandidate: CompositionCandidate;
}

export interface VectorEngineOptions {
  includeProductionGuides?: boolean;
}

export interface ComposedLayers {
  background: string;
  baseGeometry: string;
  secondaryShapes: string;
  typography: string;
  decorativeDetails: string;
  productionGuides: string;
}

export interface VectorDesign {
  brief: DesignStudioBrief;
  spec: DesignSpec;
  layers: ComposedLayers;
}
