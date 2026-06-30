"use client";

import type {
  DesignConcept,
  DesignConceptReview,
  RenderPlan,
} from "@/lib/design/ai-designer/types";
import type { DesignMissionAssets } from "@/lib/design/design-mission-store";

const STORAGE_KEY = "nexhq-image-studio-handoff";

export interface ImageStudioHandoff {
  brief: string;
  sourceTitle?: string;
  designId?: string;
  reportId?: string;
  handoffAt: string;
  /** Full blueprint from Commercial Design Director for Image Studio. */
  commercialBlueprint?: string;
  commercialScore?: number;
  commercialApproved?: boolean;
  /** AI Designer primary image prompt — preferred over brief when present. */
  imagePromptPrimary?: string;
  /** AI Designer primary mockup prompt. */
  mockupPromptPrimary?: string;
  renderPlan?: RenderPlan;
  concept?: DesignConcept;
  review?: DesignConceptReview;
}

export function buildImageStudioHandoff(input: {
  brief: string;
  sourceTitle?: string;
  designId?: string;
  reportId?: string;
  assets?: DesignMissionAssets;
}): ImageStudioHandoff {
  const concept = input.assets?.aiDesignerConcept;
  const review = input.assets?.aiDesignerReview;
  const renderPlan = input.assets?.aiDesignerRenderPlan;

  const imagePromptPrimary = concept?.imagePrompt.primary;
  const mockupPromptPrimary = concept?.mockupPrompt.primary;

  return {
    brief: imagePromptPrimary ?? input.brief,
    sourceTitle: input.sourceTitle,
    designId: input.designId,
    reportId: input.reportId,
    handoffAt: new Date().toISOString(),
    commercialBlueprint: input.assets?.imageStudioBlueprint,
    commercialScore: input.assets?.commercialScore,
    commercialApproved: input.assets?.commercialApproved,
    imagePromptPrimary,
    mockupPromptPrimary,
    renderPlan,
    concept,
    review,
  };
}

export function saveImageStudioHandoff(handoff: ImageStudioHandoff): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(handoff));
}

export function loadImageStudioHandoff(): ImageStudioHandoff | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ImageStudioHandoff;
    if (!parsed?.brief?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function consumeImageStudioHandoff(): ImageStudioHandoff | null {
  const handoff = loadImageStudioHandoff();
  if (!handoff) return null;
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
  return handoff;
}
