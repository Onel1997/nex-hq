import type { PremiumRenderContext } from "@/lib/design/design-library/templates/premium/types";
import { buildPremiumTypographyPlacements } from "@/lib/design/design-library/templates/premium/shared/typography-build";
import { LAYOUT } from "./layout";

export function buildTypography(ctx: PremiumRenderContext) {
  return buildPremiumTypographyPlacements(ctx, LAYOUT);
}
