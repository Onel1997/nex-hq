import { ensureEmotionalVisualMatch } from "./emotional-visual";
import {
  COLLECTION_ROLES,
  type CollectionRole,
  type DesignConcept,
  type ResearchCollection,
} from "./types";

/** Priority order for role assignment — higher roles are satisfied first. */
export const ROLE_ASSIGNMENT_PRIORITY: CollectionRole[] = [
  "Hero Piece",
  "Core Essential",
  "Statement Piece",
  "Supporting Piece",
  "Limited Piece",
];

function logRoleRepair(
  adjustments: string[],
  oldRole: CollectionRole,
  newRole: CollectionRole,
  title: string,
): void {
  if (oldRole === newRole) return;
  adjustments.push(`ROLE_REPAIRED: ${oldRole} → ${newRole} (${title})`);
}

/**
 * Enforce exactly one design per collection role.
 *
 * Preserves the first valid claimant for each role (by priority). Only duplicates
 * and overflow designs are reassigned. Hero Piece is never modified.
 */
export function normalizeCollectionRoles(
  designs: DesignConcept[],
  adjustments: string[] = [],
): DesignConcept[] {
  if (designs.length === 0) return designs;

  const heroDesign = designs.find((design) => design.collectionRole === "Hero Piece");
  const assigned = new Map<string, CollectionRole>();

  for (const role of ROLE_ASSIGNMENT_PRIORITY) {
    const remaining = designs.filter((design) => !assigned.has(design.designId));
    if (remaining.length === 0) break;

    if (role === "Hero Piece") {
      const keeper =
        heroDesign ??
        remaining.find((design) => design.collectionRole === "Hero Piece") ??
        remaining[0];
      logRoleRepair(adjustments, keeper.collectionRole, role, keeper.title);
      assigned.set(keeper.designId, role);
      continue;
    }

    const claimants = remaining.filter((design) => design.collectionRole === role);
    const keeper = claimants[0] ?? remaining[0];
    logRoleRepair(adjustments, keeper.collectionRole, role, keeper.title);
    assigned.set(keeper.designId, role);
  }

  return designs.map((design) => {
    const role = assigned.get(design.designId);
    if (!role || design.collectionRole === role) return design;
    return { ...design, collectionRole: role };
  });
}

/** Repair emotional visual mismatches across the capsule before role normalization. */
export function applyEmotionalRepairPass(
  designs: DesignConcept[],
  collection: ResearchCollection,
  adjustments: string[] = [],
): DesignConcept[] {
  return designs.map((design) =>
    ensureEmotionalVisualMatch(design, collection, adjustments),
  );
}

export function assertRoleConsistency(designs: DesignConcept[]): void {
  const errors: string[] = [];

  if (designs.length !== COLLECTION_ROLES.length) {
    errors.push(
      `expected ${COLLECTION_ROLES.length} designs, received ${designs.length}`,
    );
  }

  for (const role of COLLECTION_ROLES) {
    const count = designs.filter((design) => design.collectionRole === role).length;
    if (count !== 1) {
      errors.push(`expected exactly 1 "${role}", received ${count}`);
    }
  }

  if (errors.length > 0) {
    console.error("ROLE CONSISTENCY ASSERTION FAILED", errors);
    console.error(
      "ROLE SUMMARY",
      designs.map((design) => ({
        title: design.title,
        role: design.collectionRole,
      })),
    );
    throw new Error(`Role consistency failed: ${errors.join("; ")}`);
  }
}
