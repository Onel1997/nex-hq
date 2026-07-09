import type { PremiumRenderContext } from "@/lib/design/design-library/templates/premium/types";
import { renderPremiumTemplateFromRecipe } from "@/lib/design/design-library/templates/premium/shared/assemble";
import { RECIPE } from "./layout";

export function assembleLayers(ctx: PremiumRenderContext) {
  return renderPremiumTemplateFromRecipe(ctx, RECIPE);
}
