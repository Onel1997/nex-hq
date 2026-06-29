import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { PremiumRenderContext } from "@/lib/design/design-library/templates/premium/types";
import type { PremiumTemplateId } from "@/lib/design/design-library/templates/premium/types";
import type { DesignStyleId } from "@/lib/design/design-library/types";
import type { ApparelPlacement } from "@/lib/design/design-library/templates/premium/types";

export const SVG_ASSETS_COMMENT = "<!-- PREMIUM_SVG_ASSET_LIBRARY_PHASE_1 -->";

export type SvgAssetFamily =
  | "halo"
  | "frame"
  | "divider"
  | "gallery-marker"
  | "capsule"
  | "museum-label"
  | "cross"
  | "star"
  | "grid"
  | "ornament"
  | "texture"
  | "directional-marker";

export type SvgAssetRenderMode = "stroke" | "fill" | "mixed" | "pattern" | "mask";

export type SvgPrintMethod = "screen" | "dtg" | "embroidery" | "heat-transfer" | "vinyl";

export interface SvgAssetRenderContext {
  cx: number;
  cy: number;
  scale: number;
  rotation: number;
  opacity: number;
  strokeWidth: number;
  color: string;
  secondaryColor: string;
  accentColor: string;
  variant: string;
  clipPathId?: string;
  maskId?: string;
}

export interface SvgAssetDefinition {
  id: string;
  family: SvgAssetFamily;
  name: string;
  styleTags: string[];
  recommendedStyles: DesignStyleId[];
  recommendedTemplates: PremiumTemplateId[];
  recommendedPlacements: ApparelPlacement[];
  complexity: number;
  visualWeight: number;
  printMethods: SvgPrintMethod[];
  renderMode: SvgAssetRenderMode;
  variants: string[];
  qualityScore: number;
  render: (ctx: SvgAssetRenderContext) => string;
}

export interface SvgAssetPlacement {
  asset: SvgAssetDefinition;
  cx: number;
  cy: number;
  scale: number;
  rotation: number;
  opacity: number;
  variant: string;
  layer: "hero" | "secondary" | "decorative" | "support";
}

export interface SvgAssetSelectionInput {
  brief: DesignStudioBrief;
  styleId: DesignStyleId;
  templateId: PremiumTemplateId;
  collection?: string;
  placement: ApparelPlacement;
  emotionalTone?: string;
  symbolSystem?: string;
  ornamentSystem?: string;
  seed: number;
  heroScale: number;
  focal: { x: number; y: number };
  compositionScore?: number;
  premiumContext?: PremiumRenderContext;
}

export interface SvgAssetPack {
  assets: SvgAssetPlacement[];
  families: SvgAssetFamily[];
  validation: SvgAssetPackValidation;
}

export interface SvgAssetPackValidation {
  passed: boolean;
  reason?: string;
  diversityScore: number;
  apparelScaleScore: number;
}
