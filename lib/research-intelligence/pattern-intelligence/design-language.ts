import type {
  AggregatedDesignPattern,
  DesignLanguage,
  ExtractedProductPattern,
} from "./types";
import { findDominantTraits } from "./similarity";
import { resolveProductTarget } from "./product-target";
import {
  dedupeMaterialTraits,
  dedupeSilhouettes,
  filterSilhouettesForScope,
} from "../clean-signals";
import { deriveResearchScope } from "../clean-signals/research-scope";

function joinTraits(values: string[]): string {
  return values.slice(0, 4).join(", ");
}

export function buildDesignLanguage(
  extracted: ExtractedProductPattern[],
  aggregated: AggregatedDesignPattern[],
  catalogTitles: string[],
  userRequest?: string,
): DesignLanguage {
  function dominantOr(
    dimension: import("./types").PatternDimension,
    fallback: string[],
  ): string[] {
    const traits = findDominantTraits(extracted, dimension);
    if (traits.length > 0) return traits;
    const fromAgg = aggregated.find((p) => p.dimension === dimension)?.traits ?? [];
    return fromAgg.length > 0 ? fromAgg : fallback;
  }

  const typography = dominantOr("typography", ["Minimal Sans", "Ruhige Hierarchie"]);
  const placement = dominantOr("placement", ["Großer Rückenprint", "Kleine Bruststickerei"]);
  const colorWorld = dominantOr("colorWorld", ["Schwarz", "Off White", "Washed Grey"]);
  const graphicStyle = dominantOr("graphicStyle", ["Archive", "Quiet Luxury"]);
  const printTechnique = dominantOr("printTechnique", ["Screen Print", "Embroidery"]);
  const material = dedupeMaterialTraits(dominantOr("material", ["Heavyweight Cotton", "380–480 GSM"]));
  const scope = deriveResearchScope(userRequest);
  const silhouette = filterSilhouettesForScope(
    dominantOr("silhouette", []).length > 0
      ? dominantOr("silhouette", [])
      : scope.allowedSilhouettes,
    scope,
  );

  const prohibitions = [
    ...catalogTitles.slice(0, 5).map((title) => `Nicht kopieren: ${title}`),
    "Keine bestehenden Milaene-Produktnamen übernehmen",
    "Keine 1:1-Reproduktion bestehender Grafiken",
  ];

  const patternSummary = [
    `Typografie: ${joinTraits(typography)}`,
    `Platzierung: ${joinTraits(placement)}`,
    `Farbwelt: ${joinTraits(colorWorld)}`,
    `Grafik: ${joinTraits(graphicStyle)}`,
    `Material: ${joinTraits(material)}`,
    `Druck: ${joinTraits(printTechnique)}`,
  ].join("\n");

  return {
    typography,
    placement,
    colorWorld,
    graphicStyle,
    symbolism: findDominantTraits(extracted, "symbolism", 2),
    complexity: findDominantTraits(extracted, "complexity", 2),
    negativeSpace: findDominantTraits(extracted, "negativeSpace", 2),
    lineWork: findDominantTraits(extracted, "lineWork", 2),
    printTechnique,
    material,
    silhouette,
    premiumLevel: findDominantTraits(extracted, "premiumLevel", 2),
    palette: colorWorld,
    guardrails: [
      "Quiet Luxury — Zurückhaltung vor Volumen",
      "Monochrome Neutrals bevorzugen",
      "Einzelnes Fokusmotiv statt Collage",
      "Premium Heavyweight als Standard",
    ],
    risks: [
      "Laute Grafiken verwässern die Archive-Positionierung",
      "Neon- oder Festival-Ästhetik widerspricht Milaene-DNA",
    ],
    prohibitions: [...new Set(prohibitions)].slice(0, 10),
    patternSummary,
  };
}

export function deriveRecommendedSilhouette(
  designLanguage: DesignLanguage,
  userRequest?: string,
): { recommended: string; alternatives: string[] } {
  const scope = deriveResearchScope(userRequest);
  const recommended = resolveProductTarget({
    userRequest,
    patternSilhouette: designLanguage.silhouette.join(" "),
  });

  const alternatives = filterSilhouettesForScope(
    dedupeSilhouettes([
      ...designLanguage.silhouette,
      ...scope.allowedSilhouettes,
      "Oversized T-Shirt",
      "Heavyweight Hoodie",
      "Zip Hoodie",
      "Long Sleeve",
    ]),
    scope,
  )
    .filter((target) => target !== recommended)
    .slice(0, 3);

  return { recommended, alternatives };
}
