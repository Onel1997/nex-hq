import { MILAENE_DNA, scoreDnaAlignment } from "@/services/milaene-dna";
import type { TrendDimension, TrendIntelligence } from "@/lib/research/types";
import type { TrendScore } from "@/services/trendScanner";
import type { MilaeneCommerceBaseline } from "@/lib/commerce/milaene-commerce-baseline";

function dim(
  label: string,
  change: number,
  direction: "up" | "down" | "stable" = change >= 0 ? "up" : "down",
): TrendDimension {
  const dnaMatch = scoreDnaAlignment({
    colorMatch: /earth|obsidian|signal|concrete|off white|sage/i.test(label)
      ? 90
      : 65,
    silhouetteMatch: MILAENE_DNA.silhouettes.some((s) =>
      label.toLowerCase().includes(s),
    )
      ? 92
      : 60,
    styleMatch: /premium|editorial|minimal|embroidery/i.test(label) ? 88 : 70,
  });
  return { label, change, direction, dnaMatch };
}

const BASE_COLOR_TRENDS: TrendDimension[] = [
  dim("Earth Brown", 22, "up"),
  dim("Sage Green", 18, "up"),
  dim("Obsidian Black", 8, "stable"),
  dim("Off White", 6, "stable"),
  dim("Signal Green", 14, "up"),
  dim("Concrete Grey", 5, "stable"),
];

const BASE_SILHOUETTE_TRENDS: TrendDimension[] = [
  dim("Oversized", 18, "up"),
  dim("Boxy", 14, "up"),
  dim("Relaxed", 12, "up"),
  dim("Slim Fit", -8, "down"),
  dim("Wide-leg", 10, "up"),
];

const BASE_MATERIAL_TRENDS: TrendDimension[] = [
  dim("Heavy Cotton", 15, "up"),
  dim("French Terry", 12, "up"),
  dim("Premium Fleece", 16, "up"),
  dim("Embroidery Detail", 12, "up"),
];

const BASE_GRAPHIC_TRENDS: TrendDimension[] = [
  dim("Minimal Typography", 10, "up"),
  dim("Embroidered Logo", 14, "up"),
  dim("Tone-on-tone Graphics", 8, "up"),
  dim("Bold All-over Prints", -6, "down"),
];

const BASE_SEASON_TRENDS: TrendDimension[] = [
  dim("SS26 Earth Capsule", 20, "up"),
  dim("AW25 Layering", 11, "up"),
  dim("Transitional Outerwear", 16, "up"),
];

export interface TrendIntelligenceInput {
  trendScores?: TrendScore[];
  baseline?: MilaeneCommerceBaseline | null;
}

/** Analyze colors, silhouettes, materials, graphics and seasonal trends. */
export function analyzeTrendIntelligence(
  input: TrendIntelligenceInput = {},
): TrendIntelligence {
  const { trendScores, baseline } = input;

  const risingFromScores: TrendDimension[] = (trendScores ?? [])
    .filter((t) => t.direction === "up")
    .map((t) => dim(t.label, t.change, "up"));

  const decliningFromScores: TrendDimension[] = (trendScores ?? [])
    .filter((t) => t.direction === "down")
    .map((t) => dim(t.label, t.change, "down"));

  const catalogColors =
    baseline?.productKnowledge.availableColors.slice(0, 4).map((c) =>
      dim(c, 8, "stable"),
    ) ?? [];

  const colors = mergeDimensions(BASE_COLOR_TRENDS, catalogColors).slice(0, 6);
  const silhouettes = BASE_SILHOUETTE_TRENDS;
  const materials = BASE_MATERIAL_TRENDS;
  const graphics = BASE_GRAPHIC_TRENDS;
  const seasons = BASE_SEASON_TRENDS;

  const rising = mergeDimensions(
    risingFromScores,
    [...colors, ...silhouettes].filter((d) => d.direction === "up"),
  ).slice(0, 8);

  const declining = mergeDimensions(decliningFromScores, [
    ...silhouettes,
    ...graphics,
  ].filter((d) => d.direction === "down")).slice(0, 4);

  const newOpportunities = [
    ...baseline?.productKnowledge.categoryGaps.slice(0, 3).map((g) => `${g} expansion`) ?? [],
    "Earth tone capsule — low competition",
    "Premium embroidery line — differentiation",
    "Heavy outerwear — category gap",
  ].slice(0, 5);

  return {
    colors,
    silhouettes,
    materials,
    graphics,
    seasons,
    rising,
    declining,
    newOpportunities,
  };
}

function mergeDimensions(
  primary: TrendDimension[],
  secondary: TrendDimension[],
): TrendDimension[] {
  const seen = new Set<string>();
  const result: TrendDimension[] = [];
  for (const item of [...primary, ...secondary]) {
    const key = item.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}
