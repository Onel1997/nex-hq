"use client";

import type {
  DesignConcept,
  DesignConceptReview,
  RenderPlan,
} from "@/lib/design/ai-designer/types";
import type { DesignMissionAssets } from "@/lib/design/design-mission-store";
import { buildMasterArtworkHandoffPayload } from "@/lib/design/master-artwork";
import {
  slimConceptForStorage,
  slimRenderPlanForStorage,
} from "@/lib/design/design-mission-storage";

export const IMAGE_STUDIO_HANDOFF_KEY = "nexhq-image-studio-handoff";
export const IMAGE_STUDIO_HANDOFF_KEY_V2 = "nexhq-image-studio-handoff-v2";
const STORAGE_KEY = IMAGE_STUDIO_HANDOFF_KEY;
const STORAGE_KEY_V2 = IMAGE_STUDIO_HANDOFF_KEY_V2;
const HANDOFF_STORAGE_KEYS = [STORAGE_KEY, STORAGE_KEY_V2] as const;
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
  /** Approved master artwork — Image Studio production source (never redesign). */
  masterArtworkApproved?: boolean;
  masterArtworkSourceType?: "vector-artwork" | "ai-designer-artwork" | "svg-draft" | "uploaded";
  masterArtworkVersion?: string;
  masterArtworkArtworkUrl?: string;
  masterArtworkTransparentPngUrl?: string;
  masterArtworkProductionPngUrl?: string;
  masterArtworkApprovedArtworkUrl?: string;
  masterArtworkApprovedProductionFileUrl?: string;
  masterArtworkSvgUrl?: string;
  masterArtworkSvgMarkup?: string;
  masterArtworkPlacement?: string;
  masterArtworkPrintMethod?: string;
  masterArtworkResolution?: string;
  masterArtworkDpi?: number;
  masterArtworkGenerationMode?: "draft" | "production";
  masterArtworkTransparentBackground?: boolean;
  masterArtworkPrintReady?: boolean;
  masterArtworkDesignDirection?: string;
  masterArtworkCommercialScore?: number;
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

export interface HandoffRawDiagnostics {
  localStorageRawLength: number;
  sessionStorageRawLength: number;
  windowNameRawLength: number;
  localStorageV2RawLength: number;
  sessionStorageV2RawLength: number;
}

function safeStorageGetItem(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function maxRawLength(values: Array<string | null>): number {
  return values.reduce((max, value) => Math.max(max, value?.length ?? 0), 0);
}

export function readHandoffRawDiagnostics(): HandoffRawDiagnostics {
  if (typeof window === "undefined") {
    return {
      localStorageRawLength: 0,
      sessionStorageRawLength: 0,
      windowNameRawLength: 0,
      localStorageV2RawLength: 0,
      sessionStorageV2RawLength: 0,
    };
  }

  const localV1 = safeStorageGetItem(localStorage, STORAGE_KEY);
  const localV2 = safeStorageGetItem(localStorage, STORAGE_KEY_V2);
  const sessionV1 = safeStorageGetItem(sessionStorage, STORAGE_KEY);
  const sessionV2 = safeStorageGetItem(sessionStorage, STORAGE_KEY_V2);
  const windowName = window.name ?? "";
  const windowRaw =
    windowName.startsWith(WINDOW_NAME_PREFIX) ? windowName.slice(WINDOW_NAME_PREFIX.length) : null;

  return {
    localStorageRawLength: maxRawLength([localV1, localV2]),
    sessionStorageRawLength: maxRawLength([sessionV1, sessionV2]),
    windowNameRawLength: windowRaw?.length ?? 0,
    localStorageV2RawLength: localV2?.length ?? 0,
    sessionStorageV2RawLength: sessionV2?.length ?? 0,
  };
}

export function logHandoffRawDiagnostics(): HandoffRawDiagnostics {
  const diagnostics = readHandoffRawDiagnostics();
  console.info("[Image Studio] localStorage raw length", diagnostics.localStorageRawLength);
  console.info("[Image Studio] sessionStorage raw length", diagnostics.sessionStorageRawLength);
  console.info("[Image Studio] window.name raw length", diagnostics.windowNameRawLength);
  return diagnostics;
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
    masterArtworkApproved: raw.masterArtworkApproved,
    masterArtworkSourceType: raw.masterArtworkSourceType,
    masterArtworkVersion: raw.masterArtworkVersion,
    masterArtworkArtworkUrl: raw.masterArtworkArtworkUrl,
    masterArtworkTransparentPngUrl: raw.masterArtworkTransparentPngUrl,
    masterArtworkProductionPngUrl: raw.masterArtworkProductionPngUrl,
    masterArtworkApprovedArtworkUrl: raw.masterArtworkApprovedArtworkUrl,
    masterArtworkApprovedProductionFileUrl: raw.masterArtworkApprovedProductionFileUrl,
    masterArtworkSvgUrl: raw.masterArtworkSvgUrl,
    masterArtworkSvgMarkup: raw.masterArtworkSvgMarkup,
    masterArtworkPlacement: raw.masterArtworkPlacement,
    masterArtworkPrintMethod: raw.masterArtworkPrintMethod,
    masterArtworkResolution: raw.masterArtworkResolution,
    masterArtworkDpi: raw.masterArtworkDpi,
    masterArtworkGenerationMode: raw.masterArtworkGenerationMode,
    masterArtworkTransparentBackground: raw.masterArtworkTransparentBackground,
    masterArtworkPrintReady: raw.masterArtworkPrintReady,
    masterArtworkDesignDirection: raw.masterArtworkDesignDirection,
    masterArtworkCommercialScore: raw.masterArtworkCommercialScore,
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
    ...buildMasterArtworkHandoffPayload(input.assets ?? {}),
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
    masterArtworkApproved: handoff.masterArtworkApproved,
    masterArtworkApprovedArtworkUrl: handoff.masterArtworkApprovedArtworkUrl,
    masterArtworkApprovedProductionFileUrl: handoff.masterArtworkApprovedProductionFileUrl,
    masterArtworkDesignDirection: handoff.masterArtworkDesignDirection,
    masterArtworkResolution: handoff.masterArtworkResolution,
    masterArtworkDpi: handoff.masterArtworkDpi,
    masterArtworkPrintReady: handoff.masterArtworkPrintReady,
  };
}

function slimHandoffForStorage(handoff: ImageStudioHandoff): ImageStudioHandoff {
  const concept = handoff.concept ? slimConceptForStorage(handoff.concept) : undefined;
  const renderPlan = handoff.renderPlan ? slimRenderPlanForStorage(handoff.renderPlan) : undefined;
  const slim: ImageStudioHandoff = {
    ...handoff,
    concept,
    renderPlan,
    masterArtworkSvgMarkup:
      handoff.masterArtworkSvgMarkup && handoff.masterArtworkSvgMarkup.length <= 12_000
        ? handoff.masterArtworkSvgMarkup
        : undefined,
  };
  return normalizeImageStudioHandoff(slim) ?? slim;
}

function handoffPayloadVariants(handoff: ImageStudioHandoff): ImageStudioHandoff[] {
  const normalized = normalizeImageStudioHandoff(handoff) ?? handoff;
  const variants: ImageStudioHandoff[] = [];
  const seen = new Set<string>();

  for (const candidate of [normalized, slimHandoffForStorage(normalized), compactForWindowName(normalized)]) {
    const key = JSON.stringify(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    variants.push(candidate);
  }

  return variants;
}

export interface DesignStudioHandoffInput {
  title: string;
  collection: string;
  garment: string;
  colorway: string;
  version?: string;
  imagePrompt: string;
  mockupPrompt?: string;
  designId?: string;
  reportId?: string;
  assets?: DesignMissionAssets;
  aiDesignerConcept?: DesignConcept;
  renderPlan?: RenderPlan;
  review?: DesignConceptReview;
}

function rebuildImageStudioHandoffFromMission(
  input: DesignStudioHandoffInput,
  assets: DesignMissionAssets,
): ImageStudioHandoff {
  const concept = assets.aiDesignerConcept ?? input.aiDesignerConcept;
  const imagePromptPrimary =
    trim(input.imagePrompt) ||
    trim(concept?.imagePrompt?.primary) ||
    trim(assets.imageStudioBlueprint) ||
    undefined;
  const mockupPromptPrimary =
    trim(input.mockupPrompt) ||
    trim(concept?.mockupPrompt?.primary) ||
    undefined;

  const mission: ImageStudioHandoffMission = {
    title: trim(input.title) || trim(concept?.title) || "Design Mission",
    collection: trim(input.collection) || trim(concept?.collection) || "—",
    garment: trim(input.garment) || trim(concept?.product) || "—",
    colorway: trim(input.colorway) || trim(concept?.color) || "—",
    version: input.version ?? "V1",
  };

  const brief =
    imagePromptPrimary ??
    trim(concept?.imagePrompt?.campaign) ??
    `${mission.title} — ${mission.collection} — ${mission.garment} in ${mission.colorway}`;

  return {
    brief,
    sourceTitle: mission.title,
    designId: input.designId,
    reportId: input.reportId,
    handoffAt: new Date().toISOString(),
    mission,
    commercialBlueprint: assets.imageStudioBlueprint,
    commercialScore: assets.commercialScore,
    commercialApproved: assets.commercialApproved,
    imagePromptPrimary,
    mockupPromptPrimary,
    renderPlan: assets.aiDesignerRenderPlan ?? input.renderPlan,
    concept,
    review: assets.aiDesignerReview ?? input.review,
    ...buildMasterArtworkHandoffPayload(assets),
  };
}

export function sendDesignHandoffToImageStudio(input: DesignStudioHandoffInput): HandoffSaveResult {
  console.info("[Design Studio] send clicked");

  const mergedAssets: DesignMissionAssets = {
    ...input.assets,
    aiDesignerConcept: input.assets?.aiDesignerConcept ?? input.aiDesignerConcept,
    aiDesignerRenderPlan: input.assets?.aiDesignerRenderPlan ?? input.renderPlan,
    aiDesignerReview: input.assets?.aiDesignerReview ?? input.review,
  };

  let handoff = buildImageStudioHandoff({
    brief: input.imagePrompt,
    sourceTitle: input.title,
    designId: input.designId,
    reportId: input.reportId,
    assets: mergedAssets,
    collectionName: input.collection,
    productName: input.garment,
    colorName: input.colorway,
  });

  if (!normalizeImageStudioHandoff(handoff)) {
    handoff = rebuildImageStudioHandoffFromMission(input, mergedAssets);
  }

  if (input.version && handoff.mission) {
    handoff = { ...handoff, mission: { ...handoff.mission, version: input.version } };
  }

  console.info("[Design Studio] handoff built", {
    title: handoff.mission?.title ?? handoff.sourceTitle,
    collection: handoff.mission?.collection,
    garment: handoff.mission?.garment,
    colorway: handoff.mission?.colorway,
    briefLength: handoff.brief.length,
  });

  const saveResult = saveImageStudioHandoff(handoff);
  console.info("[Design Studio] handoff saved", saveResult);

  return saveResult;
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
  storageKey: string;
} {
  if (typeof window === "undefined") {
    return { raw: null, source: "none", storageKey: STORAGE_KEY };
  }

  for (const key of HANDOFF_STORAGE_KEYS) {
    try {
      const fromLocal = safeStorageGetItem(localStorage, key);
      if (fromLocal) {
        return { raw: JSON.parse(fromLocal) as unknown, source: "localStorage", storageKey: key };
      }
    } catch {
      /* try next key/source */
    }
  }

  for (const key of HANDOFF_STORAGE_KEYS) {
    try {
      const fromSession = safeStorageGetItem(sessionStorage, key);
      if (fromSession) {
        return { raw: JSON.parse(fromSession) as unknown, source: "sessionStorage", storageKey: key };
      }
    } catch {
      /* try next key/source */
    }
  }

  const fromWindow = readRawFromWindowName();
  if (fromWindow) {
    return { raw: fromWindow, source: "window.name", storageKey: STORAGE_KEY };
  }

  return { raw: null, source: "none", storageKey: STORAGE_KEY };
}

export function loadImageStudioHandoffWithDebug(): {
  handoff: ImageStudioHandoff | null;
  debug: HandoffLoadDebug;
} {
  const { raw, source, storageKey } = readRawImageStudioHandoff();
  const partial = raw as Partial<ImageStudioHandoff> | null;
  const mission = partial?.mission;
  const rejectReason = explainHandoffRejection(partial);
  const handoff = normalizeImageStudioHandoff(partial);

  const debug: HandoffLoadDebug = {
    rawFound: Boolean(raw),
    source,
    storageKey,
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

export function applyImageStudioHandoff(): {
  handoff: ImageStudioHandoff | null;
  debug: HandoffLoadDebug;
} {
  logHandoffRawDiagnostics();
  const result = loadImageStudioHandoffWithDebug();
  console.info("[Image Studio] selected handoff source", result.debug.source);
  if (result.handoff) {
    console.info("[Image Studio] applying handoff", {
      source: result.debug.source,
      storageKey: result.debug.storageKey,
      title: result.handoff.mission?.title ?? result.handoff.sourceTitle,
    });
  }
  return result;
}

export function loadImageStudioHandoff(): ImageStudioHandoff | null {
  return loadImageStudioHandoffWithDebug().handoff;
}

export function peekImageStudioHandoff(): ImageStudioHandoff | null {
  return applyImageStudioHandoff().handoff;
}

function tryPersistHandoffPayload(payload: string): {
  localStorage: boolean;
  sessionStorage: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  let localStorageOk = false;
  let sessionStorageOk = false;

  for (const key of HANDOFF_STORAGE_KEYS) {
    try {
      localStorage.setItem(key, payload);
      localStorageOk = true;
    } catch (error) {
      errors.push(`localStorage(${key}): ${error instanceof Error ? error.message : "failed"}`);
    }
  }

  for (const key of HANDOFF_STORAGE_KEYS) {
    try {
      sessionStorage.setItem(key, payload);
      sessionStorageOk = true;
    } catch (error) {
      errors.push(`sessionStorage(${key}): ${error instanceof Error ? error.message : "failed"}`);
    }
  }

  return { localStorage: localStorageOk, sessionStorage: sessionStorageOk, errors };
}

export function saveImageStudioHandoff(handoff: ImageStudioHandoff): HandoffSaveResult {
  const variants = handoffPayloadVariants(handoff);
  const normalized = variants[0] ?? handoff;
  const mission =
    normalized.mission ??
    buildMissionSnapshot({ sourceTitle: normalized.sourceTitle, concept: normalized.concept });
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

  const persistErrors: string[] = [];

  for (const variant of variants) {
    if (result.localStorage && result.sessionStorage) break;

    let payload: string;
    try {
      payload = JSON.stringify(variant);
    } catch (error) {
      persistErrors.push(`stringify: ${error instanceof Error ? error.message : "failed"}`);
      continue;
    }

    const attempt = tryPersistHandoffPayload(payload);
    if (!result.localStorage && attempt.localStorage) result.localStorage = true;
    if (!result.sessionStorage && attempt.sessionStorage) result.sessionStorage = true;
    if (attempt.errors.length) persistErrors.push(...attempt.errors);

    const quotaHit = attempt.errors.some((message) => /quota|exceeded|storage/i.test(message));
    if (!quotaHit && (attempt.localStorage || attempt.sessionStorage)) break;
  }

  result.windowName = writeWindowNameHandoff(normalized);

  if (!result.localStorage && !result.sessionStorage && !result.windowName && persistErrors.length) {
    result.error = persistErrors.join("; ");
  }

  try {
    sessionStorage.setItem(SEND_DEBUG_KEY, JSON.stringify({ ...result, savedAt: new Date().toISOString() }));
  } catch {
    /* non-fatal */
  }

  result.saved = result.localStorage || result.sessionStorage || result.windowName;
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
  for (const key of HANDOFF_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  if (window.name.startsWith(WINDOW_NAME_PREFIX)) {
    window.name = "";
  }
}

export function acknowledgeImageStudioHandoff(): void {
  console.info("[Image Studio] clearing handoff after successful apply");
  clearImageStudioHandoff();
}

/** @deprecated Use peekImageStudioHandoff + acknowledgeImageStudioHandoff instead */
export function consumeImageStudioHandoff(): ImageStudioHandoff | null {
  return peekImageStudioHandoff();
}
