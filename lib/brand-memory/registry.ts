import { DEFAULT_BUSINESS_PROFILE_SLUG } from "@/lib/business/business-profile";
import { MILAENE_BRAND_MEMORY } from "./milaene";
import type { BrandMemory } from "./types";

export const DEFAULT_BRAND_MEMORY_SLUG = DEFAULT_BUSINESS_PROFILE_SLUG;

export const BRAND_MEMORY_BY_SLUG: Record<string, BrandMemory> = {
  milaene: MILAENE_BRAND_MEMORY,
};

/** Resolve Brand Memory for a workspace slug. Falls back to Milaene. */
export function getBrandMemoryForSlug(slug: string): BrandMemory {
  return (
    BRAND_MEMORY_BY_SLUG[slug] ??
    BRAND_MEMORY_BY_SLUG[DEFAULT_BRAND_MEMORY_SLUG]!
  );
}

export function listBrandMemorySlugs(): string[] {
  return Object.keys(BRAND_MEMORY_BY_SLUG);
}
