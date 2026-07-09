import type { FashionEngineAgentId, FashionEngineProgressStep } from "./types";

/** User-facing progress labels shown during master artwork generation. */
export const FASHION_ENGINE_UI_STEPS = [
  { id: "research-handoff" as const, label: "Research Analysis" },
  { id: "creative-director" as const, label: "Creative Direction" },
  { id: "art-director" as const, label: "Art Direction" },
  { id: "typography-designer" as const, label: "Typography Design" },
  { id: "graphic-designer" as const, label: "Graphic Design" },
  { id: "composition-engine" as const, label: "Composition Review" },
  { id: "commercial-director" as const, label: "Commercial Review" },
  { id: "print-production" as const, label: "Preparing Artwork" },
  { id: "image-generation" as const, label: "Finalizing Master Artwork" },
] as const;

export type FashionEngineUiStep = (typeof FASHION_ENGINE_UI_STEPS)[number];

/** Build initial progress sequence for the fashion design engine pipeline. */
export function createFashionEngineProgress(): FashionEngineProgressStep[] {
  return FASHION_ENGINE_UI_STEPS.map((step) => ({
    id: step.id,
    label: step.label,
    status: "pending" as const,
  }));
}

/** Mark a step complete and optionally set the next step to running. */
export function advanceFashionEngineProgress(
  progress: FashionEngineProgressStep[],
  completedId: FashionEngineAgentId,
): FashionEngineProgressStep[] {
  const completedIndex = progress.findIndex((step) => step.id === completedId);
  if (completedIndex < 0) return progress;

  const now = new Date().toISOString();
  return progress.map((step, index) => {
    if (index < completedIndex) {
      return { ...step, status: "complete" as const, completedAt: step.completedAt ?? now };
    }
    if (index === completedIndex) {
      return { ...step, status: "complete" as const, completedAt: now };
    }
    if (index === completedIndex + 1) {
      return { ...step, status: "running" as const };
    }
    return step;
  });
}

/** Mark the first step as running when pipeline starts. */
export function startFashionEngineProgress(
  progress: FashionEngineProgressStep[],
): FashionEngineProgressStep[] {
  if (progress.length === 0) return progress;
  return progress.map((step, index) => ({
    ...step,
    status: index === 0 ? ("running" as const) : step.status,
  }));
}
