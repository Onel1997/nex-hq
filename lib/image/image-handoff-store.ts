"use client";

import type {
  DesignConcept,
  DesignConceptReview,
  RenderPlan,
} from "@/lib/design/ai-designer/types";
import type { DesignMissionAssets } from "@/lib/design/design-mission-store";

export const IMAGE_STUDIO_HANDOFF_KEY = "nexhq-image-studio-handoff";
const STORAGE_KEY = IMAGE_STUDIO_HANDOFF_KEY;
const SEND_DEBUG_KEY = "nexhq-image-studio-handoff-send-debug";
const WINDOW_NAME_PREFIX = "nexhq-image-handoff:";

export interface ImageStudioHandoffMission {
  title: string;
  collection: string;
  garment: string;
  colorway: string;
  version: string;
}

export interface ImageStudioHandoff {
  brief: string;
  sourceTitle?: string;
  designId?: string;
  reportId?: string;
  handoffAt: string;
  mission?: ImageStudioHandoffMission;
  commercialBlueprint?: string;
  commercialScore?: number;
  commercialApproved?: boolean;
  imagePromptPrimary?: string;
  mockupPromptPrimary?: string;
  renderPlan?: RenderPlan;
  concept?: DesignConcept;
  review?: DesignConceptReview;
}

export interface HandoffSaveResult {
  saved: boolean;
  storageKey: string;
  localStorage: boolean;
  sessionStorage: boolean;
  windowName: boolean;
  title: string;
  collection: string;
  garment: string;
  colorway: string;
  briefLength: number;
  promptLength: number;
  error?: string;
}

export interface HandoffLoadDebug {
  rawFound: boolean;
  source: "localStorage" | "sessionStorage" | "window.name" | "none";
  storageKey: string;
  parsed: boolean;
  title: string;
  collection: string;
  garment: string;
  colorway: string;
  briefLength: number;
  rejectReason?: string;
}

function trim(value: string | undefined): string {
  return value?.trim() ?? "";
}

function buildMissionSnapshot(input: {
  sourceTitle?: string;
  designId?: string;
  concept?: DesignConcept;
  briefTitle?: string;
  collectionName?: string;
  productName?: string;
  colorName?: string;
}): ImageStudioHandoffMission {
  const concept = input.concept;
  return {
    title: trim(concept?.title) || trim(input.sourceTitle) || trim(input.briefTitle) || "Design Mission",
    collection: trim(concept?.collection) || trim(input.collectionName) || "—",
    garment: trim(concept?.product) || trim(input.productName) || "—",
    colorway: trim(concept?.color) || trim(input.colorName) || "—",
    version: "V1",
  };
}

function rebuildBriefFromHandoff(handoff: Partial<ImageStudioHandoff>): string {
  const concept = handoff.concept;
  const candidates = [
    handoff.brief,
    handoff.imagePromptPrimary,
    concept?.imagePrompt?.primary,
    concept?.imagePrompt?.campaign,
    concept?.imagePrompt?.social,
    handoff.commercialBlueprint,
    concept?.creativeDirection?.summary,
    concept?.designStory,
    handoff.renderPlan?.handoffNotes?.[0],
    handoff.mission?.title
      ? `${handoff.mission.title} — ${handoff.mission.collection} — ${handoff.mission.garment} in ${handoff.mission.colorway}`
      : "",
  ];

  for (const candidate of candidates) {
    const text = trim(candidate);
    if (text.length >= 3) return text.slice(0, 4000);
  }

  return "";
}

export function explainHandoffRejection(
  raw: Partial<ImageStudioHandoff> | null | undefined,
): string | undefined {
  if (!raw || typeof raw !== "object") return "No raw payload";
  const mission = raw.mission ?? buildMissionSnapshot({ sourceTitle: raw.sourceTitle, concept: raw.concept });
  const brief = rebuildBriefFromHandoff({ ...raw, mission });
  const hasPayload = Boolean(
    brief ||
      raw.concept ||
      trim(raw.imagePromptPrimary) ||
      trim(raw.mockupPromptPrimary) ||
      trim(raw.commercialBlueprint) ||
      trim(raw.sourceTitle) ||
      trim(mission.title),
  );
  if (!hasPayload) return "Payload empty after normalize — no brief, concept, prompts, or title";
  return undefined;
}

export function normalizeImageStudioHandoff(
  raw: Partial<ImageStudioHandoff> | null | undefined,
): ImageStudioHandoff | null {
  if (!raw || typeof raw !== "object") return null;

  const rejectReason = explainHandoffRejection(raw);
  if (rejectReason) return null;

  const concept = raw.concept;
  const mission =
    raw.mission ??
    buildMissionSnapshot({
      sourceTitle: raw.sourceTitle,
      designId: raw.designId,
      concept,
    });

  const imagePromptPrimary =
    trim(raw.imagePromptPrimary) ||
    trim(concept?.imagePrompt?.primary) ||
    undefined;
  const mockupPromptPrimary =
    trim(raw.mockupPromptPrimary) ||
    trim(concept?.mockupPrompt?.primary) ||
    undefined;

  const brief = rebuildBriefFromHandoff({
    ...raw,
    imagePromptPrimary,
    mockupPromptPrimary,
    mission,
  });

  return {
    brief,
    sourceTitle: trim(raw.sourceTitle) || mission.title,
    designId: raw.designId,
    reportId: raw.reportId,
    handoffAt: raw.handoffAt ?? new Date().toISOString(),
    mission,
    commercialBlueprint: raw.commercialBlueprint,
    commercialScore: raw.commercialScore,
    commercialApproved: raw.commercialApproved,
    imagePromptPrimary,
    mockupPromptPrimary,
    renderPlan: raw.renderPlan,
    concept,
    review: raw.review,
  };
}

export function buildImageStudioHandoff(input: {
  brief: string;
  sourceTitle?: string;
  designId?: string;
  reportId?: string;
  assets?: DesignMissionAssets;
  collectionName?: string;
  productName?: string;
  colorName?: string;
}): ImageStudioHandoff {
  const concept = input.assets?.aiDesignerConcept;
  const review = input.assets?.aiDesignerReview;
  const renderPlan = input.assets?.aiDesignerRenderPlan;

  const imagePromptPrimary = trim(concept?.imagePrompt?.primary) || trim(input.brief) || undefined;
  const mockupPromptPrimary = trim(concept?.mockupPrompt?.primary) || undefined;
  const mission = buildMissionSnapshot({
    sourceTitle: input.sourceTitle,
    designId: input.designId,
    concept,
    briefTitle: input.sourceTitle,
    collectionName: input.collectionName,
    productName: input.productName,
    colorName: input.colorName,
  });

  const handoff: ImageStudioHandoff = {
    brief: imagePromptPrimary ?? trim(input.brief),
    sourceTitle: input.sourceTitle ?? mission.title,
    designId: input.designId,
    reportId: input.reportId,
    handoffAt: new Date().toISOString(),
    mission,
    commercialBlueprint: input.assets?.imageStudioBlueprint,
    commercialScore: input.assets?.commercialScore,
    commercialApproved: input.assets?.commercialApproved,
    imagePromptPrimary,
    mockupPromptPrimary,
    renderPlan,
    concept,
    review,
  };

  return normalizeImageStudioHandoff(handoff) ?? handoff;
}

function compactForWindowName(handoff: ImageStudioHandoff): ImageStudioHandoff {
  return {
    brief: handoff.brief,
    sourceTitle: handoff.sourceTitle,
    designId: handoff.designId,
    reportId: handoff.reportId,
    handoffAt: handoff.handoffAt,
    mission: handoff.mission,
    imagePromptPrimary: handoff.imagePromptPrimary,
    mockupPromptPrimary: handoff.mockupPromptPrimary,
    commercialBlueprint: handoff.commercialBlueprint,
    commercialScore: handoff.commercialScore,
    commercialApproved: handoff.commercialApproved,
  };
}

function readRawFromWindowName(): unknown {
  if (typeof window === "undefined") return null;
  const name = window.name ?? "";
  if (!name.startsWith(WINDOW_NAME_PREFIX)) return null;
  try {
    return JSON.parse(name.slice(WINDOW_NAME_PREFIX.length)) as unknown;
  } catch {
    return null;
  }
}

function writeWindowNameHandoff(handoff: ImageStudioHandoff): boolean {
  if (typeof window === "undefined") return false;
  try {
    const full = JSON.stringify(handoff);
    if (full.length <= 1_500_000) {
      window.name = WINDOW_NAME_PREFIX + full;
      return true;
    }
    const compact = JSON.stringify(compactForWindowName(handoff));
    window.name = WINDOW_NAME_PREFIX + compact;
    return true;
  } catch {
    return false;
  }
}

export function readRawImageStudioHandoff(): {
  raw: unknown;
  source: HandoffLoadDebug["source"];
} {
  if (typeof window === "undefined") {
    return { raw: null, source: "none" };
  }

  try {
    const fromLocal = localStorage.getItem(STORAGE_KEY);
    if (fromLocal) {
      return { raw: JSON.parse(fromLocal) as unknown, source: "localStorage" };
    }
  } catch {
    /* try next source */
  }

  try {
    const fromSession = sessionStorage.getItem(STORAGE_KEY);
    if (fromSession) {
      return { raw: JSON.parse(fromSession) as unknown, source: "sessionStorage" };
    }
  } catch {
    /* try next source */
  }

  const fromWindow = readRawFromWindowName();
  if (fromWindow) {
    return { raw: fromWindow, source: "window.name" };
  }

  return { raw: null, source: "none" };
}

export function loadImageStudioHandoffWithDebug(): {
  handoff: ImageStudioHandoff | null;
  debug: HandoffLoadDebug;
} {
  const { raw, source } = readRawImageStudioHandoff();
  const partial = raw as Partial<ImageStudioHandoff> | null;
  const mission = partial?.mission;
  const rejectReason = explainHandoffRejection(partial);
  const handoff = normalizeImageStudioHandoff(partial);

  const debug: HandoffLoadDebug = {
    rawFound: Boolean(raw),
    source,
    storageKey: STORAGE_KEY,
    parsed: Boolean(handoff),
    title: handoff?.mission?.title ?? mission?.title ?? trim(partial?.sourceTitle) ?? "—",
    collection: handoff?.mission?.collection ?? mission?.collection ?? "—",
    garment: handoff?.mission?.garment ?? mission?.garment ?? "—",
    colorway: handoff?.mission?.colorway ?? mission?.colorway ?? "—",
    briefLength: handoff?.brief.length ?? trim(partial?.brief).length,
    rejectReason: handoff ? undefined : rejectReason ?? "Normalize returned null",
  };

  return { handoff, debug };
}

export function loadImageStudioHandoff(): ImageStudioHandoff | null {
  return loadImageStudioHandoffWithDebug().handoff;
}

export function peekImageStudioHandoff(): ImageStudioHandoff | null {
  return loadImageStudioHandoff();
}

export function saveImageStudioHandoff(handoff: ImageStudioHandoff): HandoffSaveResult {
  const normalized = normalizeImageStudioHandoff(handoff) ?? handoff;
  const mission = normalized.mission ?? buildMissionSnapshot({ sourceTitle: normalized.sourceTitle, concept: normalized.concept });
  const payload = JSON.stringify(normalized);
  const promptLength = trim(normalized.imagePromptPrimary).length || trim(normalized.brief).length;

  const result: HandoffSaveResult = {
    saved: false,
    storageKey: STORAGE_KEY,
    localStorage: false,
    sessionStorage: false,
    windowName: false,
    title: mission.title,
    collection: mission.collection,
    garment: mission.garment,
    colorway: mission.colorway,
    briefLength: normalized.brief.length,
    promptLength,
  };

  if (typeof window === "undefined") {
    result.error = "window undefined (SSR)";
    return result;
  }

  try {
    localStorage.setItem(STORAGE_KEY, payload);
    result.localStorage = true;
  } catch (error) {
    result.error = `localStorage: ${error instanceof Error ? error.message : "failed"}`;
  }

  try {
    sessionStorage.setItem(STORAGE_KEY, payload);
    result.sessionStorage = true;
  } catch (error) {
    const message = `sessionStorage: ${error instanceof Error ? error.message : "failed"}`;
    result.error = result.error ? `${result.error}; ${message}` : message;
  }

  result.windowName = writeWindowNameHandoff(normalized);

  try {
    sessionStorage.setItem(SEND_DEBUG_KEY, JSON.stringify({ ...result, savedAt: new Date().toISOString() }));
  } catch {
    /* non-fatal */
  }

  result.saved = result.localStorage || result.sessionStorage || result.windowName;

  console.info("[Design Studio] image handoff saved", result);
  return result;
}

export function loadHandoffSendDebug(): HandoffSaveResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SEND_DEBUG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as HandoffSaveResult;
  } catch {
    return null;
  }
}

export function clearImageStudioHandoff(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  if (window.name.startsWith(WINDOW_NAME_PREFIX)) {
    window.name = "";
  }
}

export function acknowledgeImageStudioHandoff(): void {
  clearImageStudioHandoff();
}

export function consumeImageStudioHandoff(): ImageStudioHandoff | null {
  const { handoff } = loadImageStudioHandoffWithDebug();
  if (!handoff) return null;
  clearImageStudioHandoff();
  return handoff;
}
