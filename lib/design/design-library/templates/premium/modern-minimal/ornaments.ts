import type { PremiumRenderContext } from "@/lib/design/design-library/templates/premium/types";
import { buildOrnamentLayers } from "@/lib/design/design-library/templates/premium/shared/ornaments-build";
import { RECIPE } from "./layout";

export function buildOrnaments(ctx: PremiumRenderContext) {
  return buildOrnamentLayers(ctx, RECIPE.ornaments);
}
