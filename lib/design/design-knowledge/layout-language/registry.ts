import type { LayoutRecipe } from "@/lib/design/design-knowledge/layout-language/types";
import { buildAllLayoutRecipes, LAYOUT_RECIPE_TARGET } from "@/lib/design/design-knowledge/layout-language/archetypes";
import type { KnowledgeQuery } from "@/lib/design/design-knowledge/types";
import { knuth } from "@/lib/design/design-knowledge/shared/variant";

let _cache: LayoutRecipe[] | null = null;

export function getLayoutRecipes(): LayoutRecipe[] {
  if (!_cache) _cache = buildAllLayoutRecipes();
  return _cache;
}

export function getLayoutRecipeCount(): number {
  return LAYOUT_RECIPE_TARGET;
}

export function getLayoutRecipeById(id: string): LayoutRecipe | undefined {
  return getLayoutRecipes().find((r) => r.id === id);
}

export function getLayoutsByFamily(family: string): LayoutRecipe[] {
  return getLayoutRecipes().filter((r) => r.meta.family === family);
}

export function getLayoutsByCollection(collection: string): LayoutRecipe[] {
  return getLayoutRecipes().filter((r) => r.meta.collections.includes(collection));
}

export function selectLayoutRecipe(query: KnowledgeQuery): LayoutRecipe {
  const recipes = getLayoutRecipes();
  const text = `${query.visualConcept} ${query.product} ${query.placement} ${query.collectionHint ?? ""}`.toLowerCase();

  const scored = recipes.map((r) => {
    let score = knuth(query.seed, r.meta.variant) * 20;
    for (const tag of r.meta.tags) {
      if (text.includes(tag.replace(/-/g, " ")) || text.includes(tag)) score += 12;
    }
    for (const col of r.meta.collections) {
      if (text.includes(col) || query.collectionHint === col) score += 15;
    }
    if (text.includes("oversized") && r.meta.garmentFit.includes("oversized-front")) score += 10;
    if (text.includes("back") && r.meta.garmentFit.includes("oversized-back")) score += 10;
    if (text.includes("faith") && r.meta.collections.includes("faith")) score += 20;
    if (text.includes("silent") && r.meta.collections.includes("silent")) score += 18;
    if (text.includes("museum") && r.meta.collections.includes("museum")) score += 16;
    if (query.role.toLowerCase().includes("hero") && r.tension >= 0.6) score += 8;
    return { recipe: r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const topN = Math.min(8, scored.length);
  const pick = Math.floor(knuth(query.seed, 99) * topN);
  return scored[pick]!.recipe;
}
