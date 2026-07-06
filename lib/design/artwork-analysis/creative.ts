import type {
  CommercialAnalysis,
  CompositionAnalysis,
  CreativeAnalysis,
  GraphicStyleAnalysis,
  TypographyAnalysis,
} from "./types";

export function analyzeCreative(input: {
  typography: TypographyAnalysis;
  composition: CompositionAnalysis;
  graphicStyle: GraphicStyleAnalysis;
  commercial: CommercialAnalysis;
  edgeDensity: number;
  inkCount: number;
}): CreativeAnalysis {
  const { typography, composition, graphicStyle, commercial, edgeDensity, inkCount } = input;

  const complexity =
    edgeDensity > 0.16 || inkCount > 6 || typography.blocks.length > 4
      ? "High"
      : edgeDensity > 0.09 || inkCount > 3
        ? "Medium"
        : "Low";

  const targetAudience =
    graphicStyle.badges.includes("Streetwear") || typography.style === "Bold"
      ? "Premium streetwear buyers 22–35"
      : graphicStyle.badges.includes("Luxury") || graphicStyle.badges.includes("Editorial")
        ? "Calm-luxury enthusiasts 25–40"
        : graphicStyle.badges.includes("Vintage")
          ? "Archive and heritage collectors"
          : "Design-conscious everyday wearers";

  const emotion =
    typography.style === "Vintage"
      ? "Nostalgic restraint"
      : typography.style === "Bold" || typography.style === "Streetwear"
        ? "Confident energy"
        : composition.negativeSpacePercent > 55
          ? "Quiet confidence"
          : "Controlled intensity";

  const storytelling =
    typography.detected
      ? `Typography-led narrative with ${typography.style.toLowerCase()} voice and ${composition.readingDirection.toLowerCase()} flow.`
      : `Visual-symbol storytelling — ${graphicStyle.primary.toLowerCase()} language with ${composition.focalPoint.label.toLowerCase()}.`;

  return {
    targetAudience,
    emotion,
    storytelling,
    complexity,
    luxuryPositioning: commercial.luxuryFeel,
    visualHierarchy: typography.hierarchyScore,
    manufacturingComplexity: commercial.manufacturingDifficulty,
  };
}
