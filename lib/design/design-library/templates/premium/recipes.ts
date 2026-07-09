import type { OrnamentId } from "@/lib/design/design-library/types";
import type { PremiumTemplateLayoutConfig } from "@/lib/design/design-library/templates/premium/types";
import type { SymbolRecipe } from "@/lib/design/design-library/templates/premium/shared/symbols-build";

export interface TemplateRecipeBundle {
  layout: PremiumTemplateLayoutConfig;
  symbols: SymbolRecipe;
  ornaments: OrnamentId[][];
}

export const LUXURY_EDITORIAL_RECIPE: TemplateRecipeBundle = {
  layout: {
    id: "luxury-editorial",
    typographyMode: "stacked-headline",
    apparelBias: ["oversized-front", "oversized-back", "center-chest"],
    focalShift: { x: 0.02, y: 0.18 },
    scaleMultiplier: 1.05,
    asymmetry: 0.12,
    negativeSpaceBias: 0.42,
    depthOpacity: 0.11,
    preferOversized: true,
  },
  symbols: {
    primary: "frame",
    secondary: "interrupted-arc",
    nested: ["broken-circle", "missing-center-void"],
    includeHalo: true,
    includeDirectional: true,
  },
  ornaments: [
    ["rule-lines", "editorial-dividers", "roman-ids"],
    ["vertical-rules", "micro-dots", "tiny-capsules"],
  ],
};

export const GALLERY_POSTER_RECIPE: TemplateRecipeBundle = {
  layout: {
    id: "gallery-poster",
    typographyMode: "oversized-headline",
    apparelBias: ["oversized-front", "oversized-back"],
    focalShift: { x: -0.03, y: 0.22 },
    scaleMultiplier: 1.12,
    asymmetry: 0.18,
    negativeSpaceBias: 0.38,
    depthOpacity: 0.1,
    preferOversized: true,
  },
  symbols: {
    primary: "broken-circle",
    secondary: "orbit",
    nested: ["interrupted-arc", "frame"],
    includeHalo: false,
    includeDirectional: true,
  },
  ornaments: [
    ["collection-numbers", "corner-marks", "editorial-dividers"],
    ["micro-lines", "vertical-rules", "flank-strikes"],
  ],
};

export const MUSEUM_LABEL_RECIPE: TemplateRecipeBundle = {
  layout: {
    id: "museum-label",
    typographyMode: "museum-label",
    apparelBias: ["center-chest", "oversized-front"],
    focalShift: { x: 0.08, y: 0.14 },
    scaleMultiplier: 0.92,
    asymmetry: 0.22,
    negativeSpaceBias: 0.48,
    depthOpacity: 0.09,
    preferOversized: false,
  },
  symbols: {
    primary: "diamond",
    secondary: "frame",
    nested: ["missing-center-void", "minimal-star"],
    includeHalo: false,
    includeDirectional: false,
  },
  ornaments: [
    ["registration-marks", "alignment-guides", "luxury-borders"],
    ["micro-dots", "roman-ids", "minimal-labels"],
  ],
};

export const ARCHITECTURAL_FRAME_RECIPE: TemplateRecipeBundle = {
  layout: {
    id: "architectural-frame",
    typographyMode: "broken-typography",
    apparelBias: ["oversized-front", "oversized-back", "dual-print"],
    focalShift: { x: 0.04, y: 0.16 },
    scaleMultiplier: 1.08,
    asymmetry: 0.15,
    negativeSpaceBias: 0.4,
    depthOpacity: 0.12,
    preferOversized: true,
  },
  symbols: {
    primary: "architectural-line",
    secondary: "broken-circle",
    nested: ["frame", "interrupted-arc"],
    includeHalo: true,
    includeDirectional: true,
  },
  ornaments: [
    ["luxury-borders", "flank-strikes", "rule-lines"],
    ["vertical-rules", "editorial-dividers", "alignment-guides"],
  ],
};

export const FAITH_COLLECTION_RECIPE: TemplateRecipeBundle = {
  layout: {
    id: "faith-collection",
    typographyMode: "vertical-typography",
    apparelBias: ["oversized-front", "center-chest"],
    focalShift: { x: 0.06, y: 0.2 },
    scaleMultiplier: 1.02,
    asymmetry: 0.1,
    negativeSpaceBias: 0.44,
    depthOpacity: 0.1,
    preferOversized: true,
  },
  symbols: {
    primary: "sacred-geometry",
    secondary: "cross",
    nested: ["halo", "missing-center-void"],
    includeHalo: true,
    includeDirectional: false,
  },
  ornaments: [
    ["roman-ids", "minimal-labels", "rule-lines"],
    ["tiny-capsules", "micro-dots", "vertical-rules"],
  ],
};

export const OVERSIZED_GRAPHIC_RECIPE: TemplateRecipeBundle = {
  layout: {
    id: "oversized-graphic",
    typographyMode: "oversized-headline",
    apparelBias: ["oversized-front", "oversized-back"],
    focalShift: { x: 0, y: 0.24 },
    scaleMultiplier: 1.18,
    asymmetry: 0.14,
    negativeSpaceBias: 0.36,
    depthOpacity: 0.13,
    preferOversized: true,
  },
  symbols: {
    primary: "frame",
    secondary: "architectural-line",
    nested: ["broken-circle", "interrupted-arc", "orbit"],
    includeHalo: true,
    includeDirectional: true,
  },
  ornaments: [
    ["editorial-dividers", "vertical-rules", "flank-strikes"],
    ["collection-numbers", "rule-lines", "corner-marks"],
  ],
};

export const SILENT_COLLECTION_RECIPE: TemplateRecipeBundle = {
  layout: {
    id: "silent-collection",
    typographyMode: "split-typography",
    apparelBias: ["center-chest", "oversized-front"],
    focalShift: { x: -0.02, y: 0.12 },
    scaleMultiplier: 0.96,
    asymmetry: 0.2,
    negativeSpaceBias: 0.5,
    depthOpacity: 0.08,
    preferOversized: false,
  },
  symbols: {
    primary: "missing-center-void",
    secondary: "halo",
    nested: ["interrupted-arc", "minimal-star"],
    includeHalo: true,
    includeDirectional: false,
  },
  ornaments: [
    ["micro-dots", "tiny-capsules", "roman-ids"],
    ["micro-lines", "alignment-guides", "minimal-labels"],
  ],
};

export const MODERN_MINIMAL_RECIPE: TemplateRecipeBundle = {
  layout: {
    id: "modern-minimal",
    typographyMode: "split-typography",
    apparelBias: ["center-chest", "oversized-front"],
    focalShift: { x: 0.03, y: 0.15 },
    scaleMultiplier: 0.98,
    asymmetry: 0.16,
    negativeSpaceBias: 0.46,
    depthOpacity: 0.09,
    preferOversized: false,
  },
  symbols: {
    primary: "interrupted-arc",
    secondary: "missing-center-void",
    nested: ["frame", "broken-circle"],
    includeHalo: false,
    includeDirectional: true,
  },
  ornaments: [
    ["micro-dots", "alignment-guides", "tiny-capsules"],
    ["rule-lines", "micro-lines", "roman-ids"],
  ],
};

export const TECHNICAL_LUXURY_RECIPE: TemplateRecipeBundle = {
  layout: {
    id: "technical-luxury",
    typographyMode: "offset-typography",
    apparelBias: ["oversized-front", "dual-print"],
    focalShift: { x: 0.05, y: 0.17 },
    scaleMultiplier: 1.04,
    asymmetry: 0.11,
    negativeSpaceBias: 0.41,
    depthOpacity: 0.1,
    preferOversized: true,
  },
  symbols: {
    primary: "grid",
    secondary: "compass",
    nested: ["architectural-line", "directional-marker"],
    includeHalo: false,
    includeDirectional: true,
  },
  ornaments: [
    ["coordinates", "registration-marks", "alignment-guides"],
    ["rule-lines", "micro-lines", "collection-numbers"],
  ],
};

export const FASHION_CAMPAIGN_RECIPE: TemplateRecipeBundle = {
  layout: {
    id: "fashion-campaign",
    typographyMode: "curved-typography",
    apparelBias: ["oversized-front", "oversized-back"],
    focalShift: { x: -0.04, y: 0.21 },
    scaleMultiplier: 1.1,
    asymmetry: 0.19,
    negativeSpaceBias: 0.37,
    depthOpacity: 0.12,
    preferOversized: true,
  },
  symbols: {
    primary: "broken-circle",
    secondary: "frame",
    nested: ["diamond", "interrupted-arc"],
    includeHalo: true,
    includeDirectional: true,
  },
  ornaments: [
    ["editorial-dividers", "collection-numbers", "flank-strikes"],
    ["vertical-rules", "micro-dots", "luxury-borders"],
  ],
};
