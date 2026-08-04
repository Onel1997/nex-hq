import type {
  PersonaCandidate,
  PersonaCandidateAsset,
  PersonaCandidateAssetView,
  PersonaCreationProject,
  PersonaGenerationJob,
} from "@/lib/persona/domain/creation-types";
import type { IncidentProjectSummary } from "@/lib/persona/creation/creation-service";
import type { CandidateGenerationCostEstimate } from "@/lib/persona/domain/creation-types";
import {
  projectScopedPreviewKey,
  validateProjectCandidateBoardState,
} from "@/lib/persona/creation/casting-data-integrity";

/** Enable with NEXT_PUBLIC_DEBUG_MODE=true in .env.local */
export const DEBUG_MODE = process.env.NEXT_PUBLIC_DEBUG_MODE === "true";

export type ProjectCandidateState = {
  projectId: string;
  candidates: PersonaCandidate[];
  assets: PersonaCandidateAsset[];
  loadedAt: string;
  candidatePreviews: Record<string, string | null>;
  noveltyFailureSlots: import("@/lib/persona/face-novelty-memory/board-visibility").NoveltyFailureSlotDto[];
  generationJobs: PersonaGenerationJob[];
  incidentSummary: IncidentProjectSummary | null;
};

export function projectScopedCandidatesCacheKey(
  workspaceId: string,
  creationProjectId: string,
): string {
  return `persona-candidates:${workspaceId}:${creationProjectId}`;
}

export function filterLoadedCandidatesForProject<
  T extends { creation_project_id: string },
>(candidates: T[], creationProjectId: string): T[] {
  return candidates.filter((c) => c.creation_project_id === creationProjectId);
}

export function projectIdPrefix(id: string): string {
  return id.slice(0, 8);
}

export function discoverySlotLabel(candidateNumber: number): string {
  const letters = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
  const letter = letters[Math.max(0, candidateNumber - 1)] ?? String(candidateNumber);
  return `Candidate ${letter}`;
}

/** Concise intended-use chips for Official Brand Face A1 card review. */
export function discoveryIntendedUseLabel(
  candidate: Pick<PersonaCandidate, "candidate_number" | "generation_settings">,
): string | null {
  const fromSettings = candidate.generation_settings?.intendedUseLabel;
  if (typeof fromSettings === "string" && fromSettings.trim()) {
    return fromSettings;
  }
  const aesthetic = (
    candidate.generation_settings?.variation as { aesthetic?: string } | undefined
  )?.aesthetic;
  if (typeof aesthetic === "string" && aesthetic.includes("·")) {
    const parts = aesthetic.split("·").map((p) => p.trim());
    const last = parts[parts.length - 1];
    if (
      last &&
      /(Homepage|Social|Lifestyle|Flagship|Shopify|Campaign|Video|Storytelling|Community|Editorial)/i.test(
        last,
      )
    ) {
      return last;
    }
  }
  return null;
}

export function isProjectDetailReady(args: {
  selectedProjectId: string | null;
  loadedProjectId: string | null;
  loadedProject: PersonaCreationProject | null;
}): boolean {
  return (
    args.selectedProjectId != null &&
    args.loadedProjectId === args.selectedProjectId &&
    args.loadedProject != null &&
    args.loadedProject.id === args.selectedProjectId
  );
}

export function canRenderProjectCandidates(args: {
  activeCreationProjectId: string | null;
  projectCandidateState: ProjectCandidateState | null;
}): boolean {
  return (
    args.projectCandidateState != null &&
    args.activeCreationProjectId != null &&
    args.projectCandidateState.projectId === args.activeCreationProjectId
  );
}

export function resolvePreviewUrlForCandidate(args: {
  projectId: string;
  candidate: PersonaCandidate;
  previews: Record<string, string | null>;
}): string | null {
  const assetId = args.candidate.primary_preview_asset_id;
  if (assetId) {
    const scoped =
      args.previews[projectScopedPreviewKey(args.projectId, args.candidate.id, assetId)];
    if (scoped) return scoped;
  }
  return args.previews[args.candidate.id] ?? null;
}

export function assertProjectSelectionSync(args: {
  clickedProjectId: string | null;
  loadedProjectId: string | null;
  renderedProjectId: string | null;
}): void {
  if (!DEBUG_MODE) return;

  console.log("[persona] Clicked project id:", args.clickedProjectId);
  console.log("[persona] Loaded project id:", args.loadedProjectId);
  console.log("[persona] Rendered project id:", args.renderedProjectId);

  if (
    args.clickedProjectId &&
    args.loadedProjectId &&
    args.clickedProjectId !== args.loadedProjectId
  ) {
    console.error("[persona] Project selection mismatch: clicked vs loaded", {
      clickedProjectId: args.clickedProjectId,
      loadedProjectId: args.loadedProjectId,
    });
  }

  if (
    args.loadedProjectId &&
    args.renderedProjectId &&
    args.loadedProjectId !== args.renderedProjectId
  ) {
    console.error("[persona] Project selection mismatch: loaded vs rendered", {
      loadedProjectId: args.loadedProjectId,
      renderedProjectId: args.renderedProjectId,
    });
  }

  if (
    args.clickedProjectId &&
    args.renderedProjectId &&
    args.clickedProjectId !== args.renderedProjectId
  ) {
    console.error("[persona] Project selection mismatch: clicked vs rendered", {
      clickedProjectId: args.clickedProjectId,
      renderedProjectId: args.renderedProjectId,
    });
  }
}

export function buildProjectCandidateState(input: {
  projectId: string;
  candidates: PersonaCandidate[];
  assets?: PersonaCandidateAsset[];
  candidatePreviews?: Record<string, string | null>;
  noveltyFailureSlots?: import("@/lib/persona/face-novelty-memory/board-visibility").NoveltyFailureSlotDto[];
  generationJobs?: PersonaGenerationJob[];
  incidentSummary?: IncidentProjectSummary | null;
}): ProjectCandidateState {
  const candidates = filterLoadedCandidatesForProject(input.candidates, input.projectId);
  const verdict = validateProjectCandidateBoardState({
    activeCreationProjectId: input.projectId,
    stateProjectId: input.projectId,
    candidates,
    assets: input.assets,
  });
  if (!verdict.ok) {
    console.error("[persona] Refusing invalid project candidate state", {
      projectId: input.projectId,
      reasons: verdict.reasons,
    });
    return {
      projectId: input.projectId,
      candidates: [],
      assets: [],
      loadedAt: new Date().toISOString(),
      candidatePreviews: {},
      noveltyFailureSlots: [],
      generationJobs: input.generationJobs ?? [],
      incidentSummary: input.incidentSummary ?? null,
    };
  }
  return {
    projectId: input.projectId,
    candidates,
    assets: input.assets ?? [],
    loadedAt: new Date().toISOString(),
    candidatePreviews: input.candidatePreviews ?? {},
    noveltyFailureSlots: input.noveltyFailureSlots ?? [],
    generationJobs: input.generationJobs ?? [],
    incidentSummary: input.incidentSummary ?? null,
  };
}

/**
 * Pure reducer for project-switch race tests.
 * Late Project A responses must never overwrite Project B.
 */
export function applyProjectLoadResult(input: {
  activeProjectId: string;
  loadVersion: number;
  currentLoadVersion: number;
  requestedProjectId: string;
  previous: ProjectCandidateState | null;
  next: ProjectCandidateState;
}): ProjectCandidateState | null {
  if (input.loadVersion !== input.currentLoadVersion) return input.previous;
  if (input.requestedProjectId !== input.activeProjectId) return input.previous;
  if (input.next.projectId !== input.activeProjectId) return input.previous;
  return input.next;
}

export function emptyProjectDetailState() {
  return {
    loadedProjectId: null as string | null,
    loadedProject: null as PersonaCreationProject | null,
    candidates: [] as PersonaCandidate[],
    generationJobs: [] as PersonaGenerationJob[],
    incidentSummary: null as IncidentProjectSummary | null,
    candidatePreviews: {} as Record<string, string | null>,
    selectedCandidateId: null as string | null,
    candidateAssets: [] as PersonaCandidateAssetView[],
    costEstimate: null as CandidateGenerationCostEstimate | null,
    paidConfirmationToken: null as string | null,
    paidConfirmationProjectId: null as string | null,
    projectCandidateState: null as ProjectCandidateState | null,
    projectDetailLoading: true,
    activeGenerationRunId: null as string | null,
  };
}
