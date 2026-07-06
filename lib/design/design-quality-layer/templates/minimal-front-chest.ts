import type { CompositionTemplate } from "../types";
import {
  boostCompositionScore,
  cloneSpecs,
  enrichGraphicSystems,
  registrationSymbols,
} from "./shared";

export const minimalFrontChestTemplate: CompositionTemplate = {
  id: "minimal-front-chest",
  label: "Minimal Front Chest Mark",
  description: "Quiet left-chest mark with micro registration and restrained negative space",
  matches: (ctx) => {
    const area = ctx.engine.layoutSpec.printArea;
    if (area === "left-chest") return 92;
    if (area === "front" && ctx.engine.layoutSpec.garmentBalance.visualWeight === "light-minimal") {
      return 80;
    }
    return 25;
  },
  apply: (ctx) => {
    const typographySpec = cloneSpecs(ctx.engine.typographySpec);
    const layoutSpec = cloneSpecs(ctx.engine.layoutSpec);
    const panel = layoutSpec.frontLayout ?? layoutSpec.backLayout;

    if (panel) {
      panel.offsetFromCenterMm = -40;
      panel.boundingBoxMm = {
        width: Math.min(panel.boundingBoxMm.width, 80),
        height: Math.min(panel.boundingBoxMm.height, 50),
      };
    }

    typographySpec.blocks = typographySpec.blocks.slice(0, 3);

    for (const block of typographySpec.blocks) {
      if (block.role === "hero" && panel) {
        block.alignment = "left";
        block.fontSizeMm = Math.min(block.fontSizeMm, 7);
        block.letterSpacingMm = Math.max(block.letterSpacingMm, 2.2);
        block.positionMm = {
          x: panel.safeMarginMm + 8,
          y: panel.offsetFromCollarMm + 18,
        };
      }
    }

    const graphicSpec = enrichGraphicSystems(ctx.engine.graphicSpec, {
      lineSystems: [
        {
          id: "chest-micro-frame",
          type: "fragment",
          count: 1,
          strokeWidthMm: 0.4,
          spacingMm: 0,
          opacity: 0.5,
        },
      ],
      symbols: registrationSymbols().slice(0, 1),
    });

    return {
      typographySpec,
      layoutSpec,
      graphicSpec,
      compositionSpec: boostCompositionScore(ctx.engine.compositionSpec, 6),
    };
  },
};
