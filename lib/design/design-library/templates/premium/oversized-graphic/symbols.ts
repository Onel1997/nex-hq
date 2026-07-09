import type { PremiumRenderContext } from "@/lib/design/design-library/templates/premium/types";
import { buildSymbolLayers } from "@/lib/design/design-library/templates/premium/shared/symbols-build";
import { RECIPE } from "./layout";

export function buildSymbols(ctx: PremiumRenderContext) {
  return buildSymbolLayers(ctx, RECIPE.symbols);
}
