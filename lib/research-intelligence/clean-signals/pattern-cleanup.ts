import type { AggregatedDesignPattern, PatternDimension } from "../pattern-intelligence/types";
import { INSUFFICIENT_SHOPIFY_EVIDENCE } from "../pattern-intelligence/extractor";
import { deriveResearchScope, filterSilhouettesForScope } from "./research-scope";
import { dedupeMaterialTraits, dedupeSilhouettes, normalizeSilhouetteLabel } from "./product-terminology";

function cleanTraitsForDimension(
  dimension: PatternDimension,
  traits: string[],
  userRequest?: string,
): string[] {
  if (traits.length === 0) return [];

  if (dimension === "silhouette") {
    const scope = deriveResearchScope(userRequest);
    const scoped = filterSilhouettesForScope(traits, scope);
    if (scoped.length > 0) return scoped.slice(0, 4);
    const fallback = scopeApprovedFromRequest(scope);
    return fallback.length > 0 ? fallback : [];
  }

  if (dimension === "material") {
    return dedupeMaterialTraits(traits).slice(0, 6);
  }

  const unique = [...new Set(traits.map((trait) => trait.trim()).filter(Boolean))];
  return unique.slice(0, 6);
}

function scopeApprovedFromRequest(scope: ReturnType<typeof deriveResearchScope>): string[] {
  if (/hoodie/i.test(scope.userRequest)) {
    return ["Heavyweight Hoodie", "Oversized Hoodie", "Zip Hoodie"];
  }
  return dedupeSilhouettes(
    scope.allowedSilhouettes.map((label) => normalizeSilhouetteLabel(label) ?? label),
  ).slice(0, 3);
}

export function cleanAggregatedPatterns(
  patterns: AggregatedDesignPattern[],
  userRequest?: string,
): AggregatedDesignPattern[] {
  return patterns.map((pattern) => {
    const traits = cleanTraitsForDimension(pattern.dimension, pattern.traits, userRequest);
    return {
      ...pattern,
      traits:
        traits.length > 0 ? traits : [INSUFFICIENT_SHOPIFY_EVIDENCE],
      evidence:
        traits.length > 0
          ? pattern.evidence.filter((line) => line !== INSUFFICIENT_SHOPIFY_EVIDENCE).slice(0, 2)
          : [INSUFFICIENT_SHOPIFY_EVIDENCE],
    };
  });
}

export function sanitizeSuccessReasons(reasons: string[]): string[] {
  return reasons
    .map((reason) =>
      reason
        .replace(/Faith Oversized Tee|Dreams Oversized Tee|Love Story/gi, "Shopify-Bestseller")
        .replace(/Outsider Sherpa Jacke[^.]*mit Stick/gi, "Shopify-Bestseller aus Heavyweight-Kategorien")
        .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+ (Tee|Hoodie)[^.]*/g, "Shopify-Bestseller aus Oversized- und Heavyweight-Kategorien"),
    )
    .filter((value, index, array) => array.indexOf(value) === index)
    .slice(0, 4);
}
