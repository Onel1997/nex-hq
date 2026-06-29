import type { CompositionPattern } from "@/lib/design/design-knowledge/composition-language/patterns";
import { buildAllCompositionPatterns } from "@/lib/design/design-knowledge/composition-language/patterns";
import type { KnowledgeQuery } from "@/lib/design/design-knowledge/types";
import { knuth } from "@/lib/design/design-knowledge/shared/variant";

let _cache: CompositionPattern[] | null = null;

export function getCompositionPatterns(): CompositionPattern[] {
  if (!_cache) _cache = buildAllCompositionPatterns();
  return _cache;
}

export function selectCompositionPattern(query: KnowledgeQuery, collectionId?: string): CompositionPattern {
  const patterns = getCompositionPatterns();
  const text = `${query.visualConcept} ${collectionId ?? ""}`.toLowerCase();

  const scored = patterns.map((p) => {
    let score = knuth(query.seed, p.meta.variant + 400) * 10;
    for (const tag of p.meta.tags) if (text.includes(tag)) score += 12;
    for (const col of p.meta.collections) if (text.includes(col) || collectionId === col) score += 15;
    if (query.role.toLowerCase().includes("hero") && p.movementRequired) score += 8;
    return { pattern: p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const pick = Math.floor(knuth(query.seed, 499) * Math.min(6, scored.length));
  return scored[pick]!.pattern;
}
