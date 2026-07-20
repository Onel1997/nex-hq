/**
 * Creation project workflow — status / stage / action guards.
 *
 * Official flow:
 * draft → confirmation prepared → generation running → candidates generated
 * → review → convert → identity lock → approved brand cast
 */

import type {
  CreationProjectStatus,
  GenerationStage,
  PersonaCreationProject,
  ProviderMode,
} from "../domain/creation-types";
import { PersonaDomainError, PersonaWorkflowError } from "../domain/errors";
import { resolveEffectiveProviderMode, isPersonaImageProviderConfigured } from "./provider/config";
import { shouldUseFakePersonaProvider } from "./paid-generation-guard";
import { assetTypesForStage } from "./provider/cost";

/** API / service workflow actions for creation projects. */
export type CreationWorkflowAction =
  | "prepare_confirmation"
  | "prepare_manual"
  | "start_generation"
  | "estimate";

/** UX-facing workflow step (derived — not a DB column). */
export type CreationWorkflowStep =
  | "draft"
  | "confirmation_prepared"
  | "generation_running"
  | "candidates_generated"
  | "review"
  | "convert"
  | "identity_lock"
  | "approved_brand_cast";

const PREPARE_CONFIRMATION_STATUSES: ReadonlyArray<CreationProjectStatus> = [
  "draft",
  "ready",
  "review",
  "failed",
];

const PREPARE_MANUAL_STATUSES: ReadonlyArray<CreationProjectStatus> = [
  "draft",
  "ready",
  "review",
  "failed",
];

const START_GENERATION_STATUSES: ReadonlyArray<CreationProjectStatus> = [
  "draft",
  "ready",
  "review",
  "failed",
];

const GENERATION_STAGES: ReadonlyArray<GenerationStage> = [
  "discovery",
  "shortlist_validation",
];

function isPaidProviderMode(mode: ProviderMode): boolean {
  return mode === "image_provider" || mode === "hybrid";
}

function isManualProviderMode(mode: ProviderMode): boolean {
  return mode === "manual_upload";
}

function assertPaidProviderConfigured(
  project: PersonaCreationProject,
  details: Record<string, unknown>,
): void {
  if (!isPaidProviderMode(project.provider_mode)) {
    const effective = resolveEffectiveProviderMode(project.provider_mode);
    throw new PersonaDomainError(
      effective.setupMessage ??
        "Bezahlte Generierung ist nicht verfügbar — Provider nicht eingerichtet.",
      "CONFIG",
      details,
    );
  }

  if (shouldUseFakePersonaProvider()) return;
  if (isPersonaImageProviderConfigured()) return;

  const effective = resolveEffectiveProviderMode(project.provider_mode);
  throw new PersonaDomainError(
    effective.setupMessage ??
      "Bezahlte Generierung ist nicht verfügbar — Provider nicht eingerichtet.",
    "CONFIG",
    details,
  );
}

export function resolveCreationWorkflowStep(
  project: PersonaCreationProject,
): CreationWorkflowStep {
  if (project.status === "generating") return "generation_running";
  if (project.status === "review") return "candidates_generated";
  if (project.status === "selected") {
    return project.generation_stage === "identity_lock"
      ? "identity_lock"
      : "convert";
  }
  if (
    (project.status === "draft" || project.status === "ready") &&
    project.last_confirmation_token
  ) {
    return "confirmation_prepared";
  }
  return "draft";
}

export function canPreparePaidConfirmation(
  project: PersonaCreationProject,
): boolean {
  try {
    assertCreationProjectAction(project, "prepare_confirmation");
    return true;
  } catch {
    return false;
  }
}

export function canPrepareManualSlots(project: PersonaCreationProject): boolean {
  try {
    assertCreationProjectAction(project, "prepare_manual");
    return true;
  } catch {
    return false;
  }
}

export function canStartPaidGeneration(project: PersonaCreationProject): boolean {
  try {
    assertCreationProjectAction(project, "start_generation");
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates whether a workflow action is allowed for the current project state.
 * Throws PersonaWorkflowError (code WORKFLOW) or PersonaDomainError (code CONFIG).
 */
export function assertCreationProjectAction(
  project: PersonaCreationProject,
  action: CreationWorkflowAction,
): void {
  const workflowStep = resolveCreationWorkflowStep(project);
  const details = {
    action,
    workflowStep,
    status: project.status,
    generationStage: project.generation_stage,
    providerMode: project.provider_mode,
  };

  if (action === "prepare_confirmation") {
    if (isManualProviderMode(project.provider_mode)) {
      throw new PersonaWorkflowError(
        "Manueller Upload-Modus — bitte „Manuelle Slots vorbereiten“ verwenden, nicht die bezahlte Bestätigung.",
        details,
      );
    }

    assertPaidProviderConfigured(project, details);

    if (project.status === "generating") {
      throw new PersonaWorkflowError(
        "Generierung läuft bereits — Kostenschätzung kann in diesem Schritt nicht vorbereitet werden.",
        details,
      );
    }

    if (project.status === "selected") {
      throw new PersonaWorkflowError(
        "Ein Kandidat wurde bereits ausgewählt — Discovery-Generierung ist abgeschlossen.",
        details,
      );
    }

    if (project.status === "cancelled" || project.status === "archived") {
      throw new PersonaWorkflowError(
        `Projekt ist ${project.status} — Workflow-Aktion nicht erlaubt.`,
        details,
      );
    }

    if (!PREPARE_CONFIRMATION_STATUSES.includes(project.status)) {
      throw new PersonaWorkflowError(
        `Kostenschätzung kann im Status „${project.status}“ nicht vorbereitet werden.`,
        details,
      );
    }

    if (project.generation_stage === "identity_lock") {
      throw new PersonaWorkflowError(
        "Identity-Lock-Phase — keine Kandidaten-Discovery. Bitte Referenzpaket und Identity Review abschließen.",
        details,
      );
    }

    if (!GENERATION_STAGES.includes(project.generation_stage)) {
      throw new PersonaWorkflowError(
        `Generierungsstufe „${project.generation_stage}“ unterstützt keine Kandidaten-Batch-Generierung.`,
        details,
      );
    }

    if (assetTypesForStage(project.generation_stage).length === 0) {
      throw new PersonaWorkflowError(
        "Keine Generierungs-Assets für diese Stufe konfiguriert.",
        details,
      );
    }

    return;
  }

  if (action === "prepare_manual") {
    if (isPaidProviderMode(project.provider_mode) && !isManualProviderMode(project.provider_mode)) {
      throw new PersonaWorkflowError(
        "Bezahlter Provider-Modus — bitte „Schätzung & Bestätigung vorbereiten“ für OpenAI-Generierung verwenden.",
        details,
      );
    }

    if (
      project.provider_mode !== "manual_upload" &&
      resolveEffectiveProviderMode(project.provider_mode).mode !== "manual_upload"
    ) {
      throw new PersonaWorkflowError(
        "Manuelle Slots sind nur im Manual-Upload-Modus verfügbar.",
        details,
      );
    }

    if (project.status === "generating") {
      throw new PersonaWorkflowError(
        "Generierung läuft — manuelle Slots können jetzt nicht vorbereitet werden.",
        details,
      );
    }

    if (project.status === "selected") {
      throw new PersonaWorkflowError(
        "Kandidat bereits ausgewählt — manuelle Slot-Vorbereitung nicht mehr nötig.",
        details,
      );
    }

    if (project.status === "cancelled" || project.status === "archived") {
      throw new PersonaWorkflowError(
        `Projekt ist ${project.status} — Workflow-Aktion nicht erlaubt.`,
        details,
      );
    }

    if (!PREPARE_MANUAL_STATUSES.includes(project.status)) {
      throw new PersonaWorkflowError(
        `Manuelle Slots können im Status „${project.status}“ nicht vorbereitet werden.`,
        details,
      );
    }

    return;
  }

  if (action === "start_generation") {
    if (isManualProviderMode(project.provider_mode)) {
      throw new PersonaWorkflowError(
        "Manueller Upload-Modus — bitte Kandidatenbilder hochladen statt zu generieren.",
        { ...details, providerMode: "manual_upload" },
      );
    }

    assertPaidProviderConfigured(project, details);

    if (project.status === "generating") {
      throw new PersonaWorkflowError(
        "Generierung läuft bereits.",
        details,
      );
    }

    if (project.status === "selected") {
      throw new PersonaWorkflowError(
        "Kandidat bereits ausgewählt — keine erneute Discovery-Generierung.",
        details,
      );
    }

    if (project.status === "cancelled" || project.status === "archived") {
      throw new PersonaWorkflowError(
        `Projekt ist ${project.status} — Generierung nicht erlaubt.`,
        details,
      );
    }

    if (!START_GENERATION_STATUSES.includes(project.status)) {
      throw new PersonaWorkflowError(
        `Generierung kann im Status „${project.status}“ nicht gestartet werden.`,
        details,
      );
    }

    if (project.generation_stage === "identity_lock") {
      throw new PersonaWorkflowError(
        "Identity-Lock-Phase — keine bezahlte Kandidaten-Generierung.",
        details,
      );
    }

    if (!GENERATION_STAGES.includes(project.generation_stage)) {
      throw new PersonaWorkflowError(
        `Generierungsstufe „${project.generation_stage}“ unterstützt keinen Generierungsstart.`,
        details,
      );
    }

    return;
  }

  // estimate is read-only — allowed unless terminal / generating
  if (action === "estimate") {
    if (project.status === "cancelled" || project.status === "archived") {
      throw new PersonaWorkflowError(
        `Projekt ist ${project.status} — Kostenschätzung nicht verfügbar.`,
        details,
      );
    }
  }
}
