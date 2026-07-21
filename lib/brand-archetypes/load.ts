import { getActiveWorkspaceSlug } from "@/lib/workspace/active";
import {
  DEFAULT_BRAND_ARCHETYPE_SLUG,
  getBrandArchetypeCatalogForSlug,
  getIdentityDnaForArchetype,
  resolveArchetypeForCandidate,
} from "./registry";
import { createBrandArchetypeSnapshot } from "./snapshot";
import type {
  BrandArchetype,
  BrandArchetypeCatalog,
  BrandArchetypeSnapshot,
  IdentityDna,
} from "./types";

function resolveWorkspaceSlug(_workspaceId?: string): string {
  try {
    return getActiveWorkspaceSlug();
  } catch {
    return DEFAULT_BRAND_ARCHETYPE_SLUG;
  }
}

export function loadBrandArchetypeCatalog(
  workspaceId?: string,
): BrandArchetypeCatalog {
  return getBrandArchetypeCatalogForSlug(resolveWorkspaceSlug(workspaceId));
}

export function loadBrandArchetypeCatalogBySlug(
  slug: string,
): BrandArchetypeCatalog {
  return getBrandArchetypeCatalogForSlug(slug);
}

export function loadArchetypeForCandidate(
  candidateNumber: number,
  workspaceId?: string,
): { archetype: BrandArchetype; dna: IdentityDna; catalog: BrandArchetypeCatalog } {
  const catalog = loadBrandArchetypeCatalog(workspaceId);
  const archetype = resolveArchetypeForCandidate(catalog, candidateNumber);
  const dna = getIdentityDnaForArchetype(catalog, archetype);
  return { archetype, dna, catalog };
}

export function loadBrandArchetypeSnapshotForCandidate(
  candidateNumber: number,
  workspaceId?: string,
): BrandArchetypeSnapshot {
  const { archetype, dna, catalog } = loadArchetypeForCandidate(
    candidateNumber,
    workspaceId,
  );
  return createBrandArchetypeSnapshot({
    archetype,
    dna,
    brandFaceMemory: catalog.brandFaceMemoryByArchetypeId[archetype.id],
  });
}
