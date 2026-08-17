/**
 * Phase 1.8B — Brand Face Casting start screen UX (presentation + session rules).
 *
 * Keeps Official Brand Face Casting as a clean starting point.
 * Old creation runs live under Persona Studio → Creation Projects only.
 */

import type { CreationProjectStatus } from "@/lib/persona/domain/creation-types";
import { parseArchetypeIdFromProjectDescription } from "./creation-project-mapper";
import { listSelectionProjectsForArchetype } from "./store";
import type {
  BrandFaceSelectionProject,
  BrandFaceSelectionStatus,
  OfficialBrandFaceRecord,
} from "./types";

export type CreationProjectLink = {
  id: string;
  description: string | null;
  status: CreationProjectStatus;
  created_at?: string;
};

export type OfficialArchetypeStatusTone =
  | "ready"
  | "casting"
  | "awaiting_approval"
  | "official";

export type OfficialArchetypeStatus = {
  label: string;
  tone: OfficialArchetypeStatusTone;
};

export type CastingCardPrimaryAction = "start_new_discovery" | "view_brand_cast";

export type ArchetypeCastingCardModel = {
  officialStatus: OfficialArchetypeStatus;
  previousRunCount: number;
  unfinishedRunCount: number;
  primaryAction: CastingCardPrimaryAction;
  startDiscoveryDisabledReason: string | null;
};

const CASTING_IN_PROGRESS_STATUSES: ReadonlySet<BrandFaceSelectionStatus> =
  new Set([
    "draft",
    "discovery_ready",
    "discovery_generating",
    "discovery_review",
    "candidate_selected",
    "validation_ready",
    "validation_generating",
  ]);

const AWAITING_APPROVAL_STATUSES: ReadonlySet<BrandFaceSelectionStatus> =
  new Set(["identity_review", "identity_locked"]);

const UNFINISHED_CREATION_STATUSES: ReadonlySet<CreationProjectStatus> =
  new Set(["draft", "ready", "generating", "review", "selected"]);

export function filterCreationProjectsForArchetype(
  creationProjects: CreationProjectLink[],
  archetypeId: string,
): CreationProjectLink[] {
  return creationProjects.filter(
    (p) => parseArchetypeIdFromProjectDescription(p.description) === archetypeId,
  );
}

export function summarizeArchetypeCreationRuns(
  creationProjects: CreationProjectLink[],
  archetypeId: string,
): { previousRunCount: number; unfinishedRunCount: number } {
  const linked = filterCreationProjectsForArchetype(creationProjects, archetypeId);
  return {
    previousRunCount: linked.length,
    unfinishedRunCount: linked.filter((p) =>
      UNFINISHED_CREATION_STATUSES.has(p.status),
    ).length,
  };
}

function findActiveSelectionProject(
  selections: BrandFaceSelectionProject[],
): BrandFaceSelectionProject | null {
  const open = selections
    .filter((p) => p.status !== "archived" && p.status !== "approved")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return open[0] ?? null;
}

export function resolveOfficialArchetypeStatus(input: {
  workspaceId: string;
  archetypeId: string;
  activeFace?: OfficialBrandFaceRecord | null;
  selectionProjects?: BrandFaceSelectionProject[];
}): OfficialArchetypeStatus {
  // Official status must be supplied from a durable Persona projection. Never
  // fall back to the process-local legacy registry.
  const activeFace = input.activeFace ?? null;
  if (activeFace) {
    return {
      label: "1/1 approved — official brand face",
      tone: "official",
    };
  }

  const selections =
    input.selectionProjects ??
    listSelectionProjectsForArchetype(input.workspaceId, input.archetypeId);
  const activeSelection = findActiveSelectionProject(selections);
  if (activeSelection) {
    if (AWAITING_APPROVAL_STATUSES.has(activeSelection.status)) {
      return {
        label: "0/1 approved — awaiting final approval",
        tone: "awaiting_approval",
      };
    }
    if (CASTING_IN_PROGRESS_STATUSES.has(activeSelection.status)) {
      return {
        label: "0/1 approved — casting in progress",
        tone: "casting",
      };
    }
  }

  return {
    label: "0/1 approved — ready for discovery",
    tone: "ready",
  };
}

export function resolveStartDiscoveryDisabledReason(input: {
  archetypeActive: boolean;
  isCreating: boolean;
  providerGateFailed: boolean;
  providerGateMessage?: string | null;
}): string | null {
  if (input.isCreating) {
    return "Creating a new discovery project…";
  }
  if (!input.archetypeActive) {
    return "Archetype configuration is missing or inactive.";
  }
  if (input.providerGateFailed) {
    return (
      input.providerGateMessage ??
      "Paid generation is not enabled or the provider is not configured."
    );
  }
  return null;
}

export function buildArchetypeCastingCardModel(input: {
  workspaceId: string;
  archetypeId: string;
  archetypeActive: boolean;
  creationProjects: CreationProjectLink[];
  isCreating?: boolean;
  providerGateFailed?: boolean;
  providerGateMessage?: string | null;
  activeFace?: OfficialBrandFaceRecord | null;
  selectionProjects?: BrandFaceSelectionProject[];
}): ArchetypeCastingCardModel {
  const officialStatus = resolveOfficialArchetypeStatus({
    workspaceId: input.workspaceId,
    archetypeId: input.archetypeId,
    activeFace: input.activeFace,
    selectionProjects: input.selectionProjects,
  });
  const { previousRunCount, unfinishedRunCount } = summarizeArchetypeCreationRuns(
    input.creationProjects,
    input.archetypeId,
  );

  const primaryAction: CastingCardPrimaryAction =
    officialStatus.tone === "official" ? "view_brand_cast" : "start_new_discovery";

  const startDiscoveryDisabledReason =
    primaryAction === "start_new_discovery"
      ? resolveStartDiscoveryDisabledReason({
          archetypeActive: input.archetypeActive,
          isCreating: input.isCreating ?? false,
          providerGateFailed: input.providerGateFailed ?? false,
          providerGateMessage: input.providerGateMessage,
        })
      : null;

  return {
    officialStatus,
    previousRunCount,
    unfinishedRunCount,
    primaryAction,
    startDiscoveryDisabledReason,
  };
}

/** Navigation must use the explicitly created project — never historical lists. */
export function resolveDiscoverySessionProjectId(
  createdProjectId: string | null | undefined,
): string {
  if (!createdProjectId?.trim()) {
    throw new Error("Discovery session requires the newly created project id");
  }
  return createdProjectId;
}

/** Client-side duplicate-click guard — one in-flight discovery start per screen. */
export class DiscoveryStartLock {
  private activeArchetypeId: string | null = null;

  tryAcquire(archetypeId: string): boolean {
    if (this.activeArchetypeId) return false;
    this.activeArchetypeId = archetypeId;
    return true;
  }

  release(): void {
    this.activeArchetypeId = null;
  }

  get isLocked(): boolean {
    return this.activeArchetypeId !== null;
  }
}

/** Card actions never resume old sessions — only start new or view official face. */
export function assertCastingCardHasNoContinueSession(
  model: ArchetypeCastingCardModel,
): void {
  const allowed: CastingCardPrimaryAction[] = [
    "start_new_discovery",
    "view_brand_cast",
  ];
  if (!allowed.includes(model.primaryAction)) {
    throw new Error("Casting card must not expose Continue session");
  }
}
