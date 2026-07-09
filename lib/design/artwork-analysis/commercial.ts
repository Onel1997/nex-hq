import type {
  BrandDnaAnalysis,
  ColorPaletteAnalysis,
  CommercialAnalysis,
  CompositionAnalysis,
  GraphicStyleAnalysis,
  TypographyAnalysis,
} from "./types";

export function analyzeCommercial(input: {
  typography: TypographyAnalysis;
  colors: ColorPaletteAnalysis;
  composition: CompositionAnalysis;
  graphicStyle: GraphicStyleAnalysis;
  brandDna: BrandDnaAnalysis;
  edgeDensity: number;
  complexity: "Low" | "Medium" | "High";
}): CommercialAnalysis {
  const { typography, colors, composition, graphicStyle, brandDna, edgeDensity, complexity } = input;

  const luxuryFeel = Math.round(
    brandDna.traits.find((t) => t.label === "Luxury")?.score ??
      composition.negativeSpacePercent * 0.6 + colors.printFriendliness * 0.2,
  );

  const commercialPotential = Math.round(
    (typography.hierarchyScore * 0.2 +
      composition.qualityScore * 0.25 +
      colors.contrastScore * 0.2 +
      brandDna.overallScore * 0.35),
  );

  const brandConsistency = brandDna.overallScore;

  const trendPotential = Math.round(
    (graphicStyle.badges.includes("Streetwear") ? 72 : 55) * 0.4 +
      (graphicStyle.badges.includes("Vintage") ? 68 : 50) * 0.2 +
      colors.contrastScore * 0.2 +
      typography.hierarchyScore * 0.2,
  );

  const productionRisk = Math.min(
    100,
    Math.round(
      (complexity === "High" ? 55 : complexity === "Medium" ? 30 : 12) +
        (colors.swatches.length > 6 ? 20 : 0) +
        (edgeDensity > 0.18 ? 15 : 0) +
        (colors.printFriendliness < 50 ? 18 : 0),
    ),
  );

  const manufacturingDifficulty = Math.min(
    100,
    Math.round(
      (complexity === "High" ? 70 : complexity === "Medium" ? 42 : 18) +
        (colors.swatches.length > 5 ? 15 : 0) +
        (typography.blocks.length > 4 ? 12 : 0) +
        edgeDensity * 120,
    ),
  );

  const summary =
    commercialPotential >= 75
      ? "Strong commercial read — luxury positioning with manageable production risk."
      : commercialPotential >= 55
        ? "Solid commercial potential — review contrast and complexity before scale."
        : "Commercial potential limited — simplify palette or increase hierarchy clarity.";

  return {
    luxuryFeel,
    commercialPotential,
    brandConsistency,
    trendPotential,
    productionRisk,
    manufacturingDifficulty,
    summary,
  };
}
