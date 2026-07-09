import type { CompositionTemplate } from "../types";
import {
  basePremiumGraphics,
  boostCompositionScore,
  cloneSpecs,
  enrichGraphicSystems,
  registrationSymbols,
} from "./shared";

export const abstractPerimeterTemplate: CompositionTemplate = {
  id: "abstract-perimeter",
  label: "Abstract Perimeter System",
  description: "Concentric perimeter loops with boundary symbols and thin grid",
  matches: (ctx) => {
    const geometry = ctx.engine.input.brief?.geometry?.toLowerCase() ?? "";
    if (geometry.includes("perimeter") || geometry.includes("loop") || geometry.includes("boundary")) {
      return 90;
    }
    if (geometry.includes("arc") || geometry.includes("concentric")) return 75;
    return 35;
  },
  apply: (ctx) => {
    const typographySpec = cloneSpecs(ctx.engine.typographySpec);
    const layoutSpec = cloneSpecs(ctx.engine.layoutSpec);
    const panel = layoutSpec.backLayout ?? layoutSpec.frontLayout;

    for (const block of typographySpec.blocks) {
      if (block.role === "hero" && panel) {
        block.alignment = "center";
        block.positionMm = {
          x: panel.boundingBoxMm.width / 2 + (panel.offsetFromCenterMm ?? 0),
          y: panel.offsetFromCollarMm + panel.boundingBoxMm.height * 0.4,
        };
      }
    }

    const graphicSpec = enrichGraphicSystems(ctx.engine.graphicSpec, {
      lineSystems: [
        ...basePremiumGraphics(ctx),
        {
          id: "perimeter-outer",
          type: "perimeter",
          count: 1,
          strokeWidthMm: 1.1,
          spacingMm: 0,
          opacity: 0.7,
        },
        {
          id: "perimeter-inner",
          type: "perimeter",
          count: 1,
          strokeWidthMm: 0.6,
          spacingMm: 12,
          opacity: 0.45,
        },
        {
          id: "perimeter-arcs",
          type: "arc",
          count: 4,
          strokeWidthMm: 0.5,
          spacingMm: 14,
          opacity: 0.4,
        },
      ],
      symbols: [
        ...registrationSymbols(),
        {
          id: "boundary-n",
          name: "boundary-tick",
          abstraction: "geometric",
          meaning: "Perimeter boundary symbol",
          strokeWidthMm: 0.5,
          dimensionsMm: { width: 5, height: 5 },
        },
        {
          id: "boundary-s",
          name: "boundary-tick",
          abstraction: "geometric",
          meaning: "Perimeter boundary symbol",
          strokeWidthMm: 0.5,
          dimensionsMm: { width: 5, height: 5 },
        },
      ],
    });

    return {
      typographySpec,
      layoutSpec,
      graphicSpec,
      compositionSpec: boostCompositionScore(ctx.engine.compositionSpec, 11),
    };
  },
};
