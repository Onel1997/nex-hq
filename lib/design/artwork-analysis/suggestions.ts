import type {
  AnalysisSuggestion,
  ColorPaletteAnalysis,
  CompositionAnalysis,
  CreativeAnalysis,
  PrintAnalysis,
} from "./types";

export function buildSuggestions(input: {
  colors: ColorPaletteAnalysis;
  composition: CompositionAnalysis;
  print: PrintAnalysis;
  creative: CreativeAnalysis;
}): AnalysisSuggestion[] {
  const suggestions: AnalysisSuggestion[] = [];

  if (input.colors.contrastScore < 55) {
    suggestions.push({
      id: "improve-contrast",
      message: "Consider increasing contrast between type and artwork for cleaner DTG output.",
      optional: true,
    });
  }

  if (input.composition.negativeSpacePercent < 35) {
    suggestions.push({
      id: "increase-whitespace",
      message: "Optional: increase whitespace around the artwork for a more premium garment read.",
      optional: true,
    });
  }

  if (input.creative.complexity === "High") {
    suggestions.push({
      id: "reduce-complexity",
      message: "Optional: reduce fine detail density to lower screen-print and embroidery risk.",
      optional: true,
    });
  }

  if (input.print.coverageLabel === "Low" && input.print.placement === "Center chest") {
    suggestions.push({
      id: "increase-print-size",
      message: "Optional: increase print size if the design should read stronger on oversized blanks.",
      optional: true,
    });
  }

  return suggestions;
}
