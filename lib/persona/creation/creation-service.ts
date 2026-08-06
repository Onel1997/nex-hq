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
  CandidateStatus,
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
import {
  assetTypesForStage,
  OPENAI_IMAGE_COST_EUR_MAX,
  OPENAI_IMAGE_COST_EUR_MIN,
} from "./provider/cost";
import {
  clampA2Selection,
  missingValidationAssetTypes,
  type CastingFunnelPhase,
} from "./casting-funnel";
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
  resolveOfficialDiscoveryVariations,
} from "./candidate-intelligence";
import {
  INCIDENT_CLASSIFICATION,
  PERSONA_INCIDENT_PROJECT_ID,
} from "./incident-constants";
import { executeIncidentCleanup } from "./incident-cleanup";
import {
  assertAssetsBelongToCandidateProject,
  assertCandidatesBelongToProject,
  assertLiveCastingProviderNotFake,
  appendAssetCacheBust,
  DISCOVERY_NO_NEW_CANDIDATES_MESSAGE,
  filterCandidatesForGenerationRun,
  filterCandidatesForProject,
  logCastingFlowTrace,
  projectScopedPreviewKey,
  resolveCurrentGenerationRunId,
  resolveGenerationSource,
  validateA1DiscoveryCompletion,
  type GenerationSource,
} from "./casting-data-integrity";
import {
  buildIdentityFingerprint,
  buildVisualFingerprint,
  MemoryNoveltyRepository,
  SupabaseNoveltyRepository,
  SupabaseEmbeddingRepository,
  checkAndRegisterCandidate,
  markCandidateShown,
  loadDiscoveryHistory,
} from "../face-novelty-memory";
import {
  buildLiveFaceEvaluator,
  assertLiveFaceEvaluatorNotNull,
} from "../face-novelty-memory/live-evaluator";
import { MemoryLiveDiagnosticStore } from "../face-novelty-memory/diagnostic-store";
import { SupabaseLiveDiagnosticStore } from "../face-novelty-memory/supabase-diagnostic-store";
import { assertCandidateMayBecomeReady } from "../face-novelty-memory/visibility-assertion";
import { maybeAttachNoveltyDebugToSettings } from "../face-novelty-memory/live-debug";
import {
  partitionBoardCandidates,
  type NoveltyFailureSlotDto,
} from "../face-novelty-memory/board-visibility";
import {
  buildNoveltyReplacementAttemptRecord,
  canRequestNoveltyReplacement,
  extractAnatomySampleFromSettings,
  NOVELTY_REPLACEMENT_REASON,
  readGenerationRunIdFromSettings,
  readIdentityAttemptNumber,
  resolveMatchedSameRunSlot,
  SLOT_EXHAUSTED_MESSAGE,
  MAX_DISCOVERY_IDENTITY_ATTEMPTS,
} from "./novelty-replacement";
import {
  buildStaleFailurePayload,
  evaluateReplacementJobStaleness,
  isNoveltyReplacementJob,
  logNoveltyReplacementCheckpoint,
  mapFinalStatusToOutcome,
  outcomeMessage,
  readActiveNoveltyReplacements,
  resolveSlotReplacementStates,
  type NoveltyReplacementCheckpoint,
  type NoveltyReplacementHttpResponse,
  type NoveltyReplacementSuccessResponse,
} from "./novelty-replacement-result";
import { buildNoveltyBlockIdentityRetryContract } from "./candidate-intelligence/obf-l3-integration";
import { resolveSlotBlueprint } from "../identity-blueprints";
import { slotForCandidateNumber } from "@/lib/brand-archetypes/discovery-blueprints";
import { parseArchetypeIdFromProjectDescription } from "@/lib/brand-face-selection/creation-project-mapper";

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
  options?: {
    castingPhase?: CastingFunnelPhase;
    candidateIds?: string[];
    imagesPerCandidate?: number;
    candidateCount?: number;
  },
): Promise<CandidateGenerationCostEstimate> {
  const project = await requireProject(scope, projectId);
  assertCreationProjectAction(project, "estimate");
  const qualityMode = project.quality_mode ?? DEFAULT_QUALITY_MODE;
  const profile = getQualityModeProfile(qualityMode);
  const generator = getPersonaCandidateGenerator(project.provider_mode);
  const castingPhase =
    options?.castingPhase ??
    (project.generation_stage === "discovery" ? "a1_discovery" : undefined);

  let candidateCount = options?.candidateCount ?? project.candidate_count;
  let imagesPerCandidate = options?.imagesPerCandidate;

  if (castingPhase === "a2_validation" && options?.candidateIds?.length) {
    const selected = clampA2Selection(options.candidateIds);
    candidateCount = selected.length;
    let missingTotal = 0;
    for (const id of selected) {
      const assets = await creationRepo().listCandidateAssets(scope, id);
      const missing = missingValidationAssetTypes(assets.map((a) => a.asset_type));
      missingTotal += missing.length;
    }
    imagesPerCandidate =
      candidateCount > 0 ? Math.max(1, Math.round(missingTotal / candidateCount)) : 2;
    if (missingTotal === 0) {
      imagesPerCandidate = 0;
    } else {
      // Prefer exact total via imagesPerCandidate * count ≈ missingTotal
      imagesPerCandidate = missingTotal / candidateCount;
    }
  }

  const estimate = await generator.estimateCandidateGeneration({
    project,
    stage: project.generation_stage,
    candidateCount,
    imagesPerCandidate:
      imagesPerCandidate != null ? Math.ceil(imagesPerCandidate) : undefined,
    qualityMode,
    costMultiplier: profile.costMultiplier,
    castingPhase,
  });

  // For A2 with uneven missing angles, override totalImages to exact missing count.
  if (
    castingPhase === "a2_validation" &&
    options?.candidateIds?.length &&
    typeof imagesPerCandidate === "number"
  ) {
    const selected = clampA2Selection(options.candidateIds);
    let missingTotal = 0;
    for (const id of selected) {
      const assets = await creationRepo().listCandidateAssets(scope, id);
      missingTotal += missingValidationAssetTypes(assets.map((a) => a.asset_type)).length;
    }
    if (missingTotal > 0) {
      const mult = profile.costMultiplier;
      const estimatedMin = Number((missingTotal * OPENAI_IMAGE_COST_EUR_MIN * mult).toFixed(4));
      const estimatedMax = Number((missingTotal * OPENAI_IMAGE_COST_EUR_MAX * mult).toFixed(4));
      Object.assign(estimate, {
        candidateCount: selected.length,
        totalImages: missingTotal,
        imagesPerCandidate: Number((missingTotal / selected.length).toFixed(2)),
        estimatedMin,
        estimatedMax,
        estimatedTotal: Number(((estimatedMin + estimatedMax) / 2).toFixed(4)),
        castingPhase: "a2_validation",
        costStatus: "estimated",
        note: `Angle validation (A2): ${selected.length} selected · ${missingTotal} missing angles. Separate confirmation required.`,
        allocatedPerCandidate: {
          estimatedMin: Number((estimatedMin / selected.length).toFixed(4)),
          estimatedMax: Number((estimatedMax / selected.length).toFixed(4)),
          label: "allocated_estimate" as const,
        },
      });
    }
  }

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
  options?: {
    castingPhase?: CastingFunnelPhase;
    candidateIds?: string[];
  },
) {
  const project = await requireProject(scope, projectId);
  assertCreationProjectAction(project, "prepare_confirmation");
  const castingPhase =
    options?.castingPhase ??
    (project.generation_stage === "discovery" ? "a1_discovery" : "a2_validation");
  const selectedIds =
    castingPhase === "a2_validation" && options?.candidateIds?.length
      ? clampA2Selection(options.candidateIds)
      : undefined;

  if (castingPhase === "a2_validation") {
    if (!selectedIds?.length) {
      throw new PersonaDomainError(
        "A2 Angle Validation erfordert ausgewählte Kandidaten (max. 2 empfohlen).",
        "VALIDATION",
        { requiresCandidateSelection: true },
      );
    }
  }

  const estimate = await estimateCreationCost(scope, projectId, {
    castingPhase,
    candidateIds: selectedIds,
  });
  if (!estimate.available) {
    throw new PersonaDomainError(
      "Kostenschätzung nicht verfügbar.",
      "CONFIG",
    );
  }
  if (estimate.totalImages <= 0) {
    throw new PersonaDomainError(
      "Keine fehlenden Winkel — A2 Expansion nicht nötig.",
      "WORKFLOW",
    );
  }

  const qualityMode = project.quality_mode ?? DEFAULT_QUALITY_MODE;
  const estimateHash = estimateFingerprintFromCost(projectId, qualityMode, estimate);
  const token = createConfirmationToken();

  let requestedAssetTypes = assetTypesForStage(project.generation_stage);
  if (castingPhase === "a2_validation" && selectedIds) {
    const missingSet = new Set<CandidateAssetType>();
    for (const id of selectedIds) {
      const assets = await creationRepo().listCandidateAssets(scope, id);
      for (const t of missingValidationAssetTypes(assets.map((a) => a.asset_type))) {
        missingSet.add(t);
      }
    }
    requestedAssetTypes = [...missingSet];
  }

  const confirmationIntent: PaidConfirmationIntent =
    castingPhase === "a2_validation"
      ? "retry"
      : project.actual_cost > 0
        ? "retry"
        : "initial";

  const job = await jobRepo().createJob(scope, {
    creation_project_id: projectId,
    stage: project.generation_stage,
    provider: estimate.provider,
    status: "pending_confirmation",
    requested_asset_types: requestedAssetTypes,
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
      castingPhase,
      selectedCandidateIds: selectedIds ?? [],
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
      castingPhase,
      selectedCandidateIds: selectedIds ?? [],
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
    castingPhase,
    castingPhaseLabel:
      castingPhase === "a1_discovery"
        ? "Discovery casting"
        : "Expand selected candidates",
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

  // Phase 2.0C — development-safe historical coverage gate (paid discovery).
  // Skipped in automated unit tests unless PERSONA_FORCE_COVERAGE_GATE=1.
  // Never silently spend money while processable historical faces lack embeddings.
  if (
    process.env.NODE_ENV !== "production" &&
    isPaidProviderMode(project.provider_mode) &&
    !(
      (process.env.NODE_TEST_CONTEXT ||
        process.env.npm_lifecycle_event === "test" ||
        process.argv.includes("--test")) &&
      process.env.PERSONA_FORCE_COVERAGE_GATE !== "1"
    )
  ) {
    const { isPersonaFaceNoveltyDebugEnabled } = await import(
      "../face-novelty-memory/live-debug"
    );
    const { loadHistoricalProtectionSnapshot } = await import(
      "../face-novelty-memory/historical-backfill-service"
    );
    const {
      evaluateDiscoveryCoverageGate,
      resolveMinimumProcessableCoveragePercent,
    } = await import("../face-novelty-memory/discovery-coverage-gate");

    try {
      const archetypeId = project.brand_role || "unknown";
      const snapshot = await loadHistoricalProtectionSnapshot(scope, {
        archetypeId,
      });
      const required = resolveMinimumProcessableCoveragePercent();
      const needsGate =
        isPersonaFaceNoveltyDebugEnabled() ||
        snapshot.processableCoveragePercentage < required ||
        snapshot.failedProcessing > 0 ||
        snapshot.missingEmbedding - snapshot.missingAsset > 0;

      if (needsGate) {
        const { runFaceNoveltyPreflight } = await import(
          "../face-novelty-memory/preflight"
        );
        const preflight = await runFaceNoveltyPreflight();
        const coverageGate = evaluateDiscoveryCoverageGate({
          evaluatorReady:
            preflight.ready &&
            preflight.verdict === "READY FOR CONTROLLED LIVE TEST",
          coverage: snapshot,
          runningBackfillJob:
            snapshot.lastBackfillJob?.status === "running" ||
            snapshot.lastBackfillJob?.status === "pending"
              ? snapshot.lastBackfillJob
              : null,
          acknowledgeUnresolvedFailures: Boolean(
            (options as { acknowledgeUnresolvedFailures?: boolean })
              .acknowledgeUnresolvedFailures,
          ),
        });
        if (coverageGate.blocked) {
          throw new PersonaDomainError(
            coverageGate.message ??
              "Historical face protection coverage is incomplete — paid discovery blocked.",
            "WORKFLOW",
            {
              discoveryCoverageGate: coverageGate,
              requiresHistoricalBackfill: true,
            },
          );
        }
      }
    } catch (err) {
      if (err instanceof PersonaDomainError) throw err;
      // Snapshot infra unavailable — do not block unrelated flows.
    }
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

  const estimateOpts = (() => {
    // Peek confirmation payload early for A2 estimate alignment.
    return {} as {
      castingPhase?: CastingFunnelPhase;
      candidateIds?: string[];
    };
  })();

  // Load confirmation first so estimate matches the confirmed casting phase.
  if (!options.confirmationToken) {
    throw new PersonaDomainError(
      "Bestätigungstoken erforderlich.",
      "WORKFLOW",
      { requiresConfirmationToken: true },
    );
  }

  const confirmationEarly = await jobRepo().getConfirmationByToken(
    scope,
    options.confirmationToken,
  );
  if (!confirmationEarly) {
    throw new PersonaDomainError(
      "Bestätigung ungültig — bitte Kostenschätzung erneut bestätigen.",
      "WORKFLOW",
    );
  }

  const earlyPayload = (confirmationEarly.payload ?? {}) as Record<string, unknown>;
  if (earlyPayload.castingPhase === "a2_validation") {
    estimateOpts.castingPhase = "a2_validation";
    estimateOpts.candidateIds = Array.isArray(earlyPayload.selectedCandidateIds)
      ? earlyPayload.selectedCandidateIds.filter((id): id is string => typeof id === "string")
      : [];
  } else {
    estimateOpts.castingPhase = "a1_discovery";
  }

  const estimate = await estimateCreationCost(scope, projectId, estimateOpts);
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

  const confirmation = confirmationEarly;

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
  assertLiveCastingProviderNotFake(generator.id, {
    liveUiAttestation: options.attestation === UI_CHECKBOX_ATTESTATION,
  });
  const generationSource: GenerationSource = resolveGenerationSource(
    generator.id === "fake" ? "fake" : estimate.provider,
  );
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
      confirmation_payload: {
        generationSource,
        castingPhase: estimateOpts.castingPhase ?? "a1_discovery",
        providerExecution: {
          provider: estimate.provider,
          requestCount: 0,
          successCount: 0,
          retryCount: 0,
          startedAt: now,
        },
      },
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
    const confirmationPayload = (consumedConfirmation?.payload ??
      durableJob?.confirmation_payload ??
      {}) as Record<string, unknown>;
    const castingPhase: CastingFunnelPhase =
      confirmationPayload.castingPhase === "a2_validation"
        ? "a2_validation"
        : "a1_discovery";
    const selectedCandidateIds = Array.isArray(confirmationPayload.selectedCandidateIds)
      ? confirmationPayload.selectedCandidateIds.filter(
          (id): id is string => typeof id === "string",
        )
      : [];

    let candidateNumbers: number[] | undefined;
    let assetTypes: CandidateAssetType[] | undefined;

    if (castingPhase === "a2_validation" && selectedCandidateIds.length > 0) {
      const selected = await Promise.all(
        selectedCandidateIds.map((id) => creationRepo().getCandidate(scope, id)),
      );
      candidateNumbers = selected
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .map((c) => c.candidate_number);
      const missingSet = new Set<CandidateAssetType>();
      for (const id of selectedCandidateIds) {
        const assets = await creationRepo().listCandidateAssets(scope, id);
        for (const t of missingValidationAssetTypes(assets.map((a) => a.asset_type))) {
          missingSet.add(t);
        }
      }
      assetTypes = [...missingSet];
      if (assetTypes.length === 0) {
        throw new PersonaDomainError(
          "Keine fehlenden Winkel für die Auswahl — nichts zu generieren.",
          "WORKFLOW",
        );
      }
    }

    const job = await generator.createCandidateBatch({
      project,
      stage: project.generation_stage,
      costConfirmed: true,
      retryConfirmed: options.retryConfirmed,
      qualityMode,
      castingPhase,
      candidateNumbers,
      assetTypes,
      generationRunId: durableJob.id,
      identityAttemptNumber: 1, // initial discovery cast — replacements use confirmNoveltyReplacementGeneration
    });

    const existing = await creationRepo().listCandidates(scope, projectId);
    const priorAssetIds: string[] = [];
    const priorStoragePaths: string[] = [];
    for (const c of existing) {
      const priorAssets = await creationRepo().listCandidateAssets(scope, c.id);
      for (const a of priorAssets) {
        priorAssetIds.push(a.id);
        priorStoragePaths.push(a.storage_path);
      }
    }
    const officialCast = resolveOfficialDiscoveryVariations({
      project,
      candidateNumbers: job.results.map((r) => r.candidateNumber),
    });

    // -----------------------------------------------------------------------
    // Face Novelty Memory — build live evaluator once per generation batch.
    // Only active for A1 discovery with live providers (not memory/fake).
    // -----------------------------------------------------------------------
    const isLiveProvider = creationRepo().kind !== "memory";
    const archetypeIdForNovelty = officialCast.archetype?.id ?? "unknown";
    const noveltyRepo = isLiveProvider
      ? new SupabaseNoveltyRepository()
      : new MemoryNoveltyRepository();
    const embeddingRepo = isLiveProvider ? new SupabaseEmbeddingRepository() : null;
    const diagnosticStore = isLiveProvider
      ? new SupabaseLiveDiagnosticStore()
      : new MemoryLiveDiagnosticStore();

    let liveEvaluator: import("../face-novelty-memory/types").FaceSimilarityEvaluator | null =
      null;
    let noveltyHistory: import("../face-novelty-memory/types").DiscoveryHistory | null = null;
    let priorEmbeddingsLoaded = 0;
    if (isLiveProvider && castingPhase === "a1_discovery") {
      try {
        noveltyHistory = await loadDiscoveryHistory(
          noveltyRepo,
          scope.workspaceId,
          archetypeIdForNovelty,
        );
        liveEvaluator = await buildLiveFaceEvaluator({
          workspaceId: scope.workspaceId,
          archetypeId: archetypeIdForNovelty,
        });
        assertLiveFaceEvaluatorNotNull(
          liveEvaluator,
          `a1_discovery project=${projectId}`,
        );
        const embCountRepo = new SupabaseEmbeddingRepository();
        priorEmbeddingsLoaded = (
          await embCountRepo.loadEmbeddingsForWorkspace(
            scope.workspaceId,
            archetypeIdForNovelty,
          )
        ).length;
      } catch (initErr) {
        // Surface clearly — do not silently fall back to null evaluator.
        logCastingFlowTrace("novelty.evaluator_init_failed", {
          creationProjectId: projectId,
          workspaceId: scope.workspaceId,
          source: "unknown",
        } as import("./casting-data-integrity").CastingFlowTracePayload);
        // Re-throw so the generation does not proceed with unverified novelty.
        throw new PersonaDomainError(
          `Face novelty evaluator failed to initialize: ${initErr instanceof Error ? initErr.message : String(initErr)}`,
          "CONFIG",
          { noveltyEvaluatorInitFailed: true },
        );
      }
    }
    // -----------------------------------------------------------------------

    for (const result of job.results) {
      const variation =
        (officialCast.officialBrandFace
          ? officialCast.variations[result.candidateNumber - 1]
          : null) ?? resolveCandidateVariation(result.candidateNumber);
      const qualityAssessment = assessCandidateQuality({
        project,
        variation,
        assetTypes: result.assets.map((a) => a.assetType),
        qualityMode,
      });
      const qualityFields = qualityFieldsForCandidate(qualityAssessment);
      const blueprint = officialCast.blueprints[result.candidateNumber - 1];
      const enrichedSettings = {
        ...result.settings,
        qualityAssessment,
        ...(blueprint
          ? {
              intendedUseLabel: blueprint.intendedUseLabel,
              discoveryBlueprintId: blueprint.id,
              fashionPresence: blueprint.fashionCasting.fashionPresence,
            }
          : {}),
      };
      const displayName =
        typeof (result.settings as { variation?: { label?: string } }).variation?.label ===
        "string"
          ? (result.settings as { variation: { label: string } }).variation.label
          : variation.label;

      // A1 live novelty path: create as generating until evaluation completes.
      // Prevents ready/visible status before performed + allowed novelty decision.
      const initialStatus =
        isLiveProvider && castingPhase === "a1_discovery" ? "generating" : "ready";

      let candidate = existing.find((c) => c.candidate_number === result.candidateNumber);
      if (!candidate) {
        candidate = await creationRepo().createCandidate(scope, {
          creation_project_id: projectId,
          candidate_number: result.candidateNumber,
          candidate_name: displayName,
          status: initialStatus,
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
          status: initialStatus,
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

      // -----------------------------------------------------------------------
      // Face Novelty Check — run BEFORE candidate is visible on Candidate Board.
      // -----------------------------------------------------------------------
      if (
        isLiveProvider &&
        castingPhase === "a1_discovery" &&
        liveEvaluator !== null &&
        noveltyHistory !== null &&
        primaryId !== null
      ) {
        const variation =
          (officialCast.officialBrandFace
            ? officialCast.variations[result.candidateNumber - 1]
            : null) ?? resolveCandidateVariation(result.candidateNumber);
        const identityFingerprint = buildIdentityFingerprint({
          archetypeId: archetypeIdForNovelty,
          blueprintId:
            officialCast.blueprints[result.candidateNumber - 1]?.id ?? undefined,
          runVariationToken: officialCast.runVariationToken ?? undefined,
          faceGeometry: variation.faceGeometry,
          jawShape: variation.jawShape,
          noseShape: variation.noseShape,
          eyeShape: variation.eyeShape,
          lipShape: variation.lipShape,
          hairTexture: variation.hairTexture,
          haircut: variation.haircut,
          facialHair: variation.facialHair,
          bodyStructure: variation.bodyBuild,
          skinTone: variation.skinTone,
          ancestryDirection: variation.identityDescriptor,
        });

        // Obtain a short-lived signed URL for the primary portrait (server-side only).
        let signedUrl: string | undefined;
        try {
          const primaryAssetRecord = result.assets.find(
            (a) => a.assetType === "portrait_front",
          );
          if (primaryAssetRecord) {
            // Refresh evaluator with image source map
            const imgMap = new Map<string, string>();
            // Use raw bytes directly via data URL — avoids a round-trip signed URL
            const dataUrl = `data:${primaryAssetRecord.mimeType};base64,${Buffer.from(primaryAssetRecord.imageBytes).toString("base64")}`;
            imgMap.set(primaryId!, dataUrl);
            signedUrl = dataUrl;
            liveEvaluator = await buildLiveFaceEvaluator({
              workspaceId: scope.workspaceId,
              archetypeId: archetypeIdForNovelty,
              imageSourceMap: imgMap,
            });
          }
        } catch {
          // Non-fatal: evaluator proceeds without image source (returns not_available)
        }

        const checkOpts: import("../face-novelty-memory/novelty-service").CheckCandidateOptions =
          {
            evaluator: liveEvaluator,
            embeddingRepo: embeddingRepo ?? undefined,
            diagnosticStore,
            priorEmbeddingsLoaded,
            slot: result.candidateNumber,
            evaluatorActive: true,
          };

        const noveltyCheck = await checkAndRegisterCandidate(
          noveltyRepo,
          noveltyHistory,
          {
            workspaceId: scope.workspaceId,
            archetypeId: archetypeIdForNovelty,
            creationProjectId: projectId,
            candidateId: candidate.id,
            assetId: primaryId!,
            identityFingerprint,
            visualFingerprint: buildVisualFingerprint({
              imageChecksum: result.assets.find((a) => a.assetType === "portrait_front")
                ? undefined
                : undefined,
            }),
            signedUrl,
            sourceProvider: job.provider,
            sourceModel:
              typeof result.settings?.model === "string"
                ? result.settings.model
                : job.provider,
          },
          checkOpts,
        );

        logCastingFlowTrace("novelty.candidate_evaluated", {
          creationProjectId: projectId,
          workspaceId: scope.workspaceId,
          candidateIds: [candidate.id],
          // Do NOT log similarity scores or embedding vectors.
        });

        const nextStatus = noveltyCheck.candidateStatus;
        assertCandidateMayBecomeReady({
          proposedStatus: nextStatus,
          evaluationStatus: noveltyCheck.evaluationStatus,
          finalDecision: noveltyCheck.finalDecision,
          detectionStatus: noveltyCheck.detectionStatus,
        });

        const settingsWithDebug = maybeAttachNoveltyDebugToSettings(
          {
            ...(candidate.generation_settings ?? {}),
            ...enrichedSettings,
          },
          noveltyCheck.liveDebug ?? null,
        );

        await creationRepo().updateCandidate(scope, candidate.id, {
          status: nextStatus,
          generation_settings: settingsWithDebug,
          rejection_reason:
            nextStatus === "ready"
              ? ""
              : noveltyCheck.replacementMessage ?? "novelty_protection",
          user_notes:
            nextStatus === "ready"
              ? ""
              : `[novelty] ${noveltyCheck.hardRejectReason ?? noveltyCheck.finalDecision}`,
        });

        if (noveltyCheck.finalDecision === "allowed") {
          await markCandidateShown(noveltyRepo, noveltyCheck.recordId, scope.workspaceId);
        }
        // Failed / blocked stay exhausted — never mark shown (a shown face is consumed).

        // Update history for subsequent candidates in this same batch.
        noveltyHistory = await loadDiscoveryHistory(
          noveltyRepo,
          scope.workspaceId,
          archetypeIdForNovelty,
        );
        if (embeddingRepo) {
          priorEmbeddingsLoaded = (
            await embeddingRepo.loadEmbeddingsForWorkspace(
              scope.workspaceId,
              archetypeIdForNovelty,
            )
          ).length;
        }
      } else if (initialStatus === "generating") {
        // Novelty path skipped unexpectedly — fail closed, never leave as generating→ready.
        await creationRepo().updateCandidate(scope, candidate.id, {
          status: "novelty_failed",
          rejection_reason: "novelty_evaluation_skipped",
          user_notes: "[novelty] evaluation_not_performed",
        });
      }
      // -----------------------------------------------------------------------
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
      confirmation_payload: {
        ...(durableJob.confirmation_payload ?? {}),
        generationSource,
        providerExecution: {
          provider: job.provider,
          model:
            typeof job.results[0]?.settings?.model === "string"
              ? job.results[0].settings.model
              : estimate.provider,
          startedAt: durableJob.started_at ?? now,
          completedAt: new Date().toISOString(),
          requestCount: job.results.length,
          successCount: job.results.length,
          retryCount: 0,
          creationProjectId: projectId,
        },
      },
    });

    const persistedCandidates = await creationRepo().listCandidates(scope, projectId);
    assertCandidatesBelongToProject(persistedCandidates, projectId);

    const persistedJobs = await jobRepo().listJobsForProject(scope, projectId);
    const persistedAssets: PersonaCandidateAsset[] = [];
    for (const candidate of persistedCandidates) {
      const assets = await creationRepo().listCandidateAssets(scope, candidate.id);
      assertAssetsBelongToCandidateProject(assets, candidate, projectId);
      persistedAssets.push(...assets);
    }

    if (castingPhase === "a1_discovery" && job.results.length > 0) {
      const completion = validateA1DiscoveryCompletion({
        projectId,
        candidates: persistedCandidates,
        jobs: persistedJobs,
        expectedCount: project.candidate_count,
        generationSource,
        requireProviderExecution: true,
        generationStartedAt: durableJob.started_at ?? now,
        assets: persistedAssets,
        priorCandidateIds: [],
        priorAssetIds,
        priorStoragePaths,
      });
      if (!completion.complete) {
        throw new PersonaDomainError(
          DISCOVERY_NO_NEW_CANDIDATES_MESSAGE,
          "WORKFLOW",
          { reasons: completion.reasons, projectId },
        );
      }
    }

    logCastingFlowTrace("generation.completed", {
      creationProjectId: projectId,
      workspaceId: scope.workspaceId,
      provider: job.provider,
      generationRequestId: durableJob.id,
      candidateIds: persistedCandidates.map((c) => c.id),
      assetIds: persistedAssets.map((a) => a.id),
      createdAt: persistedCandidates.map((c) => c.created_at),
      source:
        generationSource === "openai_live"
          ? "live_openai"
          : generationSource,
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
      candidates: filterCandidatesForGenerationRun(
        await creationRepo().listCandidates(scope, projectId),
        durableJob.id,
      ),
      generationRunId: durableJob.id,
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
    generationRunId: durableJob.id,
    identityAttemptNumber: 1,
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

/**
 * Phase 2.1E — Prepare single-slot novelty replacement confirmation.
 * Never calls OpenAI. User must confirm before confirmNoveltyReplacementGeneration.
 */
export async function prepareNoveltyReplacementConfirmation(
  scope: WorkspaceScope,
  projectId: string,
  options: { candidateId: string },
) {
  const project = await requireProject(scope, projectId);
  const candidate = await requireCandidate(scope, options.candidateId);
  if (candidate.creation_project_id !== projectId) {
    throw new PersonaDomainError(
      "Candidate does not belong to this creation project.",
      "WORKFLOW",
    );
  }
  if (candidate.status !== "novelty_blocked") {
    throw new PersonaDomainError(
      "Generate New Face is only available for novelty_blocked slots.",
      "WORKFLOW",
      { status: candidate.status },
    );
  }

  const previousAttempt = readIdentityAttemptNumber(candidate.generation_settings);
  if (!canRequestNoveltyReplacement(previousAttempt)) {
    throw new PersonaDomainError(SLOT_EXHAUSTED_MESSAGE, "WORKFLOW", {
      attemptNumber: previousAttempt,
      maxAttempts: MAX_DISCOVERY_IDENTITY_ATTEMPTS,
      slotExhausted: true,
    });
  }

  const nextAttempt = previousAttempt + 1;
  const slotLabel =
    ["A", "B", "C", "D"][candidate.candidate_number - 1] ??
    String(candidate.candidate_number);

  const qualityMode = project.quality_mode ?? DEFAULT_QUALITY_MODE;
  const mult = getQualityModeProfile(qualityMode).costMultiplier;
  const estimatedMin = Number((OPENAI_IMAGE_COST_EUR_MIN * mult).toFixed(4));
  const estimatedMax = Number((OPENAI_IMAGE_COST_EUR_MAX * mult).toFixed(4));
  const estimate: CandidateGenerationCostEstimate = {
    available: true,
    provider: "openai",
    providerMode: project.provider_mode,
    candidateCount: 1,
    imagesPerCandidate: 1,
    totalImages: 1,
    estimatedMin,
    estimatedMax,
    estimatedTotal: estimatedMax,
    currency: "EUR",
    stage: project.generation_stage,
    note: `Novelty replacement · Slot ${slotLabel} · attempt ${nextAttempt} of ${MAX_DISCOVERY_IDENTITY_ATTEMPTS}`,
    costStatus: "estimated",
    castingPhase: "a1_discovery",
  };

  const estimateHash = estimateFingerprintFromCost(
    projectId,
    qualityMode,
    estimate,
  );
  const token = createConfirmationToken();
  const confirmationIntent: PaidConfirmationIntent = "novelty_replacement";

  const job = await jobRepo().createJob(scope, {
    creation_project_id: projectId,
    candidate_id: candidate.id,
    stage: project.generation_stage,
    provider: estimate.provider,
    status: "pending_confirmation",
    requested_asset_types: ["portrait_front"],
    quality_mode: qualityMode,
    estimated_cost_min: estimatedMin,
    estimated_cost_max: estimatedMax,
    cost_is_estimated: true,
    confirmation_token: token,
    estimate_hash: estimateHash,
    confirmation_payload: {
      projectId,
      intent: confirmationIntent,
      castingPhase: "a1_discovery",
      noveltyReplacement: true,
      candidateId: candidate.id,
      slot: slotLabel,
      previousAttemptNumber: previousAttempt,
      nextAttemptNumber: nextAttempt,
      reason: NOVELTY_REPLACEMENT_REASON,
      provider: estimate.provider,
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
    candidate_count: 1,
    asset_count: 1,
    estimated_cost_min: estimatedMin,
    estimated_cost_max: estimatedMax,
    payload: {
      ...job.confirmation_payload,
      intent: confirmationIntent,
    },
    created_by: scope.actorId,
  });

  return {
    estimate,
    job,
    confirmation,
    quality: getQualityModeProfile(qualityMode),
    costLabel: "estimated" as const,
    slot: slotLabel,
    candidateId: candidate.id,
    previousAttemptNumber: previousAttempt,
    nextAttemptNumber: nextAttempt,
    maxAttempts: MAX_DISCOVERY_IDENTITY_ATTEMPTS,
    reason: NOVELTY_REPLACEMENT_REASON,
    replacementMessage: `Generate New Face for Slot ${slotLabel} (attempt ${nextAttempt} of ${MAX_DISCOVERY_IDENTITY_ATTEMPTS})`,
  };
}

/**
 * Phase 2.1E / 2.1E.1 — Confirmed single-slot novelty replacement generation.
 * Requires explicit confirmation. Generates only the blocked slot.
 * Keeps same project + L3 generationRunId; increments attemptNumber by 1.
 * Returns a non-ambiguous HTTP result contract (ok + status).
 */
export async function confirmNoveltyReplacementGeneration(
  scope: WorkspaceScope,
  projectId: string,
  options: {
    candidateId: string;
    costConfirmed: boolean;
    confirmationToken?: string;
    userConfirmedAt?: string;
    attestation?: string;
    httpRequest?: Request;
  },
): Promise<NoveltyReplacementHttpResponse> {
  const startedAtMs = Date.now();
  const checkpoints: NoveltyReplacementCheckpoint[] = ["request_received"];
  logNoveltyReplacementCheckpoint("request_received", {
    projectId,
    previousCandidateId: options.candidateId,
  });

  if (!options.costConfirmed) {
    throw new PersonaDomainError(
      "Explizite Kostenbestätigung erforderlich.",
      "WORKFLOW",
      { requiresCostConfirmation: true },
    );
  }
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

  const project = await requireProject(scope, projectId);
  const previous = await requireCandidate(scope, options.candidateId);
  if (previous.creation_project_id !== projectId) {
    throw new PersonaDomainError(
      "Candidate does not belong to this creation project.",
      "WORKFLOW",
    );
  }
  if (previous.status !== "novelty_blocked") {
    throw new PersonaDomainError(
      "Generate New Face is only available for novelty_blocked slots.",
      "WORKFLOW",
    );
  }

  const previousAttempt = readIdentityAttemptNumber(previous.generation_settings);
  if (!canRequestNoveltyReplacement(previousAttempt)) {
    await creationRepo().updateCandidate(scope, previous.id, {
      generation_settings: {
        ...(previous.generation_settings ?? {}),
        slotExhausted: true,
      },
    });
    throw new PersonaDomainError(SLOT_EXHAUSTED_MESSAGE, "WORKFLOW", {
      slotExhausted: true,
      attemptNumber: previousAttempt,
    });
  }

  const nextAttempt = previousAttempt + 1;
  const slotLabel =
    ["A", "B", "C", "D"][previous.candidate_number - 1] ??
    String(previous.candidate_number);
  const generationRunId = readGenerationRunIdFromSettings(
    previous.generation_settings,
    previous.provider_job_id ?? project.id,
  );

  const archetypeId =
    parseArchetypeIdFromProjectDescription(project.description) ??
    "arch-mediterranean-premium-hero";
  const slot = slotForCandidateNumber(previous.candidate_number);
  const slotBlueprint = resolveSlotBlueprint({ archetypeId, slot });
  const contract = buildNoveltyBlockIdentityRetryContract({
    previousAttemptNumber: previousAttempt,
    slotBlueprint,
    generationRunId,
    creationProjectId: projectId,
  });
  if (contract.slotExhausted) {
    throw new PersonaDomainError(SLOT_EXHAUSTED_MESSAGE, "WORKFLOW", {
      slotExhausted: true,
    });
  }

  const qualityMode = project.quality_mode ?? DEFAULT_QUALITY_MODE;
  const mult = getQualityModeProfile(qualityMode).costMultiplier;
  const estimatedMin = Number((OPENAI_IMAGE_COST_EUR_MIN * mult).toFixed(4));
  const estimatedMax = Number((OPENAI_IMAGE_COST_EUR_MAX * mult).toFixed(4));
  const retryEstimate: CandidateGenerationCostEstimate = {
    available: true,
    provider: "openai",
    providerMode: project.provider_mode,
    candidateCount: 1,
    imagesPerCandidate: 1,
    totalImages: 1,
    estimatedMin,
    estimatedMax,
    estimatedTotal: estimatedMax,
    currency: "EUR",
    stage: project.generation_stage,
    note: "novelty_replacement",
    costStatus: "estimated",
    castingPhase: "a1_discovery",
  };
  const currentHash = estimateFingerprintFromCost(
    projectId,
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

  // Idempotent resume: same token already consumed → return existing job outcome.
  if (confirmation.consumed_at) {
    const existingJobId = confirmation.generation_job_id;
    const existingJob = existingJobId
      ? await jobRepo().getJob(scope, existingJobId)
      : null;
    if (existingJob && existingJob.confirmation_payload?.noveltyReplacement) {
      const payload = existingJob.confirmation_payload;
      const newCandidateId =
        typeof payload.newCandidateId === "string"
          ? payload.newCandidateId
          : null;
      if (newCandidateId) {
        const existingCandidate = await creationRepo().getCandidate(
          scope,
          newCandidateId,
        );
        if (existingCandidate) {
          const slotExhausted =
            existingCandidate.status === "novelty_blocked" &&
            (Boolean(existingCandidate.generation_settings?.slotExhausted) ||
              readIdentityAttemptNumber(existingCandidate.generation_settings) >=
                MAX_DISCOVERY_IDENTITY_ATTEMPTS);
          const outcome = mapFinalStatusToOutcome({
            finalCandidateStatus: existingCandidate.status,
            slotExhausted,
          });
          if (outcome !== "failed") {
            checkpoints.push("response_returned");
            return {
              ok: true,
              status: outcome,
              projectId,
              slot: slotLabel,
              previousCandidateId: previous.id,
              newCandidateId,
              replacementJobId: existingJob.id,
              attemptNumber: nextAttempt,
              maxAttempts: MAX_DISCOVERY_IDENTITY_ATTEMPTS,
              noveltyDecision:
                typeof payload.noveltyDecision === "string"
                  ? payload.noveltyDecision
                  : null,
              finalCandidateStatus: existingCandidate.status,
              providerStarted: Boolean(payload.providerStartedAt),
              providerCompleted: Boolean(payload.providerCompletedAt),
              durationMs: Date.now() - startedAtMs,
              message: outcomeMessage(outcome),
              checkpoints,
            } satisfies NoveltyReplacementSuccessResponse;
          }
        }
      }
      if (
        existingJob.status === "generating" ||
        existingJob.status === "queued"
      ) {
        throw new PersonaDomainError(
          "Generate New Face is already running for this confirmation.",
          "WORKFLOW",
          {
            replacementInProgress: true,
            replacementJobId: existingJob.id,
            slot: slotLabel,
          },
        );
      }
    }
    throw new PersonaDomainError(
      "Bestätigung wurde bereits verwendet — neue Kostenschätzung erforderlich.",
      "WORKFLOW",
      { reusedConfirmation: true },
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
  assertValidUiAttestation({
    attestation: options.attestation ?? UI_CHECKBOX_ATTESTATION,
    userConfirmedAt: options.userConfirmedAt,
    confirmation,
    request: options.httpRequest,
  });
  assertValidUserConfirmationTimestamp(options.userConfirmedAt, confirmation);
  assertLivePaidProviderInvocationAllowed({
    estimatedMaxEur: retryEstimate.estimatedMax,
  });
  checkpoints.push("confirmation_validated");
  logNoveltyReplacementCheckpoint("confirmation_validated", {
    projectId,
    slot: slotLabel,
    previousCandidateId: previous.id,
    attemptNumber: nextAttempt,
  });

  // Reject a second active replacement for the same slot.
  const existingJobs = await jobRepo().listJobsForProject(scope, projectId);
  const activeSameSlot = existingJobs.find((j) => {
    if (!j.confirmation_payload?.noveltyReplacement) return false;
    if (j.status !== "generating" && j.status !== "queued") return false;
    const payloadSlot = j.confirmation_payload.slot;
    const payloadCandidateId = j.confirmation_payload.candidateId;
    return (
      payloadSlot === slotLabel ||
      payloadCandidateId === previous.id ||
      j.candidate_id === previous.id
    );
  });
  if (activeSameSlot) {
    throw new PersonaDomainError(
      `A Generate New Face job is already active for Slot ${slotLabel}.`,
      "WORKFLOW",
      {
        replacementInProgress: true,
        replacementJobId: activeSameSlot.id,
        slot: slotLabel,
      },
    );
  }

  const consumed = await jobRepo().consumeConfirmation(
    scope,
    options.confirmationToken,
  );

  const generator = getPersonaCandidateGenerator(project.provider_mode);
  if (!generator.isConfigured()) {
    throw new PersonaDomainError("Provider nicht eingerichtet.", "CONFIG");
  }
  assertLiveCastingProviderNotFake(generator.id, {
    liveUiAttestation: Boolean(options.attestation),
  });

  const durableJob = consumed.generation_job_id
    ? (await jobRepo().getJob(scope, consumed.generation_job_id)) ?? null
    : null;
  const providerStartedAt = new Date().toISOString();
  const job =
    durableJob ??
    (await jobRepo().createJob(scope, {
      creation_project_id: projectId,
      candidate_id: previous.id,
      stage: project.generation_stage,
      provider: retryEstimate.provider,
      status: "generating",
      requested_asset_types: ["portrait_front"],
      quality_mode: qualityMode,
      estimated_cost_min: estimatedMin,
      estimated_cost_max: estimatedMax,
      cost_is_estimated: true,
      retry_count: nextAttempt,
      confirmation_token: options.confirmationToken,
      estimate_hash: currentHash,
      confirmation_payload: {
        userConfirmedAt: options.userConfirmedAt,
        attestation: UI_CHECKBOX_ATTESTATION,
        intent: "novelty_replacement",
        noveltyReplacement: true,
        slot: slotLabel,
        candidateId: previous.id,
        previousAttemptNumber: previousAttempt,
        nextAttemptNumber: nextAttempt,
        maxAttempts: MAX_DISCOVERY_IDENTITY_ATTEMPTS,
        reason: NOVELTY_REPLACEMENT_REASON,
        providerStartedAt,
      },
      confirmed_at: new Date().toISOString(),
      started_at: providerStartedAt,
      created_by: scope.actorId,
    }));

  await jobRepo().updateJob(scope, job.id, {
    status: "generating",
    confirmed_at: job.confirmed_at ?? new Date().toISOString(),
    started_at: job.started_at ?? providerStartedAt,
    confirmation_payload: {
      ...job.confirmation_payload,
      userConfirmedAt: options.userConfirmedAt,
      attestation: UI_CHECKBOX_ATTESTATION,
      intent: "novelty_replacement",
      noveltyReplacement: true,
      slot: slotLabel,
      candidateId: previous.id,
      previousAttemptNumber: previousAttempt,
      nextAttemptNumber: nextAttempt,
      maxAttempts: MAX_DISCOVERY_IDENTITY_ATTEMPTS,
      reason: NOVELTY_REPLACEMENT_REASON,
      providerStartedAt,
    },
  });
  checkpoints.push("replacement_job_loaded");
  logNoveltyReplacementCheckpoint("replacement_job_loaded", {
    projectId,
    slot: slotLabel,
    replacementJobId: job.id,
    previousCandidateId: previous.id,
    attemptNumber: nextAttempt,
  });

  const previousSample = extractAnatomySampleFromSettings(
    previous.generation_settings,
  );
  const debug = previous.generation_settings?.faceNoveltyLiveDebug as
    | {
        closestPriorCandidateId?: string;
        closestPriorAssetId?: string;
        similarity?: number;
      }
    | undefined;
  const matchedCandidateId = debug?.closestPriorCandidateId ?? null;
  let matchedProjectId: string | null = null;
  let matchedCandidateNumber: number | null = null;
  let avoidSameRunSample: Record<string, string> | null = null;
  if (matchedCandidateId) {
    try {
      const matched = await creationRepo().getCandidate(scope, matchedCandidateId);
      if (matched) {
        matchedProjectId = matched.creation_project_id;
        matchedCandidateNumber = matched.candidate_number;
        if (matched.creation_project_id === projectId) {
          avoidSameRunSample =
            (extractAnatomySampleFromSettings(matched.generation_settings) as
              | Record<string, string>
              | null) ?? null;
        }
      }
    } catch {
      // matched prior may be historical — ignore sample load failures
    }
  }
  const { matchedSameRun, matchedSlot } = resolveMatchedSameRunSlot({
    matchedCandidateId,
    matchedProjectId,
    currentProjectId: projectId,
    matchedCandidateNumber,
  });

  checkpoints.push("provider_generation_started");
  logNoveltyReplacementCheckpoint("provider_generation_started", {
    projectId,
    slot: slotLabel,
    replacementJobId: job.id,
    attemptNumber: nextAttempt,
    providerStarted: true,
  });

  let batch;
  try {
    batch = await generator.createCandidateBatch({
      project: { ...project, candidate_count: 1 },
      stage: project.generation_stage,
      costConfirmed: true,
      retryConfirmed: true,
      qualityMode,
      castingPhase: "a1_discovery",
      assetTypes: ["portrait_front"],
      candidateNumbers: [previous.candidate_number],
      generationRunId: contract.keepGenerationRunId,
      identityAttemptNumber: contract.nextAttemptNumber,
      previousAttemptSample: previousSample as Record<string, string> | null,
      avoidSameRunSample,
      replacementOfCandidateId: previous.id,
      replacementReason: NOVELTY_REPLACEMENT_REASON,
      concurrency: 1,
    });
  } catch (err) {
    const safeErrorMessage =
      err instanceof Error ? err.message : "Provider generation failed";
    await jobRepo().updateJob(scope, job.id, {
      status: "failed",
      error_code: "provider_exception",
      error_message: safeErrorMessage,
      completed_at: new Date().toISOString(),
      confirmation_payload: {
        ...(job.confirmation_payload ?? {}),
        providerStartedAt,
        providerCompletedAt: null,
        safeErrorCode: "provider_exception",
        safeErrorMessage,
      },
    });
    throw err instanceof PersonaDomainError
      ? err
      : new PersonaDomainError(safeErrorMessage, "WORKFLOW", {
          safeErrorCode: "provider_exception",
          providerStarted: true,
          providerCompleted: false,
          replacementJobId: job.id,
        });
  }

  const providerCompletedAt = new Date().toISOString();
  checkpoints.push("provider_generation_completed");
  logNoveltyReplacementCheckpoint("provider_generation_completed", {
    projectId,
    slot: slotLabel,
    replacementJobId: job.id,
    providerCompleted: true,
  });

  const result = batch.results[0];
  if (!result?.assets.length) {
    await jobRepo().updateJob(scope, job.id, {
      status: "failed",
      error_code: "provider_empty_result",
      error_message: batch.errorMessage ?? "Novelty replacement failed",
      completed_at: new Date().toISOString(),
      confirmation_payload: {
        ...(job.confirmation_payload ?? {}),
        providerStartedAt,
        providerCompletedAt,
        safeErrorCode: "provider_empty_result",
        safeErrorMessage: batch.errorMessage ?? "Novelty replacement failed",
      },
    });
    throw new PersonaDomainError("Generierung fehlgeschlagen", "WORKFLOW", {
      safeErrorCode: "provider_empty_result",
      providerStarted: true,
      providerCompleted: true,
      replacementJobId: job.id,
    });
  }

  const officialCast = resolveOfficialDiscoveryVariations({
    project,
    candidateNumbers: [previous.candidate_number],
  });
  const variation =
    officialCast.variations[0] ??
    resolveCandidateVariation(previous.candidate_number);
  const qualityAssessment = assessCandidateQuality({
    project,
    variation,
    assetTypes: result.assets.map((a) => a.assetType),
    qualityMode,
  });
  const qualityFields = qualityFieldsForCandidate(qualityAssessment);

  const attemptRecord = buildNoveltyReplacementAttemptRecord({
    attemptNumber: nextAttempt,
    replacementOfCandidateId: previous.id,
    replacementReason: NOVELTY_REPLACEMENT_REASON,
    matchedCandidateId,
    matchedProjectId,
    matchedSlot,
    matchedSameRun,
    anatomyFingerprint: String(
      (result.settings?.discoveryIdentity as { anatomyFingerprint?: string })
        ?.anatomyFingerprint ?? "",
    ),
    identityFingerprint: String(
      (result.settings?.discoveryIdentity as { identityFingerprint?: string })
        ?.identityFingerprint ?? "",
    ),
    promptFingerprint: String(
      (result.settings?.discoveryIdentity as { promptFingerprint?: string })
        ?.promptFingerprint ?? "",
    ),
    samplingSeed: String(
      (result.settings?.discoveryIdentity as { samplingSeed?: string })
        ?.samplingSeed ?? "",
    ),
    providerRequestId: null,
    providerOutputId: result.assets[0]?.providerOutputId ?? null,
    noveltyDecision: null,
    similarityScore: null,
    slotBlueprintId: slotBlueprint.id,
    generationRunId: contract.keepGenerationRunId,
  });

  const enrichedSettings: Record<string, unknown> = {
    ...result.settings,
    qualityAssessment,
    generationRunId: contract.keepGenerationRunId,
    identityAttemptNumber: nextAttempt,
    replacementOfCandidateId: previous.id,
    replacementReason: NOVELTY_REPLACEMENT_REASON,
    matchedCandidateId,
    matchedProjectId,
    matchedSlot,
    matchedSameRun,
    noveltyReplacementAttempt: attemptRecord,
    noveltyReplacementHistory: [
      ...((Array.isArray(previous.generation_settings?.noveltyReplacementHistory)
        ? previous.generation_settings?.noveltyReplacementHistory
        : []) as unknown[]),
      attemptRecord,
    ],
  };

  // Keep board scoped to the original discovery run job id.
  const boardGenerationRunId =
    previous.provider_job_id ?? contract.keepGenerationRunId;

  const isLiveProvider = creationRepo().kind !== "memory";
  const initialStatus = isLiveProvider ? "generating" : "ready";

  const displayName =
    typeof (result.settings as { variation?: { label?: string } }).variation
      ?.label === "string"
      ? (result.settings as { variation: { label: string } }).variation.label
      : previous.candidate_name;

  const replacement = await creationRepo().createCandidate(scope, {
    creation_project_id: projectId,
    candidate_number: previous.candidate_number,
    candidate_name: displayName,
    status: initialStatus,
    provider: batch.provider,
    provider_job_id: boardGenerationRunId,
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
    parent_candidate_id: previous.id,
  });
  checkpoints.push("candidate_created");
  logNoveltyReplacementCheckpoint("candidate_created", {
    projectId,
    slot: slotLabel,
    previousCandidateId: previous.id,
    newCandidateId: replacement.id,
    replacementJobId: job.id,
  });

  let primaryId: string | null = null;
  for (const asset of result.assets) {
    const assetId = randomUUID();
    const uploaded =
      creationRepo().kind === "memory"
        ? buildPersonaCandidateAssetMetadata({
            workspaceId: scope.workspaceId,
            projectId,
            candidateId: replacement.id,
            assetId,
            filename: `${asset.assetType}-replacement.png`,
            bytes: asset.imageBytes,
            mimeType: asset.mimeType,
          })
        : await uploadPersonaCandidateBytes({
            workspaceId: scope.workspaceId,
            projectId,
            candidateId: replacement.id,
            assetId,
            filename: `${asset.assetType}-replacement.png`,
            bytes: asset.imageBytes,
            mimeType: asset.mimeType,
          });
    const created = await creationRepo().createCandidateAsset(scope, {
      candidate_id: replacement.id,
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
        noveltyReplacement: true,
        attemptNumber: nextAttempt,
        costLabel: "estimated",
      },
      status: "ready",
      is_primary: asset.assetType === "portrait_front",
    });
    if (created.is_primary) primaryId = created.id;
  }
  if (primaryId) {
    await creationRepo().updateCandidate(scope, replacement.id, {
      primary_preview_asset_id: primaryId,
    });
  }
  checkpoints.push("asset_created");
  logNoveltyReplacementCheckpoint("asset_created", {
    projectId,
    slot: slotLabel,
    newCandidateId: replacement.id,
    replacementJobId: job.id,
  });

  // Preserve previous blocked candidate; hide from board failure slots.
  await creationRepo().updateCandidate(scope, previous.id, {
    generation_settings: {
      ...(previous.generation_settings ?? {}),
      boardSupersededByReplacement: true,
      replacedByCandidateId: replacement.id,
    },
  });

  let finalStatus: CandidateStatus =
    initialStatus === "ready" ? "ready" : "novelty_failed";
  let similarityScore: number | null = null;
  let noveltyDecision: string | null = initialStatus === "ready" ? "allowed" : null;

  if (isLiveProvider && primaryId) {
    try {
      checkpoints.push("novelty_evaluation_started");
      logNoveltyReplacementCheckpoint("novelty_evaluation_started", {
        projectId,
        slot: slotLabel,
        newCandidateId: replacement.id,
      });
      const noveltyRepo = new SupabaseNoveltyRepository();
      const embeddingRepo = new SupabaseEmbeddingRepository();
      const diagnosticStore = new SupabaseLiveDiagnosticStore();
      const noveltyHistory = await loadDiscoveryHistory(
        noveltyRepo,
        scope.workspaceId,
        archetypeId,
      );
      const dataUrl = `data:${result.assets[0]!.mimeType};base64,${Buffer.from(result.assets[0]!.imageBytes).toString("base64")}`;
      const imgMap = new Map<string, string>([[primaryId, dataUrl]]);
      const liveEvaluator = await buildLiveFaceEvaluator({
        workspaceId: scope.workspaceId,
        archetypeId,
        imageSourceMap: imgMap,
      });
      assertLiveFaceEvaluatorNotNull(
        liveEvaluator,
        `novelty_replacement candidate=${replacement.id}`,
      );
      const priorEmbeddingsLoaded = (
        await embeddingRepo.loadEmbeddingsForWorkspace(
          scope.workspaceId,
          archetypeId,
        )
      ).length;

      const identityFingerprint = buildIdentityFingerprint({
        archetypeId,
        blueprintId: slotBlueprint.id,
        runVariationToken: officialCast.runVariationToken ?? undefined,
        faceGeometry: variation.faceGeometry,
        jawShape: variation.jawShape,
        noseShape: variation.noseShape,
        eyeShape: variation.eyeShape,
        lipShape: variation.lipShape,
        hairTexture: variation.hairTexture,
        haircut: variation.haircut,
        facialHair: variation.facialHair,
        bodyStructure: variation.bodyBuild,
        skinTone: variation.skinTone,
        ancestryDirection: variation.identityDescriptor,
      });

      const noveltyCheck = await checkAndRegisterCandidate(
        noveltyRepo,
        noveltyHistory,
        {
          workspaceId: scope.workspaceId,
          archetypeId,
          creationProjectId: projectId,
          candidateId: replacement.id,
          assetId: primaryId,
          identityFingerprint,
          visualFingerprint: buildVisualFingerprint({}),
          signedUrl: dataUrl,
          sourceProvider: batch.provider,
          sourceModel: batch.provider,
        },
        {
          evaluator: liveEvaluator,
          embeddingRepo,
          diagnosticStore,
          priorEmbeddingsLoaded,
          slot: previous.candidate_number,
          evaluatorActive: true,
        },
      );

      finalStatus = noveltyCheck.candidateStatus as CandidateStatus;
      noveltyDecision = noveltyCheck.finalDecision ?? null;
      similarityScore =
        typeof noveltyCheck.similarity === "number"
          ? noveltyCheck.similarity
          : null;

      assertCandidateMayBecomeReady({
        proposedStatus: finalStatus,
        evaluationStatus: noveltyCheck.evaluationStatus,
        finalDecision: noveltyCheck.finalDecision,
        detectionStatus: noveltyCheck.detectionStatus,
      });

      const slotExhausted =
        finalStatus === "novelty_blocked" &&
        nextAttempt >= MAX_DISCOVERY_IDENTITY_ATTEMPTS;

      const updatedAttempt = {
        ...attemptRecord,
        noveltyDecision,
        similarityScore,
        slotExhausted,
        matchedCandidateId:
          noveltyCheck.liveDebug?.closestPriorCandidateId ?? matchedCandidateId,
      };

      const settingsWithDebug = maybeAttachNoveltyDebugToSettings(
        {
          ...enrichedSettings,
          noveltyReplacementAttempt: updatedAttempt,
          slotExhausted,
        },
        noveltyCheck.liveDebug ?? null,
      );

      await creationRepo().updateCandidate(scope, replacement.id, {
        status: finalStatus,
        generation_settings: settingsWithDebug,
        rejection_reason:
          finalStatus === "ready"
            ? ""
            : slotExhausted
              ? SLOT_EXHAUSTED_MESSAGE
              : (noveltyCheck.replacementMessage ?? "novelty_protection"),
        user_notes:
          finalStatus === "ready"
            ? ""
            : `[novelty] ${noveltyCheck.hardRejectReason ?? noveltyCheck.finalDecision}`,
      });
      checkpoints.push("novelty_evaluation_completed");
      checkpoints.push("candidate_status_persisted");
      logNoveltyReplacementCheckpoint("novelty_evaluation_completed", {
        projectId,
        slot: slotLabel,
        newCandidateId: replacement.id,
        noveltyDecision: noveltyDecision ?? null,
        finalCandidateStatus: finalStatus,
      });

      if (noveltyCheck.finalDecision === "allowed") {
        await markCandidateShown(
          noveltyRepo,
          noveltyCheck.recordId,
          scope.workspaceId,
        );
      }
    } catch (err) {
      await creationRepo().updateCandidate(scope, replacement.id, {
        status: "novelty_failed",
        rejection_reason:
          err instanceof Error ? err.message : "novelty_evaluation_failed",
      });
      finalStatus = "novelty_failed";
      checkpoints.push("novelty_evaluation_completed");
      checkpoints.push("candidate_status_persisted");
    }
  } else if (!isLiveProvider) {
    checkpoints.push("novelty_evaluation_completed");
    checkpoints.push("candidate_status_persisted");
  }

  await creationRepo().updateProject(scope, projectId, {
    actual_cost: Number((project.actual_cost + batch.actualCostEur).toFixed(4)),
  });

  const slotExhausted =
    finalStatus === "novelty_blocked" &&
    nextAttempt >= MAX_DISCOVERY_IDENTITY_ATTEMPTS;
  const outcome = mapFinalStatusToOutcome({
    finalCandidateStatus: finalStatus,
    slotExhausted,
  });
  if (outcome === "failed") {
    await jobRepo().updateJob(scope, job.id, {
      status: "failed",
      actual_cost: batch.actualCostEur,
      completed_at: new Date().toISOString(),
      error_code: "novelty_failed",
      error_message: "Face novelty evaluation failed for replacement.",
      confirmation_payload: {
        ...(job.confirmation_payload ?? {}),
        providerStartedAt,
        providerCompletedAt,
        newCandidateId: replacement.id,
        noveltyDecision,
        finalCandidateStatus: finalStatus,
        safeErrorCode: "novelty_failed",
        safeErrorMessage: "Face novelty evaluation failed for replacement.",
      },
    });
    checkpoints.push("response_returned");
    return {
      ok: false,
      status: "failed",
      projectId,
      slot: slotLabel,
      previousCandidateId: previous.id,
      newCandidateId: replacement.id,
      replacementJobId: job.id,
      attemptNumber: nextAttempt,
      providerStarted: true,
      providerCompleted: true,
      safeErrorCode: "novelty_failed",
      safeErrorMessage: "Face novelty evaluation failed for replacement.",
      durationMs: Date.now() - startedAtMs,
      checkpoints,
    };
  }

  await jobRepo().updateJob(scope, job.id, {
    status: "completed",
    actual_cost: batch.actualCostEur,
    completed_at: new Date().toISOString(),
    confirmation_payload: {
      ...(job.confirmation_payload ?? {}),
      providerStartedAt,
      providerCompletedAt,
      newCandidateId: replacement.id,
      noveltyDecision,
      finalCandidateStatus: finalStatus,
      attemptNumber: nextAttempt,
      slot: slotLabel,
      slotExhausted,
    },
  });

  checkpoints.push("response_returned");
  logNoveltyReplacementCheckpoint("response_returned", {
    projectId,
    slot: slotLabel,
    newCandidateId: replacement.id,
    replacementJobId: job.id,
    attemptNumber: nextAttempt,
    noveltyDecision: noveltyDecision ?? null,
    finalCandidateStatus: finalStatus,
    durationMs: Date.now() - startedAtMs,
  });

  return {
    ok: true,
    status: outcome,
    projectId,
    slot: slotLabel,
    previousCandidateId: previous.id,
    newCandidateId: replacement.id,
    replacementJobId: job.id,
    attemptNumber: nextAttempt,
    maxAttempts: MAX_DISCOVERY_IDENTITY_ATTEMPTS,
    noveltyDecision,
    finalCandidateStatus: finalStatus,
    providerStarted: true,
    providerCompleted: true,
    durationMs: Date.now() - startedAtMs,
    message: outcomeMessage(outcome),
    checkpoints,
  };
}

export async function listGenerationJobsForProject(
  scope: WorkspaceScope,
  projectId: string,
) {
  await requireProject(scope, projectId);
  await reconcileStaleNoveltyReplacementJobs(scope, projectId);
  return jobRepo().listJobsForProject(scope, projectId);
}

/**
 * Phase 2.1E.2 — Mark abandoned novelty replacement jobs as stale_failed.
 * Never starts a provider call. Never reuses confirmation tokens.
 */
export async function reconcileStaleNoveltyReplacementJobs(
  scope: WorkspaceScope,
  projectId: string,
  nowMs = Date.now(),
): Promise<{
  reconciledJobIds: string[];
  activeNoveltyReplacements: ReturnType<typeof readActiveNoveltyReplacements>;
  slotReplacementStates: ReturnType<typeof resolveSlotReplacementStates>;
}> {
  const jobs = await jobRepo().listJobsForProject(scope, projectId);
  const reconciledJobIds: string[] = [];
  const nowIso = new Date(nowMs).toISOString();

  for (const job of jobs) {
    if (!isNoveltyReplacementJob(job)) continue;
    const { stale } = evaluateReplacementJobStaleness(job, nowMs);
    if (!stale) continue;
    if (job.status === "failed" || job.status === "completed") continue;

    await jobRepo().updateJob(scope, job.id, {
      status: "failed",
      error_code: "replacement_job_stale",
      error_message:
        "The previous face-generation job stopped unexpectedly and is no longer running.",
      completed_at: nowIso,
      confirmation_payload: buildStaleFailurePayload(
        job.confirmation_payload ?? {},
        nowIso,
      ),
    });
    reconciledJobIds.push(job.id);
    logNoveltyReplacementCheckpoint("response_returned", {
      projectId,
      replacementJobId: job.id,
      safeErrorCode: "replacement_job_stale",
      recoveredFromStaleState: true,
    });
  }

  const refreshed = await jobRepo().listJobsForProject(scope, projectId);
  return {
    reconciledJobIds,
    activeNoveltyReplacements: readActiveNoveltyReplacements(refreshed, nowMs),
    slotReplacementStates: resolveSlotReplacementStates(refreshed, nowMs),
  };
}

/**
 * Explicit status endpoint helper for client polling timeout reconciliation.
 */
export async function getNoveltyReplacementJobStatus(
  scope: WorkspaceScope,
  projectId: string,
  jobId?: string,
) {
  const reconciled = await reconcileStaleNoveltyReplacementJobs(scope, projectId);
  const jobs = await jobRepo().listJobsForProject(scope, projectId);
  const job = jobId
    ? jobs.find((j) => j.id === jobId) ?? null
    : reconciled.activeNoveltyReplacements[0]
      ? jobs.find((j) => j.id === reconciled.activeNoveltyReplacements[0]!.jobId) ??
        null
      : null;
  return {
    projectId,
    reconciledJobIds: reconciled.reconciledJobIds,
    activeNoveltyReplacements: reconciled.activeNoveltyReplacements,
    slotReplacementStates: reconciled.slotReplacementStates,
    job: job
      ? {
          id: job.id,
          status: job.status,
          errorCode: job.error_code,
          errorMessage: job.error_message,
          startedAt: job.started_at,
          completedAt: job.completed_at,
          confirmedAt: job.confirmed_at,
          providerStartedAt:
            typeof job.confirmation_payload?.providerStartedAt === "string"
              ? job.confirmation_payload.providerStartedAt
              : null,
          providerCompletedAt:
            typeof job.confirmation_payload?.providerCompletedAt === "string"
              ? job.confirmation_payload.providerCompletedAt
              : null,
          recoveredFromStaleState:
            job.confirmation_payload?.recoveredFromStaleState === true,
          slot:
            typeof job.confirmation_payload?.slot === "string"
              ? job.confirmation_payload.slot
              : null,
        }
      : null,
  };
}

export async function listCandidates(scope: WorkspaceScope, projectId: string) {
  await requireProject(scope, projectId);
  const candidates = await creationRepo().listCandidates(scope, projectId);
  assertCandidatesBelongToProject(candidates, projectId);
  return candidates.map((c) => {
    const existingDebug = c.generation_settings?.faceNoveltyLiveDebug as
      | import("../face-novelty-memory/live-debug").SafeFaceNoveltyLiveDebug
      | undefined;
    return {
      ...c,
      generation_settings: maybeAttachNoveltyDebugToSettings(
        c.generation_settings ?? {},
        existingDebug ?? null,
      ),
    };
  });
}

/**
 * Candidate Board payload — fail-closed.
 * Only candidates belonging to the current completed generation run are eligible.
 * Only ready + performed + allowed candidates include images / selectable payload.
 * Failed/blocked return as safe failure-slot DTOs (no signed URLs).
 */
export async function listCandidateBoardPayload(
  scope: WorkspaceScope,
  projectId: string,
): Promise<{
  candidates: PersonaCandidate[];
  noveltyFailureSlots: NoveltyFailureSlotDto[];
  candidatePreviews: Record<string, string | null>;
  generationRunId: string | null;
  activeNoveltyReplacements: ReturnType<typeof readActiveNoveltyReplacements>;
  slotReplacementStates: ReturnType<typeof resolveSlotReplacementStates>;
  freshness: {
    creationProjectId: string;
    generationRunId: string | null;
    candidateIds: string[];
    assetIds: (string | null)[];
    providerJobIds: (string | null)[];
  };
}> {
  const reconciled = await reconcileStaleNoveltyReplacementJobs(scope, projectId);
  const jobs = await jobRepo().listJobsForProject(scope, projectId);
  const generationRunId = resolveCurrentGenerationRunId(jobs);
  const all = await listCandidates(scope, projectId);
  const runScoped = generationRunId
    ? filterCandidatesForGenerationRun(all, generationRunId)
    : [];
  const { visibleCandidates, failureSlots } = partitionBoardCandidates(runScoped);
  const candidatePreviews = await signPreviewsForVisibleCandidates(
    scope,
    projectId,
    visibleCandidates,
  );
  const freshness = {
    creationProjectId: projectId,
    generationRunId,
    candidateIds: visibleCandidates.map((c) => c.id),
    assetIds: visibleCandidates.map((c) => c.primary_preview_asset_id),
    providerJobIds: visibleCandidates.map((c) => c.provider_job_id),
  };
  logCastingFlowTrace("board.payload", {
    creationProjectId: projectId,
    workspaceId: scope.workspaceId,
    generationRequestId: generationRunId,
    candidateIds: freshness.candidateIds,
    assetIds: freshness.assetIds.filter((id): id is string => Boolean(id)),
    source: generationRunId ? "live_openai" : "unknown",
  });
  return {
    candidates: visibleCandidates,
    noveltyFailureSlots: failureSlots,
    candidatePreviews,
    generationRunId,
    activeNoveltyReplacements: reconciled.activeNoveltyReplacements,
    slotReplacementStates: reconciled.slotReplacementStates,
    freshness,
  };
}

export async function listCandidatesForProject(
  scope: WorkspaceScope,
  projectId: string,
) {
  // Board-facing listing: never return non-visible novelty candidates as cards.
  const board = await listCandidateBoardPayload(scope, projectId);
  return board.candidates;
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
    if (
      candidate.status === "novelty_failed" ||
      candidate.status === "novelty_blocked"
    ) {
      throw new PersonaDomainError(
        "Novelty-blocked or failed candidates cannot be shortlisted.",
        "WORKFLOW",
      );
    }
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
    if (
      candidate.status === "novelty_failed" ||
      candidate.status === "novelty_blocked"
    ) {
      throw new PersonaDomainError(
        "Novelty-blocked or failed candidates cannot be selected.",
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
  const candidate = await requireCandidate(scope, candidateId);
  // Fail-closed: never return signed image URLs for novelty failed/blocked faces.
  if (
    candidate.status === "novelty_failed" ||
    candidate.status === "novelty_blocked"
  ) {
    return [];
  }

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

async function signPreviewsForVisibleCandidates(
  scope: WorkspaceScope,
  projectId: string,
  visibleCandidates: PersonaCandidate[],
): Promise<Record<string, string | null>> {
  const previews: Record<string, string | null> = {};
  for (const candidate of visibleCandidates) {
    previews[candidate.id] = null;
    if (!candidate.primary_preview_asset_id) continue;
    try {
      const asset = await creationRepo().getCandidateAsset(
        scope,
        candidate.primary_preview_asset_id,
      );
      if (!asset || asset.candidate_id !== candidate.id) continue;
      const signed = await createPersonaCandidateSignedUrl(asset.storage_path);
      const url = appendAssetCacheBust(signed.signedUrl, asset.id);
      previews[candidate.id] = url;
      previews[
        projectScopedPreviewKey(projectId, candidate.id, asset.id)
      ] = url;
    } catch {
      previews[candidate.id] = null;
    }
  }
  return previews;
}

/** Primary portrait signed URLs for the candidate board (additive API field). */
export async function listCandidateBoardPreviews(
  scope: WorkspaceScope,
  projectId: string,
): Promise<Record<string, string | null>> {
  const board = await listCandidateBoardPayload(scope, projectId);
  return board.candidatePreviews;
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
