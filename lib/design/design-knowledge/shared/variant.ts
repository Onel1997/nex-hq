import type { KnowledgeRecipeMeta } from "@/lib/design/design-knowledge/types";

/** Deterministic pseudo-random in [0, 1) from seed + index. */
export function knuth(seed: number, index: number): number {
  let h = (seed * 2654435761 + index * 2246822519) >>> 0;
  h = ((h ^ (h >>> 16)) * 0x45d9f3b) >>> 0;
  h = ((h ^ (h >>> 16)) * 0x45d9f3b) >>> 0;
  return (h ^ (h >>> 16)) / 0xffffffff;
}

export function lerp(seed: number, index: number, min: number, max: number): number {
  return min + knuth(seed, index) * (max - min);
}

export function pick<T>(seed: number, index: number, items: readonly T[]): T {
  return items[Math.floor(knuth(seed, index) * items.length)]!;
}

export function buildMeta(
  family: string,
  variant: number,
  name: string,
  tags: string[],
  collections: string[],
  garmentFit: KnowledgeRecipeMeta["garmentFit"],
): KnowledgeRecipeMeta {
  const slug = family.toLowerCase().replace(/\s+/g, "-");
  return {
    id: `${slug}-v${String(variant).padStart(3, "0")}`,
    name: `${name} ${variant}`,
    family,
    variant,
    tags,
    collections,
    garmentFit,
  };
}

export interface ArchetypeExpansion<T> {
  archetype: string;
  base: Omit<T, "id" | "meta">;
  variantCount: number;
  mutate: (base: Omit<T, "id" | "meta">, variant: number, seed: number) => Omit<T, "id" | "meta">;
  name: (variant: number) => string;
  tags: string[];
  collections: string[];
  garmentFit: KnowledgeRecipeMeta["garmentFit"];
}

export function expandArchetype<T extends { id: string; meta: KnowledgeRecipeMeta }>(
  expansion: ArchetypeExpansion<T>,
  seed: number,
): T[] {
  const recipes: T[] = [];
  for (let v = 1; v <= expansion.variantCount; v++) {
    const mutated = expansion.mutate(expansion.base, v, seed + v * 17);
    const meta = buildMeta(
      expansion.archetype,
      v,
      expansion.name(v),
      expansion.tags,
      expansion.collections,
      expansion.garmentFit,
    );
    recipes.push({ ...mutated, id: meta.id, meta } as T);
  }
  return recipes;
}
