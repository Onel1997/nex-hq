import type { CompositionTemplate } from "../types";
import {
  basePremiumGraphics,
  boostCompositionScore,
  cloneSpecs,
  distressedTexture,
  enrichGraphicSystems,
} from "./shared";

export const vintageLabelTemplate: CompositionTemplate = {
  id: "vintage-label",
  label: "Vintage Label System",
  description: "Heritage label blocks with distressed texture and coordinate marks",
  matches: (ctx) => {
    const effects = ctx.engine.input.brief?.materialEffects?.toLowerCase() ?? "";
    if (effects.includes("distress") || effects.includes("vintage")) return 85;
    const mood = ctx.engine.creativeBrief.moodKeywords.join(" ").toLowerCase();
    if (mood.includes("heritage") || mood.includes("vintage")) return 70;
    return 30;
  },
  apply: (ctx) => {
    const typographySpec = cloneSpecs(ctx.engine.typographySpec);
    const layoutSpec = cloneSpecs(ctx.engine.layoutSpec);
    const panel = layoutSpec.backLayout ?? layoutSpec.frontLayout;

    for (const block of typographySpec.blocks) {
      if (block.role === "hero" && panel) {
        block.fontFamily = "Cormorant Garamond, Georgia, serif";
        block.positionMm = {
          x: panel.boundingBoxMm.width / 2,
          y: panel.offsetFromCollarMm + panel.boundingBoxMm.height * 0.36,
        };
      }
      if (block.role === "micro" && panel) {
        block.fontSizeMm = Math.max(3.5, block.fontSizeMm * 0.65);
        block.opacity = 0.55;
        block.positionMm = {
          x: panel.boundingBoxMm.width / 2,
          y: panel.offsetFromCollarMm + panel.boundingBoxMm.height * 0.55,
        };
      }
    }

    const graphicSpec = enrichGraphicSystems(ctx.engine.graphicSpec, {
      lineSystems: [
        ...basePremiumGraphics(ctx),
        {
          id: "label-frame",
          type: "grid",
          count: 2,
          strokeWidthMm: 0.8,
          spacingMm: 24,
          opacity: 0.55,
        },
      ],
      symbols: [
        {
          id: "vintage-seal",
          name: "heritage-seal",
          abstraction: "organic",
          meaning: "Vintage label seal",
          strokeWidthMm: 1,
          dimensionsMm: { width: 14, height: 14 },
        },
      ],
      textures: distressedTexture(),
      abstractElements: [
        {
          id: "vintage-label-block",
          geometry: "heritage-label",
          dimensionsMm: "label",
          coordinates: "center",
          layerOrder: 1,
        },
        {
          id: "coord-mark",
          geometry: "coordinates",
          dimensionsMm: "micro",
          coordinates: "lower-right",
          layerOrder: 3,
        },
      ],
    });

    return {
      typographySpec,
      layoutSpec,
      graphicSpec,
      compositionSpec: boostCompositionScore(ctx.engine.compositionSpec, 7),
    };
  },
};
