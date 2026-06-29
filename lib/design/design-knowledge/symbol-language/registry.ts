import type { SymbolSystemRecipe } from "@/lib/design/design-knowledge/symbol-language/types";
import { buildAllSymbolSystems, SYMBOL_RECIPE_TARGET } from "@/lib/design/design-knowledge/symbol-language/archetypes";
import type { KnowledgeQuery } from "@/lib/design/design-knowledge/types";
import { knuth } from "@/lib/design/design-knowledge/shared/variant";

let _cache: SymbolSystemRecipe[] | null = null;

export function getSymbolSystems(): SymbolSystemRecipe[] {
  if (!_cache) _cache = buildAllSymbolSystems();
  return _cache;
}

export function getSymbolSystemCount(): number {
  return SYMBOL_RECIPE_TARGET;
}

export function getSymbolSystemById(id: string): SymbolSystemRecipe | undefined {
  return getSymbolSystems().find((r) => r.id === id);
}

export function selectSymbolSystem(query: KnowledgeQuery, layoutFamily?: string): SymbolSystemRecipe {
  const systems = getSymbolSystems();
  const text = `${query.visualConcept} ${query.product}`.toLowerCase();

  const scored = systems.map((r) => {
    let score = knuth(query.seed, r.meta.variant + 200) * 12;
    for (const tag of r.meta.tags) if (text.includes(tag)) score += 10;
    for (const col of r.meta.collections) if (text.includes(col)) score += 14;
    if (text.includes("faith") && r.meta.collections.includes("faith")) score += 20;
    if (text.includes("architect") && r.meta.collections.includes("architect")) score += 16;
    if (text.includes("gallery") && r.meta.family === "Gallery Marks") score += 14;
    if (layoutFamily?.includes("Faith") && r.meta.family === "Cross Systems") score += 18;
    if (query.role.toLowerCase().includes("hero") && r.priority === "dominant") score += 8;
    return { recipe: r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const pick = Math.floor(knuth(query.seed, 299) * Math.min(8, scored.length));
  return scored[pick]!.recipe;
}
