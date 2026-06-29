import type {
  PremiumRenderContext,
  PremiumTemplateLayoutConfig,
  PremiumTemplateRenderResult,
} from "@/lib/design/design-library/templates/premium/types";
import type { OrnamentId } from "@/lib/design/design-library/types";
import type { SymbolRecipe } from "@/lib/design/design-library/templates/premium/shared/symbols-build";
import { PREMIUM_ENGINE_COMMENT } from "@/lib/design/design-library/templates/premium/types";
import { buildPremiumTypographyPlacements } from "@/lib/design/design-library/templates/premium/shared/typography-build";
import { renderTypographySvg } from "@/lib/design/design-library/templates/premium/shared/typography-render";
import { isHeroTypographyArtwork } from "@/lib/design/design-library/templates/premium/shared/typography-artwork";
import { buildSymbolLayers } from "@/lib/design/design-library/templates/premium/shared/symbols-build";
import { buildOrnamentLayers } from "@/lib/design/design-library/templates/premium/shared/ornaments-build";
import { analyzePremiumSvg } from "@/lib/design/design-library/templates/premium/quality-gate";
import {
  applyDirectiveToContext,
  directComposition,
  type CompositionQualityGate,
} from "@/lib/design/design-library/composition-intelligence";
import {
  applyKnowledgeToRecipe,
  applyKnowledgeTypography,
} from "@/lib/design/design-knowledge";
import {
  renderSvgAssetPack,
  selectAssetsFromPremiumContext,
  SVG_ASSETS_COMMENT,
} from "@/lib/design/svg-assets";
import { DESIGN_TOKENS, fmt } from "@/lib/design/vector-engine/tokens";
import { escapeXml, group, rect } from "@/lib/design/vector-engine/xml";

export interface TemplateRecipe {
  layout: PremiumTemplateLayoutConfig;
  symbols: SymbolRecipe;
  ornaments: OrnamentId[][];
  decision?: import("@/lib/design/design-knowledge/art-direction/creative-director").CreativeDirectorDecision;
}

function estimateElementCount(recipe: TemplateRecipe, typographyCount: number): number {
  const symbolCount =
    2 +
    recipe.symbols.nested.length +
    (recipe.symbols.includeHalo ? 1 : 0) +
    (recipe.symbols.includeDirectional ? 1 : 0);
  const ornamentCount = recipe.ornaments.flat().length * 2;
  return symbolCount + ornamentCount + typographyCount + 12;
}

export function evaluateRecipeComposition(
  ctx: PremiumRenderContext,
  recipe: TemplateRecipe,
): CompositionQualityGate {
  const layout = recipe.layout;
  const scale = ctx.heroScale * layout.scaleMultiplier;
  const adjustedCtx = { ...ctx, heroScale: scale };
  const rawType = buildPremiumTypographyPlacements(adjustedCtx, layout);
  const elementCount = estimateElementCount(recipe, rawType.length);
  const directed = directComposition(adjustedCtx, layout, rawType, elementCount);
  return directed.gate;
}

export function renderPremiumTemplateFromKnowledge(
  ctx: PremiumRenderContext,
  templateId: PremiumTemplateLayoutConfig["id"],
): PremiumTemplateRenderResult {
  const knowledge = applyKnowledgeToRecipe(ctx, templateId);
  return renderPremiumTemplateFromRecipe(ctx, {
    layout: knowledge.layout,
    symbols: knowledge.symbols,
    ornaments: knowledge.ornaments,
    decision: knowledge.decision,
  });
}

export function renderPremiumTemplateFromRecipe(
  ctx: PremiumRenderContext,
  recipe: TemplateRecipe,
): PremiumTemplateRenderResult {
  const layout = recipe.layout;
  const scale = ctx.heroScale * layout.scaleMultiplier;
  let adjustedCtx = { ...ctx, heroScale: scale };

  let rawTypography = buildPremiumTypographyPlacements(adjustedCtx, layout);
  if (recipe.decision && !isHeroTypographyArtwork(adjustedCtx)) {
    rawTypography = applyKnowledgeTypography(rawTypography, recipe.decision);
  }

  const elementCount = estimateElementCount(recipe, rawTypography.length);
  const directed = directComposition(adjustedCtx, layout, rawTypography, elementCount);
  adjustedCtx = applyDirectiveToContext(adjustedCtx, directed.directive);

  const typographyPlacements = directed.typography;
  const typeRender = renderTypographySvg(
    typographyPlacements,
    ctx.colors.ink,
    ctx.fontFamily,
  );

  const symbols = buildSymbolLayers(adjustedCtx, recipe.symbols);
  const ornaments = buildOrnamentLayers(adjustedCtx, recipe.ornaments);

  const assetPack = selectAssetsFromPremiumContext(adjustedCtx, layout.id, directed.gate.score.overall);
  const svgAssetLayer =
    assetPack.validation.passed
      ? group(
          "premium-svg-asset-layer",
          renderSvgAssetPack(assetPack.assets, ctx.strokeWidth, ctx.colors),
        )
      : "";

  const negativeSpace = group(
    "premium-negative-space",
    rect(
      ctx.safeZone.x + ctx.safeZone.width * 0.04,
      ctx.safeZone.y + ctx.safeZone.height * 0.04,
      ctx.safeZone.width * 0.92,
      ctx.safeZone.height * 0.92,
      {
        fill: "none",
        stroke: ctx.colors.secondary,
        "stroke-width": ctx.strokeWidth * 0.2,
        opacity: 0.08 + layout.negativeSpaceBias * 0.06,
        "stroke-dasharray": "1 8",
      },
    ),
  );

  const headline = typographyPlacements.find((t) => t.role === "headline" || t.role === "stacked-headline");
  const depthType =
    headline &&
    group(
      "premium-depth-type-ghost",
      `<text x="${fmt(headline.x)}" y="${fmt(headline.y - headline.size * 0.7)}" fill="${ctx.colors.secondary}" font-family="${DESIGN_TOKENS.fonts.display}" font-size="${fmt(headline.size * 0.16)}" font-weight="400" letter-spacing="5" text-anchor="middle" opacity="${layout.depthOpacity}">${escapeXml(headline.text.toUpperCase())}</text>`,
    );

  const baseGeometry = group(
    "hero-composition-root",
    [
      negativeSpace,
      symbols.primaryFocal,
      group("hero-architectural-frame", symbols.symbolLayer),
    ].join(""),
  );

  const secondaryShapes = group(
    "layer-secondary-shapes",
    [symbols.secondaryGeometry, symbols.depthLayer, depthType ?? ""].join(""),
  );

  const decorativeDetails = group(
    "layer-decorative-details",
    [svgAssetLayer, ornaments.ornamentLayer, ornaments.editorialLayer, ornaments.microLayer].join(""),
  );

  const typography = group("layer-typography", typeRender.svg);

  const defs = [PREMIUM_ENGINE_COMMENT, SVG_ASSETS_COMMENT, symbols.defs, typeRender.defs].filter(Boolean).join("");

  const combined = [baseGeometry, secondaryShapes, typography, decorativeDetails, defs].join("");
  const stats = analyzePremiumSvg(combined);

  return {
    baseGeometry,
    secondaryShapes,
    decorativeDetails,
    typography,
    defs,
    background: group("layer-background", ""),
    templateId: layout.id,
    stats,
  };
}
