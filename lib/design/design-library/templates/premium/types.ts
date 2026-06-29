import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";
import type { ColorScheme } from "@/lib/design/vector-engine/types";
import type { Point, Rect } from "@/lib/design/design-library/types";

export const PREMIUM_ENGINE_COMMENT = "<!-- PREMIUM_APPAREL_TEMPLATE_ENGINE -->";

export type PremiumTemplateId =
  | "luxury-editorial"
  | "gallery-poster"
  | "museum-label"
  | "architectural-frame"
  | "faith-collection"
  | "oversized-graphic"
  | "silent-collection"
  | "modern-minimal"
  | "technical-luxury"
  | "fashion-campaign";

export type ApparelPlacement =
  | "center-chest"
  | "oversized-front"
  | "oversized-back"
  | "sleeve"
  | "dual-print"
  | "corner";

export type TypographyMode =
  | "oversized-headline"
  | "stacked-headline"
  | "split-typography"
  | "broken-typography"
  | "offset-typography"
  | "vertical-typography"
  | "curved-typography"
  | "museum-label";

export interface PremiumRenderContext {
  spec: LibraryArtworkSpec;
  strokeWidth: number;
  placement: ApparelPlacement;
  safeZone: Rect;
  artboard: Rect;
  seed: number;
  colors: ColorScheme;
  focal: Point;
  heroScale: number;
  fontFamily: string;
}

export interface PremiumTemplateLayoutConfig {
  id: PremiumTemplateId;
  typographyMode: TypographyMode;
  /** Preferred apparel placements for this template. */
  apparelBias: ApparelPlacement[];
  focalShift: { x: number; y: number };
  scaleMultiplier: number;
  asymmetry: number;
  negativeSpaceBias: number;
  depthOpacity: number;
  preferOversized: boolean;
}

export interface PremiumTemplateRenderResult {
  baseGeometry: string;
  secondaryShapes: string;
  decorativeDetails: string;
  typography: string;
  defs: string;
  background: string;
  templateId: PremiumTemplateId;
  stats: PremiumTemplateStats;
}

export interface PremiumTemplateStats {
  elementCount: number;
  layerCount: number;
  typographyGroups: number;
  ornamentGroups: number;
  symbolGroups: number;
}

export interface PremiumTemplateModule {
  id: PremiumTemplateId;
  layout: PremiumTemplateLayoutConfig;
  render: (ctx: PremiumRenderContext) => PremiumTemplateRenderResult;
}
