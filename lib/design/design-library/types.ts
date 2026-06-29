import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { ColorScheme } from "@/lib/design/vector-engine/types";

/* ── Geometry primitives ─────────────────────────────────────── */

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

/* ── Style library ───────────────────────────────────────────── */

export type DesignStyleId =
  | "minimal-luxury"
  | "silent-luxury"
  | "editorial-fashion"
  | "architectural"
  | "faith"
  | "vintage-washed"
  | "modern-gothic"
  | "japanese-minimal"
  | "technical-streetwear"
  | "swiss-typography"
  | "scandinavian-minimal"
  | "monochrome-luxury";

export type HierarchyPreference = "type-first" | "geometry-first" | "balanced";
export type PrintScalePreference = "micro" | "standard" | "oversized";
export type AlignmentPreference = "center" | "left" | "optical" | "asymmetric";

export interface SpacingSystem {
  marginRatio: number;
  safeZoneRatio: number;
  elementGap: number;
  baselineGrid: number;
}

export interface DesignStyleDefinition {
  id: DesignStyleId;
  name: string;
  typographyPreference: string[];
  spacing: SpacingSystem;
  negativeSpace: number;
  preferredLayouts: LayoutId[];
  preferredSymbols: SymbolId[];
  preferredOrnaments: OrnamentId[];
  preferredPrintScale: PrintScalePreference;
  hierarchy: HierarchyPreference;
  allowedEffects: EffectId[];
  visualRhythm: number;
  strokeHairline: number;
  strokeThin: number;
  strokeRegular: number;
  trackingTight: number;
  trackingNormal: number;
  trackingWide: number;
  headlineScale: number;
  geometryScale: number;
  alignment: AlignmentPreference;
}

/* ── Layout library ──────────────────────────────────────────── */

export type LayoutId =
  | "center-chest"
  | "oversized-front"
  | "oversized-back"
  | "corner-print"
  | "vertical-print"
  | "dual-print"
  | "split-layout"
  | "gallery-layout"
  | "editorial-layout"
  | "micro-chest"
  | "symbol-above-type"
  | "type-above-symbol"
  | "wrap-composition"
  | "diagonal-layout"
  | "floating-composition";

export type BalanceRule = "symmetric" | "asymmetric" | "radial" | "optical";

export interface LayoutAnchors {
  focal: Point;
  type: Point;
  symbol: Point;
  secondary?: Point;
}

export interface ScalingRules {
  heroScale: number;
  typeScale: number;
  ornamentScale: number;
  minScale: number;
  maxScale: number;
}

export interface LayoutDefinition {
  id: LayoutId;
  name: string;
  safeZoneMargin: number;
  padding: { top: number; bottom: number; sides: number };
  balance: BalanceRule;
  scaling: ScalingRules;
  hierarchy: "symbol-first" | "type-first" | "balanced";
  alignment: AlignmentPreference;
  resolveZones: (artboard: Rect, negativeSpaceBias: number) => LayoutZones;
}

export interface LayoutZones {
  artboard: Rect;
  safeZone: Rect;
  heroZone: Rect;
  typeZone: Rect;
  accentZone: Rect;
  anchors: LayoutAnchors;
  marginTop: number;
  marginBottom: number;
  baselineGrid: number;
}

/* ── Typography library ──────────────────────────────────────── */

export type TypographySystemId =
  | "luxury-serif"
  | "editorial-serif"
  | "modern-sans"
  | "grotesk"
  | "condensed"
  | "extended";

export type TypographyRoleId =
  | "headline"
  | "subheadline"
  | "stacked-headline"
  | "roman-numeral"
  | "coordinates"
  | "micro-label"
  | "collection-code"
  | "vertical-text"
  | "curved-text"
  | "caption";

export interface TrackingPreset {
  id: string;
  value: number;
}

export interface WeightPreset {
  id: string;
  value: number;
}

export interface HierarchyPreset {
  id: string;
  headlineScale: number;
  subheadlineScale: number;
  decorScale: number;
}

export interface TypographySystemDefinition {
  id: TypographySystemId;
  name: string;
  fontFamily: string;
  trackingPresets: TrackingPreset[];
  weightPresets: WeightPreset[];
  hierarchyPresets: HierarchyPreset[];
  baselineRhythm: number;
  supportedRoles: TypographyRoleId[];
}

export interface TypographyPlacement {
  id: string;
  role: TypographyRoleId;
  text: string;
  x: number;
  y: number;
  size: number;
  tracking: number;
  lineHeight: number;
  weight: number;
  align: "start" | "middle" | "end";
  rotation: number;
  opacity: number;
  layer: "typography" | "decorative";
  curved?: boolean;
  curveRadius?: number;
}

/* ── Symbol library ──────────────────────────────────────────── */

export type SymbolId =
  | "broken-circle"
  | "interrupted-arc"
  | "halo"
  | "cross"
  | "compass"
  | "frame"
  | "minimal-star"
  | "diamond"
  | "architectural-line"
  | "sacred-geometry"
  | "grid"
  | "half-circle"
  | "split-circle"
  | "orbit"
  | "minimal-eye"
  | "directional-marker"
  | "missing-center-void";

export type SymbolZone = "hero" | "secondary" | "accent";

export interface SymbolConstruction {
  strokeWeight: number;
  proportion: number;
  gapDegrees?: number;
  variant: "outline" | "filled" | "dual-stroke";
}

export interface SymbolDefinition {
  id: SymbolId;
  name: string;
  construction: SymbolConstruction;
  recommendedStyles: DesignStyleId[];
  recommendedLayouts: LayoutId[];
}

export interface SymbolPlacement {
  id: string;
  symbolId: SymbolId;
  zone: SymbolZone;
  cx: number;
  cy: number;
  scale: number;
  rotation: number;
  opacity: number;
}

/* ── Ornament library ──────────────────────────────────────── */

export type OrnamentId =
  | "rule-lines"
  | "micro-dots"
  | "editorial-dividers"
  | "coordinates"
  | "registration-marks"
  | "luxury-borders"
  | "corner-marks"
  | "alignment-guides"
  | "tiny-capsules"
  | "minimal-labels"
  | "roman-ids"
  | "collection-numbers"
  | "flank-strikes"
  | "vertical-rules"
  | "micro-lines";

export interface OrnamentDefinition {
  id: OrnamentId;
  name: string;
  density: "sparse" | "moderate" | "dense";
  recommendedStyles: DesignStyleId[];
}

export interface OrnamentPlacement {
  id: string;
  ornamentId: OrnamentId;
  cx: number;
  cy: number;
  scale: number;
  rotation: number;
  opacity: number;
  text?: string;
}

/* ── Grid library ────────────────────────────────────────────── */

export type GridId = "baseline" | "modular" | "golden" | "editorial" | "technical";

export interface GridDefinition {
  id: GridId;
  name: string;
  columns: number;
  gutter: number;
  baseline: number;
}

/* ── Effect library ──────────────────────────────────────────── */

export type EffectId =
  | "vintage-distress"
  | "screen-print-noise"
  | "halftone"
  | "fade"
  | "outline"
  | "outline-fill"
  | "embroidery"
  | "heavy-ink"
  | "washed"
  | "texture-mask"
  | "grain"
  | "filled";

export interface EffectDefinition {
  id: EffectId;
  name: string;
  vectorOnly: true;
  opacityRange: [number, number];
  recommendedStyles: DesignStyleId[];
}

/* ── Template library ────────────────────────────────────────── */

export type TemplateId =
  | "luxury-wordmark"
  | "editorial-poster"
  | "faith-collection"
  | "minimal-emblem"
  | "technical-blueprint"
  | "gallery-composition"
  | "silent-collection"
  | "micro-graphic"
  | "oversized-graphic"
  | "monochrome-symbol";

export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  styleId: DesignStyleId;
  layoutId: LayoutId;
  typographySystemId: TypographySystemId;
  primarySymbol: SymbolId;
  secondarySymbols: SymbolId[];
  ornaments: OrnamentId[];
  effects: EffectId[];
  hierarchy: HierarchyPreference;
}

/* ── Composed artwork spec ───────────────────────────────────── */

export interface LibraryArtworkSpec {
  brief: DesignStudioBrief;
  seed: number;
  style: DesignStyleDefinition;
  layout: LayoutDefinition;
  layoutZones: LayoutZones;
  typographySystem: TypographySystemDefinition;
  typography: TypographyPlacement[];
  symbols: SymbolPlacement[];
  ornaments: OrnamentPlacement[];
  effects: EffectDefinition[];
  template: TemplateDefinition;
  grid: GridDefinition;
  colors: ColorScheme;
  artboard: Rect;
}

export interface LibraryEngineOptions {
  includeProductionGuides?: boolean;
}

/* ── Composition overrides (quality reselection) ─────────────── */

export interface CompositionOverrides {
  templateId?: TemplateId;
  styleId?: DesignStyleId;
  layoutId?: LayoutId;
  variantIndex?: number;
  forceRich?: boolean;
}

/* ── Quality scoring ─────────────────────────────────────────── */

export interface QualityScoreBreakdown {
  visualBalance: number;
  typographyHierarchy: number;
  luxuryFeeling: number;
  apparelReadiness: number;
  compositionRichness: number;
  originality: number;
  emotionalTranslation: number;
  negativeSpaceUse: number;
  printReadiness: number;
  brandConsistency: number;
  commercialPotential: number;
  overall: number;
}

export interface HeroVisualAuditResult {
  passed: boolean;
  reason?: string;
  symbolCount: number;
  ornamentCount: number;
  typographyBlocks: number;
  layerCount: number;
}

export interface QualityValidationResult {
  valid: boolean;
  reason?: string;
}

export interface ScoredArtworkCandidate {
  spec: LibraryArtworkSpec;
  score: QualityScoreBreakdown;
  validation: QualityValidationResult;
}
