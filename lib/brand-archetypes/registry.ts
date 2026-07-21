import { DEFAULT_BUSINESS_PROFILE_SLUG } from "@/lib/business/business-profile";
import { MILAENE_BRAND_ARCHETYPE_CATALOG } from "./archetypes";
import type { BrandArchetype, BrandArchetypeCatalog, IdentityDna } from "./types";

export const DEFAULT_BRAND_ARCHETYPE_SLUG = DEFAULT_BUSINESS_PROFILE_SLUG;

export const BRAND_ARCHETYPE_CATALOG_BY_SLUG: Record<
  string,
  BrandArchetypeCatalog
> = {
  milaene: MILAENE_BRAND_ARCHETYPE_CATALOG,
};

export function getBrandArchetypeCatalogForSlug(
  slug: string,
): BrandArchetypeCatalog {
  return (
    BRAND_ARCHETYPE_CATALOG_BY_SLUG[slug] ??
    BRAND_ARCHETYPE_CATALOG_BY_SLUG[DEFAULT_BRAND_ARCHETYPE_SLUG]!
  );
}

export function getBrandArchetypeBySlug(
  catalog: BrandArchetypeCatalog,
  archetypeSlug: string,
): BrandArchetype | undefined {
  return catalog.archetypes.find((a) => a.slug === archetypeSlug);
}

export function getIdentityDnaForArchetype(
  catalog: BrandArchetypeCatalog,
  archetype: BrandArchetype,
): IdentityDna {
  const dna = catalog.identityDnaById[archetype.identityDnaId];
  if (!dna) {
    throw new Error(
      `Brand Archetype Intelligence: Identity DNA missing for ${archetype.id}`,
    );
  }
  return dna;
}

/**
 * Map Stage A candidate slots to official archetypes.
 * Slot 1 → Mediterranean, 2 → Urban, 3 → Female.
 * Additional slots cycle for compatibility with larger cast sizes.
 */
export function resolveArchetypeForCandidate(
  catalog: BrandArchetypeCatalog,
  candidateNumber: number,
): BrandArchetype {
  const active = catalog.archetypes.filter((a) => a.status === "active");
  if (active.length === 0) {
    throw new Error("Brand Archetype Intelligence: no active archetypes");
  }
  const index = Math.max(0, candidateNumber - 1) % active.length;
  return active[index]!;
}

export function listBrandArchetypeSlugs(): string[] {
  return Object.keys(BRAND_ARCHETYPE_CATALOG_BY_SLUG);
}
