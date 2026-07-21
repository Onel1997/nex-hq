import { DEFAULT_BUSINESS_PROFILE_SLUG } from "@/lib/business/business-profile";
import { MILAENE_PRODUCT_CATALOG } from "./milaene";
import type { ProductCatalog } from "./types";

export const DEFAULT_PRODUCT_INTELLIGENCE_SLUG = DEFAULT_BUSINESS_PROFILE_SLUG;

export const PRODUCT_CATALOG_BY_SLUG: Record<string, ProductCatalog> = {
  milaene: MILAENE_PRODUCT_CATALOG,
};

/** Resolve product catalog for a workspace slug. Falls back to Milaene seed. */
export function getProductCatalogForSlug(slug: string): ProductCatalog {
  return (
    PRODUCT_CATALOG_BY_SLUG[slug] ??
    PRODUCT_CATALOG_BY_SLUG[DEFAULT_PRODUCT_INTELLIGENCE_SLUG]!
  );
}

export function listProductCatalogSlugs(): string[] {
  return Object.keys(PRODUCT_CATALOG_BY_SLUG);
}
