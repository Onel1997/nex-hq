"use client";

import { useCallback, useEffect, useState } from "react";
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
}

export type PersonaStudioSection =
  | "dashboard"
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
        },
      }));
    }
  }, []);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    void refreshHealth();
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
  }, [refreshHealth]);

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
  };
}

export type PersonaStudioController = ReturnType<typeof usePersonaStudio>;
