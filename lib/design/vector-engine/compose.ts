import { renderHeroArtwork } from "@/lib/design/vector-engine/hero-artwork";
import type { ComposedLayers, DesignSpec } from "@/lib/design/vector-engine/types";
import { DESIGN_TOKENS, snap } from "@/lib/design/vector-engine/tokens";
import { renderTypographyLayer } from "@/lib/design/vector-engine/typography";
import { group, line, rect } from "@/lib/design/vector-engine/xml";

function renderCandidateEditorialRules(spec: DesignSpec): string {
  const { safeZone, colors, compositionCandidate } = spec;
  if (!compositionCandidate.detailSystem.includeEditorialRules) return "";

  const sw = DESIGN_TOKENS.stroke.hairline;
  const rules: string[] = [];
  const ruleY = snap(spec.focalPoint.y + safeZone.width * compositionCandidate.geometrySystem.scale * 0.38);

  rules.push(
    line(
      safeZone.x + safeZone.width * 0.2,
      ruleY,
      safeZone.x + safeZone.width * 0.8,
      ruleY,
      {
        stroke: colors.secondary,
        "stroke-width": sw,
        opacity: 0.2,
        "stroke-linecap": "round",
      },
    ),
  );

  if (compositionCandidate.printScale === "oversized" || spec.composition.includes("oversized")) {
    const topRule = snap(safeZone.y + safeZone.height * 0.14);
    rules.push(
      rect(safeZone.x + safeZone.width * 0.36, topRule, safeZone.width * 0.28, 0.3, {
        fill: colors.secondary,
        opacity: 0.16,
      }),
    );
    const bottomRule = snap(safeZone.y + safeZone.height * 0.86);
    rules.push(
      line(
        safeZone.x + safeZone.width * 0.32,
        bottomRule,
        safeZone.x + safeZone.width * 0.68,
        bottomRule,
        {
          stroke: colors.accent,
          "stroke-width": sw * 0.8,
          opacity: 0.18,
          "stroke-linecap": "round",
        },
      ),
    );
  }

  if (compositionCandidate.symmetry === "asymmetric") {
    rules.push(
      line(
        safeZone.x + safeZone.width * 0.68,
        safeZone.y + safeZone.height * 0.22,
        safeZone.x + safeZone.width * 0.82,
        safeZone.y + safeZone.height * 0.22,
        {
          stroke: colors.accent,
          "stroke-width": sw,
          opacity: 0.24,
          "stroke-linecap": "round",
        },
      ),
    );
  }

  return rules.join("");
}

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

  const decorativeExtras: string[] = [hero.decorative, renderCandidateEditorialRules(spec)];

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
