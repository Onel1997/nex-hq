import type {
  BrandDnaAnalysis,
  ColorPaletteAnalysis,
  CompositionAnalysis,
  GraphicStyleAnalysis,
  TypographyAnalysis,
} from "./types";

const MILAENE_TRAITS = [
  { label: "Premium", weight: 1.1 },
  { label: "Minimal", weight: 1.0 },
  { label: "Emotional", weight: 0.9 },
  { label: "Luxury", weight: 1.15 },
  { label: "Streetwear", weight: 0.85 },
  { label: "Editorial", weight: 1.05 },
] as const;

export function analyzeBrandDna(input: {
  typography: TypographyAnalysis;
  colors: ColorPaletteAnalysis;
  composition: CompositionAnalysis;
  graphicStyle: GraphicStyleAnalysis;
}): BrandDnaAnalysis {
  const { typography, colors, composition, graphicStyle } = input;
  const inkCount = colors.swatches.filter((s) => s.role !== "background").length;

  const traitScores = MILAENE_TRAITS.map((trait) => {
    let score = 42;

    if (trait.label === "Premium" || trait.label === "Luxury") {
      score += composition.negativeSpacePercent > 45 ? 22 : 8;
      score += inkCount <= 3 ? 18 : inkCount <= 5 ? 8 : -8;
      score += colors.printFriendliness > 65 ? 10 : 0;
    }
    if (trait.label === "Minimal") {
      score += composition.negativeSpacePercent > 50 ? 25 : 10;
      score += inkCount <= 2 ? 20 : inkCount <= 4 ? 8 : -10;
      score += graphicStyle.badges.includes("Minimal") ? 12 : 0;
    }
    if (trait.label === "Emotional") {
      score += typography.style === "Editorial" || typography.style === "Vintage" ? 18 : 8;
      score += composition.readingDirection === "Top-down" ? 10 : 5;
    }
    if (trait.label === "Streetwear") {
      score += typography.style === "Streetwear" || typography.style === "Bold" ? 22 : 4;
      score += graphicStyle.badges.includes("Typography driven") ? 12 : 0;
      score += composition.visualWeight === "Heavy" ? 10 : 0;
    }
    if (trait.label === "Editorial") {
      score += typography.style === "Editorial" || typography.style === "Luxury" ? 24 : 6;
      score += graphicStyle.badges.includes("Editorial") ? 15 : 0;
      score += composition.alignment === "Centered" || composition.alignment === "Symmetric" ? 8 : 0;
    }

    const normalized = Math.max(0, Math.min(100, Math.round(score * trait.weight)));
    return {
      label: trait.label,
      score: normalized,
      match: normalized >= 62,
    };
  });

  const overallScore = Math.round(
    traitScores.reduce((sum, t) => sum + t.score, 0) / traitScores.length,
  );

  const matched = traitScores.filter((t) => t.match).map((t) => t.label);
  const summary =
    matched.length >= 3
      ? `Strong Milaene alignment — reads ${matched.slice(0, 3).join(", ").toLowerCase()}.`
      : matched.length > 0
        ? `Partial Milaene fit via ${matched.join(", ").toLowerCase()} — review restraint and negative space.`
        : "Artwork diverges from Milaene calm-luxury DNA — consider simplifying palette and mass.";

  return { overallScore, traits: traitScores, summary };
}
