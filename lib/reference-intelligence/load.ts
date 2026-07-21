import { getActiveWorkspaceSlug } from "@/lib/workspace/active";
import {
  DEFAULT_REFERENCE_INTELLIGENCE_SLUG,
  getReferenceCatalogForSlug,
} from "./registry";
import { createReferenceIntelligenceSnapshot } from "./snapshot";
import type {
  ReferenceIntelligenceSnapshot,
  ReferenceUsage,
  ReferenceWorkspaceCatalog,
} from "./types";

function resolveWorkspaceSlug(_workspaceId?: string): string {
  try {
    return getActiveWorkspaceSlug();
  } catch {
    return DEFAULT_REFERENCE_INTELLIGENCE_SLUG;
  }
}

/**
 * Load Reference Intelligence catalog for a workspace.
 * V1: empty seed boards + manual descriptors. No uploads, no vision, no Shopify.
 */
export function loadReferenceCatalog(
  workspaceId?: string,
): ReferenceWorkspaceCatalog {
  const slug = resolveWorkspaceSlug(workspaceId);
  return getReferenceCatalogForSlug(slug);
}

export function loadReferenceCatalogBySlug(
  slug: string,
): ReferenceWorkspaceCatalog {
  return getReferenceCatalogForSlug(slug);
}

export function loadReferenceIntelligenceSnapshot(
  workspaceId?: string,
  options?: {
    usageFilter?: ReferenceUsage | null;
    capturedAt?: string;
  },
): ReferenceIntelligenceSnapshot {
  const catalog = loadReferenceCatalog(workspaceId);
  return createReferenceIntelligenceSnapshot(catalog, options);
}
