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
import {
  shouldUseFakePersonaProvider,
  type PaidGenerationSafetyStatus,
} from "./paid-generation-guard";
import { assetTypesForStage } from "./provider/cost";

/** Server health probe values — use in client UI instead of reading OPENAI_API_KEY. */
export type PaidGenerationSafetyContext = Pick<
  PaidGenerationSafetyStatus,
  "openaiApiKeyConfigured" | "fakeProviderActive"
>;

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

/**
 * Phase 2.3B — Brand Face continuation lifecycle (derived UI only).
 * Selection alone never means Identity Lock has started.
 */
export type BrandFaceUiLifecycle =
  | "discovery_review"
  | "selected"
  | "draft_persona"
  | "reference_package"
  | "identity_lock"
  | "approved";

export const BRAND_FACE_UI_LIFECYCLE_LABELS: Record<BrandFaceUiLifecycle, string> = {
  discovery_review: "Discovery / Review",
  selected: "Selected Brand Face",
  draft_persona: "Draft Persona",
  reference_package: "Reference Package",
  identity_lock: "Identity Lock",
  approved: "Approved Brand Cast",
};

export function resolveBrandFaceUiLifecycle(input: {
  projectStatus: CreationProjectStatus;
  generationStage?: GenerationStage | null;
  selectedCandidate?: {
    status: string;
    converted_persona_id?: string | null;
  } | null;
  persona?: {
    status: string;
    approved?: boolean;
    identity_lock_status?: string | null;
  } | null;
}): BrandFaceUiLifecycle {
  const persona = input.persona;
  if (persona?.status === "Approved" && persona.approved) {
    return "approved";
  }
  if (
    persona &&
    (persona.identity_lock_status === "approved" ||
      persona.identity_lock_status === "review" ||
      persona.identity_lock_status === "needs_revision")
  ) {
    return "identity_lock";
  }
  if (persona && persona.identity_lock_status === "collecting_references") {
    return "reference_package";
  }
  if (persona || input.selectedCandidate?.converted_persona_id) {
    return "draft_persona";
  }
  if (
    input.projectStatus === "selected" ||
    input.selectedCandidate?.status === "selected"
  ) {
    return "selected";
  }
  // Historical projects may still store generation_stage=identity_lock after
  // Auswählen with no persona — do not treat that as Identity Lock started.
  void input.generationStage;
  return "discovery_review";
}
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
  paidGenerationSafety?: PaidGenerationSafetyContext,
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

  if (paidGenerationSafety) {
    if (paidGenerationSafety.fakeProviderActive) return;
    if (paidGenerationSafety.openaiApiKeyConfigured) return;
  } else {
    if (shouldUseFakePersonaProvider()) return;
    if (isPersonaImageProviderConfigured()) return;
  }

  const effective = resolveEffectiveProviderMode(project.provider_mode);
  throw new PersonaDomainError(
    effective.setupMessage ??
      "Bezahlte Generierung ist nicht verfügbar — Provider nicht eingerichtet.",
    "CONFIG",
    details,
  );
}

function isPrepareConfirmationStatusAllowed(project: PersonaCreationProject): boolean {
  if (project.status === "generating" || project.status === "selected") return false;
  if (project.status === "cancelled" || project.status === "archived") return false;
  return PREPARE_CONFIRMATION_STATUSES.includes(project.status);
}

function isPrepareConfirmationStageAllowed(project: PersonaCreationProject): boolean {
  if (project.generation_stage === "identity_lock") return false;
  if (!GENERATION_STAGES.includes(project.generation_stage)) return false;
  return assetTypesForStage(project.generation_stage).length > 0;
}

export type PreparePaidConfirmationGateReasons = {
  projectLoaded: boolean;
  statusAllowed: boolean;
  providerAllowed: boolean;
  paidGenerationEnabled: boolean;
  openaiConfigured: boolean;
  healthLoaded: boolean;
  busy: boolean;
  workflowAllowed: boolean;
};

export function evaluatePreparePaidConfirmationGate(args: {
  project: PersonaCreationProject | null;
  projectLoaded: boolean;
  busy: boolean;
  paidGenerationSafety: PaidGenerationSafetyStatus | null | undefined;
}): {
  reasons: PreparePaidConfirmationGateReasons;
  allowed: boolean;
  disabledReasons: string[];
} {
  const safety = args.paidGenerationSafety;
  const project = args.project;
  const healthLoaded = safety != null;
  const paidGenerationEnabled = safety?.paidGenerationEnabled ?? false;
  const openaiConfigured = Boolean(
    safety?.openaiApiKeyConfigured || safety?.fakeProviderActive,
  );
  const providerModeAllowed = project ? isPaidProviderMode(project.provider_mode) : false;
  const providerAllowed = providerModeAllowed && openaiConfigured;
  const statusAllowed = project ? isPrepareConfirmationStatusAllowed(project) : false;
  const stageAllowed = project ? isPrepareConfirmationStageAllowed(project) : false;
  const manualModeBlocked =
    project != null && isManualProviderMode(project.provider_mode);
  const workflowAllowed =
    healthLoaded &&
    project != null &&
    !manualModeBlocked &&
    canPreparePaidConfirmation(project, safety ?? undefined);
  const allowed = args.projectLoaded && !args.busy && workflowAllowed;

  const disabledReasons: string[] = [];
  if (!args.projectLoaded) disabledReasons.push("project_not_loaded");
  if (!healthLoaded) disabledReasons.push("health_not_loaded");
  if (!paidGenerationEnabled) disabledReasons.push("paid_generation_disabled");
  if (!openaiConfigured) disabledReasons.push("openai_not_configured");
  if (!providerModeAllowed) disabledReasons.push("provider_mode_not_paid");
  if (!statusAllowed) disabledReasons.push("status_not_allowed");
  if (!stageAllowed) disabledReasons.push("stage_not_allowed");
  if (manualModeBlocked) disabledReasons.push("manual_upload_mode");
  if (!workflowAllowed && project != null) disabledReasons.push("workflow_blocked");
  if (args.busy) disabledReasons.push("busy");

  return {
    reasons: {
      projectLoaded: args.projectLoaded,
      statusAllowed,
      providerAllowed,
      paidGenerationEnabled,
      openaiConfigured,
      healthLoaded,
      busy: args.busy,
      workflowAllowed,
    },
    allowed,
    disabledReasons,
  };
}

export function resolveCreationWorkflowStep(
  project: PersonaCreationProject,
  options?: {
    selectedCandidate?: {
      status: string;
      converted_persona_id?: string | null;
    } | null;
    persona?: {
      status: string;
      approved?: boolean;
      identity_lock_status?: string | null;
    } | null;
  },
): CreationWorkflowStep {
  if (project.status === "generating") return "generation_running";
  if (project.status === "review") return "candidates_generated";
  if (project.status === "selected") {
    const lifecycle = resolveBrandFaceUiLifecycle({
      projectStatus: project.status,
      generationStage: project.generation_stage,
      selectedCandidate: options?.selectedCandidate ?? null,
      persona: options?.persona ?? null,
    });
    if (lifecycle === "approved") return "approved_brand_cast";
    if (lifecycle === "identity_lock") return "identity_lock";
    if (lifecycle === "draft_persona" || lifecycle === "reference_package") {
      return "identity_lock";
    }
    // Selected with no persona — convert is the next real step.
    // Do not treat premature generation_stage=identity_lock as lock started.
    return "convert";
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
  paidGenerationSafety?: PaidGenerationSafetyContext,
): boolean {
  try {
    assertCreationProjectAction(project, "prepare_confirmation", paidGenerationSafety);
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
  paidGenerationSafety?: PaidGenerationSafetyContext,
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

    assertPaidProviderConfigured(project, details, paidGenerationSafety);

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

    assertPaidProviderConfigured(project, details, paidGenerationSafety);

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
