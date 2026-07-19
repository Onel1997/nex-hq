/**
 * Persona Studio production health probe.
 * Never returns secrets or service-role credentials.
 */

import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  createProductionPersonaRepository,
  getPersonaRepositoryKind,
} from "../repositories/factory";
import {
  PERSONA_REFERENCES_BUCKET,
  createPersonaReferenceSignedUrl,
} from "../storage/reference-storage";
import { resolvePersonaWorkspaceScope } from "./workspace-scope";

export const PERSONA_SCHEMA_VERSION = "20260719220000_persona_studio_phase_1_2_candidate_workflow";

const REQUIRED_TABLES = [
  "persona_personas",
  "persona_locations",
  "persona_camera_presets",
  "persona_poses",
  "persona_brand_looks",
  "persona_outfits",
  "persona_reference_assets",
  "persona_persona_locations",
  "persona_persona_camera_presets",
  "persona_persona_poses",
  "persona_persona_brand_looks",
  "persona_persona_outfits",
  "persona_creation_projects",
  "persona_candidates",
  "persona_candidate_assets",
  "persona_identity_reviews",
  "persona_brand_cast_requirements",
] as const;

export type PersonaHealthStatus = "healthy" | "degraded" | "unavailable";

export type PersonaHealthUiLabel =
  | "Bereit"
  | "Einrichtung erforderlich"
  | "Fehler";

export interface PersonaHealthCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface PersonaHealthReport {
  status: PersonaHealthStatus;
  uiLabel: PersonaHealthUiLabel;
  message: string;
  repositoryMode: "supabase" | "memory" | "unconfigured";
  schemaVersion: string | null;
  checks: PersonaHealthCheck[];
  workspaceId: string | null;
  memoryFallback: false;
  checkedAt: string;
}

function uiLabelFor(status: PersonaHealthStatus): PersonaHealthUiLabel {
  if (status === "healthy") return "Bereit";
  if (status === "degraded") return "Einrichtung erforderlich";
  return "Fehler";
}

async function probeTable(
  table: string,
): Promise<{ ok: boolean; detail?: string }> {
  const db = createAdminClient();
  // Junction tables use composite keys without an `id` column — use `*`.
  const { error } = await db.from(table).select("*", { count: "exact", head: true });
  if (error) {
    const missing =
      /does not exist|Could not find the table|schema cache/i.test(error.message);
    return {
      ok: false,
      detail: missing
        ? `Tabelle fehlt oder Migration nicht angewendet: ${table}`
        : error.message,
    };
  }
  return { ok: true };
}

async function probePhase11Columns(): Promise<{ ok: boolean; detail?: string }> {
  const db = createAdminClient();
  const { error } = await db
    .from("persona_personas")
    .select("id, image_use_approved, video_use_approved, primary_reference_asset_id", {
      head: true,
      count: "exact",
    });
  if (error) {
    return {
      ok: false,
      detail:
        "Phase-1.1-Spalten fehlen. Migration 20260719140000_persona_studio_phase_1_1.sql anwenden.",
    };
  }
  return { ok: true };
}

async function probeBucket(): Promise<{ ok: boolean; detail?: string }> {
  const db = createAdminClient();
  const { data, error } = await db.storage.listBuckets();
  if (error) {
    return { ok: false, detail: `Bucket-Liste fehlgeschlagen: ${error.message}` };
  }
  const bucket = data?.find((b) => b.id === PERSONA_REFERENCES_BUCKET);
  if (!bucket) {
    return {
      ok: false,
      detail:
        "Privater Bucket „persona-references“ fehlt. Migration oder Storage-Setup erforderlich.",
    };
  }
  if (bucket.public) {
    return {
      ok: false,
      detail: "Bucket „persona-references“ darf nicht öffentlich sein.",
    };
  }
  return { ok: true };
}

async function probeSignedUrl(): Promise<{ ok: boolean; detail?: string }> {
  try {
    // Probe capability without relying on an existing object.
    // createSignedUrl on a missing path still exercises auth + signing when bucket exists.
    const probePath = `workspace/health-probe/personas/health/references/probe.bin`;
    await createPersonaReferenceSignedUrl(probePath, 60);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Some Supabase setups reject signing for missing objects — treat as degraded, not hard fail,
    // if the error clearly indicates object-not-found rather than auth/bucket failure.
    if (/not found|Object not found|does not exist/i.test(message)) {
      return { ok: true, detail: "Signierung erreichbar (Objekt-Probe fehlt)." };
    }
    return { ok: false, detail: message };
  }
}

/**
 * Run a safe, read-only Persona Studio health check for production readiness.
 */
export async function checkPersonaStudioHealth(): Promise<PersonaHealthReport> {
  const checkedAt = new Date().toISOString();
  const checks: PersonaHealthCheck[] = [];

  if (!isSupabaseConfigured()) {
    return {
      status: "unavailable",
      uiLabel: "Fehler",
      message:
        "Supabase ist nicht konfiguriert. Persona Studio benötigt Persistenz.",
      repositoryMode: "unconfigured",
      schemaVersion: null,
      checks: [
        {
          name: "supabase_configured",
          ok: false,
          detail: "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen.",
        },
      ],
      workspaceId: null,
      memoryFallback: false,
      checkedAt,
    };
  }

  checks.push({ name: "supabase_configured", ok: true });

  let repositoryMode: PersonaHealthReport["repositoryMode"] = "unconfigured";
  try {
    const repo = createProductionPersonaRepository();
    repositoryMode = repo.kind;
    checks.push({
      name: "repository_mode",
      ok: repo.kind === "supabase",
      detail: repo.kind === "supabase" ? "supabase" : `unerwartet: ${repo.kind}`,
    });
  } catch (error) {
    checks.push({
      name: "repository_mode",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  // Never silently fall back to memory in production health.
  checks.push({
    name: "no_memory_fallback",
    ok: getPersonaRepositoryKind() !== "memory" && repositoryMode === "supabase",
    detail:
      repositoryMode === "supabase"
        ? "Kein Memory-Fallback"
        : "Memory-Fallback ist in Produktion verboten",
  });

  let connectivityOk = false;
  try {
    const db = createAdminClient();
    const { error } = await db.from("brain_workspaces").select("id", {
      head: true,
      count: "exact",
    });
    connectivityOk = !error;
    checks.push({
      name: "supabase_connectivity",
      ok: connectivityOk,
      detail: error?.message,
    });
  } catch (error) {
    checks.push({
      name: "supabase_connectivity",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  const missingTables: string[] = [];
  if (connectivityOk) {
    for (const table of REQUIRED_TABLES) {
      const result = await probeTable(table);
      checks.push({
        name: `table:${table}`,
        ok: result.ok,
        detail: result.detail,
      });
      if (!result.ok) missingTables.push(table);
    }

    const phase11 = await probePhase11Columns();
    checks.push({
      name: "schema_phase_1_1",
      ok: phase11.ok,
      detail: phase11.detail,
    });
  }

  const bucket = connectivityOk
    ? await probeBucket()
    : { ok: false, detail: "Übersprungen (keine Verbindung)" };
  checks.push({ name: "storage_bucket", ok: bucket.ok, detail: bucket.detail });

  let signed: { ok: boolean; detail?: string } = {
    ok: false,
    detail: "Übersprungen",
  };
  if (bucket.ok) {
    signed = await probeSignedUrl();
  }
  checks.push({
    name: "signed_url_support",
    ok: signed.ok,
    detail: signed.detail,
  });

  let workspaceId: string | null = null;
  try {
    const scope = await resolvePersonaWorkspaceScope();
    workspaceId = scope.workspaceId;
    checks.push({
      name: "active_workspace",
      ok: Boolean(workspaceId) && !workspaceId.startsWith("local-"),
      detail: workspaceId?.startsWith("local-")
        ? "Nur lokaler Workspace — Supabase-Workspace erforderlich"
        : workspaceId ?? undefined,
    });
  } catch (error) {
    checks.push({
      name: "active_workspace",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  const criticalFailed = checks.some(
    (c) =>
      !c.ok &&
      (c.name === "supabase_configured" ||
        c.name === "supabase_connectivity" ||
        c.name === "repository_mode" ||
        c.name === "no_memory_fallback"),
  );
  const setupFailed = checks.some(
    (c) =>
      !c.ok &&
      (c.name.startsWith("table:") ||
        c.name === "schema_phase_1_1" ||
        c.name === "storage_bucket" ||
        c.name === "active_workspace"),
  );
  const degradedSoft = checks.some(
    (c) => !c.ok && c.name === "signed_url_support",
  );

  let status: PersonaHealthStatus;
  let message: string;
  if (criticalFailed) {
    status = "unavailable";
    message =
      "Persona Studio ist nicht verfügbar. Supabase-Verbindung oder Repository prüfen.";
  } else if (setupFailed || missingTables.length > 0) {
    status = "degraded";
    message =
      missingTables.length > 0 || !checks.find((c) => c.name === "schema_phase_1_1")?.ok
        ? "Einrichtung erforderlich: Persona-Studio-Migrationen fehlen. Bitte 20250719120000_persona_studio.sql, 20260719140000_persona_studio_phase_1_1.sql und 20260719220000_persona_studio_phase_1_2_candidate_workflow.sql anwenden."
        : !bucket.ok
          ? "Einrichtung erforderlich: Privater Storage-Bucket „persona-references“ fehlt oder ist falsch konfiguriert."
          : "Einrichtung erforderlich: Workspace oder Schema unvollständig.";
  } else if (degradedSoft) {
    status = "degraded";
    message =
      "Persona Studio ist eingeschränkt: Signierte URLs konnten nicht verifiziert werden.";
  } else {
    status = "healthy";
    message = "Persona Studio ist bereit (Supabase-Persistenz aktiv).";
  }

  return {
    status,
    uiLabel: uiLabelFor(status),
    message,
    repositoryMode,
    schemaVersion:
      status === "healthy" || (status === "degraded" && missingTables.length === 0)
        ? PERSONA_SCHEMA_VERSION
        : null,
    checks,
    workspaceId,
    memoryFallback: false,
    checkedAt,
  };
}
