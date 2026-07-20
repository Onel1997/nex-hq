/**
 * Persona Creator + Brand Cast candidate workflow services.
 * Selection → draft Persona only. Approval prerequisites remain authoritative.
 */

import { randomUUID } from "node:crypto";
import { logPersonaAuditEvent } from "../audit/persona-events";
import { PersonaDomainError } from "../domain/errors";
import {
  computePersonaReadiness,
  listApprovalPrerequisiteGaps,
} from "../domain/readiness";
import type {
  BrandCastMilestoneProgress,
  CandidateAssetType,
  CandidateGenerationCostEstimate,
  CreateCreationProjectInput,
  IdentityReviewChecklist,
  IdentityReviewCheckKey,
  PersonaBrandCastRequirements,
  PersonaCandidate,
  PersonaCandidateAsset,
  PersonaCandidateAssetView,
  PersonaCreationProject,
  PersonaIdentityReview,
  UpdateCandidateInput,
  UpdateCreationProjectInput,
} from "../domain/creation-types";
import {
  DEFAULT_CANDIDATE_COUNT,
  IDENTITY_REVIEW_CHECK_KEYS as REVIEW_KEYS,
  MAX_CANDIDATE_BATCH_SIZE,
  MAX_DAILY_GENERATION_EUR,
} from "../domain/creation-types";
import type { Persona, WorkspaceScope } from "../domain/types";
import { getPersonaRepository } from "../repositories/factory";
import { deletePersonaReferenceObject } from "../storage/reference-storage";
import {
  copyCandidateAssetToPersonaReference,
  createPersonaCandidateSignedUrl,
  defaultCandidateRetentionUntil,
  uploadPersonaCandidateBytes,
  buildPersonaCandidateAssetMetadata,
} from "./candidate-storage";
import { getCreationRepository } from "./creation-factory";
import { getGenerationJobRepository } from "./generation-job-factory";
import {
  createConfirmationToken,
  estimateFingerprintFromCost,
} from "./paid-confirmation";
import {
  DEFAULT_QUALITY_MODE,
  OPENAI_PROVIDER_CAPABILITY,
  getQualityModeProfile,
} from "./quality-modes";
import { defaultProviderModeForEnvironment } from "./provider/config";
import { getPersonaCandidateGenerator, getProviderSetupState } from "./provider/registry";
import { getCreationPreset, PERSONA_CREATION_PRESETS } from "./presets";
import { assetTypesForStage } from "./provider/cost";
import { assertCreationProjectAction } from "./creation-workflow";
import {
  assertConfirmationMatchesGenerationRequest,
  assertLivePaidProviderInvocationAllowed,
  assertPaidGenerationEnabled,
  assertValidUiAttestation,
  assertValidUserConfirmationTimestamp,
  isDebugOrUnattestedGenerationJob,
  isPaidGenerationEnabled,
  isPaidProviderMode,
  UI_CHECKBOX_ATTESTATION,
  type PaidConfirmationIntent,
} from "./paid-generation-guard";
import {
  appendCandidateNoteRevision,
  assessCandidateQuality,
  qualityFieldsForCandidate,
  resolveCandidateVariation,
} from "./candidate-intelligence";
import {
  INCIDENT_CLASSIFICATION,
  PERSONA_INCIDENT_PROJECT_ID,
} from "./incident-constants";
import { executeIncidentCleanup } from "./incident-cleanup";

function creationRepo() {
  return getCreationRepository();
}

function personaRepo() {
  return getPersonaRepository();
}

async function assertCandidateIsBrandCastAttested(
  scope: WorkspaceScope,
  candidate: PersonaCandidate,
): Promise<void> {
  if (!candidate.provider_job_id) return;
  const job = await jobRepo().getJob(scope, candidate.provider_job_id);
  if (!job || !isDebugOrUnattestedGenerationJob(job)) return;
  throw new PersonaDomainError(
    "Dieser Kandidat stammt aus einem Debug-/API-Lauf ohne UI-Bestätigung und ist nicht für Brand Cast vorgesehen.",
    "WORKFLOW",
    { debugRun: true, generationJobId: job.id },
  );
}

function jobRepo() {
  return getGenerationJobRepository();
}

async function requireProject(scope: WorkspaceScope, id: string) {
  const project = await creationRepo().getProject(scope, id);
  if (!project) {
    throw new PersonaDomainError(`Creation project not found: ${id}`, "NOT_FOUND");
  }
  return project;
}

async function requireCandidate(scope: WorkspaceScope, id: string) {
  const candidate = await creationRepo().getCandidate(scope, id);
  if (!candidate) {
    throw new PersonaDomainError(`Candidate not found: ${id}`, "NOT_FOUND");
  }
  return candidate;
}

function mapAssetTypeToReference(assetType: CandidateAssetType): {
  asset_type: "portrait" | "profile" | "full_body" | "three_quarter" | "other";
  view_angle:
    | "front"
    | "left_profile"
    | "right_profile"
    | "three_quarter_left"
    | "unknown";
  framing: "face" | "head_shoulders" | "half_body" | "full_body" | "unknown";
} {
  switch (assetType) {
    case "portrait_front":
      return { asset_type: "portrait", view_angle: "front", framing: "face" };
    case "portrait_three_quarter":
      return {
        asset_type: "three_quarter",
        view_angle: "three_quarter_left",
        framing: "head_shoulders",
      };
    case "portrait_profile":
      return { asset_type: "profile", view_angle: "left_profile", framing: "face" };
    case "half_body":
      return { asset_type: "portrait", view_angle: "front", framing: "half_body" };
    case "full_body":
      return { asset_type: "full_body", view_angle: "front", framing: "full_body" };
    default:
      return { asset_type: "other", view_angle: "unknown", framing: "unknown" };
  }
}

export function listCreationPresets() {
  return PERSONA_CREATION_PRESETS;
}

export async function listCreationProjects(scope: WorkspaceScope) {
  return creationRepo().listProjects(scope);
}

export async function getCreationProject(scope: WorkspaceScope, id: string) {
  return requireProject(scope, id);
}

export async function createCreationProject(
  scope: WorkspaceScope,
  input: CreateCreationProjectInput & { preset_id?: string },
): Promise<PersonaCreationProject> {
  let merged = { ...input };
  if (input.preset_id) {
    const preset = getCreationPreset(input.preset_id);
    if (!preset) {
      throw new PersonaDomainError("Preset nicht gefunden", "VALIDATION");
    }
    const { id: _id, label: _label, ...presetFields } = preset;
    merged = { ...presetFields, ...input, name: input.name || preset.label };
  }

  const candidateCount = Math.min(
    Math.max(1, merged.candidate_count ?? DEFAULT_CANDIDATE_COUNT),
    MAX_CANDIDATE_BATCH_SIZE,
  );

  const provider_mode =
    merged.provider_mode ?? defaultProviderModeForEnvironment();

  const project = await creationRepo().createProject(scope, {
    ...merged,
    candidate_count: candidateCount,
    provider_mode,
    quality_mode: merged.quality_mode ?? DEFAULT_QUALITY_MODE,
    status: merged.status ?? "draft",
  });

  await logPersonaAuditEvent({
    workspaceId: scope.workspaceId,
    eventType: "persona_creation_project.created",
    recordId: project.id,
    actorId: scope.actorId,
    payload: {
      brand_role: project.brand_role,
      provider_mode: project.provider_mode,
      candidate_count: project.candidate_count,
    },
  });

  return project;
}

export async function updateCreationProject(
  scope: WorkspaceScope,
  id: string,
  patch: UpdateCreationProjectInput,
) {
  if (patch.candidate_count != null) {
    patch.candidate_count = Math.min(
      Math.max(1, patch.candidate_count),
      MAX_CANDIDATE_BATCH_SIZE,
    );
  }
  return creationRepo().updateProject(scope, id, patch);
}

export async function estimateCreationCost(
  scope: WorkspaceScope,
  projectId: string,
): Promise<CandidateGenerationCostEstimate> {
  const project = await requireProject(scope, projectId);
  assertCreationProjectAction(project, "estimate");
  const qualityMode = project.quality_mode ?? DEFAULT_QUALITY_MODE;
  const profile = getQualityModeProfile(qualityMode);
  const generator = getPersonaCandidateGenerator(project.provider_mode);
  const estimate = await generator.estimateCandidateGeneration({
    project,
    stage: project.generation_stage,
    candidateCount: project.candidate_count,
    qualityMode,
    costMultiplier: profile.costMultiplier,
  });

  const estimateHash = estimateFingerprintFromCost(projectId, qualityMode, estimate);
  await creationRepo().updateProject(scope, projectId, {
    estimated_cost_min: estimate.estimatedMin,
    estimated_cost_max: estimate.estimatedMax,
    last_estimate_hash: estimateHash,
    last_estimate_at: new Date().toISOString(),
  });

  return estimate;
}

/**
 * Creates a durable pending job + confirmation token for paid generation.
 * User must confirm with this token before generation starts.
 */
export async function preparePaidGenerationConfirmation(
  scope: WorkspaceScope,
  projectId: string,
) {
  const project = await requireProject(scope, projectId);
  assertCreationProjectAction(project, "prepare_confirmation");
  const estimate = await estimateCreationCost(scope, projectId);
  if (!estimate.available) {
    throw new PersonaDomainError(
      "Kostenschätzung nicht verfügbar.",
      "CONFIG",
    );
  }

  const qualityMode = project.quality_mode ?? DEFAULT_QUALITY_MODE;
  const estimateHash = estimateFingerprintFromCost(projectId, qualityMode, estimate);
  const token = createConfirmationToken();
  const assetTypes = assetTypesForStage(project.generation_stage);
  const confirmationIntent: PaidConfirmationIntent =
    project.actual_cost > 0 ? "retry" : "initial";

  const job = await jobRepo().createJob(scope, {
    creation_project_id: projectId,
    stage: project.generation_stage,
    provider: estimate.provider,
    status: "pending_confirmation",
    requested_asset_types: assetTypes,
    quality_mode: qualityMode,
    estimated_cost_min: estimate.estimatedMin,
    estimated_cost_max: estimate.estimatedMax,
    cost_is_estimated: true,
    confirmation_token: token,
    estimate_hash: estimateHash,
    confirmation_payload: {
      projectId,
      stage: project.generation_stage,
      qualityMode,
      candidateCount: estimate.candidateCount,
      assetCount: estimate.totalImages,
      estimatedMin: estimate.estimatedMin,
      estimatedMax: estimate.estimatedMax,
      provider: estimate.provider,
      intent: confirmationIntent,
      timestamp: new Date().toISOString(),
    },
    created_by: scope.actorId,
  });

  const confirmation = await jobRepo().createConfirmation(scope, {
    creation_project_id: projectId,
    generation_job_id: job.id,
    confirmation_token: token,
    estimate_hash: estimateHash,
    stage: project.generation_stage,
    quality_mode: qualityMode,
    candidate_count: estimate.candidateCount,
    asset_count: estimate.totalImages,
    estimated_cost_min: estimate.estimatedMin,
    estimated_cost_max: estimate.estimatedMax,
    payload: {
      ...job.confirmation_payload,
      intent: confirmationIntent,
      provider: estimate.provider,
    },
    created_by: scope.actorId,
  });

  await creationRepo().updateProject(scope, projectId, {
    last_confirmation_token: token,
    last_estimate_hash: estimateHash,
  });

  return {
    estimate,
    job,
    confirmation,
    quality: getQualityModeProfile(qualityMode),
    costLabel: "estimated" as const,
    paidExecutionLocked: isPaidProviderMode(project.provider_mode) && !isPaidGenerationEnabled(),
    paidExecutionLockedMessage: isPaidProviderMode(project.provider_mode) && !isPaidGenerationEnabled()
      ? "Kostenpflichtige Generierung ist derzeit gesperrt."
      : null,
  };
}

export async function getCreationProviderSetup(scope: WorkspaceScope, projectId?: string) {
  const mode = projectId
    ? (await requireProject(scope, projectId)).provider_mode
    : defaultProviderModeForEnvironment();
  return getProviderSetupState(mode);
}

export async function confirmAndStartCandidateGeneration(
  scope: WorkspaceScope,
  projectId: string,
  options: {
    costConfirmed: boolean;
    /** UI acknowledgment only — never authorizes paid generation alone. */
    retryConfirmed?: boolean;
    /** Required for all paid runs — ties to preparePaidGenerationConfirmation. */
    confirmationToken?: string;
    /** ISO timestamp when user explicitly confirmed cost in UI. */
    userConfirmedAt?: string;
    /** Server-verifiable UI attestation — must be ui_checkbox for normal flows. */
    attestation?: string;
    /** Optional HTTP request for debug-header rejection on UI attestation path. */
    httpRequest?: Request;
  },
) {
  const project = await requireProject(scope, projectId);
  if (!options.costConfirmed) {
    throw new PersonaDomainError(
      "Kostenbestätigung erforderlich vor bezahlter Generierung.",
      "WORKFLOW",
      { requiresCostConfirmation: true },
    );
  }
  assertCreationProjectAction(project, "start_generation");

  if (isPaidProviderMode(project.provider_mode) && !options.confirmationToken?.trim()) {
    throw new PersonaDomainError(
      "Bestätigungstoken erforderlich — bitte Kostenschätzung vorbereiten.",
      "WORKFLOW",
      { requiresConfirmationToken: true },
    );
  }

  if (isPaidProviderMode(project.provider_mode) && !options.userConfirmedAt?.trim()) {
    throw new PersonaDomainError(
      "Explizite Nutzerbestätigung erforderlich (Checkbox im UI).",
      "WORKFLOW",
      { requiresUserConfirmation: true },
    );
  }

  if (isPaidProviderMode(project.provider_mode)) {
    assertPaidGenerationEnabled();
  }

  if (project.candidate_count > MAX_CANDIDATE_BATCH_SIZE) {
    throw new PersonaDomainError(
      `Maximale Batch-Größe ist ${MAX_CANDIDATE_BATCH_SIZE}.`,
      "VALIDATION",
    );
  }

  const setup = getProviderSetupState(project.provider_mode);
  if (setup.mode === "disabled") {
    throw new PersonaDomainError(
      setup.setupMessage ?? "Provider nicht eingerichtet.",
      "CONFIG",
    );
  }
  // No silent provider fallback — image_provider must be configured.
  if (
    (project.provider_mode === "image_provider" || project.provider_mode === "hybrid") &&
    !getPersonaCandidateGenerator(project.provider_mode).isConfigured()
  ) {
    throw new PersonaDomainError(
      "Provider nicht eingerichtet — kein stiller Fallback.",
      "CONFIG",
    );
  }

  const estimate = await estimateCreationCost(scope, projectId);
  if (!estimate.available) {
    throw new PersonaDomainError(
      "Kostenschätzung nicht verfügbar — Generierung abgebrochen.",
      "CONFIG",
    );
  }

  const qualityMode = project.quality_mode ?? DEFAULT_QUALITY_MODE;
  const currentHash = estimateFingerprintFromCost(projectId, qualityMode, estimate);

  let durableJobId: string | null = null;
  let consumedConfirmation: Awaited<
    ReturnType<ReturnType<typeof jobRepo>["consumeConfirmation"]>
  > | null = null;

  if (!options.confirmationToken) {
    throw new PersonaDomainError(
      "Bestätigungstoken erforderlich.",
      "WORKFLOW",
      { requiresConfirmationToken: true },
    );
  }

  const confirmation = await jobRepo().getConfirmationByToken(
    scope,
    options.confirmationToken,
  );
  if (!confirmation) {
    throw new PersonaDomainError(
      "Bestätigung ungültig — bitte Kostenschätzung erneut bestätigen.",
      "WORKFLOW",
    );
  }

  assertConfirmationMatchesGenerationRequest({
    scope,
    project,
    confirmation,
    estimate,
    estimateHash: currentHash,
    qualityMode,
  });
  assertValidUiAttestation({
    attestation: options.attestation,
    userConfirmedAt: options.userConfirmedAt,
    confirmation,
    request: options.httpRequest,
  });

  assertLivePaidProviderInvocationAllowed({
    estimatedMaxEur: estimate.estimatedMax,
  });

  consumedConfirmation = await jobRepo().consumeConfirmation(
    scope,
    options.confirmationToken,
  );
  durableJobId = consumedConfirmation.generation_job_id;

  // retryConfirmed is UI-only acknowledgment — authorization is the confirmation record.
  void options.retryConfirmed;

  const spentToday = await creationRepo().sumActualGenerationCostToday(scope);
  if (spentToday + estimate.estimatedMax > MAX_DAILY_GENERATION_EUR) {
    throw new PersonaDomainError(
      `Tageslimit für Generierung (${MAX_DAILY_GENERATION_EUR} €) würde überschritten.`,
      "WORKFLOW",
      { spentToday, estimatedMax: estimate.estimatedMax },
    );
  }

  // Persist attested user confirmation on the durable job before provider execution.
  if (durableJobId && options.userConfirmedAt) {
    const existing = await jobRepo().getJob(scope, durableJobId);
    if (existing) {
      await jobRepo().updateJob(scope, durableJobId, {
        confirmation_payload: {
          ...existing.confirmation_payload,
          userConfirmedAt: options.userConfirmedAt,
          attestation: UI_CHECKBOX_ATTESTATION,
        },
      });
    }
  }

  // Stage B auto-expansion not supported on OpenAI — require manual references.
  if (
    project.generation_stage === "shortlist_validation" &&
    !OPENAI_PROVIDER_CAPABILITY.stageBIdentityConsistentExpansion
  ) {
    throw new PersonaDomainError(
      "Identitätskonsistente Referenzpaket-Generierung ist mit dem aktuellen Provider nicht zuverlässig. " +
        "Bitte Manuelle Referenzen hochladen (needs_manual_references).",
      "WORKFLOW",
      {
        identityExpansionUnsupported: true,
        capability: OPENAI_PROVIDER_CAPABILITY,
      },
    );
  }

  const generator = getPersonaCandidateGenerator(project.provider_mode);
  const now = new Date().toISOString();

  let durableJob = durableJobId
    ? await jobRepo().getJob(scope, durableJobId)
    : null;

  if (!durableJob) {
    durableJob = await jobRepo().createJob(scope, {
      creation_project_id: projectId,
      stage: project.generation_stage,
      provider: estimate.provider,
      status: "queued",
      requested_asset_types: assetTypesForStage(project.generation_stage),
      quality_mode: qualityMode,
      estimated_cost_min: estimate.estimatedMin,
      estimated_cost_max: estimate.estimatedMax,
      cost_is_estimated: true,
      confirmation_token: options.confirmationToken ?? null,
      estimate_hash: currentHash,
      confirmed_at: now,
      started_at: now,
      created_by: scope.actorId,
    });
  } else {
    durableJob = await jobRepo().updateJob(scope, durableJob.id, {
      status: "queued",
      confirmed_at: now,
      started_at: now,
      estimate_hash: currentHash,
    });
  }

  await creationRepo().updateProject(scope, projectId, {
    status: "generating",
    cost_confirmed_at: now,
    estimated_cost_min: estimate.estimatedMin,
    estimated_cost_max: estimate.estimatedMax,
    last_estimate_hash: currentHash,
  });

  await jobRepo().updateJob(scope, durableJob.id, { status: "generating" });

  await logPersonaAuditEvent({
    workspaceId: scope.workspaceId,
    eventType: "candidate_generation.started",
    recordId: projectId,
    actorId: scope.actorId,
    payload: {
      estimate,
      stage: project.generation_stage,
      qualityMode,
      durableJobId: durableJob.id,
      costLabel: "estimated",
    },
  });

  try {
    const job = await generator.createCandidateBatch({
      project,
      stage: project.generation_stage,
      costConfirmed: true,
      retryConfirmed: options.retryConfirmed,
      qualityMode,
    });

    const existing = await creationRepo().listCandidates(scope, projectId);
    for (const result of job.results) {
      const variation = resolveCandidateVariation(result.candidateNumber);
      const qualityAssessment = assessCandidateQuality({
        project,
        variation,
        assetTypes: result.assets.map((a) => a.assetType),
        qualityMode,
      });
      const qualityFields = qualityFieldsForCandidate(qualityAssessment);
      const enrichedSettings = {
        ...result.settings,
        qualityAssessment,
      };
      const displayName =
        typeof (result.settings as { variation?: { label?: string } }).variation?.label ===
        "string"
          ? (result.settings as { variation: { label: string } }).variation.label
          : variation.label;

      let candidate = existing.find((c) => c.candidate_number === result.candidateNumber);
      if (!candidate) {
        candidate = await creationRepo().createCandidate(scope, {
          creation_project_id: projectId,
          candidate_number: result.candidateNumber,
          candidate_name: displayName,
          status: "ready",
          provider: job.provider,
          provider_job_id: durableJob.id,
          generation_seed: result.seed,
          generation_prompt: result.prompt,
          negative_prompt: result.negativePrompt,
          generation_settings: enrichedSettings,
          identity_summary: result.identitySummary,
          distinguishing_features: result.distinguishingFeatures,
          ...qualityFields,
          user_rating: null,
          user_notes: "",
          rejection_reason: "",
          actual_generation_cost: result.actualCostEur,
        });
      } else {
        candidate = await creationRepo().updateCandidate(scope, candidate.id, {
          status: "ready",
          candidate_name: displayName,
          provider: job.provider,
          provider_job_id: durableJob.id,
          generation_seed: result.seed,
          generation_prompt: result.prompt,
          negative_prompt: result.negativePrompt,
          generation_settings: enrichedSettings,
          identity_summary: result.identitySummary,
          distinguishing_features: result.distinguishingFeatures,
          ...qualityFields,
          actual_generation_cost: Number(
            ((candidate.actual_generation_cost ?? 0) + result.actualCostEur).toFixed(4),
          ),
        });
      }

      let primaryId: string | null = null;
      for (const asset of result.assets) {
        const assetId = randomUUID();
        const uploaded =
          creationRepo().kind === "memory"
            ? buildPersonaCandidateAssetMetadata({
                workspaceId: scope.workspaceId,
                projectId,
                candidateId: candidate.id,
                assetId,
                filename: `${asset.assetType}.png`,
                bytes: asset.imageBytes,
                mimeType: asset.mimeType,
              })
            : await uploadPersonaCandidateBytes({
                workspaceId: scope.workspaceId,
                projectId,
                candidateId: candidate.id,
                assetId,
                filename: `${asset.assetType}.png`,
                bytes: asset.imageBytes,
                mimeType: asset.mimeType,
              });
        const created = await creationRepo().createCandidateAsset(scope, {
          candidate_id: candidate.id,
          asset_type: asset.assetType,
          storage_path: uploaded.storagePath,
          mime_type: asset.mimeType,
          width: uploaded.width,
          height: uploaded.height,
          file_size_bytes: asset.imageBytes.length,
          checksum: uploaded.checksum,
          provider_output_id: asset.providerOutputId ?? null,
          generation_metadata: {
            ...(asset.metadata ?? {}),
            costLabel: "estimated",
          },
          status: "ready",
          is_primary: asset.assetType === "portrait_front",
        });
        if (created.is_primary) primaryId = created.id;
      }
      if (primaryId) {
        await creationRepo().updateCandidate(scope, candidate.id, {
          primary_preview_asset_id: primaryId,
        });
      }
    }

    const partial = Boolean(job.errorMessage) && job.results.length > 0;
    const finalStatus = job.results.length === 0 ? "failed" : partial ? "partially_completed" : "completed";

    await jobRepo().updateJob(scope, durableJob.id, {
      status: finalStatus,
      provider_job_id: job.jobId,
      actual_cost: job.actualCostEur,
      cost_is_estimated: true,
      error_message: job.errorMessage ?? null,
      error_code: job.results.length === 0 ? "GENERATION_FAILED" : partial ? "PARTIAL" : null,
      completed_at: new Date().toISOString(),
    });

    await creationRepo().updateProject(scope, projectId, {
      status: job.results.length ? "review" : "failed",
      actual_cost: Number((project.actual_cost + job.actualCostEur).toFixed(4)),
    });

    await logPersonaAuditEvent({
      workspaceId: scope.workspaceId,
      eventType: job.results.length
        ? "candidate_generation.completed"
        : "candidate_generation.failed",
      recordId: projectId,
      actorId: scope.actorId,
      payload: {
        jobId: job.jobId,
        durableJobId: durableJob.id,
        resultCount: job.results.length,
        actualCostEur: job.actualCostEur,
        costLabel: "estimated",
        errorMessage: job.errorMessage,
      },
    });

    return {
      project: await requireProject(scope, projectId),
      job,
      durableJob: await jobRepo().getJob(scope, durableJob.id),
      candidates: await creationRepo().listCandidates(scope, projectId),
      costLabel: "estimated" as const,
    };
  } catch (error) {
    await creationRepo().updateProject(scope, projectId, { status: "failed" });
    await jobRepo().updateJob(scope, durableJob.id, {
      status: "failed",
      error_code: "GENERATION_FAILED",
      error_message: error instanceof Error ? error.message : "unknown",
      completed_at: new Date().toISOString(),
    });
    await logPersonaAuditEvent({
      workspaceId: scope.workspaceId,
      eventType: "candidate_generation.failed",
      recordId: projectId,
      actorId: scope.actorId,
      payload: {
        message: error instanceof Error ? error.message : "unknown",
        durableJobId: durableJob.id,
      },
    });
    throw error;
  }
}

/**
 * Stage B reference package — OpenAI cannot reliably preserve identity.
 * Marks shortlisted candidate for manual references instead of faking expansion.
 */
export async function requestStageBReferencePackage(
  scope: WorkspaceScope,
  candidateId: string,
) {
  const candidate = await requireCandidate(scope, candidateId);
  if (candidate.status !== "shortlisted" && candidate.status !== "selected") {
    throw new PersonaDomainError(
      "Nur shortlistete oder ausgewählte Kandidaten für Stage B.",
      "WORKFLOW",
    );
  }

  if (!OPENAI_PROVIDER_CAPABILITY.stageBIdentityConsistentExpansion) {
    const updated = await creationRepo().updateCandidate(scope, candidateId, {
      status: "needs_manual_references",
      visual_risks:
        "Automatische Identitäts-Expansion mit aktuellem Provider nicht zuverlässig. " +
        "Bitte Referenzpaket manuell hochladen und Identitätsprüfung durchführen.",
    });
    return {
      candidate: updated,
      automaticExpansion: false as const,
      reason: OPENAI_PROVIDER_CAPABILITY.note,
      requiredAction: "manual_upload" as const,
    };
  }

  throw new PersonaDomainError(
    "Stage B Automatik ist für diesen Provider noch nicht angebunden.",
    "CONFIG",
  );
}

/** Retry a single failed asset for one candidate — requires fresh confirmation. */
export async function retrySingleCandidateAsset(
  scope: WorkspaceScope,
  candidateId: string,
  assetType: CandidateAssetType,
  options: {
    costConfirmed: boolean;
    confirmationToken?: string;
    /** UI acknowledgment only — never authorizes paid generation alone. */
    retryConfirmed?: boolean;
    userConfirmedAt?: string;
  },
) {
  if (!options.costConfirmed) {
    throw new PersonaDomainError(
      "Explizite Kostenbestätigung erforderlich.",
      "WORKFLOW",
    );
  }
  void options.retryConfirmed;

  const candidate = await requireCandidate(scope, candidateId);
  const project = await requireProject(scope, candidate.creation_project_id);

  if (!options.confirmationToken?.trim()) {
    throw new PersonaDomainError(
      "Bestätigungstoken erforderlich — bitte Kostenschätzung vorbereiten.",
      "WORKFLOW",
      { requiresConfirmationToken: true },
    );
  }
  if (!options.userConfirmedAt?.trim()) {
    throw new PersonaDomainError(
      "Explizite Nutzerbestätigung erforderlich (Checkbox im UI).",
      "WORKFLOW",
      { requiresUserConfirmation: true },
    );
  }

  const estimate = await estimateCreationCost(scope, project.id);
  const qualityMode = project.quality_mode ?? DEFAULT_QUALITY_MODE;
  const retryEstimate = {
    ...estimate,
    candidateCount: 1,
    totalImages: 1,
    imagesPerCandidate: 1,
  };
  const currentHash = estimateFingerprintFromCost(
    project.id,
    qualityMode,
    retryEstimate,
  );

  const confirmation = await jobRepo().getConfirmationByToken(
    scope,
    options.confirmationToken,
  );
  if (!confirmation) {
    throw new PersonaDomainError(
      "Bestätigung ungültig — bitte Kostenschätzung erneut bestätigen.",
      "WORKFLOW",
    );
  }

  assertConfirmationMatchesGenerationRequest({
    scope,
    project,
    confirmation,
    estimate: retryEstimate,
    estimateHash: currentHash,
    qualityMode,
  });
  assertValidUserConfirmationTimestamp(options.userConfirmedAt, confirmation);
  assertLivePaidProviderInvocationAllowed({
    estimatedMaxEur: retryEstimate.estimatedMax,
  });

  const consumed = await jobRepo().consumeConfirmation(
    scope,
    options.confirmationToken,
  );

  const generator = getPersonaCandidateGenerator(project.provider_mode);
  if (!generator.isConfigured()) {
    throw new PersonaDomainError("Provider nicht eingerichtet.", "CONFIG");
  }

  const durableJob = consumed.generation_job_id
    ? (await jobRepo().getJob(scope, consumed.generation_job_id)) ??
      (await jobRepo().createJob(scope, {
        creation_project_id: project.id,
        candidate_id: candidateId,
        stage: project.generation_stage,
        provider: estimate.provider,
        status: "generating",
        requested_asset_types: [assetType],
        quality_mode: qualityMode,
        estimated_cost_min: retryEstimate.estimatedMin,
        estimated_cost_max: retryEstimate.estimatedMax,
        cost_is_estimated: true,
        retry_count: 1,
        confirmation_token: options.confirmationToken,
        estimate_hash: currentHash,
        confirmation_payload: {
          userConfirmedAt: options.userConfirmedAt,
          attestation: UI_CHECKBOX_ATTESTATION,
        },
        confirmed_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        created_by: scope.actorId,
      }))
    : await jobRepo().createJob(scope, {
        creation_project_id: project.id,
        candidate_id: candidateId,
        stage: project.generation_stage,
        provider: estimate.provider,
        status: "generating",
        requested_asset_types: [assetType],
        quality_mode: qualityMode,
        estimated_cost_min: retryEstimate.estimatedMin,
        estimated_cost_max: retryEstimate.estimatedMax,
        cost_is_estimated: true,
        retry_count: 1,
        confirmation_token: options.confirmationToken,
        estimate_hash: currentHash,
        confirmation_payload: {
          userConfirmedAt: options.userConfirmedAt,
          attestation: UI_CHECKBOX_ATTESTATION,
        },
        confirmed_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        created_by: scope.actorId,
      });

  const batch = await generator.createCandidateBatch({
    project: { ...project, candidate_count: 1 },
    stage: project.generation_stage,
    costConfirmed: true,
    retryConfirmed: true,
    qualityMode,
    assetTypes: [assetType],
    candidateNumbers: [candidate.candidate_number],
  });

  const result = batch.results[0];
  if (!result?.assets.length) {
    await jobRepo().updateJob(scope, durableJob.id, {
      status: "failed",
      error_message: batch.errorMessage ?? "Retry fehlgeschlagen",
      completed_at: new Date().toISOString(),
    });
    throw new PersonaDomainError("Generierung fehlgeschlagen", "WORKFLOW");
  }

  for (const asset of result.assets) {
    const assetId = randomUUID();
    const uploaded =
      creationRepo().kind === "memory"
        ? buildPersonaCandidateAssetMetadata({
            workspaceId: scope.workspaceId,
            projectId: project.id,
            candidateId,
            assetId,
            filename: `${asset.assetType}-retry.png`,
            bytes: asset.imageBytes,
            mimeType: asset.mimeType,
          })
        : await uploadPersonaCandidateBytes({
            workspaceId: scope.workspaceId,
            projectId: project.id,
            candidateId,
            assetId,
            filename: `${asset.assetType}-retry.png`,
            bytes: asset.imageBytes,
            mimeType: asset.mimeType,
          });
    await creationRepo().createCandidateAsset(scope, {
      candidate_id: candidateId,
      asset_type: asset.assetType,
      storage_path: uploaded.storagePath,
      mime_type: asset.mimeType,
      width: uploaded.width,
      height: uploaded.height,
      file_size_bytes: asset.imageBytes.length,
      checksum: uploaded.checksum,
      provider_output_id: asset.providerOutputId ?? null,
      generation_metadata: { ...(asset.metadata ?? {}), retry: true, costLabel: "estimated" },
      status: "ready",
      is_primary: asset.assetType === "portrait_front",
    });
  }

  await creationRepo().updateProject(scope, project.id, {
    actual_cost: Number((project.actual_cost + batch.actualCostEur).toFixed(4)),
  });
  await creationRepo().updateCandidate(scope, candidateId, {
    actual_generation_cost: Number(
      ((candidate.actual_generation_cost ?? 0) + batch.actualCostEur).toFixed(4),
    ),
    status: candidate.status === "failed" ? "ready" : candidate.status,
  });
  await jobRepo().updateJob(scope, durableJob.id, {
    status: "completed",
    actual_cost: batch.actualCostEur,
    completed_at: new Date().toISOString(),
  });

  return {
    candidate: await requireCandidate(scope, candidateId),
    durableJob: await jobRepo().getJob(scope, durableJob.id),
    costLabel: "estimated" as const,
  };
}

export async function listGenerationJobsForProject(
  scope: WorkspaceScope,
  projectId: string,
) {
  await requireProject(scope, projectId);
  return jobRepo().listJobsForProject(scope, projectId);
}

export async function listCandidates(scope: WorkspaceScope, projectId: string) {
  return creationRepo().listCandidates(scope, projectId);
}

export async function getCandidate(scope: WorkspaceScope, id: string) {
  return requireCandidate(scope, id);
}

export async function updateCandidateReview(
  scope: WorkspaceScope,
  candidateId: string,
  patch: UpdateCandidateInput,
) {
  const candidate = await requireCandidate(scope, candidateId);

  // Version notes when user_notes changes — keeps user_notes as latest snapshot.
  if (
    typeof patch.user_notes === "string" &&
    patch.user_notes.trim() !== (candidate.user_notes ?? "").trim()
  ) {
    const appended = appendCandidateNoteRevision({
      settings: candidate.generation_settings ?? {},
      previousNote: candidate.user_notes ?? "",
      nextNote: patch.user_notes,
      author: scope.actorId ?? "user",
    });
    if (appended) {
      patch = {
        ...patch,
        generation_settings: appended.settings,
      };
    }
  }

  if (patch.status === "shortlisted") {
    if (!["ready", "archived"].includes(candidate.status)) {
      throw new PersonaDomainError(
        "Nur bereite Kandidaten können auf die Shortlist.",
        "WORKFLOW",
      );
    }
    await assertCandidateIsBrandCastAttested(scope, candidate);
    const updated = await creationRepo().updateCandidate(scope, candidateId, {
      ...patch,
      status: "shortlisted",
    });
    await logPersonaAuditEvent({
      workspaceId: scope.workspaceId,
      eventType: "candidate.shortlisted",
      recordId: candidateId,
      actorId: scope.actorId,
    });
    // Stage B: mark project for shortlist validation when any shortlisted
    await creationRepo().updateProject(scope, candidate.creation_project_id, {
      generation_stage: "shortlist_validation",
    });
    return updated;
  }

  if (patch.status === "rejected") {
    const updated = await creationRepo().updateCandidate(scope, candidateId, {
      ...patch,
      status: "rejected",
      rejection_reason: patch.rejection_reason ?? candidate.rejection_reason,
    });
    const assets = await creationRepo().listCandidateAssets(scope, candidateId);
    for (const asset of assets) {
      await creationRepo().updateCandidateAsset(scope, asset.id, {
        status: "pending_cleanup",
        retention_until: defaultCandidateRetentionUntil(),
      });
    }
    await logPersonaAuditEvent({
      workspaceId: scope.workspaceId,
      eventType: "candidate.rejected",
      recordId: candidateId,
      actorId: scope.actorId,
      payload: { reason: updated.rejection_reason },
    });
    return updated;
  }

  if (patch.status === "selected") {
    if (candidate.status === "rejected") {
      throw new PersonaDomainError(
        "Abgelehnte Kandidaten müssen zuerst wiederhergestellt werden.",
        "WORKFLOW",
      );
    }
    if (!["ready", "shortlisted", "needs_manual_references"].includes(candidate.status)) {
      throw new PersonaDomainError(
        "Nur bereite, shortlistete oder manuell referenzierte Kandidaten können ausgewählt werden.",
        "WORKFLOW",
      );
    }
    await assertCandidateIsBrandCastAttested(scope, candidate);
    const existing = await creationRepo().findSelectedCandidate(
      scope,
      candidate.creation_project_id,
    );
    if (existing && existing.id !== candidateId) {
      throw new PersonaDomainError(
        "Pro Creation-Projekt darf nur ein Kandidat ausgewählt werden.",
        "WORKFLOW",
        { existingId: existing.id },
      );
    }
    const updated = await creationRepo().updateCandidate(scope, candidateId, {
      ...patch,
      status: "selected",
      selected_at: new Date().toISOString(),
    });
    await creationRepo().updateProject(scope, candidate.creation_project_id, {
      status: "selected",
      generation_stage: "identity_lock",
    });
    await logPersonaAuditEvent({
      workspaceId: scope.workspaceId,
      eventType: "candidate.selected",
      recordId: candidateId,
      actorId: scope.actorId,
    });
    return updated;
  }

  if (patch.status === "ready" && candidate.status === "rejected") {
    // restore
    return creationRepo().updateCandidate(scope, candidateId, {
      ...patch,
      status: "ready",
      rejection_reason: "",
    });
  }

  return creationRepo().updateCandidate(scope, candidateId, patch);
}

export async function listCandidateAssetViews(
  scope: WorkspaceScope,
  candidateId: string,
): Promise<PersonaCandidateAssetView[]> {
  const assets = await creationRepo().listCandidateAssets(scope, candidateId);
  const views: PersonaCandidateAssetView[] = [];
  for (const asset of assets) {
    try {
      const signed = await createPersonaCandidateSignedUrl(asset.storage_path);
      views.push({
        ...asset,
        signed_url: signed.signedUrl,
        signed_url_expires_at: signed.expiresAt,
      });
    } catch {
      views.push({
        ...asset,
        signed_url: null,
        signed_url_expires_at: null,
      });
    }
  }
  return views;
}

/** Primary portrait signed URLs for the candidate board (additive API field). */
export async function listCandidateBoardPreviews(
  scope: WorkspaceScope,
  projectId: string,
): Promise<Record<string, string | null>> {
  const candidates = await creationRepo().listCandidates(scope, projectId);
  const previews: Record<string, string | null> = {};
  for (const candidate of candidates) {
    previews[candidate.id] = null;
    if (!candidate.primary_preview_asset_id) continue;
    try {
      const asset = await creationRepo().getCandidateAsset(
        scope,
        candidate.primary_preview_asset_id,
      );
      if (!asset) continue;
      const signed = await createPersonaCandidateSignedUrl(asset.storage_path);
      previews[candidate.id] = signed.signedUrl;
    } catch {
      previews[candidate.id] = null;
    }
  }
  return previews;
}

export async function uploadManualCandidateAsset(
  scope: WorkspaceScope,
  candidateId: string,
  file: { bytes: Buffer; mimeType: string; filename: string },
  meta: {
    asset_type: CandidateAssetType;
    is_primary?: boolean;
  },
): Promise<PersonaCandidateAsset> {
  const candidate = await requireCandidate(scope, candidateId);
  const project = await requireProject(scope, candidate.creation_project_id);
  const assetId = randomUUID();
  const isMemory = creationRepo().kind === "memory";

  let storagePath: string;
  let checksum: string;
  let width: number | null;
  let height: number | null;

  if (isMemory) {
    const uploaded = buildPersonaCandidateAssetMetadata({
      workspaceId: scope.workspaceId,
      projectId: project.id,
      candidateId,
      assetId,
      filename: file.filename,
      bytes: file.bytes,
      mimeType: file.mimeType,
    });
    storagePath = uploaded.storagePath;
    checksum = uploaded.checksum;
    width = uploaded.width;
    height = uploaded.height;
  } else {
    const uploaded = await uploadPersonaCandidateBytes({
      workspaceId: scope.workspaceId,
      projectId: project.id,
      candidateId,
      assetId,
      filename: file.filename,
      bytes: file.bytes,
      mimeType: file.mimeType,
    });
    storagePath = uploaded.storagePath;
    checksum = uploaded.checksum;
    width = uploaded.width;
    height = uploaded.height;
  }

  const asset = await creationRepo().createCandidateAsset(scope, {
    candidate_id: candidateId,
    asset_type: meta.asset_type,
    storage_path: storagePath,
    mime_type: file.mimeType,
    width,
    height,
    file_size_bytes: file.bytes.length,
    checksum,
    provider_output_id: null,
    generation_metadata: { source: "manual_upload" },
    status: "ready",
    is_primary: meta.is_primary ?? meta.asset_type === "portrait_front",
  });

  if (asset.is_primary) {
    await creationRepo().updateCandidate(scope, candidateId, {
      primary_preview_asset_id: asset.id,
      status: candidate.status === "queued" ? "ready" : candidate.status,
      provider: "manual_upload",
    });
  } else if (candidate.status === "queued") {
    await creationRepo().updateCandidate(scope, candidateId, {
      status: "ready",
      provider: "manual_upload",
    });
  }

  // Ensure project in review when assets arrive via manual upload
  if (project.status === "draft" || project.status === "ready") {
    await creationRepo().updateProject(scope, project.id, { status: "review" });
  }

  return asset;
}

export async function ensureManualCandidateSlots(
  scope: WorkspaceScope,
  projectId: string,
) {
  const project = await requireProject(scope, projectId);
  assertCreationProjectAction(project, "prepare_manual");
  const existing = await creationRepo().listCandidates(scope, projectId);
  const created: PersonaCandidate[] = [];
  for (let i = 1; i <= project.candidate_count; i++) {
    if (existing.some((c) => c.candidate_number === i)) continue;
    created.push(
      await creationRepo().createCandidate(scope, {
        creation_project_id: projectId,
        candidate_number: i,
        candidate_name: `Kandidat ${i}`,
        status: "queued",
        provider: "manual_upload",
        provider_job_id: null,
        generation_seed: null,
        generation_prompt: "",
        negative_prompt: "",
        generation_settings: {},
        identity_summary: "",
        distinguishing_features: "",
        visual_strengths: "",
        visual_risks: "",
        brand_fit_score: null,
        identity_consistency_score: null,
        realism_score: null,
        video_suitability_score: null,
        user_rating: null,
        user_notes: "",
        rejection_reason: "",
      }),
    );
  }
  return creationRepo().listCandidates(scope, projectId);
}

/**
 * Convert selected candidate → draft Persona + copy assets into reference library.
 * Does NOT approve image/video use. Does NOT bypass approval prerequisites.
 */
export async function convertCandidateToPersona(
  scope: WorkspaceScope,
  candidateId: string,
): Promise<{ persona: Persona; candidate: PersonaCandidate }> {
  const candidate = await requireCandidate(scope, candidateId);

  if (candidate.status !== "selected") {
    throw new PersonaDomainError(
      "Nur ausgewählte Kandidaten können in eine Persona überführt werden.",
      "WORKFLOW",
    );
  }
  if (candidate.converted_persona_id) {
    throw new PersonaDomainError(
      "Dieser Kandidat wurde bereits in eine Persona überführt.",
      "WORKFLOW",
      { personaId: candidate.converted_persona_id },
    );
  }

  await assertCandidateIsBrandCastAttested(scope, candidate);

  const project = await requireProject(scope, candidate.creation_project_id);
  const assets = await creationRepo().listCandidateAssets(scope, candidateId);

  const gender =
    project.gender_presentation ||
    (project.brand_role.includes("female")
      ? "Female"
      : project.brand_role.includes("male")
        ? "Male"
        : "");

  const immutable = [
    "Facial identity",
    "Body proportions",
    "Skin tone",
    "Eye shape",
    "Nose structure",
    candidate.distinguishing_features || project.visual_keywords,
  ]
    .filter(Boolean)
    .join("; ");

  const flexible =
    "Outfit; location; pose; lighting; expression within approved range; hairstyle only within approved variations";

  const persona = await personaRepo().createPersona(scope, {
    name: candidate.candidate_name || `Brand Cast ${project.brand_role}`,
    role: project.brand_role,
    gender,
    age_range: project.age_range,
    height: project.height_range,
    body_type: project.body_type,
    skin_tone: project.skin_tone_direction,
    hair: project.hair_direction,
    beard: project.facial_hair_direction,
    eye_color: project.eye_direction,
    expression: project.expression_direction,
    personality: project.personality,
    style: project.fashion_style,
    notes: project.additional_description,
    brand_fit_score: candidate.brand_fit_score ?? 0,
    status: "Draft",
    image_use_approved: false,
    video_use_approved: false,
    visual_identity_notes:
      candidate.identity_summary ||
      `${project.brand_role} · ${project.fashion_style}`,
    distinguishing_features:
      candidate.distinguishing_features || project.visual_keywords,
    prohibited_changes:
      project.excluded_features ||
      "No age shift, no face morph, no eye color change, no unapproved hairline change",
    default_hair_style: project.hair_direction,
    default_facial_hair: project.facial_hair_direction,
    default_expression: project.expression_direction,
    default_body_proportions: project.body_type,
    default_styling_notes: project.fashion_style,
    source_creation_project_id: project.id,
    source_candidate_id: candidate.id,
    identity_lock_status: "collecting_references",
    canonical_identity_description:
      candidate.identity_summary ||
      [gender, project.age_range, project.hair_direction, project.fashion_style]
        .filter(Boolean)
        .join(" · "),
    immutable_features: immutable,
    flexible_features: flexible,
    approved_hair_variations: project.hair_direction,
    approved_expression_range: project.expression_direction,
    approved_body_proportions: project.body_type,
    approved_age_range: project.age_range,
    default_styling: project.fashion_style,
    image_identity_ready: false,
    video_identity_ready: false,
    intended_usage: project.intended_usage,
  });

  let primaryRefId: string | null = null;
  const isMemory = creationRepo().kind === "memory";

  for (const asset of assets.filter(
    (a) => a.status === "ready" || a.status === "uploaded",
  )) {
    const assetId = randomUUID();
    const mapped = mapAssetTypeToReference(asset.asset_type);
    const destPath = isMemory
      ? `workspace/${scope.workspaceId}/personas/${persona.id}/references/${assetId}-${asset.asset_type}.png`
      : await copyCandidateAssetToPersonaReference({
          sourceStoragePath: asset.storage_path,
          workspaceId: scope.workspaceId,
          personaId: persona.id,
          assetId,
          filename: `${asset.asset_type}.png`,
        });

    const ref = await personaRepo().createReferenceAsset(scope, {
      persona_id: persona.id,
      asset_type: mapped.asset_type,
      storage_path: destPath,
      mime_type: asset.mime_type,
      width: asset.width,
      height: asset.height,
      file_size_bytes: asset.file_size_bytes,
      checksum: asset.checksum,
      view_angle: mapped.view_angle,
      framing: mapped.framing,
      expression: project.expression_direction,
      body_visibility: mapped.framing === "full_body" ? "full" : "partial",
      notes: `From candidate ${candidate.id}`,
      source_type: "generated_external",
      rights_confirmed: false,
      status: "uploaded",
      is_primary: asset.is_primary || asset.asset_type === "portrait_front",
    });

    if (ref.is_primary || asset.asset_type === "portrait_front") {
      primaryRefId = ref.id;
    }
  }

  if (primaryRefId) {
    await personaRepo().updatePersona(scope, persona.id, {
      primary_reference_asset_id: primaryRefId,
    });
    await personaRepo().updateReferenceAsset(scope, primaryRefId, {
      is_primary: true,
    });
  }

  const updatedCandidate = await creationRepo().updateCandidate(scope, candidateId, {
    converted_persona_id: persona.id,
  });

  await logPersonaAuditEvent({
    workspaceId: scope.workspaceId,
    eventType: "candidate.converted_to_persona",
    recordId: persona.id,
    actorId: scope.actorId,
    payload: {
      candidateId,
      projectId: project.id,
      image_use_approved: false,
      video_use_approved: false,
      status: persona.status,
    },
  });

  await logPersonaAuditEvent({
    workspaceId: scope.workspaceId,
    eventType: "persona.created",
    recordId: persona.id,
    actorId: scope.actorId,
    payload: { source: "candidate_conversion", candidateId },
  });

  const finalPersona = await personaRepo().getPersona(scope, persona.id);
  if (!finalPersona) {
    throw new PersonaDomainError("Persona nach Konvertierung nicht gefunden", "NOT_FOUND");
  }

  return { persona: finalPersona, candidate: updatedCandidate };
}

export function emptyIdentityChecklist(): IdentityReviewChecklist {
  return Object.fromEntries(REVIEW_KEYS.map((k) => [k, false])) as IdentityReviewChecklist;
}

export async function submitIdentityReview(
  scope: WorkspaceScope,
  personaId: string,
  input: {
    checklist: IdentityReviewChecklist;
    reviewer_notes?: string;
  },
): Promise<PersonaIdentityReview> {
  const persona = await personaRepo().getPersona(scope, personaId);
  if (!persona) {
    throw new PersonaDomainError("Persona not found", "NOT_FOUND");
  }

  const allPassed = REVIEW_KEYS.every((k) => input.checklist[k] === true);
  const review = await creationRepo().createIdentityReview(scope, {
    persona_id: personaId,
    checklist: input.checklist,
    all_passed: allPassed,
    reviewer_notes: input.reviewer_notes ?? "",
  });

  await personaRepo().updatePersona(scope, personaId, {
    identity_lock_status: allPassed ? "review" : "needs_revision",
    image_identity_ready: allPassed && input.checklist.suitable_for_image_generation,
    video_identity_ready: allPassed && input.checklist.suitable_for_video_generation,
  });

  await logPersonaAuditEvent({
    workspaceId: scope.workspaceId,
    eventType: "identity_review.completed",
    recordId: personaId,
    actorId: scope.actorId,
    payload: { allPassed, checklist: input.checklist },
  });

  return review;
}

export async function lockPersonaIdentity(
  scope: WorkspaceScope,
  personaId: string,
): Promise<Persona> {
  const persona = await personaRepo().getPersona(scope, personaId);
  if (!persona) {
    throw new PersonaDomainError("Persona not found", "NOT_FOUND");
  }
  const reviews = await creationRepo().listIdentityReviews(scope, personaId);
  const latest = reviews[0];
  if (!latest?.all_passed) {
    throw new PersonaDomainError(
      "Identity Lock erfordert eine bestandene manuelle Checkliste.",
      "WORKFLOW",
    );
  }

  const updated = await personaRepo().updatePersona(scope, personaId, {
    identity_lock_status: "approved",
    identity_lock_version: (persona.identity_lock_version || 1) + 1,
    image_identity_ready: latest.checklist.suitable_for_image_generation,
    video_identity_ready: latest.checklist.suitable_for_video_generation,
  });

  await logPersonaAuditEvent({
    workspaceId: scope.workspaceId,
    eventType: "persona.identity_locked",
    recordId: personaId,
    actorId: scope.actorId,
    payload: { identity_lock_version: updated.identity_lock_version },
  });

  return updated;
}

function isMalePersona(p: Persona): boolean {
  const g = p.gender.toLowerCase().trim();
  if (g === "female" || g.startsWith("female")) return false;
  if (g === "male" || g.startsWith("male")) return true;
  const r = p.role.toLowerCase();
  if (r.includes("female")) return false;
  return r.includes("male");
}

function isFemalePersona(p: Persona): boolean {
  const g = p.gender.toLowerCase().trim();
  if (g === "female" || g.startsWith("female")) return true;
  if (g === "male" || g.startsWith("male")) return false;
  const r = p.role.toLowerCase();
  return r.includes("female");
}

export async function getOrCreateBrandCastRequirements(
  scope: WorkspaceScope,
): Promise<PersonaBrandCastRequirements> {
  const existing = await creationRepo().getBrandCastRequirements(scope);
  if (existing) return existing;
  return creationRepo().upsertBrandCastRequirements(scope, {});
}

export async function getBrandCastMilestoneProgress(
  scope: WorkspaceScope,
): Promise<BrandCastMilestoneProgress> {
  const requirements = await getOrCreateBrandCastRequirements(scope);
  const personas = await personaRepo().listPersonas(scope);
  const refs = (await personaRepo().snapshot(scope)).reference_assets;

  const approved = personas.filter((p) => p.status === "Approved" && p.approved);

  let male_approved = 0;
  let female_approved = 0;
  let image_ready_count = 0;
  let video_ready_count = 0;
  const missing_reference_requirements: string[] = [];

  for (const persona of approved) {
    const personaRefs = refs.filter((r) => r.persona_id === persona.id);
    const readiness = computePersonaReadiness(persona, personaRefs);
    if (readiness.image_ready) image_ready_count += 1;
    if (readiness.video_ready) video_ready_count += 1;

    const gaps = listApprovalPrerequisiteGaps(persona, personaRefs);
    if (gaps.length) {
      missing_reference_requirements.push(
        `${persona.name}: ${gaps.join(", ")}`,
      );
    }

    // Milestone counts only fully approved personas that remain image-ready
    if (!readiness.image_ready) {
      missing_reference_requirements.push(
        `${persona.name}: incomplete reference package (not image-ready)`,
      );
      continue;
    }

    if (isMalePersona(persona)) male_approved += 1;
    if (isFemalePersona(persona)) female_approved += 1;
  }

  const milestone_reached =
    male_approved >= requirements.required_male_approved &&
    female_approved >= requirements.required_female_approved;

  return {
    requirements,
    male_approved,
    female_approved,
    male_required: requirements.required_male_approved,
    female_required: requirements.required_female_approved,
    image_ready_count,
    video_ready_count,
    missing_reference_requirements,
    milestone_reached,
    milestone_label: requirements.milestone_label,
  };
}

export async function cleanupExpiredCandidateAssets(scope: WorkspaceScope) {
  // Best-effort: scan projects' candidates for pending_cleanup past retention
  const projects = await creationRepo().listProjects(scope);
  let cleaned = 0;
  const now = Date.now();
  for (const project of projects) {
    const candidates = await creationRepo().listCandidates(scope, project.id);
    for (const candidate of candidates) {
      const assets = await creationRepo().listCandidateAssets(scope, candidate.id);
      for (const asset of assets) {
        if (
          asset.status === "pending_cleanup" &&
          asset.retention_until &&
          new Date(asset.retention_until).getTime() < now
        ) {
          try {
            await deletePersonaReferenceObject(asset.storage_path);
          } catch {
            // continue
          }
          await creationRepo().deleteCandidateAsset(scope, asset.id);
          cleaned += 1;
        }
      }
    }
  }
  return { cleaned };
}

export async function cleanupIncidentOrphanRecords(
  scope: WorkspaceScope,
  projectId: string = PERSONA_INCIDENT_PROJECT_ID,
) {
  return executeIncidentCleanup(scope, projectId, jobRepo());
}

export async function createSafeTestRunProject(scope: WorkspaceScope) {
  const preset = getCreationPreset("primary_male_quiet_luxury");
  if (!preset) {
    throw new PersonaDomainError("Preset nicht gefunden.", "NOT_FOUND");
  }
  return createCreationProject(scope, {
    name: `${preset.label} — Sicherer Testlauf`,
    description: "",
    gender_presentation: preset.gender_presentation,
    age_range: preset.age_range,
    height_range: preset.height_range,
    body_type: preset.body_type,
    skin_tone_direction: preset.skin_tone_direction,
    face_shape_direction: preset.face_shape_direction,
    hair_direction: preset.hair_direction,
    facial_hair_direction: preset.facial_hair_direction,
    eye_direction: preset.eye_direction,
    expression_direction: preset.expression_direction,
    personality: preset.personality,
    fashion_style: preset.fashion_style,
    brand_role: preset.brand_role,
    visual_keywords: preset.visual_keywords,
    excluded_features: preset.excluded_features ?? "",
    preferred_brand_looks: preset.preferred_brand_looks,
    preferred_outfits: preset.preferred_outfits ?? "",
    intended_usage: preset.intended_usage,
    candidate_count: 1,
    provider_mode: "image_provider",
    quality_mode: "premium_editorial",
    additional_description: "",
    status: "draft",
  });
}

export type IncidentProjectSummary = {
  projectId: string;
  isIncidentProject: boolean;
  label: string;
  completedProviderRuns: number;
  readyAssetCount: number;
  estimatedCostEur: number;
  costLabel: "estimated";
  actualOpenAiBilling: "unknown";
  firstRunAt: string | null;
  lastRunAt: string | null;
  debugUnattested: boolean;
};

export async function getIncidentProjectSummary(
  scope: WorkspaceScope,
  projectId: string,
): Promise<IncidentProjectSummary | null> {
  if (projectId !== PERSONA_INCIDENT_PROJECT_ID) return null;
  const project = await requireProject(scope, projectId);
  const jobs = await jobRepo().listJobsForProject(scope, projectId);
  const candidates = await creationRepo().listCandidates(scope, projectId);
  const completedRuns = jobs.filter(
    (j) => j.status === "completed" || j.status === "partially_completed",
  );
  let readyAssetCount = 0;
  for (const candidate of candidates) {
    const assets = await creationRepo().listCandidateAssets(scope, candidate.id);
    readyAssetCount += assets.filter((a) => a.status === "ready").length;
  }
  const runTimes = completedRuns
    .map((j) => j.completed_at ?? j.started_at)
    .filter((t): t is string => Boolean(t))
    .sort();
  return {
    projectId,
    isIncidentProject: true,
    label: INCIDENT_CLASSIFICATION.label,
    completedProviderRuns: completedRuns.length,
    readyAssetCount,
    estimatedCostEur: project.actual_cost,
    costLabel: "estimated",
    actualOpenAiBilling: "unknown",
    firstRunAt: runTimes[0] ?? null,
    lastRunAt: runTimes[runTimes.length - 1] ?? null,
    debugUnattested: completedRuns.some(isDebugOrUnattestedGenerationJob),
  };
}

// Re-export checklist key type for consumers
export type { IdentityReviewCheckKey };
