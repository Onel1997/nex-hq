import type { CompositionTemplate } from "../types";
import {
  basePremiumGraphics,
  boostCompositionScore,
  cloneSpecs,
  concreteGrainTexture,
  enrichGraphicSystems,
  registrationSymbols,
} from "./shared";

export const editorialBackPrintTemplate: CompositionTemplate = {
  id: "editorial-back-print",
  label: "Editorial Back Print",
  description: "Upper-back editorial layout with arcs, grid lines, and micro-labels",
  matches: (ctx) => {
    const area = ctx.engine.layoutSpec.printArea;
    if (area === "back") return 88;
    if (area === "upper-back") return 82;
    return 0;
  },
  apply: (ctx) => {
    const typographySpec = cloneSpecs(ctx.engine.typographySpec);
    const layoutSpec = cloneSpecs(ctx.engine.layoutSpec);
    const panel = layoutSpec.backLayout ?? layoutSpec.frontLayout;

    if (panel) {
      panel.offsetFromCollarMm = Math.max(panel.offsetFromCollarMm, 55);
    }

    for (const block of typographySpec.blocks) {
      if (block.role === "hero" && panel) {
        block.alignment = "center";
        block.letterSpacingMm = Math.max(block.letterSpacingMm, 2.8);
        block.positionMm = {
          x: panel.boundingBoxMm.width / 2,
          y: panel.offsetFromCollarMm + panel.boundingBoxMm.height * 0.32,
        };
      }
      if (block.role === "secondary" && panel) {
        block.positionMm = {
          x: panel.boundingBoxMm.width / 2,
          y: panel.offsetFromCollarMm + panel.boundingBoxMm.height * 0.48,
        };
      }
    }

    const graphicSpec = enrichGraphicSystems(ctx.engine.graphicSpec, {
      lineSystems: [
        ...basePremiumGraphics(ctx),
        {
          id: "editorial-arcs",
          type: "arc",
          count: 3,
          strokeWidthMm: 0.75,
          spacingMm: 16,
          opacity: 0.5,
        },
        {
          id: "editorial-axis",
          type: "axis",
          count: 1,
          strokeWidthMm: 0.6,
          spacingMm: 0,
          opacity: 0.4,
        },
      ],
      symbols: registrationSymbols(),
      textures: concreteGrainTexture(),
      abstractElements: [
        {
          id: "editorial-divider",
          geometry: "horizontal-rule",
          dimensionsMm: "editorial",
          coordinates: "upper-third",
          layerOrder: 2,
        },
      ],
    });

    return {
      typographySpec,
      layoutSpec,
      graphicSpec,
      compositionSpec: boostCompositionScore(ctx.engine.compositionSpec, 9),
    };
  },
};
