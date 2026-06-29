import type { TypographyRecipe } from "@/lib/design/design-knowledge/typography-language/types";
import { buildAllTypographyRecipes, TYPOGRAPHY_RECIPE_TARGET } from "@/lib/design/design-knowledge/typography-language/archetypes";
import type { KnowledgeQuery } from "@/lib/design/design-knowledge/types";
import { knuth, pickScoredRecipe } from "@/lib/design/design-knowledge/shared/variant";

let _cache: TypographyRecipe[] | null = null;

export function getTypographyRecipes(): TypographyRecipe[] {
  if (!_cache) _cache = buildAllTypographyRecipes();
  return _cache;
}

export function getTypographyRecipeCount(): number {
  return TYPOGRAPHY_RECIPE_TARGET;
}

export function getTypographyRecipeById(id: string): TypographyRecipe | undefined {
  return getTypographyRecipes().find((r) => r.id === id);
}

export function selectTypographyRecipe(query: KnowledgeQuery, layoutFamily?: string): TypographyRecipe {
  const recipes = getTypographyRecipes();
  const text = `${query.visualConcept} ${query.product}`.toLowerCase();

  const scored = recipes.map((r) => {
    let score = knuth(query.seed, r.meta.variant + 100) * 15;
    for (const tag of r.meta.tags) if (text.includes(tag)) score += 10;
    for (const col of r.meta.collections) if (text.includes(col)) score += 12;
    if (layoutFamily && r.meta.family.includes(layoutFamily.split(" ")[0]!.toLowerCase())) score += 8;
    if (text.includes("oversized") && r.family === "oversized-type") score += 18;
    if (text.includes("museum") && r.family === "museum-label") score += 16;
    if (text.includes("faith") && r.family === "vertical-type") score += 14;
    if (query.role.toLowerCase().includes("hero") && r.layerPriority >= 88) score += 10;
    return { recipe: r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return pickScoredRecipe(scored, query.seed, 199);
}
