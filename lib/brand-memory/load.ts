import { DEFAULT_BRAND_MEMORY_SLUG, getBrandMemoryForSlug } from "./registry";
import type { BrandMemory } from "./types";
import { getActiveWorkspaceSlug } from "@/lib/workspace/active";

function resolveWorkspaceSlug(_workspaceId?: string): string {
  try {
    return getActiveWorkspaceSlug();
  } catch {
    return DEFAULT_BRAND_MEMORY_SLUG;
  }
}

/**
 * Load Brand Memory for a workspace.
 *
 * V1: local registry keyed by active workspace slug.
 * Future: Supabase / Brain sync for multi-brand workspaces.
 */
export function loadBrandMemory(workspaceId?: string): BrandMemory {
  const slug = resolveWorkspaceSlug(workspaceId);
  return getBrandMemoryForSlug(slug);
}

export function loadBrandMemoryBySlug(slug: string): BrandMemory {
  return getBrandMemoryForSlug(slug);
}
