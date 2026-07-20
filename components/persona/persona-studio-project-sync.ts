import type { PersonaCreationProject } from "@/lib/persona/domain/creation-types";

/** Enable with NEXT_PUBLIC_DEBUG_MODE=true in .env.local */
export const DEBUG_MODE = process.env.NEXT_PUBLIC_DEBUG_MODE === "true";

export function projectIdPrefix(id: string): string {
  return id.slice(0, 8);
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

export function emptyProjectDetailState() {
  return {
    loadedProjectId: null as string | null,
    loadedProject: null as PersonaCreationProject | null,
    candidates: [] as import("@/lib/persona/domain/creation-types").PersonaCandidate[],
    generationJobs: [] as import("@/lib/persona/domain/creation-types").PersonaGenerationJob[],
    incidentSummary: null as import("@/lib/persona/creation/creation-service").IncidentProjectSummary | null,
    selectedCandidateId: null as string | null,
    candidateAssets: [] as import("@/lib/persona/domain/creation-types").PersonaCandidateAssetView[],
    costEstimate: null as import("@/lib/persona/domain/creation-types").CandidateGenerationCostEstimate | null,
    paidConfirmationToken: null as string | null,
    paidConfirmationProjectId: null as string | null,
  };
}
