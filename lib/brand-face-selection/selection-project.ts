import {
  getIdentityDnaForArchetype,
  loadBrandArchetypeCatalog,
  type BrandArchetype,
  type BrandArchetypeCatalog,
  type IdentityDna,
} from "@/lib/brand-archetypes";
import {
  BrandFaceSelectionError,
  emptyIdentityChecklist,
  emptyIdentityLockRecord,
  emptyReferencePackage,
  SELECTION_STATUS_TRANSITIONS,
} from "./constants";
import {
  A1_DISCOVERY_CANDIDATE_COUNT,
  type BrandFaceSelectionProject,
  type BrandFaceSelectionStatus,
  type BrandFaceTargetRole,
} from "./types";

const ROLE_BY_ARCHETYPE_SLUG: Record<string, BrandFaceTargetRole> = {
  "mediterranean-premium-hero": "mediterranean_premium_hero",
  "urban-community-hero": "urban_community_hero",
  "female-lifestyle-hero": "female_lifestyle_hero",
};

export function targetRoleForArchetype(
  archetype: Pick<BrandArchetype, "slug">,
): BrandFaceTargetRole {
  const role = ROLE_BY_ARCHETYPE_SLUG[archetype.slug];
  if (!role) {
    throw new BrandFaceSelectionError(
      `No Brand Face target role for archetype slug "${archetype.slug}"`,
      "CONFIG",
    );
  }
  return role;
}

export function resolveArchetypeBundle(
  archetypeId: string,
  workspaceId?: string,
): {
  catalog: BrandArchetypeCatalog;
  archetype: BrandArchetype;
  dna: IdentityDna;
} {
  const catalog = loadBrandArchetypeCatalog(workspaceId);
  const archetype = catalog.archetypes.find((a) => a.id === archetypeId);
  if (!archetype) {
    throw new BrandFaceSelectionError(
      `Brand Archetype not found: ${archetypeId}`,
      "NOT_FOUND",
    );
  }
  const dna = getIdentityDnaForArchetype(catalog, archetype);
  return { catalog, archetype, dna };
}

export function canTransitionSelectionStatus(
  from: BrandFaceSelectionStatus,
  to: BrandFaceSelectionStatus,
): boolean {
  if (from === to) return true;
  return SELECTION_STATUS_TRANSITIONS[from].includes(to);
}

export function assertSelectionStatusTransition(
  from: BrandFaceSelectionStatus,
  to: BrandFaceSelectionStatus,
): void {
  if (!canTransitionSelectionStatus(from, to)) {
    throw new BrandFaceSelectionError(
      `Cannot transition Brand Face selection from ${from} to ${to}`,
      "WORKFLOW",
      { from, to },
    );
  }
}

export function createBrandFaceSelectionProject(input: {
  workspaceId: string;
  archetypeId: string;
  id?: string;
  now?: string;
}): BrandFaceSelectionProject {
  const now = input.now ?? new Date().toISOString();
  const { archetype, dna } = resolveArchetypeBundle(
    input.archetypeId,
    input.workspaceId,
  );

  if (archetype.status !== "active") {
    throw new BrandFaceSelectionError(
      `Archetype "${archetype.name}" is not active for Brand Face selection`,
      "WORKFLOW",
    );
  }

  return {
    id: input.id ?? `bfs_${crypto.randomUUID()}`,
    workspaceId: input.workspaceId,
    archetypeId: archetype.id,
    archetypeVersion: archetype.version,
    identityDnaFingerprint: dna.fingerprint,
    targetRole: targetRoleForArchetype(archetype),
    status: "draft",
    discoveryCandidateCount: A1_DISCOVERY_CANDIDATE_COUNT,
    selectedCandidateId: null,
    shortlistCandidateIds: [],
    rejectedCandidateIds: [],
    discoveryCandidateIds: [],
    candidateReviews: {},
    creationProjectId: null,
    draftPersonaId: null,
    referencePackage: emptyReferencePackage(),
    referencePackageStatus: "not_started",
    identityReviewStatus: "not_started",
    identityChecklist: emptyIdentityChecklist(),
    identityReviewNotes: "",
    identityLockStatus: "not_started",
    identityLock: emptyIdentityLockRecord(),
    brandFaceApprovalStatus: "not_started",
    rightsConfirmed: false,
    imageUseApproved: false,
    videoReady: false,
    lastConfirmationFingerprint: null,
    a1CompletedAt: null,
    a2CompletedAt: null,
    approvedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function markSelectionStatus(
  project: BrandFaceSelectionProject,
  status: BrandFaceSelectionStatus,
  now = new Date().toISOString(),
): BrandFaceSelectionProject {
  assertSelectionStatusTransition(project.status, status);
  return {
    ...project,
    status,
    updatedAt: now,
  };
}

export function selectionProjectSummary(project: BrandFaceSelectionProject): {
  archetypeId: string;
  targetRole: BrandFaceTargetRole;
  identityDnaFingerprint: string;
  discoveryCandidateCount: number;
  status: BrandFaceSelectionStatus;
} {
  return {
    archetypeId: project.archetypeId,
    targetRole: project.targetRole,
    identityDnaFingerprint: project.identityDnaFingerprint,
    discoveryCandidateCount: project.discoveryCandidateCount,
    status: project.status,
  };
}
