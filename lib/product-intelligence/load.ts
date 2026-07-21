import { getActiveWorkspaceSlug } from "@/lib/workspace/active";
import {
  DEFAULT_PRODUCT_INTELLIGENCE_SLUG,
  getProductCatalogForSlug,
} from "./registry";
import { resolveProductCatalogSeedOnly } from "./providers";
import { createProductIntelligenceSnapshot } from "./rules";
import type { ProductCatalog, ProductIntelligenceSnapshot } from "./types";

function resolveWorkspaceSlug(_workspaceId?: string): string {
  try {
    return getActiveWorkspaceSlug();
  } catch {
    return DEFAULT_PRODUCT_INTELLIGENCE_SLUG;
  }
}

/**
 * Load Product Intelligence catalog for a workspace.
 *
 * Sync path uses seed-only resolution (no Shopify HTTP).
 * Shopify-first async resolution is available via `resolveProductCatalog`.
 */
export function loadProductCatalog(workspaceId?: string): ProductCatalog {
  const slug = resolveWorkspaceSlug(workspaceId);
  return resolveProductCatalogSeedOnly(slug).catalog;
}

export function loadProductCatalogBySlug(slug: string): ProductCatalog {
  return resolveProductCatalogSeedOnly(slug).catalog;
}

/**
 * Load a persistable Product Intelligence snapshot for a generation job.
 * Does not call Shopify or any paid provider.
 */
export function loadProductIntelligenceSnapshot(
  workspaceId?: string,
  options?: {
    selectedProductIds?: string[];
    selectedVariantIds?: string[];
    capturedAt?: string;
  },
): ProductIntelligenceSnapshot {
  const catalog = loadProductCatalog(workspaceId);
  return createProductIntelligenceSnapshot(catalog, options);
}

export function loadProductIntelligenceSnapshotBySlug(
  slug: string,
  options?: {
    selectedProductIds?: string[];
    selectedVariantIds?: string[];
    capturedAt?: string;
  },
): ProductIntelligenceSnapshot {
  const catalog = loadProductCatalogBySlug(slug);
  return createProductIntelligenceSnapshot(catalog, options);
}

/** Direct registry access without sync wrapper — prefer loadProductCatalog. */
export function getRawSeedCatalog(slug?: string): ProductCatalog {
  return getProductCatalogForSlug(slug ?? DEFAULT_PRODUCT_INTELLIGENCE_SLUG);
}
