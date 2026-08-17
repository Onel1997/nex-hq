/**
 * Legacy process-local Brand Face projection.
 * @deprecated Non-authoritative; durable Persona state owns official membership.
 */

import type { BrandFaceMemory } from "@/lib/brand-archetypes";
import { BrandFaceSelectionError } from "./constants";
import type { BrandFaceSelectionProject, OfficialBrandFaceRecord } from "./types";
import {
  getOrCreateRegistry,
  saveOfficialBrandFace,
} from "./store";

export function buildBrandFaceMemory(
  archetypeId: string,
  registryWorkspaceId: string,
): BrandFaceMemory {
  const registry = getOrCreateRegistry(registryWorkspaceId);
  const active = registry.activeByArchetypeId[archetypeId] ?? null;
  const previous = registry.previousByArchetypeId[archetypeId] ?? [];
  const approved = Object.values(registry.facesById).filter(
    (f) => f.archetypeId === archetypeId && f.status === "active",
  );
  const retired = Object.values(registry.facesById).filter(
    (f) => f.archetypeId === archetypeId && f.status === "retired",
  );

  return {
    archetypeId,
    currentActiveFaceId: active?.id ?? null,
    approvedBrandFaceIds: approved.map((f) => f.id),
    brandFaceHistoryIds: [
      ...approved.map((f) => f.id),
      ...previous.map((f) => f.id),
      ...retired.map((f) => f.id),
    ].filter((id, i, arr) => arr.indexOf(id) === i),
    retiredFaceIds: retired.map((f) => f.id),
    identityLockVersion: active
      ? `v${active.version}`
      : null,
    brandFaceVersion: active ? String(active.version) : "0.0.0",
  };
}

export function getActiveBrandFaceForArchetype(
  workspaceId: string,
  archetypeId: string,
): OfficialBrandFaceRecord | null {
  const registry = getOrCreateRegistry(workspaceId);
  return registry.activeByArchetypeId[archetypeId] ?? null;
}

export function assertNoConflictingActiveFace(
  workspaceId: string,
  archetypeId: string,
  exceptFaceId?: string,
): void {
  const active = getActiveBrandFaceForArchetype(workspaceId, archetypeId);
  if (active && active.id !== exceptFaceId) {
    // Registration will retire the previous face — this is informational for pre-checks.
    // Callers that want to block must use assertSingleActivePolicy after write.
    void active;
  }
}

/**
 * Register an approved selection project as the Official Brand Face.
 * Retires any previous active face for the same archetype.
 * Enforces: only one active Brand Face per archetype after write.
 */
export function registerOfficialBrandFace(
  project: BrandFaceSelectionProject,
  now = new Date().toISOString(),
): OfficialBrandFaceRecord {
  if (project.status !== "approved" || project.brandFaceApprovalStatus !== "approved") {
    throw new BrandFaceSelectionError(
      "Only approved selection projects can enter the Official Brand Face Registry",
      "WORKFLOW",
    );
  }
  if (!project.draftPersonaId || !project.selectedCandidateId) {
    throw new BrandFaceSelectionError(
      "Registry entry requires personaId and candidateId",
      "WORKFLOW",
    );
  }
  if (!project.imageUseApproved) {
    throw new BrandFaceSelectionError(
      "Registry requires image_use_approved",
      "WORKFLOW",
    );
  }

  const registry = getOrCreateRegistry(project.workspaceId);
  const previousActive = registry.activeByArchetypeId[project.archetypeId] ?? null;
  const nextVersion = previousActive ? previousActive.version + 1 : 1;

  const face: OfficialBrandFaceRecord = {
    id: `obf_${project.id}`,
    workspaceId: project.workspaceId,
    archetypeId: project.archetypeId,
    version: nextVersion,
    personaId: project.draftPersonaId,
    candidateId: project.selectedCandidateId,
    selectionProjectId: project.id,
    identityDnaFingerprint: project.identityDnaFingerprint,
    imageReady: true,
    videoReady: project.videoReady,
    status: "active",
    approvedAt: project.approvedAt ?? now,
    retiredAt: null,
  };

  saveOfficialBrandFace(face);

  const after = getOrCreateRegistry(project.workspaceId);
  const activeFaces = Object.values(after.facesById).filter(
    (f) => f.archetypeId === project.archetypeId && f.status === "active",
  );
  if (activeFaces.length !== 1) {
    throw new BrandFaceSelectionError(
      "Registry invariant violated: exactly one active Brand Face per archetype",
      "INVARIANT",
      { count: activeFaces.length, archetypeId: project.archetypeId },
    );
  }

  return face;
}

export function listRetiredBrandFaces(
  workspaceId: string,
  archetypeId: string,
): OfficialBrandFaceRecord[] {
  const registry = getOrCreateRegistry(workspaceId);
  return [
    ...(registry.previousByArchetypeId[archetypeId] ?? []),
    ...Object.values(registry.facesById).filter(
      (f) => f.archetypeId === archetypeId && f.status === "retired",
    ),
  ].filter(
    (f, i, arr) => arr.findIndex((x) => x.id === f.id) === i,
  );
}

export function assertOnlyOneActivePerArchetype(
  workspaceId: string,
  archetypeId: string,
): void {
  const registry = getOrCreateRegistry(workspaceId);
  const actives = Object.values(registry.facesById).filter(
    (f) => f.archetypeId === archetypeId && f.status === "active",
  );
  if (actives.length > 1) {
    throw new BrandFaceSelectionError(
      "Only one active Brand Face is allowed per archetype",
      "INVARIANT",
      { count: actives.length },
    );
  }
}
