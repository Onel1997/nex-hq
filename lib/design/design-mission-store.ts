"use client";

import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type {
  DesignConcept,
  DesignConceptReview,
  RenderPlan,
} from "@/lib/design/ai-designer/types";
import {
  computeDesignHealth,
  defaultProductionChecklist,
  syncProductionChecklist,
} from "@/lib/design/design-workspace-utils";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "nexhq-design-mission";

export type PipelineStage =
  | "research"
  | "design"
  | "commercial-review"
  | "image"
  | "mockup"
  | "approval"
  | "shopify"
  | "launch";

export type CollectionTimelineStage =
  | "research"
  | "design"
  | "images"
  | "marketing"
  | "shopify"
  | "launch";

export type VersionEntryType =
  | "design"
  | "mockup"
  | "svg"
  | "render"
  | "approved"
  | "draft";

export type ProductionItemStatus = "pending" | "working" | "complete";

export type ApprovalStatus = "pending" | "approved" | "revision" | "archived";

export interface ProductionItem {
  id:
    | "svg"
    | "mockup"
    | "aiRender"
    | "print"
    | "embroidery"
    | "dtg"
    | "screenPrint"
    | "shopify"
    | "marketing"
    | "launch";
  label: string;
  status: ProductionItemStatus;
}

export interface DesignHealthScores {
  luxury: number;
  originality: number;
  printQuality: number;
  manufacturingComplexity: number;
  brandConsistency: number;
  commercialPotential: number;
  trendAlignment: number;
  visualBalance: number;
  colorHarmony: number;
  typography: number;
}

export interface DesignVersionEntry {
  id: string;
  label: string;
  type: VersionEntryType;
  timestamp: string;
}

export interface DesignMissionAssets {
  svgUrl?: string;
  svgMarkup?: string;
  mockupUrl?: string;
  renderUrl?: string;
  commercialApproved?: boolean;
  commercialScore?: number;
  commercialIterations?: number;
  imageStudioBlueprint?: string;
  /** AI Designer blueprint — premium creative concept for Image Studio. */
  aiDesignerConcept?: DesignConcept;
  aiDesignerRenderPlan?: RenderPlan;
  aiDesignerReview?: DesignConceptReview;
}

export interface DesignPromptOverrides {
  svgPrompt?: string;
  mockupPrompt?: string;
  imagePrompt?: string;
  designerPrompt?: string;
}

export interface DesignIteration {
  id: string;
  version: number;
  label: string;
  brief: DesignStudioBrief;
  assets: DesignMissionAssets;
  promptOverrides: DesignPromptOverrides;
  timestamp: string;
  favorite?: boolean;
  source?: "research" | "ai" | "manual" | "generation";
}

export interface CreativeDirectorMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface PerDesignWorkspace {
  designId: string;
  assets: DesignMissionAssets;
  promptOverrides: DesignPromptOverrides;
  iterations: DesignIteration[];
  activeIterationId: string;
  production: ProductionItem[];
  health: DesignHealthScores;
  chat: CreativeDirectorMessage[];
  approvalStatus: ApprovalStatus;
}

export interface DesignMissionState {
  reportId: string;
  brainRecordId?: string;
  reportTitle: string;
  collectionName?: string;
  collectionMood?: string;
  brief: DesignStudioBrief;
  allBriefs?: DesignStudioBrief[];
  handoffAt: string;
  savedAt?: string;
  pipelineStage: PipelineStage;
  timelineStage: CollectionTimelineStage;
  versionHistory: DesignVersionEntry[];
  assets: DesignMissionAssets;
  promptOverrides: DesignPromptOverrides;
  designWorkspaces: Record<string, PerDesignWorkspace>;
  compareMode: { leftId: string; rightId: string } | null;
}

function createVersionEntry(
  label: string,
  type: VersionEntryType,
): DesignVersionEntry {
  return {
    id: crypto.randomUUID(),
    label,
    type,
    timestamp: new Date().toISOString(),
  };
}

function createIteration(
  brief: DesignStudioBrief,
  version: number,
  source: DesignIteration["source"] = "research",
  assets: DesignMissionAssets = {},
  promptOverrides: DesignPromptOverrides = {},
): DesignIteration {
  return {
    id: crypto.randomUUID(),
    version,
    label: `V${version}`,
    brief,
    assets,
    promptOverrides,
    timestamp: new Date().toISOString(),
    source,
  };
}

function deriveCollectionMood(
  brief: DesignStudioBrief,
  collectionName?: string,
): string {
  if (collectionName?.toLowerCase().includes("silent")) return "Intimate restraint";
  if (collectionName?.toLowerCase().includes("love")) return "Quiet devotion";
  const snippet = brief.visualConcept.split(/[.—]/)[0]?.trim();
  if (snippet && snippet.length <= 40) return snippet;
  return "Editorial calm";
}

export function createDesignWorkspace(
  brief: DesignStudioBrief,
  existing?: Partial<PerDesignWorkspace>,
): PerDesignWorkspace {
  const iteration = createIteration(
    brief,
    1,
    "research",
    existing?.assets ?? {},
    existing?.promptOverrides ?? {},
  );
  const assets = existing?.assets ?? {};
  const production = syncProductionChecklist(
    existing?.production ?? defaultProductionChecklist(),
    brief,
    assets,
    existing?.approvalStatus,
  );

  return {
    designId: brief.designId,
    assets,
    promptOverrides: existing?.promptOverrides ?? {},
    iterations: existing?.iterations?.length
      ? existing.iterations
      : [iteration],
    activeIterationId: existing?.activeIterationId ?? iteration.id,
    production,
    health: existing?.health ?? computeDesignHealth(brief),
    chat: existing?.chat ?? [],
    approvalStatus: existing?.approvalStatus ?? "pending",
  };
}

export function getActiveWorkspace(state: DesignMissionState): PerDesignWorkspace {
  return (
    state.designWorkspaces[state.brief.designId] ??
    createDesignWorkspace(state.brief, {
      assets: state.assets,
      promptOverrides: state.promptOverrides,
    })
  );
}

export function getActiveIteration(
  workspace: PerDesignWorkspace,
): DesignIteration {
  return (
    workspace.iterations.find((i) => i.id === workspace.activeIterationId) ??
    workspace.iterations[0]
  );
}

function syncMissionSurface(state: DesignMissionState): DesignMissionState {
  const workspace = getActiveWorkspace(state);
  const iteration = getActiveIteration(workspace);
  return {
    ...state,
    brief: iteration.brief,
    assets: iteration.assets,
    promptOverrides: iteration.promptOverrides,
    designWorkspaces: {
      ...state.designWorkspaces,
      [state.brief.designId]: {
        ...workspace,
        production: syncProductionChecklist(
          workspace.production,
          iteration.brief,
          iteration.assets,
          workspace.approvalStatus,
        ),
        health: computeDesignHealth(iteration.brief),
      },
    },
  };
}

function migrateMission(raw: DesignMissionState): DesignMissionState {
  const brief = raw.brief;
  const legacyWorkspace = createDesignWorkspace(brief, {
    assets: raw.assets ?? {},
    promptOverrides: raw.promptOverrides ?? {},
  });

  const designWorkspaces: Record<string, PerDesignWorkspace> = {
    ...(raw.designWorkspaces ?? {}),
  };

  if (!designWorkspaces[brief.designId]) {
    designWorkspaces[brief.designId] = legacyWorkspace;
  }

  for (const b of raw.allBriefs ?? []) {
    if (!designWorkspaces[b.designId]) {
      designWorkspaces[b.designId] = createDesignWorkspace(b);
    }
  }

  const migrated: DesignMissionState = {
    ...raw,
    pipelineStage: raw.pipelineStage ?? "design",
    timelineStage: raw.timelineStage ?? "design",
    versionHistory:
      raw.versionHistory?.length > 0
        ? raw.versionHistory
        : [createVersionEntry(`Design V1 — ${brief.title}`, "design")],
    assets: raw.assets ?? {},
    promptOverrides: raw.promptOverrides ?? {},
    collectionMood:
      raw.collectionMood ?? deriveCollectionMood(brief, raw.collectionName),
    designWorkspaces,
    compareMode: raw.compareMode ?? null,
  };

  return syncMissionSurface(migrated);
}

function loadMission(): DesignMissionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DesignMissionState;
    if (!parsed?.brief?.designId || !parsed.reportId) return null;
    return migrateMission(parsed);
  } catch {
    return null;
  }
}

export function saveDesignMission(state: DesignMissionState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(migrateMission(state)));
}

export function clearDesignMission(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function getDesignerPrompt(
  brief: DesignStudioBrief,
  overrides: DesignPromptOverrides,
): string {
  if (overrides.designerPrompt?.trim()) return overrides.designerPrompt;
  return brief.designerInstructions.join("\n");
}

export function getEffectivePrompts(
  brief: DesignStudioBrief,
  overrides: DesignPromptOverrides,
  assets: DesignMissionAssets = {},
) {
  const aiConcept = assets.aiDesignerConcept;

  return {
    svgPrompt: overrides.svgPrompt ?? brief.svgPrompt,
    mockupPrompt:
      aiConcept?.mockupPrompt.primary ??
      overrides.mockupPrompt ??
      brief.mockupPrompt,
    imagePrompt:
      aiConcept?.imagePrompt.primary ??
      overrides.imagePrompt ??
      brief.imagePrompt,
    designerPrompt: getDesignerPrompt(brief, overrides),
  };
}

export function appendVersionEntry(
  state: DesignMissionState,
  label: string,
  type: VersionEntryType,
): DesignMissionState {
  const entry = createVersionEntry(label, type);
  return {
    ...state,
    versionHistory: [entry, ...state.versionHistory].slice(0, 30),
  };
}

export function updateWorkspace(
  state: DesignMissionState,
  designId: string,
  updater: (ws: PerDesignWorkspace) => PerDesignWorkspace,
): DesignMissionState {
  const current = state.designWorkspaces[designId] ?? createDesignWorkspace(state.brief);
  const next = migrateMission({
    ...state,
    designWorkspaces: {
      ...state.designWorkspaces,
      [designId]: updater(current),
    },
  });
  if (state.brief.designId === designId) {
    return syncMissionSurface(next);
  }
  return next;
}

export function createNewIteration(
  state: DesignMissionState,
  brief: DesignStudioBrief,
  label: string,
  source: DesignIteration["source"] = "ai",
): DesignMissionState {
  const ws = getActiveWorkspace(state);
  const version =
    ws.iterations.length > 0
      ? Math.max(...ws.iterations.map((i) => i.version)) + 1
      : 1;
  const iteration = createIteration(
    brief,
    version,
    source,
    ws.assets,
    ws.promptOverrides,
  );
  iteration.label = label || `V${version}`;

  let next = updateWorkspace(state, state.brief.designId, (w) => ({
    ...w,
    iterations: [iteration, ...w.iterations].slice(0, 12),
    activeIterationId: iteration.id,
    health: computeDesignHealth(brief),
  }));
  next = appendVersionEntry(next, `${iteration.label} — ${brief.title}`, "design");
  return next;
}

export function restoreIteration(
  state: DesignMissionState,
  iterationId: string,
): DesignMissionState {
  return updateWorkspace(state, state.brief.designId, (w) => {
    const iteration = w.iterations.find((i) => i.id === iterationId);
    if (!iteration) return w;
    return {
      ...w,
      activeIterationId: iterationId,
      assets: iteration.assets,
      promptOverrides: iteration.promptOverrides,
      health: computeDesignHealth(iteration.brief),
    };
  });
}

export function duplicateIteration(
  state: DesignMissionState,
  iterationId: string,
): DesignMissionState {
  const ws = getActiveWorkspace(state);
  const source = ws.iterations.find((i) => i.id === iterationId);
  if (!source) return state;
  const version =
    ws.iterations.length > 0
      ? Math.max(...ws.iterations.map((i) => i.version)) + 1
      : 1;
  const copy = createIteration(
    source.brief,
    version,
    "manual",
    source.assets,
    source.promptOverrides,
  );
  copy.label = `V${version} (copy)`;

  return updateWorkspace(state, state.brief.designId, (w) => ({
    ...w,
    iterations: [copy, ...w.iterations].slice(0, 12),
    activeIterationId: copy.id,
  }));
}

export function toggleIterationFavorite(
  state: DesignMissionState,
  iterationId: string,
): DesignMissionState {
  return updateWorkspace(state, state.brief.designId, (w) => ({
    ...w,
    iterations: w.iterations.map((i) =>
      i.id === iterationId ? { ...i, favorite: !i.favorite } : i,
    ),
  }));
}

export function updateMissionAssets(
  state: DesignMissionState,
  assets: Partial<DesignMissionAssets>,
): DesignMissionState {
  return updateWorkspace(state, state.brief.designId, (w) => {
    const iteration = getActiveIteration(w);
    const nextAssets = { ...w.assets, ...assets };
    const updatedIterations = w.iterations.map((i) =>
      i.id === w.activeIterationId ? { ...i, assets: nextAssets } : i,
    );
    return {
      ...w,
      assets: nextAssets,
      iterations: updatedIterations,
      production: syncProductionChecklist(
        w.production,
        iteration.brief,
        nextAssets,
        w.approvalStatus,
      ),
    };
  });
}

export function updatePromptOverride(
  state: DesignMissionState,
  key: keyof DesignPromptOverrides,
  value: string,
): DesignMissionState {
  return updateWorkspace(state, state.brief.designId, (w) => ({
    ...w,
    promptOverrides: { ...w.promptOverrides, [key]: value },
  }));
}

export function setPipelineStage(
  state: DesignMissionState,
  stage: PipelineStage,
): DesignMissionState {
  return { ...state, pipelineStage: stage };
}

export function setTimelineStage(
  state: DesignMissionState,
  stage: CollectionTimelineStage,
): DesignMissionState {
  return { ...state, timelineStage: stage };
}

export function setApprovalStatus(
  state: DesignMissionState,
  status: ApprovalStatus,
): DesignMissionState {
  return updateWorkspace(state, state.brief.designId, (w) => ({
    ...w,
    approvalStatus: status,
    production: syncProductionChecklist(
      w.production,
      getActiveIteration(w).brief,
      w.assets,
      status,
    ),
  }));
}

export function addChatMessage(
  state: DesignMissionState,
  message: CreativeDirectorMessage,
): DesignMissionState {
  return updateWorkspace(state, state.brief.designId, (w) => ({
    ...w,
    chat: [...w.chat, message].slice(-40),
  }));
}

export function setCompareMode(
  state: DesignMissionState,
  leftId: string,
  rightId: string,
): DesignMissionState {
  return { ...state, compareMode: { leftId, rightId } };
}

export function clearCompareMode(state: DesignMissionState): DesignMissionState {
  return { ...state, compareMode: null };
}

export function markDesignMissionSaved(): DesignMissionState | null {
  const current = loadMission();
  if (!current) return null;
  const next = appendVersionEntry(
    { ...current, savedAt: new Date().toISOString() },
    "Draft saved",
    "draft",
  );
  saveDesignMission(next);
  return next;
}

export function buildDesignMissionFromHandoff(input: {
  reportId: string;
  brainRecordId?: string;
  reportTitle: string;
  collectionName?: string;
  brief: DesignStudioBrief;
  allBriefs?: DesignStudioBrief[];
}): DesignMissionState {
  const now = new Date().toISOString();
  const designWorkspaces: Record<string, PerDesignWorkspace> = {};
  for (const b of input.allBriefs ?? [input.brief]) {
    designWorkspaces[b.designId] = createDesignWorkspace(b);
  }

  return migrateMission({
    reportId: input.reportId,
    brainRecordId: input.brainRecordId,
    reportTitle: input.reportTitle,
    collectionName: input.collectionName,
    collectionMood: deriveCollectionMood(input.brief, input.collectionName),
    brief: input.brief,
    allBriefs: input.allBriefs,
    handoffAt: now,
    pipelineStage: "design",
    timelineStage: "design",
    versionHistory: [
      createVersionEntry(`Design V1 — ${input.brief.title}`, "design"),
    ],
    assets: {},
    promptOverrides: {},
    designWorkspaces,
    compareMode: null,
  });
}

export function useDesignMission() {
  const [mission, setMissionState] = useState<DesignMissionState | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setMissionState(loadMission());
    setHydrated(true);
  }, []);

  const persist = useCallback((state: DesignMissionState) => {
    const next = migrateMission(state);
    saveDesignMission(next);
    setMissionState(next);
    return next;
  }, []);

  const setMission = useCallback(
    (state: DesignMissionState) => persist(state),
    [persist],
  );

  const clearMission = useCallback(() => {
    clearDesignMission();
    setMissionState(null);
  }, []);

  const selectBrief = useCallback((designId: string) => {
    setMissionState((prev) => {
      if (!prev) return prev;
      const nextBrief =
        prev.allBriefs?.find((b) => b.designId === designId) ?? prev.brief;
      if (nextBrief.designId === prev.brief.designId) return prev;

      const designWorkspaces = { ...prev.designWorkspaces };
      if (!designWorkspaces[designId]) {
        designWorkspaces[designId] = createDesignWorkspace(nextBrief);
      }

      const next = migrateMission({
        ...prev,
        brief: nextBrief,
        collectionMood: deriveCollectionMood(nextBrief, prev.collectionName),
        designWorkspaces,
      });
      saveDesignMission(next);
      return next;
    });
  }, []);

  const markSaved = useCallback(() => {
    const next = markDesignMissionSaved();
    if (next) setMissionState(next);
    return next;
  }, []);

  const patchMission = useCallback(
    (updater: (state: DesignMissionState) => DesignMissionState) => {
      setMissionState((prev) => {
        if (!prev) return prev;
        return persist(updater(prev));
      });
    },
    [persist],
  );

  return {
    mission,
    hydrated,
    setMission,
    clearMission,
    selectBrief,
    markSaved,
    patchMission,
  };
}
