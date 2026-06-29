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
