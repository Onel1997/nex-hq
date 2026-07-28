/**
 * In-memory Official Brand Face Selection store.
 * Seed / test persistence — no OpenAI, no Image/Video Studio.
 */

import type {
  BrandFaceSelectionProject,
  OfficialBrandFaceRecord,
  OfficialBrandFaceRegistry,
} from "./types";
import { BRAND_FACE_SELECTION_VERSION } from "./types";

type StoreState = {
  projectsById: Record<string, BrandFaceSelectionProject>;
  registriesByWorkspace: Record<string, OfficialBrandFaceRegistry>;
};

const globalStore: StoreState = {
  projectsById: {},
  registriesByWorkspace: {},
};

export function resetBrandFaceSelectionStoreForTests(): void {
  globalStore.projectsById = {};
  globalStore.registriesByWorkspace = {};
}

export function emptyOfficialBrandFaceRegistry(
  workspaceId: string,
  brandSlug = "milaene",
  now = new Date().toISOString(),
): OfficialBrandFaceRegistry {
  return {
    workspaceId,
    brandSlug,
    version: BRAND_FACE_SELECTION_VERSION,
    activeByArchetypeId: {},
    facesById: {},
    previousByArchetypeId: {},
    updatedAt: now,
  };
}

export function getOrCreateRegistry(
  workspaceId: string,
  brandSlug = "milaene",
): OfficialBrandFaceRegistry {
  const existing = globalStore.registriesByWorkspace[workspaceId];
  if (existing) return existing;
  const created = emptyOfficialBrandFaceRegistry(workspaceId, brandSlug);
  globalStore.registriesByWorkspace[workspaceId] = created;
  return created;
}

export function saveRegistry(registry: OfficialBrandFaceRegistry): OfficialBrandFaceRegistry {
  globalStore.registriesByWorkspace[registry.workspaceId] = registry;
  return registry;
}

export function saveSelectionProject(
  project: BrandFaceSelectionProject,
): BrandFaceSelectionProject {
  globalStore.projectsById[project.id] = project;
  return project;
}

export function getSelectionProject(
  projectId: string,
): BrandFaceSelectionProject | null {
  return globalStore.projectsById[projectId] ?? null;
}

export function listSelectionProjects(
  workspaceId: string,
): BrandFaceSelectionProject[] {
  return Object.values(globalStore.projectsById).filter(
    (p) => p.workspaceId === workspaceId,
  );
}

export function listSelectionProjectsForArchetype(
  workspaceId: string,
  archetypeId: string,
): BrandFaceSelectionProject[] {
  return listSelectionProjects(workspaceId).filter(
    (p) => p.archetypeId === archetypeId,
  );
}

export function saveOfficialBrandFace(
  face: OfficialBrandFaceRecord,
): OfficialBrandFaceRecord {
  const registry = getOrCreateRegistry(face.workspaceId);
  const facesById = { ...registry.facesById, [face.id]: face };
  const activeByArchetypeId = { ...registry.activeByArchetypeId };
  const previousByArchetypeId = { ...registry.previousByArchetypeId };

  if (face.status === "active") {
    const current = activeByArchetypeId[face.archetypeId] ?? null;
    if (current && current.id !== face.id) {
      const retired: OfficialBrandFaceRecord = {
        ...current,
        status: "retired",
        retiredAt: face.approvedAt,
      };
      facesById[retired.id] = retired;
      previousByArchetypeId[face.archetypeId] = [
        ...(previousByArchetypeId[face.archetypeId] ?? []),
        retired,
      ];
    }
    activeByArchetypeId[face.archetypeId] = face;
  }

  saveRegistry({
    ...registry,
    facesById,
    activeByArchetypeId,
    previousByArchetypeId,
    updatedAt: face.approvedAt,
  });

  return face;
}
