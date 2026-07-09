import type { CompositionTemplate } from "../types";
import {
  basePremiumGraphics,
  boostCompositionScore,
  cloneSpecs,
  enrichGraphicSystems,
  registrationSymbols,
} from "./shared";

export const luxuryBadgeTemplate: CompositionTemplate = {
  id: "luxury-badge",
  label: "Luxury Badge Layout",
  description: "Centered badge frame with micro-label hierarchy and boundary symbols",
  matches: (ctx) => {
    const area = ctx.engine.layoutSpec.printArea;
    if (area === "front" || area === "left-chest") return 75;
    if (ctx.engine.creativeBrief.emotionalCore.toLowerCase().includes("luxury")) return 65;
    return 40;
  },
  apply: (ctx) => {
    const typographySpec = cloneSpecs(ctx.engine.typographySpec);
    const layoutSpec = cloneSpecs(ctx.engine.layoutSpec);
    const panel = layoutSpec.frontLayout ?? layoutSpec.backLayout;

    for (const block of typographySpec.blocks) {
      if (block.role === "hero" && panel) {
        block.alignment = "center";
        block.fontSizeMm = Math.min(block.fontSizeMm * 0.85, 12);
        block.positionMm = {
          x: panel.boundingBoxMm.width / 2 + panel.offsetFromCenterMm,
          y: panel.offsetFromCollarMm + panel.boundingBoxMm.height * 0.38,
        };
      }
      if (block.role === "micro" && panel) {
        block.fontSizeMm = Math.max(4, block.fontSizeMm * 0.7);
        block.opacity = 0.65;
        block.positionMm = {
          x: panel.boundingBoxMm.width / 2 + panel.offsetFromCenterMm,
          y: panel.offsetFromCollarMm + panel.boundingBoxMm.height * 0.52,
        };
      }
    }

    const graphicSpec = enrichGraphicSystems(ctx.engine.graphicSpec, {
      lineSystems: [
        ...basePremiumGraphics(ctx),
        {
          id: "badge-frame",
          type: "perimeter",
          count: 1,
          strokeWidthMm: 1.4,
          spacingMm: 0,
          opacity: 0.85,
        },
      ],
      symbols: [
        ...registrationSymbols(),
        {
          id: "badge-corner-l",
          name: "boundary-diamond",
          abstraction: "architectural",
          meaning: "Luxury label corner mark",
          strokeWidthMm: 0.6,
          dimensionsMm: { width: 8, height: 8 },
        },
        {
          id: "badge-corner-r",
          name: "boundary-diamond",
          abstraction: "architectural",
          meaning: "Luxury label corner mark",
          strokeWidthMm: 0.6,
          dimensionsMm: { width: 8, height: 8 },
        },
      ],
      abstractElements: [
        {
          id: "luxury-label-block",
          geometry: "rounded-rect-badge",
          dimensionsMm: "badge-frame",
          coordinates: "center",
          layerOrder: 1,
        },
      ],
    });

    return {
      typographySpec,
      layoutSpec,
      graphicSpec,
      compositionSpec: boostCompositionScore(ctx.engine.compositionSpec, 10),
    };
  },
};
