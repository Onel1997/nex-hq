import type { DesignStudioBrief } from "@/agents/design/studio-brief";

/* ── Style families ─────────────────────────────────────────── */

export type StyleFamily =
  | "minimal-luxury"
  | "editorial-fashion"
  | "silent-luxury"
  | "architectural"
  | "faith"
  | "vintage-washed"
  | "modern-gothic"
  | "japanese-minimalism"
  | "utility-wear"
  | "avant-garde"
  | "technical-streetwear"
  | "scandinavian-minimal"
  | "swiss-typography";

/* ── Layout families ────────────────────────────────────────── */

export type LayoutFamily =
  | "center-chest"
  | "oversized-front"
  | "oversized-back"
  | "small-chest-large-back"
  | "dual-print"
  | "corner-placement"
  | "wrap-composition"
  | "vertical-layout"
  | "editorial-layout"
  | "split-layout"
  | "stacked-layout"
  | "gallery-layout";

export type VisualHierarchy = "typography-primary" | "geometry-primary" | "balanced";
export type SymmetryMode = "symmetric" | "asymmetric" | "radial";
export type EmotionalDirection = "quiet" | "confident" | "spiritual" | "technical" | "rebellious";
export type StreetwearCategory = "essentials" | "statement" | "graphic" | "typographic" | "archive";

export type TypeRole =
  | "headline"
  | "subheadline"
  | "roman-numeral"
  | "coordinates"
  | "collection-tag"
  | "production-text"
  | "vertical"
  | "curved"
  | "oversized";

export type AssetId =
  | "dual-interrupted-arc"
  | "missing-center-void"
  | "broken-circle"
  | "architectural-frame"
  | "minimal-cross"
  | "editorial-lines"
  | "luxury-divider"
  | "coordinate-marks"
  | "capsule-code"
  | "sacred-geometry"
  | "grid-system"
  | "noise-mask"
  | "halftone-field"
  | "vintage-distress"
  | "textured-frame"
  | "minimal-symbol"
  | "technical-schematic"
  | "flank-strikes"
  | "vertical-rules";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  ink: string;
  background: string;
}

/* ── Pipeline stage outputs ─────────────────────────────────── */

export interface CreativeComposition {
  seed: number;
  styleFamily: StyleFamily;
  layoutFamily: LayoutFamily;
  visualHierarchy: VisualHierarchy;
  focalPoint: Point;
  symmetry: SymmetryMode;
  emotionalDirection: EmotionalDirection;
  luxuryLevel: 1 | 2 | 3 | 4 | 5;
  streetwearCategory: StreetwearCategory;
  negativeSpaceRatio: number;
  compositionRhythm: number;
  visualWeight: number;
  collectionTone: string;
}

export interface DesignIntelligence {
  typographyWeight: number;
  geometryWeight: number;
  decorativeWeight: number;
  feelQuiet: boolean;
  feelLuxury: boolean;
  feelEmotional: boolean;
  feelTechnical: boolean;
  breatheWithNegativeSpace: boolean;
  primaryAssets: AssetId[];
  secondaryAssets: AssetId[];
  accentAssets: AssetId[];
}

export interface StyleProfile {
  family: StyleFamily;
  strokeHairline: number;
  strokeThin: number;
  strokeRegular: number;
  trackingTight: number;
  trackingNormal: number;
  trackingWide: number;
  headlineScale: number;
  geometryScale: number;
  negativeSpaceBias: number;
  alignmentBias: "center" | "left" | "optical";
  productionMethod: string;
}

export interface LayoutZones {
  artboard: Rect;
  safeZone: Rect;
  heroZone: Rect;
  typeZone: Rect;
  accentZone: Rect;
  marginTop: number;
  marginBottom: number;
  baselineGrid: number;
}

export interface TypeElement {
  id: string;
  role: TypeRole;
  text: string;
  x: number;
  y: number;
  size: number;
  weight: number;
  tracking: number;
  lineHeight: number;
  align: "start" | "middle" | "end";
  opacity: number;
  rotation: number;
  curved?: boolean;
  curveRadius?: number;
  layer: "typography" | "decorative";
}

export interface PlacedAsset {
  id: string;
  asset: AssetId;
  zone: "hero" | "accent" | "decorative" | "secondary";
  cx: number;
  cy: number;
  scale: number;
  rotation: number;
  opacity: number;
  colorRole: "primary" | "secondary" | "accent" | "ink";
}

export interface ArtworkSpec {
  brief: DesignStudioBrief;
  composition: CreativeComposition;
  intelligence: DesignIntelligence;
  style: StyleProfile;
  layout: LayoutZones;
  typography: TypeElement[];
  assets: PlacedAsset[];
  colors: ColorScheme;
  defs: string;
}

export interface RenderedLayers {
  background: string;
  baseGeometry: string;
  secondaryShapes: string;
  typography: string;
  decorativeDetails: string;
  productionGuides: string;
}

export interface EngineOptions {
  includeProductionGuides?: boolean;
}
