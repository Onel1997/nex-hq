import type { CompositionTemplate } from "../types";
import {
  basePremiumGraphics,
  boostCompositionScore,
  cloneSpecs,
  concreteGrainTexture,
  distressedTexture,
  enrichGraphicSystems,
  registrationSymbols,
} from "./shared";

export const spineTypographyTemplate: CompositionTemplate = {
  id: "spine-typography",
  label: "Spine Typography",
  description: "Vertical spine axis with editorial tracking and perimeter arcs",
  matches: (ctx) => {
    const area = ctx.engine.layoutSpec.printArea;
    if (area === "spine-back") return 95;
    if (area === "back" && ctx.engine.layoutSpec.garmentBalance.visualWeight === "heavy-center") {
      return 70;
    }
    return 0;
  },
  apply: (ctx) => {
    const typographySpec = cloneSpecs(ctx.engine.typographySpec);
    const layoutSpec = cloneSpecs(ctx.engine.layoutSpec);
    const panel = layoutSpec.backLayout ?? layoutSpec.frontLayout;

    if (panel) {
      panel.offsetFromCenterMm = 0;
    }

    for (const block of typographySpec.blocks) {
      if (block.role === "hero") {
        block.alignment = "center";
        block.letterSpacingMm = Math.max(block.letterSpacingMm, 3.2);
        block.rotationDeg = -90;
        block.positionMm = panel
          ? { x: panel.boundingBoxMm.width / 2, y: panel.offsetFromCollarMm + panel.boundingBoxMm.height * 0.42 }
          : undefined;
      }
    }

    const graphicSpec = enrichGraphicSystems(ctx.engine.graphicSpec, {
      lineSystems: [
        ...basePremiumGraphics(ctx),
        {
          id: "spine-axis",
          type: "axis",
          count: 1,
          strokeWidthMm: 1.2,
          spacingMm: 0,
          opacity: 0.75,
        },
        {
          id: "spine-arcs",
          type: "arc",
          count: 2,
          strokeWidthMm: 0.9,
          spacingMm: 22,
          opacity: 0.6,
        },
      ],
      symbols: registrationSymbols(),
      textures: [...concreteGrainTexture(), ...distressedTexture()],
    });

    return {
      typographySpec,
      layoutSpec,
      graphicSpec,
      compositionSpec: boostCompositionScore(ctx.engine.compositionSpec, 8),
    };
  },
};
