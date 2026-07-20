"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEBUG_MODE,
  emptyProjectDetailState,
} from "@/components/persona/persona-studio-project-sync";

/**
 * Safe JSON fetch: validates status and content-type before parsing.
 * Throws a structured, human-readable error instead of "Unexpected token '<'".
 */
async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<{ res: Response; data: T }> {
  const res = await fetch(url, init);
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
    presets: [],
    providerSetupMessage: null,
  });

  const refreshHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/persona/health");
      const data = (await res.json()) as PersonaHealthReport;
      setState((prev) => ({ ...prev, health: data }));
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
        fetch("/api/persona/creation-projects"),
        fetch("/api/persona/brand-cast"),
        fetch("/api/persona/creation-projects?presets=1"),
        fetch("/api/persona/creation-projects?setup=1"),
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

    const requestId = ++loadProjectRequestRef.current;

    setState((prev) => {
      const switching = prev.selectedProjectId !== projectId;
      return {
        ...prev,
        selectedProjectId: projectId,
        ...(switching ? emptyProjectDetailState() : {}),
      };
    });

    const res = await fetch(`/api/persona/creation-projects/${projectId}`);
    const data = (await res.json()) as {
      error?: string;
      project?: PersonaCreationProject;
      candidates?: PersonaCandidate[];
      jobs?: import("@/lib/persona/domain/creation-types").PersonaGenerationJob[];
      incident?: import("@/lib/persona/creation/creation-service").IncidentProjectSummary | null;
    };
    if (!res.ok) throw new Error(data.error ?? "Projekt laden fehlgeschlagen");

    if (data.project && data.project.id !== projectId) {
      console.error("[persona] API returned a different project id than requested", {
        requestedProjectId: projectId,
        returnedProjectId: data.project.id,
      });
      throw new Error("Projekt-Antwort passt nicht zur angeforderten ID");
    }

    if (requestId !== loadProjectRequestRef.current) {
      if (DEBUG_MODE) {
        console.log("[persona] Ignoring stale loadProject response", {
          requestedProjectId: projectId,
          requestId,
          latestRequestId: loadProjectRequestRef.current,
        });
      }
      return;
    }

    if (DEBUG_MODE) {
      console.log("[persona] Loaded project id:", data.project?.id ?? projectId);
    }

    setState((prev) => {
      if (prev.selectedProjectId !== projectId) {
        return prev;
      }

      const projectChanged = prev.loadedProjectId !== projectId;
      return {
        ...prev,
        selectedProjectId: projectId,
        loadedProjectId: projectId,
        loadedProject: data.project ?? null,
        candidates: data.candidates ?? [],
        generationJobs: data.jobs ?? [],
        incidentSummary: data.incident ?? null,
        creationProjects: prev.creationProjects.map((p) =>
          p.id === projectId && data.project ? data.project : p,
        ),
        costEstimate: projectChanged ? null : prev.costEstimate,
        paidConfirmationToken: projectChanged
          ? (data.project?.last_confirmation_token ?? null)
          : prev.paidConfirmationToken,
        paidConfirmationProjectId: projectChanged
          ? data.project?.last_confirmation_token
            ? projectId
            : null
          : prev.paidConfirmationProjectId,
        section: opts?.openCandidates ? "candidates" : prev.section,
      };
    });
    if (data.project?.last_estimate_at) {
      void estimateProjectCost(projectId).catch(() => undefined);
    }
  }, [estimateProjectCost]);

  const loadCandidate = useCallback(async (candidateId: string) => {
    const res = await fetch(`/api/persona/candidates/${candidateId}`);
    const data = (await res.json()) as {
      error?: string;
      candidate?: PersonaCandidate;
      assets?: PersonaCandidateAssetView[];
    };
    if (!res.ok) throw new Error(data.error ?? "Kandidat laden fehlgeschlagen");
    setState((prev) => ({
      ...prev,
      selectedCandidateId: candidateId,
      candidateAssets: data.assets ?? [],
      candidates: prev.candidates.map((c) =>
        c.id === candidateId && data.candidate ? data.candidate : c,
      ),
    }));
  }, []);

  const createProject = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch("/api/persona/creation-projects", {
        method: "POST",
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
        await loadProject(data.project.id);
        setState((prev) => ({ ...prev, section: "creation_projects" }));
      }
      return data.project;
    },
    [loadProject, refreshCreation],
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          attestation: "ui_checkbox",
          ...opts,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Generierung fehlgeschlagen");
      setState((prev) => ({
        ...prev,
        costEstimate: null,
        paidConfirmationToken: null,
        paidConfirmationProjectId: null,
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
