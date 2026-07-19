import type { AggregatedDesignPattern, ExtractedProductPattern, PatternDimension } from "./types";
import { PATTERN_DIMENSION_LABELS } from "./types";
import { INSUFFICIENT_SHOPIFY_EVIDENCE } from "./extractor";

function traitKey(dimension: PatternDimension, trait: string): string {
  return `${dimension}:${trait.toLowerCase().trim()}`;
}

export function aggregatePatterns(
  extracted: ExtractedProductPattern[],
): AggregatedDesignPattern[] {
  const buckets = new Map<
    string,
    {
      dimension: PatternDimension;
      trait: string;
      count: number;
      evidence: string[];
      weight: number;
    }
  >();

  for (const item of extracted) {
    const weight = Math.max(1, item.unitsSold);
    for (const [dimension, traits] of Object.entries(item.patterns) as Array<
      [PatternDimension, string[]]
    >) {
      if (!traits?.length) continue;
      const dimEvidence = item.dimensionEvidence?.[dimension] ?? [];
      for (const trait of traits) {
        const key = traitKey(dimension, trait);
        const existing = buckets.get(key);
        const traitEvidence = dimEvidence.filter(
          (line) => line !== INSUFFICIENT_SHOPIFY_EVIDENCE,
        );
        if (existing) {
          existing.count += 1;
          existing.weight += weight;
          for (const reason of traitEvidence) {
            if (existing.evidence.length < 2 && !existing.evidence.includes(reason)) {
              existing.evidence.push(reason);
            }
          }
        } else {
          buckets.set(key, {
            dimension,
            trait,
            count: 1,
            weight,
            evidence: traitEvidence.slice(0, 2),
          });
        }
      }
    }
  }

  const byDimension = new Map<PatternDimension, AggregatedDesignPattern>();

  for (const entry of buckets.values()) {
    const current = byDimension.get(entry.dimension);
    const evidence =
      entry.evidence.length > 0
        ? entry.evidence
        : [INSUFFICIENT_SHOPIFY_EVIDENCE];

    if (!current) {
      byDimension.set(entry.dimension, {
        dimension: entry.dimension,
        dimensionLabel: PATTERN_DIMENSION_LABELS[entry.dimension],
        traits: [entry.trait],
        frequency: entry.count,
        evidence,
      });
      continue;
    }

    current.traits.push(entry.trait);
    current.frequency = Math.max(current.frequency, entry.count);
    for (const ev of evidence) {
      if (
        current.evidence.length < 2 &&
        !current.evidence.includes(ev) &&
        ev !== INSUFFICIENT_SHOPIFY_EVIDENCE
      ) {
        current.evidence.push(ev);
      }
    }
    if (current.evidence.length === 0) {
      current.evidence = [INSUFFICIENT_SHOPIFY_EVIDENCE];
    }
  }

  const dimensionOrder: PatternDimension[] = [
    "typography",
    "placement",
    "colorWorld",
    "graphicStyle",
    "symbolism",
    "complexity",
    "negativeSpace",
    "lineWork",
    "material",
    "silhouette",
    "printTechnique",
    "premiumLevel",
  ];

  return dimensionOrder
    .map((dimension) => byDimension.get(dimension))
    .filter((item): item is AggregatedDesignPattern => Boolean(item))
    .map((item) => ({
      ...item,
      traits: [...new Set(item.traits)].slice(0, 6),
      evidence:
        item.evidence.length > 0 ? item.evidence : [INSUFFICIENT_SHOPIFY_EVIDENCE],
    }));
}

export function findDominantTraits(
  extracted: ExtractedProductPattern[],
  dimension: PatternDimension,
  limit = 4,
): string[] {
  const counts = new Map<string, number>();
  for (const item of extracted) {
    for (const trait of item.patterns[dimension] ?? []) {
      const key = trait.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1 + Math.min(item.unitsSold, 20));
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([trait]) => {
      for (const item of extracted) {
        const match = item.patterns[dimension]?.find(
          (t) => t.toLowerCase() === trait,
        );
        if (match) return match;
      }
      return trait;
    });
}
