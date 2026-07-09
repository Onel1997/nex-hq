import type { PremiumRenderContext, PremiumTemplateRenderResult } from "@/lib/design/design-library/templates/premium/types";
import { assembleLayers } from "./layers";

export function renderGalleryPoster(ctx: PremiumRenderContext): PremiumTemplateRenderResult {
  return assembleLayers(ctx);
}
