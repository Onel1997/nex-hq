import type {
  ColorPaletteAnalysis,
  CompositionAnalysis,
  GraphicStyleAnalysis,
  GraphicStyleLabel,
  TypographyAnalysis,
} from "./types";

function uniqueBadges(labels: GraphicStyleLabel[]): GraphicStyleLabel[] {
  return [...new Set(labels)];
}

export function analyzeGraphicStyle(input: {
  typography: TypographyAnalysis;
  composition: CompositionAnalysis;
  colors: ColorPaletteAnalysis;
  edgeDensity: number;
  svgMarkup?: string;
}): GraphicStyleAnalysis {
  const badges: GraphicStyleLabel[] = [];
  const { typography, composition, colors, edgeDensity } = input;

  if (typography.detected && typography.blocks.length > 0) {
    badges.push("Typography driven");
  }

  if (composition.negativeSpacePercent > 55) badges.push("Minimal");
  if (colors.swatches.length <= 3 && composition.negativeSpacePercent > 45) badges.push("Luxury");
  if (typography.style === "Editorial" || typography.style === "Luxury") badges.push("Editorial");
  if (typography.style === "Vintage") badges.push("Vintage");
  if (typography.style === "Streetwear" || typography.style === "Bold") badges.push("Streetwear");
  if (typography.style === "Industrial" || typography.style === "Technical") badges.push("Technical");
  if (edgeDensity > 0.16 && colors.swatches.length > 5) badges.push("Grunge");
  if (composition.symmetryScore > 78 && composition.visualWeight !== "Heavy") badges.push("Badge");
  if (typography.blocks.length === 1 && typography.blocks[0]?.content.length <= 3) {
    badges.push("Monogram");
  }

  const hasIllustration =
    !typography.detected || edgeDensity > 0.12 || /path|circle|polygon/i.test(input.svgMarkup ?? "");
  if (hasIllustration && !badges.includes("Typography driven")) badges.push("Illustration");

  const resolved = uniqueBadges(badges);
  const primary = resolved[0] ?? "Mixed";
  const secondary = resolved[1];

  return {
    primary,
    secondary,
    badges: resolved.length > 0 ? resolved : ["Mixed"],
    summary: `${primary}${secondary ? ` with ${secondary.toLowerCase()} cues` : ""} — ${composition.visualWeight.toLowerCase()} visual mass.`,
  };
}
