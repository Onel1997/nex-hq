import { renderPremiumTemplateEngine } from "@/lib/design/design-library/templates/premium/engine";
import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";

/** Premium apparel template engine — full layered compositions for Hero Pieces. */
export function renderHeroRichLayers(
  spec: LibraryArtworkSpec,
  strokeWidth: number,
): {
  baseGeometry: string;
  secondaryShapes: string;
  decorativeDetails: string;
  typography: string;
  defs: string;
  background: string;
} {
  const premium = renderPremiumTemplateEngine(spec, strokeWidth);
  return {
    baseGeometry: premium.baseGeometry,
    secondaryShapes: premium.secondaryShapes,
    decorativeDetails: premium.decorativeDetails,
    typography: premium.typography,
    defs: premium.defs,
    background: premium.background,
  };
}
