import { renderHeroArtwork } from "@/lib/design/vector-engine/hero-artwork";
import type { ComposedLayers, DesignSpec } from "@/lib/design/vector-engine/types";
import { DESIGN_TOKENS, snap } from "@/lib/design/vector-engine/tokens";
import { renderTypographyLayer } from "@/lib/design/vector-engine/typography";
import { group, line, rect } from "@/lib/design/vector-engine/xml";

export function composeLayers(spec: DesignSpec): { layers: ComposedLayers; defs: string } {
  const { colors, safeZone } = spec;
  const hero = renderHeroArtwork(spec, colors);

  const background = group("layer-background", "");

  const baseGeometry = group("layer-base-geometry", hero.base);
  const secondaryShapes = group("layer-secondary-shapes", hero.secondary);

  const typography = group(
    "layer-typography",
    renderTypographyLayer(spec.typography, colors.ink),
  );

  const decorativeExtras: string[] = [hero.decorative];

  const ruleY = snap(spec.focalPoint.y + safeZone.width * 0.56 * 0.42 * 0.55 + safeZone.height * 0.2);
  decorativeExtras.push(
    line(
      safeZone.x + safeZone.width * 0.22,
      ruleY,
      safeZone.x + safeZone.width * 0.78,
      ruleY,
      {
        stroke: colors.secondary,
        "stroke-width": DESIGN_TOKENS.stroke.hairline,
        opacity: 0.2,
        "stroke-linecap": "round",
      },
    ),
  );

  if (spec.composition.includes("oversized") || spec.composition === "center-chest") {
    const topRule = snap(safeZone.y + safeZone.height * 0.14);
    decorativeExtras.push(
      rect(safeZone.x + safeZone.width * 0.38, topRule, safeZone.width * 0.24, 0.3, {
        fill: colors.secondary,
        opacity: 0.18,
      }),
    );
  }

  const decorativeDetails = group("layer-decorative-details", decorativeExtras.join(""));

  const productionGuides = group(
    "print-area",
    rect(safeZone.x, safeZone.y, safeZone.width, safeZone.height, {
      fill: "none",
      stroke: colors.secondary,
      "stroke-width": 0.5,
      "stroke-dasharray": "4 3",
      opacity: 0.28,
    }),
  );

  return {
    layers: {
      background,
      baseGeometry,
      secondaryShapes,
      typography,
      decorativeDetails,
      productionGuides,
    },
    defs: hero.defs,
  };
}
