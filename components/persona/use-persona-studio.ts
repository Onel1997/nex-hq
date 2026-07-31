"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEBUG_MODE,
  buildProjectCandidateState,
  emptyProjectDetailState,
  filterLoadedCandidatesForProject,
  projectScopedCandidatesCacheKey,
  type ProjectCandidateState,
} from "@/components/persona/persona-studio-project-sync";
import {
  logCandidateRenderForensics,
  logCastingFlowTrace,
  resolveGenerationSource,
} from "@/lib/persona/creation/casting-data-integrity";

/**
 * Safe JSON fetch: validates status and content-type before parsing.
 * Throws a structured, human-readable error instead of "Unexpected token '<'".
 */
async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<{ res: Response; data: T }> {
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.headers ?? {}),
    },
  });
  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  if (!isJson) {
    const preview = await res.text().then((t) => t.slice(0, 120).replace(/\s+/g, " "));
    console.error("[persona] Unexpected non-JSON response", {
      url,
      method: init?.method ?? "GET",
      status: res.status,
      contentType,
      preview,
    });
    throw new Error(
      `Der Persona-Endpunkt hat keine gültige JSON-Antwort geliefert (HTTP ${res.status}). ` +
        `Erwartet: application/json — Erhalten: ${contentType || "(leer)"}`,
    );
  }

  const data = (await res.json()) as T;
  return { res, data };
}
import type {
  BrandLook,
  CameraPreset,
  Location,
  Outfit,
  Persona,
  PersonaReadinessReport,
  PersonaReferenceAssetView,
  PersonaStudioDashboardCounts,
  PersonaStudioSnapshot,
  Pose,
} from "@/lib/persona/domain/types";
import type {
  BrandCastMilestoneProgress,
  CandidateGenerationCostEstimate,
  CreationProjectPreset,
  PersonaCandidate,
  PersonaCandidateAssetView,
  PersonaCreationProject,
} from "@/lib/persona/domain/creation-types";

export type PersonaHealthStatus = "healthy" | "degraded" | "unavailable";
export type PersonaHealthUiLabel =
  | "Bereit"
  | "Einrichtung erforderlich"
  | "Fehler";

export interface PersonaHealthReport {
  status: PersonaHealthStatus;
  uiLabel: PersonaHealthUiLabel;
  message: string;
  repositoryMode: "supabase" | "memory" | "unconfigured";
  schemaVersion: string | null;
  checks: Array<{ name: string; ok: boolean; detail?: string }>;
  workspaceId: string | null;
  memoryFallback: false;
  checkedAt: string;
  paidGenerationSafety: {
    openaiApiKeyConfigured: boolean;
    paidGenerationEnabled: boolean;
    fakeProviderActive: boolean;
    liveTestsEnabled: boolean;
  };
}

export type PersonaStudioSection =
  | "dashboard"
  | "brand_cast"
  | "creator"
  | "creation_projects"
  | "candidates"
  | "personas"
  | "locations"
  | "camera"
  | "poses"
  | "brand_looks"
  | "outfits";

interface StudioState {
  loading: boolean;
  error: string | null;
  section: PersonaStudioSection;
  snapshot: PersonaStudioSnapshot | null;
  counts: PersonaStudioDashboardCounts | null;
  health: PersonaHealthReport | null;
  selectedPersonaId: string | null;
  selectedReadiness: PersonaReadinessReport | null;
  selectedReferences: PersonaReferenceAssetView[];
  creationProjects: PersonaCreationProject[];
  selectedProjectId: string | null;
  loadedProjectId: string | null;
  loadedProject: PersonaCreationProject | null;
  candidates: PersonaCandidate[];
  selectedCandidateId: string | null;
  candidateAssets: PersonaCandidateAssetView[];
  brandCastProgress: BrandCastMilestoneProgress | null;
  costEstimate: CandidateGenerationCostEstimate | null;
  paidConfirmationToken: string | null;
  paidConfirmationProjectId: string | null;
  generationJobs: import("@/lib/persona/domain/creation-types").PersonaGenerationJob[];
  incidentSummary: import("@/lib/persona/creation/creation-service").IncidentProjectSummary | null;
  candidatePreviews: Record<string, string | null>;
  projectCandidateState: ProjectCandidateState | null;
  projectDetailLoading: boolean;
  presets: CreationProjectPreset[];
  providerSetupMessage: string | null;
}

const EMPTY_COUNTS: PersonaStudioDashboardCounts = {
  approved_personas: 0,
  locations: 0,
  camera_presets: 0,
  pose_packs: 0,
  brand_looks: 0,
  outfits: 0,
  draft_personas: 0,
  review_personas: 0,
  image_ready_personas: 0,
  video_ready_personas: 0,
};

export function usePersonaStudio() {
  const loadProjectRequestRef = useRef(0);
  const activeProjectIdRef = useRef<string | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);
  const workspaceIdRef = useRef<string | null>(null);

  const [state, setState] = useState<StudioState>({
    loading: true,
    error: null,
    section: "dashboard",
    snapshot: null,
    counts: null,
    health: null,
    selectedPersonaId: null,
    selectedReadiness: null,
    selectedReferences: [],
    creationProjects: [],
    selectedProjectId: null,
    loadedProjectId: null,
    loadedProject: null,
    candidates: [],
    selectedCandidateId: null,
    candidateAssets: [],
    brandCastProgress: null,
    costEstimate: null,
    paidConfirmationToken: null,
    paidConfirmationProjectId: null,
    generationJobs: [],
    incidentSummary: null,
    candidatePreviews: {},
    projectCandidateState: null,
    projectDetailLoading: false,
    presets: [],
    providerSetupMessage: null,
  });

  const refreshHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/persona/health");
      const data = (await res.json()) as PersonaHealthReport;
      setState((prev) => ({ ...prev, health: data }));
      workspaceIdRef.current = data.workspaceId ?? null;
    } catch {
      setState((prev) => ({
        ...prev,
        health: {
          status: "unavailable",
          uiLabel: "Fehler",
          message: "Persona Studio Health-Check fehlgeschlagen.",
          repositoryMode: "unconfigured",
          schemaVersion: null,
          checks: [],
          workspaceId: null,
          memoryFallback: false,
          checkedAt: new Date().toISOString(),
          paidGenerationSafety: {
            openaiApiKeyConfigured: false,
            paidGenerationEnabled: false,
            fakeProviderActive: true,
            liveTestsEnabled: false,
          },
        },
      }));
    }
  }, []);

  const refreshCreation = useCallback(async () => {
    try {
      const [projectsRes, brandRes, presetsRes, setupRes] = await Promise.all([
        fetch("/api/persona/creation-projects", { cache: "no-store" }),
        fetch("/api/persona/brand-cast", { cache: "no-store" }),
        fetch("/api/persona/creation-projects?presets=1", { cache: "no-store" }),
        fetch("/api/persona/creation-projects?setup=1", { cache: "no-store" }),
      ]);
      const projectsData = (await projectsRes.json()) as {
        projects?: PersonaCreationProject[];
        error?: string;
      };
      const brandData = (await brandRes.json()) as {
        progress?: BrandCastMilestoneProgress;
      };
      const presetsData = (await presetsRes.json()) as {
        presets?: CreationProjectPreset[];
      };
      const setupData = (await setupRes.json()) as {
        setup?: { setupMessage: string | null };
      };
      setState((prev) => ({
        ...prev,
        creationProjects: projectsData.projects ?? [],
        brandCastProgress: brandData.progress ?? null,
        presets: presetsData.presets ?? [],
        providerSetupMessage: setupData.setup?.setupMessage ?? null,
      }));
    } catch {
      // keep existing creation state
    }
  }, []);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    void refreshHealth();
    void refreshCreation();
    try {
      const res = await fetch("/api/persona");
      const data = (await res.json()) as {
        error?: string;
        snapshot?: PersonaStudioSnapshot;
        counts?: PersonaStudioDashboardCounts;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Persona Studio konnte nicht geladen werden");
      }
      setState((prev) => ({
        ...prev,
        loading: false,
        snapshot: data.snapshot ?? null,
        counts: data.counts ?? EMPTY_COUNTS,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Laden fehlgeschlagen",
      }));
    }
  }, [refreshHealth, refreshCreation]);

  const estimateProjectCost = useCallback(async (projectId: string) => {
    const { res, data } = await fetchJson<{
      error?: string;
      estimate?: CandidateGenerationCostEstimate;
      costLabel?: string;
    }>(`/api/persona/creation-projects/${projectId}?estimate=1`);
    if (!res.ok) throw new Error(data.error ?? "Kostenschätzung fehlgeschlagen");
    setState((prev) => ({ ...prev, costEstimate: data.estimate ?? null }));
    return data.estimate;
  }, []);

  const loadProject = useCallback(async (projectId: string, opts?: { openCandidates?: boolean }) => {
    if (DEBUG_MODE) {
      console.log("[persona] Clicked project id:", projectId);
    }

    const loadVersion = ++loadProjectRequestRef.current;
    activeProjectIdRef.current = projectId;
    loadAbortRef.current?.abort();
    const abortController = new AbortController();
    loadAbortRef.current = abortController;

    // Always clear previous project-owned candidate state immediately.
    setState((prev) => ({
      ...prev,
      selectedProjectId: projectId,
      ...emptyProjectDetailState(),
      projectDetailLoading: true,
      projectCandidateState: null,
      costEstimate:
        prev.selectedProjectId === projectId ? prev.costEstimate : null,
      paidConfirmationToken:
        prev.selectedProjectId === projectId ? prev.paidConfirmationToken : null,
      paidConfirmationProjectId:
        prev.selectedProjectId === projectId
          ? prev.paidConfirmationProjectId
          : null,
    }));

    try {
      const res = await fetch(`/api/persona/creation-projects/${projectId}`, {
        cache: "no-store",
        signal: abortController.signal,
      });
      const data = (await res.json()) as {
        error?: string;
        project?: PersonaCreationProject;
        candidates?: PersonaCandidate[];
        jobs?: import("@/lib/persona/domain/creation-types").PersonaGenerationJob[];
        incident?: import("@/lib/persona/creation/creation-service").IncidentProjectSummary | null;
        candidatePreviews?: Record<string, string | null>;
        noveltyFailureSlots?: import("@/lib/persona/face-novelty-memory/board-visibility").NoveltyFailureSlotDto[];
      };
      if (!res.ok) throw new Error(data.error ?? "Projekt laden fehlgeschlagen");

      if (data.project && data.project.id !== projectId) {
        console.error("[persona] API returned a different project id than requested", {
          requestedProjectId: projectId,
          returnedProjectId: data.project.id,
        });
        throw new Error("Projekt-Antwort passt nicht zur angeforderten ID");
      }

      if (loadVersion !== loadProjectRequestRef.current) {
        if (DEBUG_MODE) {
          console.log("[persona] Ignoring stale loadProject response", {
            requestedProjectId: projectId,
            loadVersion,
            latestRequestId: loadProjectRequestRef.current,
          });
        }
        return;
      }
      if (projectId !== activeProjectIdRef.current) {
        if (DEBUG_MODE) {
          console.log("[persona] Ignoring loadProject for inactive project", {
            requestedProjectId: projectId,
            activeProjectId: activeProjectIdRef.current,
          });
        }
        return;
      }

      if (DEBUG_MODE) {
        console.log("[persona] Loaded project id:", data.project?.id ?? projectId);
      }

      const rawCandidates = data.candidates ?? [];
      const candidates = filterLoadedCandidatesForProject(rawCandidates, projectId);
      if (rawCandidates.length !== candidates.length) {
        console.error("[persona] Dropped cross-project candidates from loadProject response", {
          requestedProjectId: projectId,
          dropped: rawCandidates.length - candidates.length,
        });
      }

      const projectCandidateState = buildProjectCandidateState({
        projectId,
        candidates,
        candidatePreviews: data.candidatePreviews ?? {},
        noveltyFailureSlots: data.noveltyFailureSlots ?? [],
        generationJobs: data.jobs ?? [],
        incidentSummary: data.incident ?? null,
      });

      logCandidateRenderForensics(
        "client.loadProject",
        projectCandidateState.candidates.map((c) => ({
          activeCreationProjectId: projectId,
          candidateId: c.id,
          candidateCreationProjectId: c.creation_project_id,
          candidateNumber: c.candidate_number,
          assetId: c.primary_preview_asset_id,
          assetCreationProjectId: projectId,
          assetStoragePath: null,
          assetPublicUrl:
            projectCandidateState.candidatePreviews[c.id] ?? null,
          createdAt: c.created_at,
          generationJobId: c.provider_job_id,
          generationSource: resolveGenerationSource(c.provider),
        })),
      );

      if (DEBUG_MODE) {
        logCastingFlowTrace("client.state_assignment", {
          creationProjectId: projectId,
          workspaceId: workspaceIdRef.current,
          candidateIds: projectCandidateState.candidates.map((c) => c.id),
          source: "cached",
        });
      }

      setState((prev) => {
        if (prev.selectedProjectId !== projectId) {
          return prev;
        }
        if (loadVersion !== loadProjectRequestRef.current) {
          return prev;
        }

        return {
          ...prev,
          selectedProjectId: projectId,
          loadedProjectId: projectId,
          loadedProject: data.project ?? null,
          candidates: projectCandidateState.candidates,
          generationJobs: projectCandidateState.generationJobs,
          incidentSummary: projectCandidateState.incidentSummary,
          candidatePreviews: projectCandidateState.candidatePreviews,
          projectCandidateState,
          projectDetailLoading: false,
          selectedCandidateId: null,
          candidateAssets: [],
          creationProjects: prev.creationProjects.map((p) =>
            p.id === projectId && data.project ? data.project : p,
          ),
          costEstimate: prev.selectedProjectId === projectId ? prev.costEstimate : null,
          paidConfirmationToken:
            prev.paidConfirmationProjectId === projectId
              ? prev.paidConfirmationToken
              : (data.project?.last_confirmation_token ?? null),
          paidConfirmationProjectId:
            prev.paidConfirmationProjectId === projectId
              ? projectId
              : data.project?.last_confirmation_token
                ? projectId
                : null,
          section: opts?.openCandidates ? "candidates" : prev.section,
        };
      });
      if (data.project?.last_estimate_at) {
        void estimateProjectCost(projectId).catch(() => undefined);
      }
    } catch (error) {
      if (abortController.signal.aborted) return;
      if (loadVersion !== loadProjectRequestRef.current) return;
      throw error;
    }
  }, [estimateProjectCost]);

  const loadCandidate = useCallback(async (candidateId: string) => {
    const res = await fetch(`/api/persona/candidates/${candidateId}`, {
      cache: "no-store",
    });
    const data = (await res.json()) as {
      error?: string;
      candidate?: PersonaCandidate;
      assets?: PersonaCandidateAssetView[];
    };
    if (!res.ok) throw new Error(data.error ?? "Kandidat laden fehlgeschlagen");
    setState((prev) => {
      if (
        data.candidate &&
        prev.selectedProjectId &&
        data.candidate.creation_project_id !== prev.selectedProjectId
      ) {
        console.error("[persona] Candidate project mismatch — refusing stale candidate", {
          candidateId,
          candidateProjectId: data.candidate.creation_project_id,
          activeProjectId: prev.selectedProjectId,
        });
        return prev;
      }
      const nextCandidates = prev.candidates.map((c) =>
        c.id === candidateId && data.candidate ? data.candidate : c,
      );
      const nextState =
        prev.projectCandidateState &&
        prev.selectedProjectId &&
        prev.projectCandidateState.projectId === prev.selectedProjectId
          ? {
              ...prev.projectCandidateState,
              candidates: filterLoadedCandidatesForProject(
                nextCandidates,
                prev.selectedProjectId,
              ),
            }
          : prev.projectCandidateState;
      return {
        ...prev,
        selectedCandidateId: candidateId,
        candidateAssets: data.assets ?? [],
        candidates: nextCandidates,
        projectCandidateState: nextState,
      };
    });
  }, []);

  const bindDiscoveryProject = useCallback((projectId: string) => {
    loadProjectRequestRef.current += 1;
    loadAbortRef.current?.abort();
    activeProjectIdRef.current = projectId;
    setState((prev) => ({
      ...prev,
      selectedProjectId: projectId,
      ...emptyProjectDetailState(),
      projectDetailLoading: true,
      projectCandidateState: null,
    }));
    if (DEBUG_MODE) {
      console.info("[persona-casting] bindDiscoveryProject", {
        creationProjectId: projectId,
        cacheKey: projectScopedCandidatesCacheKey(
          workspaceIdRef.current ?? "unknown",
          projectId,
        ),
      });
    }
  }, []);

  const openCandidatesForProject = useCallback(
    async (projectId: string) => {
      if (!projectId.trim()) {
        throw new Error("Candidates view requires an explicit creation project id");
      }
      await loadProject(projectId, { openCandidates: true });
      setState((prev) => {
        if (prev.loadedProjectId !== projectId) {
          return prev;
        }
        if (
          !prev.projectCandidateState ||
          prev.projectCandidateState.projectId !== projectId
        ) {
          return {
            ...prev,
            selectedProjectId: projectId,
            candidates: [],
            candidatePreviews: {},
            selectedCandidateId: null,
            candidateAssets: [],
            section: "candidates",
          };
        }
        const synced = filterLoadedCandidatesForProject(
          prev.projectCandidateState.candidates,
          projectId,
        );
        return {
          ...prev,
          selectedProjectId: projectId,
          candidates: synced,
          projectCandidateState: {
            ...prev.projectCandidateState,
            candidates: synced,
          },
          selectedCandidateId: null,
          candidateAssets: [],
          section: "candidates",
        };
      });
    },
    [loadProject],
  );

  const createProject = useCallback(
    async (
      body: Record<string, unknown>,
      opts?: { navigate?: boolean },
    ) => {
      const res = await fetch("/api/persona/creation-projects", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        error?: string;
        project?: PersonaCreationProject;
      };
      if (!res.ok) throw new Error(data.error ?? "Projekt erstellen fehlgeschlagen");
      await refreshCreation();
      if (data.project) {
        bindDiscoveryProject(data.project.id);
        await loadProject(data.project.id);
        if (opts?.navigate !== false) {
          setState((prev) => ({ ...prev, section: "creation_projects" }));
        }
      }
      return data.project;
    },
    [bindDiscoveryProject, loadProject, refreshCreation],
  );

  const preparePaidConfirmation = useCallback(async (projectId: string) => {
    const { res, data } = await fetchJson<{
      error?: string;
      estimate?: CandidateGenerationCostEstimate;
      confirmation?: { confirmation_token: string };
      job?: { confirmation_token?: string | null };
      costLabel?: string;
    }>(`/api/persona/creation-projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "prepare_confirmation" }),
    });
    if (!res.ok) throw new Error(data.error ?? "Bestätigung vorbereiten fehlgeschlagen");
    const token =
      data.confirmation?.confirmation_token ?? data.job?.confirmation_token ?? null;
    setState((prev) => ({
      ...prev,
      selectedProjectId: projectId,
      costEstimate: data.estimate ?? null,
      paidConfirmationToken: token,
      paidConfirmationProjectId: token ? projectId : null,
    }));
    return { ...data, confirmationToken: token };
  }, []);

  const generateCandidates = useCallback(
    async (
      projectId: string,
      opts: {
        costConfirmed: boolean;
        retryConfirmed?: boolean;
        confirmationToken?: string;
        userConfirmedAt?: string;
        attestation?: string;
      },
    ) => {
      const res = await fetch(`/api/persona/creation-projects/${projectId}`, {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          attestation: "ui_checkbox",
          ...opts,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        candidates?: PersonaCandidate[];
      };
      if (!res.ok) throw new Error(data.error ?? "Generierung fehlgeschlagen");
      if (DEBUG_MODE) {
        logCastingFlowTrace("client.generation_completion", {
          creationProjectId: projectId,
          candidateIds: (data.candidates ?? []).map((c) => c.id),
          source: "live_openai",
        });
      }
      setState((prev) => ({
        ...prev,
        costEstimate: null,
        paidConfirmationToken: null,
        paidConfirmationProjectId: null,
        projectCandidateState: null,
        candidates: [],
        candidatePreviews: {},
      }));
      await loadProject(projectId);
      await refreshCreation();
    },
    [loadProject, refreshCreation],
  );

  const prepareManualCandidates = useCallback(
    async (projectId: string) => {
      const res = await fetch(`/api/persona/creation-projects/${projectId}`, {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prepare_manual" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Vorbereitung fehlgeschlagen");
      await loadProject(projectId);
    },
    [loadProject],
  );

  const patchCandidate = useCallback(
    async (candidateId: string, body: Record<string, unknown>) => {
      const res = await fetch(`/api/persona/candidates/${candidateId}`, {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Update fehlgeschlagen");
      if (state.selectedProjectId) await loadProject(state.selectedProjectId);
      await loadCandidate(candidateId);
    },
    [loadProject, loadCandidate, state.selectedProjectId],
  );

  const convertCandidate = useCallback(
    async (candidateId: string) => {
      const res = await fetch(`/api/persona/candidates/${candidateId}`, {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "convert" }),
      });
      const data = (await res.json()) as {
        error?: string;
        persona?: Persona;
      };
      if (!res.ok) throw new Error(data.error ?? "Konvertierung fehlgeschlagen");
      await refresh();
      if (data.persona) {
        setState((prev) => ({
          ...prev,
          section: "personas",
          selectedPersonaId: data.persona!.id,
        }));
      }
      return data.persona;
    },
    [refresh],
  );

  const uploadCandidateAsset = useCallback(
    async (candidateId: string, form: FormData) => {
      const res = await fetch(`/api/persona/candidates/${candidateId}`, {
        method: "POST",
        cache: "no-store",
        body: form,
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload fehlgeschlagen");
      await loadCandidate(candidateId);
      if (state.selectedProjectId) await loadProject(state.selectedProjectId);
    },
    [loadCandidate, loadProject, state.selectedProjectId],
  );

  const loadPersonaDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/persona/${id}`);
    const data = (await res.json()) as {
      error?: string;
      readiness?: PersonaReadinessReport;
      references?: PersonaReferenceAssetView[];
      persona?: Persona;
    };
    if (!res.ok) throw new Error(data.error ?? "Detail laden fehlgeschlagen");
    setState((prev) => ({
      ...prev,
      selectedPersonaId: id,
      selectedReadiness: data.readiness ?? null,
      selectedReferences: data.references ?? [],
      snapshot: prev.snapshot
        ? {
            ...prev.snapshot,
            personas: prev.snapshot.personas.map((p) =>
              p.id === id && data.persona ? data.persona : p,
            ),
          }
        : prev.snapshot,
    }));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setSection = useCallback((section: PersonaStudioSection) => {
    setState((prev) => ({ ...prev, section }));
  }, []);

  const selectPersona = useCallback(
    (id: string | null) => {
      setState((prev) => ({
        ...prev,
        selectedPersonaId: id,
        section: "personas",
        selectedReadiness: null,
        selectedReferences: [],
      }));
      if (id) void loadPersonaDetail(id).catch(() => undefined);
    },
    [loadPersonaDetail],
  );

  const patchPersona = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      const res = await fetch(`/api/persona/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; persona?: Persona };
      if (!res.ok) throw new Error(data.error ?? "Update fehlgeschlagen");
      await refresh();
      await loadPersonaDetail(id);
      return data.persona;
    },
    [refresh, loadPersonaDetail],
  );

  const createPersona = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch("/api/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; persona?: Persona };
      if (!res.ok) throw new Error(data.error ?? "Erstellen fehlgeschlagen");
      await refresh();
      return data.persona;
    },
    [refresh],
  );

  const removePersona = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/persona/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Löschen fehlgeschlagen");
      setState((prev) => ({
        ...prev,
        selectedPersonaId:
          prev.selectedPersonaId === id ? null : prev.selectedPersonaId,
        selectedReferences: [],
        selectedReadiness: null,
      }));
      await refresh();
    },
    [refresh],
  );

  const createLibraryItem = useCallback(
    async (path: string, body: Record<string, unknown>): Promise<void> => {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erstellen fehlgeschlagen");
      await refresh();
    },
    [refresh],
  );

  const deleteLibraryItem = useCallback(
    async (path: string): Promise<void> => {
      const res = await fetch(path, { method: "DELETE" });
      const data = (await res.json()) as {
        error?: string;
        delete_impact?: { referencing_persona_count: number };
      };
      if (!res.ok) throw new Error(data.error ?? "Löschen fehlgeschlagen");
      if (data.delete_impact && data.delete_impact.referencing_persona_count > 0) {
        // impact returned for UI awareness; relations already stripped server-side
      }
      await refresh();
    },
    [refresh],
  );

  const uploadReference = useCallback(
    async (personaId: string, form: FormData) => {
      const res = await fetch(`/api/persona/${personaId}/references`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload fehlgeschlagen");
      await refresh();
      await loadPersonaDetail(personaId);
    },
    [refresh, loadPersonaDetail],
  );

  const patchReference = useCallback(
    async (personaId: string, assetId: string, body: Record<string, unknown>) => {
      const res = await fetch(`/api/persona/${personaId}/references/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Update fehlgeschlagen");
      await refresh();
      await loadPersonaDetail(personaId);
    },
    [refresh, loadPersonaDetail],
  );

  const removeReference = useCallback(
    async (personaId: string, assetId: string) => {
      const res = await fetch(`/api/persona/${personaId}/references/${assetId}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Löschen fehlgeschlagen");
      await refresh();
      await loadPersonaDetail(personaId);
    },
    [refresh, loadPersonaDetail],
  );

  const personas: Persona[] = state.snapshot?.personas ?? [];
  const locations: Location[] = state.snapshot?.locations ?? [];
  const cameraPresets: CameraPreset[] = state.snapshot?.camera_presets ?? [];
  const poses: Pose[] = state.snapshot?.poses ?? [];
  const brandLooks: BrandLook[] = state.snapshot?.brand_looks ?? [];
  const outfits: Outfit[] = state.snapshot?.outfits ?? [];
  const selectedPersona =
    personas.find((p) => p.id === state.selectedPersonaId) ?? null;

  const createSafeTestRun = useCallback(async () => {
    const res = await fetch("/api/persona/creation-projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_safe_test_run" }),
    });
    const data = (await res.json()) as { error?: string; project?: { id: string } };
    if (!res.ok) throw new Error(data.error ?? "Testprojekt konnte nicht angelegt werden");
    if (data.project?.id) {
      await loadProject(data.project.id);
      setState((prev) => ({ ...prev, section: "creation_projects" }));
    }
    await refreshCreation();
    return data.project;
  }, [loadProject, refreshCreation]);

  return {
    ...state,
    counts: state.counts ?? EMPTY_COUNTS,
    personas,
    locations,
    cameraPresets,
    poses,
    brandLooks,
    outfits,
    selectedPersona,
    refresh,
    setSection,
    selectPersona,
    patchPersona,
    createPersona,
    removePersona,
    createLibraryItem,
    deleteLibraryItem,
    uploadReference,
    patchReference,
    removeReference,
    refreshCreation,
    loadProject,
    bindDiscoveryProject,
    openCandidatesForProject,
    loadCandidate,
    createProject,
    estimateProjectCost,
    preparePaidConfirmation,
    generateCandidates,
    prepareManualCandidates,
    patchCandidate,
    convertCandidate,
    uploadCandidateAsset,
    createSafeTestRun,
  };
}

export type PersonaStudioController = ReturnType<typeof usePersonaStudio>;
