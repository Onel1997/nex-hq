import type { PremiumRenderContext, PremiumTemplateRenderResult } from "@/lib/design/design-library/templates/premium/types";
import type { TemplateRecipeBundle } from "@/lib/design/design-library/templates/premium/recipes";
import { buildPremiumTypographyPlacements } from "@/lib/design/design-library/templates/premium/shared/typography-build";
import { buildSymbolLayers } from "@/lib/design/design-library/templates/premium/shared/symbols-build";
import { buildOrnamentLayers } from "@/lib/design/design-library/templates/premium/shared/ornaments-build";
import { renderPremiumTemplateFromRecipe } from "@/lib/design/design-library/templates/premium/shared/assemble";

export function createTemplateModule(recipe: TemplateRecipeBundle) {
  return {
    layout: recipe.layout,
    buildTypography: (ctx: PremiumRenderContext) => buildPremiumTypographyPlacements(ctx, recipe.layout),
    buildSymbols: (ctx: PremiumRenderContext) => buildSymbolLayers(ctx, recipe.symbols),
    buildOrnaments: (ctx: PremiumRenderContext) => buildOrnamentLayers(ctx, recipe.ornaments),
    assembleLayers: (ctx: PremiumRenderContext) => renderPremiumTemplateFromRecipe(ctx, recipe),
    render: (ctx: PremiumRenderContext): PremiumTemplateRenderResult =>
      renderPremiumTemplateFromRecipe(ctx, recipe),
  };
}
