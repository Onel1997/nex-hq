import type { OrnamentSystemRecipe } from "@/lib/design/design-knowledge/ornament-language/types";
import { buildAllOrnamentSystems, ORNAMENT_RECIPE_TARGET } from "@/lib/design/design-knowledge/ornament-language/archetypes";
import type { KnowledgeQuery } from "@/lib/design/design-knowledge/types";
import { knuth, pickScoredRecipe } from "@/lib/design/design-knowledge/shared/variant";

let _cache: OrnamentSystemRecipe[] | null = null;

export function getOrnamentSystems(): OrnamentSystemRecipe[] {
  if (!_cache) _cache = buildAllOrnamentSystems();
  return _cache;
}

export function getOrnamentSystemCount(): number {
  return ORNAMENT_RECIPE_TARGET;
}

export function getOrnamentSystemById(id: string): OrnamentSystemRecipe | undefined {
  return getOrnamentSystems().find((r) => r.id === id);
}

export function selectOrnamentSystem(query: KnowledgeQuery, layoutFamily?: string): OrnamentSystemRecipe {
  const systems = getOrnamentSystems();
  const text = `${query.visualConcept} ${query.product}`.toLowerCase();

  const scored = systems.map((r) => {
    let score = knuth(query.seed, r.meta.variant + 300) * 10;
    for (const tag of r.meta.tags) if (text.includes(tag)) score += 10;
    for (const col of r.meta.collections) if (text.includes(col)) score += 14;
    if (text.includes("museum") && r.meta.family === "Museum Captions") score += 18;
    if (text.includes("faith") && r.meta.family === "Faith Ornaments") score += 16;
    if (text.includes("silent") && r.meta.family === "Silent Accents") score += 16;
    return { recipe: r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return pickScoredRecipe(scored, query.seed, 399);
}
