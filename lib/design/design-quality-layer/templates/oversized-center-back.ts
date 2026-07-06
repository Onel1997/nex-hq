import type { CompositionTemplate } from "../types";
import {
  basePremiumGraphics,
  boostCompositionScore,
  cloneSpecs,
  enrichGraphicSystems,
  registrationSymbols,
} from "./shared";

export const oversizedCenterBackTemplate: CompositionTemplate = {
  id: "oversized-center-back",
  label: "Oversized Center-Back Statement",
  description: "Large-scale back statement with bold hierarchy and perimeter system",
  matches: (ctx) => {
    const area = ctx.engine.layoutSpec.printArea;
    const scale = ctx.engine.input.brief?.dimensions?.toLowerCase() ?? "";
    if ((area === "back" || area === "upper-back") && scale.includes("large")) return 85;
    if (area === "back" || area === "upper-back") return 60;
    return 0;
  },
  apply: (ctx) => {
    const typographySpec = cloneSpecs(ctx.engine.typographySpec);
    const layoutSpec = cloneSpecs(ctx.engine.layoutSpec);
    const panel = layoutSpec.backLayout ?? layoutSpec.frontLayout;

    for (const block of typographySpec.blocks) {
      if (block.role === "hero" && panel) {
        block.fontSizeMm = Math.min(block.fontSizeMm * 1.15, 16);
        block.letterSpacingMm = Math.max(block.letterSpacingMm, 3);
        block.alignment = "center";
        block.positionMm = {
          x: panel.boundingBoxMm.width / 2,
          y: panel.offsetFromCollarMm + panel.boundingBoxMm.height * 0.35,
        };
      }
      if (block.role === "secondary" && panel) {
        block.fontSizeMm = block.fontSizeMm * 0.5;
        block.positionMm = {
          x: panel.boundingBoxMm.width / 2,
          y: panel.offsetFromCollarMm + panel.boundingBoxMm.height * 0.52,
        };
      }
    }

    const graphicSpec = enrichGraphicSystems(ctx.engine.graphicSpec, {
      lineSystems: [
        ...basePremiumGraphics(ctx),
        {
          id: "statement-perimeter",
          type: "perimeter",
          count: 1,
          strokeWidthMm: 1.6,
          spacingMm: 0,
          opacity: 0.65,
        },
        {
          id: "statement-arcs",
          type: "arc",
          count: 2,
          strokeWidthMm: 1,
          spacingMm: 28,
          opacity: 0.55,
        },
      ],
      symbols: registrationSymbols(),
      abstractElements: [
        {
          id: "statement-divider",
          geometry: "wide-rule",
          dimensionsMm: "statement",
          coordinates: "center",
          layerOrder: 1,
        },
      ],
    });

    return {
      typographySpec,
      layoutSpec,
      graphicSpec,
      compositionSpec: boostCompositionScore(ctx.engine.compositionSpec, 12),
    };
  },
};
