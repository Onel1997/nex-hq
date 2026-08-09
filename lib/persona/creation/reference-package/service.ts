/**
 * Phase 2.3D — Controlled Reference Package generation around Master Identity.
 *
 * - OpenAI images.edit with Master image (no text-only fallback)
 * - Explicit single-use cost confirmation
 * - Per-angle durable attempts + identity consistency gate
 * - Never replaces Master Identity Reference
 * - Never auto Identity Lock / approve
 */

import { createHash, randomUUID } from "node:crypto";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type { PersonaReferenceAsset } from "@/lib/persona/domain/types";
import { getPersonaRepository } from "@/lib/persona/repositories/factory";
import {
  ensureMasterIdentityReferenceFromSelectedCandidate,
  getMasterIdentityReferenceForPersona,
  isMasterIdentityReference,
} from "@/lib/persona/creation/master-identity-reference";
import { downloadPersonaCandidateBytes } from "@/lib/persona/creation/candidate-storage";
import {
  buildPersonaReferenceStoragePath,
  checksumBytes,
  extractImageDimensions,
  uploadPersonaReferenceBytes,
} from "@/lib/persona/storage/reference-storage";
import { extractFaceEmbedding } from "@/lib/persona/face-novelty-memory/local-face-embedding-evaluator";
import {
  OPENAI_IMAGE_COST_EUR_MAX,
  OPENAI_IMAGE_COST_EUR_MIN,
} from "@/lib/persona/creation/provider/cost";
import { createConfirmationToken } from "@/lib/persona/creation/paid-confirmation";
import {
  assertStageBUsesImageReferencePath,
  editOpenAiImageFromReference,
  OPENAI_STAGE_B_IMAGE_EDIT_PATH,
} from "@/agents/image/providers/openai-images-edit-provider";
import {
  evaluateIdentityConsistency,
  isIdentityAcceptedForPackage,
  type IdentityConsistencyEvaluation,
} from "./identity-consistency";
import { buildReferencePackageAnglePromptDetailed } from "./prompts";
import {
  getReferencePackageRepository,
  type ReferencePackageRepository,
} from "./repository";
import {
  assertSlotMayBeRegenerated,
  resolveReferencePackageSlotCoverage,
  slotsNeedingGenerationFromCoverage,
} from "./coverage";
import {
  isAngleDirectionUsable,
  validateAngleDirectionFromOrientation,
  validateAngleDirectionFromPrompt,
  type AngleDirectionValidation,
} from "./angle-direction";
import { extractFaceOrientationFromImageBytes } from "./extract-orientation";
import type { OrientationEstimate } from "./orientation-from-landmarks";
import {
  DIRECTION_GENERATION_UNRELIABLE_MESSAGE,
  resolveProviderDirectionPlan,
  type ProviderDirectionPlan,
} from "./provider-direction-fallback";
import {
  REFERENCE_PACKAGE_SLOTS,
  REFERENCE_PACKAGE_SLOT_LABELS,
  isReferencePackageSlot,
  slotToReferenceMeta,
  type ReferencePackageSlot,
  type ReferencePackageAttemptStatus,
} from "./slots";
import {
  buildReferencePackageAssetNotes,
  getAttemptEffectiveSlot,
  type ReferencePackageAttempt,
  type ReferencePackageSession,
  type ReferencePackageSlotView,
  type ReferencePackageStatusView,
} from "./types";

export type ReferencePackageCostEstimate = {
  currency: "EUR";
  provider: "openai";
  imageCount: number;
  slots: ReferencePackageSlot[];
  estimatedMin: number;
  estimatedMax: number;
  maxAuthorizedSpend: number;
  note: string;
  imageEditPath: typeof OPENAI_STAGE_B_IMAGE_EDIT_PATH;
  textOnlyFallbackForbidden: true;
};

export type ReferencePackageDeps = {
  repo?: ReferencePackageRepository;
  downloadMasterBytes?: (storagePath: string) => Promise<Buffer>;
  editFromMaster?: typeof editOpenAiImageFromReference;
  extractEmbedding?: typeof extractFaceEmbedding;
  uploadBytes?: typeof uploadPersonaReferenceBytes;
  /**
   * Optional orientation extractor (tests inject fixtures).
   * Defaults to local face-api landmark orientation.
   */
  extractOrientation?: (
    imageBytes: Buffer,
    context?: { slot: ReferencePackageSlot },
  ) => Promise<
    OrientationEstimate & {
      status?: string;
      detectionConfidence?: number;
    }
  >;
  /** When true, skip real OpenAI (tests). */
  skipProviderCalls?: boolean;
};

function toOrientationEstimate(
  raw: OrientationEstimate & {
    status?: string;
    detectionConfidence?: number;
  },
): OrientationEstimate {
  const detected = raw.detected_orientation;
  const noseSide: OrientationEstimate["noseSide"] =
    raw.noseSide ??
    (detected === "image_left" || detected === "profile_left"
      ? "left"
      : detected === "image_right" || detected === "profile_right"
        ? "right"
        : detected === "frontal"
          ? "center"
          : "uncertain");
  const bothEyesVisible =
    raw.bothEyesVisible ??
    (detected === "image_left" ||
      detected === "image_right" ||
      detected === "frontal");
  return {
    detected_orientation: detected,
    detected_yaw_degrees: raw.detected_yaw_degrees,
    noseSide,
    bothEyesVisible,
    noseOffsetNorm: raw.noseOffsetNorm ?? null,
    reason: raw.reason ?? "orientation extracted",
  };
}

function pkgRepo(deps?: ReferencePackageDeps) {
  return deps?.repo ?? getReferencePackageRepository();
}

function personaRepo() {
  return getPersonaRepository();
}

function buildEstimateHash(input: {
  personaId: string;
  masterReferenceId: string;
  imageCount: number;
  estimatedMin: number;
  estimatedMax: number;
}): string {
  const raw = [
    input.personaId,
    input.masterReferenceId,
    "reference_package",
    "openai",
    String(input.imageCount),
    input.estimatedMin.toFixed(4),
    input.estimatedMax.toFixed(4),
  ].join("|");
  return createHash("sha256").update(raw).digest("hex");
}

async function requireMaster(scope: WorkspaceScope, personaId: string) {
  const persona = await personaRepo().getPersona(scope, personaId);
  if (!persona) {
    throw new PersonaDomainError("Persona not found", "NOT_FOUND", { personaId });
  }
  if (persona.source_candidate_id) {
    try {
      await ensureMasterIdentityReferenceFromSelectedCandidate(scope, personaId);
    } catch {
      // best-effort heal
    }
  }
  const master = await getMasterIdentityReferenceForPersona(scope, personaId);
  if (!master) {
    throw new PersonaDomainError(
      "Master Identity Reference required before Stage B Reference Package.",
      "WORKFLOW",
      { personaId },
    );
  }
  return { persona, master };
}

function slotsNeedingGeneration(
  attempts: readonly ReferencePackageAttempt[],
  assets: readonly PersonaReferenceAsset[],
  onlySlot?: ReferencePackageSlot,
): ReferencePackageSlot[] {
  const coverage = resolveReferencePackageSlotCoverage({ attempts, assets });
  return slotsNeedingGenerationFromCoverage(coverage, onlySlot);
}

export function estimateReferencePackageCost(
  slots: readonly ReferencePackageSlot[] = REFERENCE_PACKAGE_SLOTS,
): ReferencePackageCostEstimate {
  const imageCount = slots.length;
  const estimatedMin = Number(
    (imageCount * OPENAI_IMAGE_COST_EUR_MIN).toFixed(4),
  );
  const estimatedMax = Number(
    (imageCount * OPENAI_IMAGE_COST_EUR_MAX).toFixed(4),
  );
  return {
    currency: "EUR",
    provider: "openai",
    imageCount,
    slots: [...slots],
    estimatedMin,
    estimatedMax,
    maxAuthorizedSpend: estimatedMax,
    note:
      "OpenAI images.edit conditioned on Master Identity Reference. " +
      "Text-only fallback forbidden. Explicit confirmation required.",
    imageEditPath: OPENAI_STAGE_B_IMAGE_EDIT_PATH,
    textOnlyFallbackForbidden: true,
  };
}

/**
 * Prepare cost confirmation — NO provider call.
 * When forceExactSlots is set, prepare exactly those slots (slot-only regen).
 */
export async function prepareReferencePackageConfirmation(
  scope: WorkspaceScope,
  personaId: string,
  options?: {
    slots?: ReferencePackageSlot[];
    forceExactSlots?: boolean;
    deps?: ReferencePackageDeps;
  },
) {
  const { persona, master } = await requireMaster(scope, personaId);
  const repo = pkgRepo(options?.deps);
  const attempts = await repo.listAttemptsForPersona(scope, personaId);
  const assets = await personaRepo().listReferenceAssets(scope, personaId);
  const coverage = resolveReferencePackageSlotCoverage({ attempts, assets });

  let slots: ReferencePackageSlot[];
  if (options?.forceExactSlots && options.slots?.length) {
    slots = [...options.slots];
    for (const slot of slots) {
      try {
        assertSlotMayBeRegenerated(coverage, slot);
      } catch (err) {
        throw new PersonaDomainError(
          err instanceof Error ? err.message : "Slot may not be regenerated.",
          "WORKFLOW",
          { slot },
        );
      }
    }
    if (slots.length !== 1 && options.slots.length === 1) {
      // unreachable guard
      slots = [options.slots[0]!];
    }
  } else {
    const needed = slotsNeedingGeneration(
      attempts,
      assets,
      options?.slots?.length === 1 ? options.slots[0] : undefined,
    ).filter((s) =>
      options?.slots?.length ? options.slots.includes(s) : true,
    );
    slots =
      needed.length > 0
        ? needed
        : options?.slots?.length
          ? options.slots
          : [...REFERENCE_PACKAGE_SLOTS];
  }

  if (slots.length === 0) {
    throw new PersonaDomainError(
      "Reference Package already has accepted coverage for requested slots.",
      "WORKFLOW",
    );
  }

  // Never include currently approved slots in a multi-slot prepare.
  // Never include slots where direction generation is unreliable.
  slots = slots.filter((slot) => {
    const row = coverage.slots.find((s) => s.slot === slot);
    if (row?.countsTowardCoverage) return false;
    const plan = resolveProviderDirectionPlan(attempts, slot);
    return plan.allowPaidRegeneration;
  });
  if (slots.length === 0) {
    throw new PersonaDomainError(
      "No regenerable slots — approved references are protected or direction generation is unreliable.",
      "WORKFLOW",
    );
  }

  const estimate = estimateReferencePackageCost(slots);
  const token = createConfirmationToken();
  const estimateHash = buildEstimateHash({
    personaId,
    masterReferenceId: master.reference.id,
    imageCount: estimate.imageCount,
    estimatedMin: estimate.estimatedMin,
    estimatedMax: estimate.estimatedMax,
  });

  const session = await repo.createSession(scope, {
    persona_id: personaId,
    master_reference_id: master.reference.id,
    confirmation_token: token,
    estimate_hash: estimateHash,
    estimated_cost_min: estimate.estimatedMin,
    estimated_cost_max: estimate.estimatedMax,
    max_authorized_spend: estimate.maxAuthorizedSpend,
    image_count: estimate.imageCount,
  });

  return {
    persona,
    masterReferenceId: master.reference.id,
    session,
    estimate,
    confirmationToken: token,
    estimateHash,
    slots,
    providerCalled: false as const,
  };
}

/**
 * Confirm + generate requested angles. Single-use token. No silent re-run.
 */
export async function confirmAndGenerateReferencePackage(
  scope: WorkspaceScope,
  personaId: string,
  options: {
    confirmationToken: string;
    costConfirmed: boolean;
    slots?: ReferencePackageSlot[];
    deps?: ReferencePackageDeps;
  },
) {
  if (!options.costConfirmed) {
    throw new PersonaDomainError(
      "Explizite Kostenbestätigung erforderlich.",
      "WORKFLOW",
    );
  }
  if (!options.confirmationToken?.trim()) {
    throw new PersonaDomainError(
      "Confirmation token required.",
      "WORKFLOW",
    );
  }

  const { persona, master } = await requireMaster(scope, personaId);
  const repo = pkgRepo(options.deps);
  const session = await repo.findSessionByToken(
    scope,
    options.confirmationToken,
  );
  if (!session || session.persona_id !== personaId) {
    throw new PersonaDomainError(
      "Ungültiger oder unbekannter Confirmation-Token.",
      "WORKFLOW",
    );
  }
  if (session.consumed_at) {
    throw new PersonaDomainError(
      "Confirmation-Token bereits verbraucht (single-use).",
      "WORKFLOW",
      { sessionId: session.id },
    );
  }
  if (session.master_reference_id !== master.reference.id) {
    throw new PersonaDomainError(
      "Confirmation does not match current Master Identity Reference.",
      "WORKFLOW",
    );
  }

  const attemptsBefore = await repo.listAttemptsForPersona(scope, personaId);
  const assetsBefore = await personaRepo().listReferenceAssets(scope, personaId);
  const coverageBefore = resolveReferencePackageSlotCoverage({
    attempts: attemptsBefore,
    assets: assetsBefore,
  });

  // Slot-only: when exactly one slot requested, regenerate ONLY that slot.
  let slots: ReferencePackageSlot[];
  if (options.slots?.length === 1) {
    const only = options.slots[0]!;
    try {
      assertSlotMayBeRegenerated(coverageBefore, only);
    } catch (err) {
      throw new PersonaDomainError(
        err instanceof Error ? err.message : "Slot may not be regenerated.",
        "WORKFLOW",
        { slot: only },
      );
    }
    slots = [only];
  } else {
    slots = slotsNeedingGeneration(
      attemptsBefore,
      assetsBefore,
      options.slots?.length === 1 ? options.slots[0] : undefined,
    ).filter((s) =>
      options.slots?.length ? options.slots.includes(s) : true,
    );
  }

  if (slots.length === 0) {
    throw new PersonaDomainError(
      "No slots to generate — accepted coverage already present.",
      "WORKFLOW",
    );
  }

  if (slots.length !== session.image_count) {
    // Allow regenerate-one when session was prepared for that single slot.
    if (!(session.image_count === 1 && slots.length === 1)) {
      throw new PersonaDomainError(
        "Slot count does not match confirmation estimate.",
        "WORKFLOW",
        { expected: session.image_count, actual: slots.length },
      );
    }
  }

  const now = new Date().toISOString();
  await repo.updateSession(scope, session.id, {
    status: "generating",
    confirmed_at: now,
    consumed_at: now,
    // Keep confirmation_token for single-use detection on reuse.
  });

  const results: Array<{
    slot: ReferencePackageSlot;
    attempt: ReferencePackageAttempt;
  }> = [];

  for (const slot of slots) {
    const attemptsForPlan = await repo.listAttemptsForPersona(scope, personaId);
    const directionPlan = resolveProviderDirectionPlan(attemptsForPlan, slot);
    if (!directionPlan.allowPaidRegeneration) {
      throw new PersonaDomainError(
        DIRECTION_GENERATION_UNRELIABLE_MESSAGE,
        "WORKFLOW",
        { slot },
      );
    }
    const attempt = await generateOneAngle(scope, {
      personaId,
      sessionId: session.id,
      masterReferenceId: master.reference.id,
      masterStoragePath: master.reference.storage_path,
      masterMimeType: master.reference.mime_type,
      slot,
      directionPlan,
      deps: options.deps,
    });
    results.push({ slot, attempt });
  }

  const attemptsAfter = await repo.listAttemptsForPersona(scope, personaId);
  const assetsAfter = await personaRepo().listReferenceAssets(scope, personaId);
  const coverageAfter = resolveReferencePackageSlotCoverage({
    attempts: attemptsAfter,
    assets: assetsAfter,
  });
  const ready = coverageAfter.referencePackageReady;
  const anyAccepted = coverageAfter.acceptedCount > 0;
  const anyFailed = results.some(
    (r) => r.attempt.status === "failed" || r.attempt.status === "mismatch",
  );

  await repo.updateSession(scope, session.id, {
    status: ready ? "ready" : anyAccepted ? "partial" : anyFailed ? "failed" : "partial",
  });

  // Never auto-lock / approve
  const refreshed = await personaRepo().getPersona(scope, personaId);

  return {
    persona: refreshed ?? persona,
    sessionId: session.id,
    masterReferenceId: master.reference.id,
    results,
    referencePackageReady: ready,
    identityLocked: false as const,
    autoApproved: false as const,
    provider: "openai" as const,
    imageEditPath: OPENAI_STAGE_B_IMAGE_EDIT_PATH,
  };
}

async function generateOneAngle(
  scope: WorkspaceScope,
  input: {
    personaId: string;
    sessionId: string;
    masterReferenceId: string;
    masterStoragePath: string;
    masterMimeType: string;
    slot: ReferencePackageSlot;
    directionPlan?: ProviderDirectionPlan;
    deps?: ReferencePackageDeps;
  },
): Promise<ReferencePackageAttempt> {
  const repo = pkgRepo(input.deps);
  const directionPlan =
    input.directionPlan ??
    resolveProviderDirectionPlan([], input.slot);

  if (!directionPlan.allowPaidRegeneration) {
    throw new PersonaDomainError(
      DIRECTION_GENERATION_UNRELIABLE_MESSAGE,
      "WORKFLOW",
      { slot: input.slot },
    );
  }

  // Canonical slot is always input.slot / directionPlan.requested_slot.
  const canonicalSlot = input.slot;
  const providerStrategy = directionPlan.provider_direction_strategy;
  const providerDirection = directionPlan.provider_requested_direction;

  const builtPrompt = buildReferencePackageAnglePromptDetailed(canonicalSlot, {
    providerRequestedDirection: providerDirection,
    providerDirectionStrategy: providerStrategy,
  });

  let attempt = await repo.createAttempt(scope, {
    session_id: input.sessionId,
    persona_id: input.personaId,
    master_reference_id: input.masterReferenceId,
    reference_slot: canonicalSlot,
    status: "generating",
    provider_direction_strategy: providerStrategy,
    provider_requested_direction: providerDirection,
    profile_identity_mode: builtPrompt.profile_identity_mode,
    profile_prompt_version: builtPrompt.profile_prompt_version,
  });

  try {
    const download =
      input.deps?.downloadMasterBytes ?? downloadPersonaCandidateBytes;
    const masterBytes = await download(input.masterStoragePath);
    assertStageBUsesImageReferencePath({
      hasMasterImageBytes: masterBytes.length > 0,
      allowTextOnlyFallback: false,
    });

    const edit =
      input.deps?.editFromMaster ?? editOpenAiImageFromReference;
    const prompt = builtPrompt.prompt;
    // Prompt markers validate the direction we asked the provider for.
    // Actual-image validation below always judges the CANONICAL slot.
    const promptValidation = validateAngleDirectionFromPrompt({
      slot: providerDirection,
      prompt,
    });

    if (input.deps?.skipProviderCalls) {
      if (!input.deps.editFromMaster) {
        throw new Error(
          "FAIL CLOSED: skipProviderCalls requires injected editFromMaster — no text-only path.",
        );
      }
    }

    const edited = await edit({
      prompt,
      referenceImageBytes: masterBytes,
      referenceMimeType: input.masterMimeType || "image/png",
    });
    const generatedBytes = edited.imageBytes;
    const providerRequestId = edited.providerRequestId;

    // Real post-generation orientation from landmarks (or injected test fixture).
    const extractOrientation =
      input.deps?.extractOrientation ??
      ((bytes: Buffer) => extractFaceOrientationFromImageBytes(bytes));
    const orientationRaw = await extractOrientation(generatedBytes, {
      slot: canonicalSlot,
    });
    const orientation = toOrientationEstimate(orientationRaw);

    // FINAL TRUTH: compare ACTUAL output against CANONICAL requested_slot.
    const angleValidation: AngleDirectionValidation =
      validateAngleDirectionFromOrientation({
        slot: canonicalSlot,
        orientation,
        promptValidation: {
          ...promptValidation,
          // Re-attribute validation to canonical slot for persistence/audit.
          slot: canonicalSlot,
        },
      });

    attempt = await repo.updateAttempt(scope, attempt.id, {
      status: "identity_check",
      provider_request_id: providerRequestId,
      cost_eur: OPENAI_IMAGE_COST_EUR_MIN,
      angle_direction: angleValidation.angle_direction,
      detected_orientation: angleValidation.detected_orientation,
      detected_yaw_degrees: angleValidation.detected_yaw_degrees,
      provider_direction_strategy: providerStrategy,
      provider_requested_direction: providerDirection,
      profile_identity_mode: builtPrompt.profile_identity_mode,
      profile_prompt_version: builtPrompt.profile_prompt_version,
    });

    const extract = input.deps?.extractEmbedding ?? extractFaceEmbedding;
    const masterEmb = await extract(masterBytes);
    const generatedEmb = await extract(generatedBytes);

    const evaluation: IdentityConsistencyEvaluation = evaluateIdentityConsistency({
      masterEmbedding:
        masterEmb.status === "performed" ? masterEmb.embedding : null,
      generatedEmbedding:
        generatedEmb.status === "performed" ? generatedEmb.embedding : null,
    });

    const identityOk = isIdentityAcceptedForPackage(evaluation.decision);
    // Fail closed: only correct orientation is usable (uncertain/incorrect cannot).
    const angleOk = isAngleDirectionUsable(angleValidation.angle_direction);
    const accepted = identityOk && angleOk;

    // Always persist generated bytes for history/debug — new attempt = new asset.
    const assetId = randomUUID();
    const meta = slotToReferenceMeta(canonicalSlot);
    const notes = buildReferencePackageAssetNotes({
      slot: canonicalSlot,
      attemptId: attempt.id,
      masterReferenceId: input.masterReferenceId,
      identityDecision: evaluation.decision,
      angleDirection: angleValidation.angle_direction,
      providerDirectionStrategy: providerStrategy,
      providerRequestedDirection: providerDirection,
      profileIdentityMode: builtPrompt.profile_identity_mode,
      profilePromptVersion: builtPrompt.profile_prompt_version,
    });

    let generatedAssetId: string | null = null;
    const upload = input.deps?.uploadBytes ?? uploadPersonaReferenceBytes;

    if (input.deps?.skipProviderCalls && input.deps.uploadBytes == null) {
      // Memory path without storage: create DB row with synthetic path.
      const storagePath = buildPersonaReferenceStoragePath({
        workspaceId: scope.workspaceId,
        personaId: input.personaId,
        assetId,
        filename: `${canonicalSlot}.png`,
      });
      const dims = extractImageDimensions(generatedBytes, "image/png");
      const asset = await personaRepo().createReferenceAsset(scope, {
        persona_id: input.personaId,
        asset_type: meta.asset_type,
        storage_path: storagePath,
        mime_type: "image/png",
        width: dims.width,
        height: dims.height,
        file_size_bytes: generatedBytes.length,
        checksum: checksumBytes(generatedBytes),
        view_angle: meta.view_angle,
        framing: meta.framing,
        expression: "neutral",
        body_visibility: "partial",
        notes,
        source_type: "generated_external",
        rights_confirmed: false,
        status: accepted ? "review" : "rejected",
        is_primary: false,
      });
      generatedAssetId = asset.id;
    } else {
      const uploaded = await upload({
        workspaceId: scope.workspaceId,
        personaId: input.personaId,
        assetId,
        filename: `${canonicalSlot}.png`,
        bytes: generatedBytes,
        mimeType: "image/png",
      });
      const asset = await personaRepo().createReferenceAsset(scope, {
        persona_id: input.personaId,
        asset_type: meta.asset_type,
        storage_path: uploaded.storagePath,
        mime_type: "image/png",
        width: uploaded.width,
        height: uploaded.height,
        file_size_bytes: generatedBytes.length,
        checksum: uploaded.checksum,
        view_angle: meta.view_angle,
        framing: meta.framing,
        expression: "neutral",
        body_visibility: "partial",
        notes,
        source_type: "generated_external",
        rights_confirmed: false,
        status: accepted ? "review" : "rejected",
        is_primary: false,
      });
      generatedAssetId = asset.id;
    }

    // Hard guard: never promote generated as primary / master
    if (generatedAssetId) {
      const asset = await personaRepo().getReferenceAsset(scope, generatedAssetId);
      if (asset?.is_primary || isMasterIdentityReference(asset ?? { notes: "", is_primary: false })) {
        await personaRepo().updateReferenceAsset(scope, generatedAssetId, {
          is_primary: false,
        });
      }
    }

    const status: ReferencePackageAttemptStatus = !angleOk
      ? "failed"
      : accepted
        ? "review"
        : evaluation.decision === "identity_mismatch"
          ? "mismatch"
          : evaluation.decision === "identity_warning"
            ? "review"
            : "failed";

    attempt = await repo.updateAttempt(scope, attempt.id, {
      status,
      generated_asset_id: generatedAssetId,
      identity_decision: evaluation.decision,
      identity_distance: evaluation.euclideanDistance,
      identity_similarity: evaluation.similarity,
      angle_direction: angleValidation.angle_direction,
      detected_orientation: angleValidation.detected_orientation,
      detected_yaw_degrees: angleValidation.detected_yaw_degrees,
      provider_direction_strategy: providerStrategy,
      provider_requested_direction: providerDirection,
      profile_identity_mode: builtPrompt.profile_identity_mode,
      profile_prompt_version: builtPrompt.profile_prompt_version,
      error_message: accepted
        ? null
        : !angleOk
          ? angleValidation.reason
          : evaluation.reason,
    });

    return attempt;
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return repo.updateAttempt(scope, attempt.id, {
      status: "failed",
      error_message: message,
      provider_direction_strategy: providerStrategy,
      provider_requested_direction: providerDirection,
    });
  }
}

/**
 * @deprecated Prefer resolveReferencePackageSlotCoverage — historical attempt
 * acceptance alone is not live coverage.
 */
export function isReferencePackageReadyFromAttempts(
  attempts: readonly ReferencePackageAttempt[],
  assets: readonly PersonaReferenceAsset[] = [],
): boolean {
  return resolveReferencePackageSlotCoverage({ attempts, assets })
    .referencePackageReady;
}

export async function getReferencePackageStatus(
  scope: WorkspaceScope,
  personaId: string,
  deps?: ReferencePackageDeps,
): Promise<ReferencePackageStatusView> {
  const persona = await personaRepo().getPersona(scope, personaId);
  if (!persona) {
    throw new PersonaDomainError("Persona not found", "NOT_FOUND", { personaId });
  }
  const master = await getMasterIdentityReferenceForPersona(scope, personaId);
  const repo = pkgRepo(deps);
  const session = await repo.getLatestSessionForPersona(scope, personaId);
  const attempts = await repo.listAttemptsForPersona(scope, personaId);
  const assets = await personaRepo().listReferenceAssets(scope, personaId);
  const coverage = resolveReferencePackageSlotCoverage({ attempts, assets });

  const slots: ReferencePackageSlotView[] = coverage.slots.map((row) => {
    const plan = resolveProviderDirectionPlan(attempts, row.slot);
    return {
      slot: row.slot,
      label: REFERENCE_PACKAGE_SLOT_LABELS[row.slot],
      status: row.status,
      latestAttempt: row.latestAttempt,
      acceptedAssetId: row.countsTowardCoverage ? row.activeAssetId : null,
      attemptHistory: row.attemptHistory,
      identityDecision: row.identityDecision,
      humanReview: row.humanReview,
      angleManuallyReassigned: row.angleManuallyReassigned,
      angleDirection: row.angleDirection,
      detectedOrientation: row.detectedOrientation,
      wrongCameraDirection: row.wrongCameraDirection,
      invertedFallbackEligible: plan.invertedFallbackEligible,
      directionGenerationUnreliable: plan.direction_generation_unreliable,
      providerDirectionStrategy:
        row.latestAttempt?.provider_direction_strategy ?? null,
      providerRequestedDirection:
        row.latestAttempt?.provider_requested_direction ?? null,
      humanIdentityReview: row.humanIdentityReview,
      acceptedViaHumanIdentityOverride: row.acceptedViaHumanIdentityOverride,
      identitySourceConfidence: row.identitySourceConfidence,
      coverageLabel: row.coverageLabel,
    };
  });

  return {
    personaId,
    masterReferenceId: master?.reference.id ?? null,
    session,
    slots,
    acceptedCount: coverage.acceptedCount,
    requiredCount: REFERENCE_PACKAGE_SLOTS.length,
    referencePackageReady: coverage.referencePackageReady,
    identityLocked: persona.identity_lock_status === "approved",
    personaStatus: persona.status,
    provider: "openai",
    imageEditPath: OPENAI_STAGE_B_IMAGE_EDIT_PATH,
    textOnlyFallbackForbidden: true,
  };
}

/**
 * Prepare + confirm regenerate for a single failed/mismatched/rejected slot.
 * May propose inverted_fallback when recent opposite-orientation failures exist.
 * Zero provider calls.
 */
export async function prepareReferencePackageAngleRegeneration(
  scope: WorkspaceScope,
  personaId: string,
  slot: string,
  deps?: ReferencePackageDeps,
) {
  if (!isReferencePackageSlot(slot)) {
    throw new PersonaDomainError("Unknown reference package slot", "VALIDATION", {
      slot,
    });
  }
  const attempts = await pkgRepo(deps).listAttemptsForPersona(scope, personaId);
  const assets = await personaRepo().listReferenceAssets(scope, personaId);
  const coverage = resolveReferencePackageSlotCoverage({ attempts, assets });
  const row = coverage.slots.find((s) => s.slot === slot);
  if (row?.countsTowardCoverage) {
    throw new PersonaDomainError(
      "Slot already has a currently accepted usable reference — regenerate only when not accepted.",
      "WORKFLOW",
      { slot },
    );
  }

  const directionPlan = resolveProviderDirectionPlan(attempts, slot);
  if (!directionPlan.allowPaidRegeneration) {
    throw new PersonaDomainError(
      DIRECTION_GENERATION_UNRELIABLE_MESSAGE,
      "WORKFLOW",
      { slot, directionPlan },
    );
  }

  const prepared = await prepareReferencePackageConfirmation(scope, personaId, {
    slots: [slot],
    forceExactSlots: true,
    deps,
  });

  return {
    ...prepared,
    directionPlan,
    providerCalled: false as const,
  };
}

export async function confirmAndRegenerateReferencePackageAngle(
  scope: WorkspaceScope,
  personaId: string,
  slot: string,
  options: {
    confirmationToken: string;
    costConfirmed: boolean;
    /** Explicit acknowledgement when prepare proposed inverted_fallback. */
    invertedFallbackConfirmed?: boolean;
    deps?: ReferencePackageDeps;
  },
) {
  if (!isReferencePackageSlot(slot)) {
    throw new PersonaDomainError("Unknown reference package slot", "VALIDATION", {
      slot,
    });
  }

  const attempts = await pkgRepo(options.deps).listAttemptsForPersona(
    scope,
    personaId,
  );
  const directionPlan = resolveProviderDirectionPlan(attempts, slot);
  if (!directionPlan.allowPaidRegeneration) {
    throw new PersonaDomainError(
      DIRECTION_GENERATION_UNRELIABLE_MESSAGE,
      "WORKFLOW",
      { slot },
    );
  }
  if (!options.costConfirmed) {
    throw new PersonaDomainError(
      "Explizite Kostenbestätigung erforderlich.",
      "WORKFLOW",
    );
  }
  if (
    directionPlan.provider_direction_strategy === "inverted_fallback" &&
    options.invertedFallbackConfirmed === false
  ) {
    throw new PersonaDomainError(
      "Inverted provider fallback requires explicit confirmation before provider call.",
      "WORKFLOW",
      { slot },
    );
  }

  return confirmAndGenerateReferencePackage(scope, personaId, {
    confirmationToken: options.confirmationToken,
    costConfirmed: options.costConfirmed,
    slots: [slot],
    deps: options.deps,
  });
}

/** Capability export for UI / tests — Stage B OpenAI image-edit path. */
export const STAGE_B_REFERENCE_PACKAGE_CAPABILITY = {
  provider: "openai" as const,
  usesFlux: false as const,
  imageEditPath: OPENAI_STAGE_B_IMAGE_EDIT_PATH,
  textOnlyFallbackForbidden: true as const,
  autoIdentityLock: false as const,
  autoApprovePersona: false as const,
  requiredSlots: REFERENCE_PACKAGE_SLOTS,
};

/**
 * Recompute angle validation for an existing generated asset (no provider call).
 * Uses effective slot when reassigned. Does not alter image bytes or Master.
 */
export async function recomputeReferencePackageAngleValidation(
  scope: WorkspaceScope,
  personaId: string,
  input: {
    assetId: string;
  },
  deps?: ReferencePackageDeps,
): Promise<{
  providerCalled: false;
  assetId: string;
  requestedSlot: string;
  effectiveSlot: string;
  angle_direction: AngleDirectionValidation["angle_direction"];
  detected_orientation: AngleDirectionValidation["detected_orientation"];
  detected_yaw_degrees: number | null;
  reason: string;
  attemptId: string;
  identityDecision: string | null;
}> {
  const asset = await personaRepo().getReferenceAsset(scope, input.assetId);
  if (!asset || asset.persona_id !== personaId) {
    throw new PersonaDomainError("Reference asset not found", "NOT_FOUND", {
      assetId: input.assetId,
    });
  }
  if (isMasterIdentityReference(asset)) {
    throw new PersonaDomainError(
      "Master Identity Reference cannot be angle-validated as a Stage B slot.",
      "WORKFLOW",
    );
  }

  const repo = pkgRepo(deps);
  const attempts = await repo.listAttemptsForPersona(scope, personaId);
  const attempt = attempts.find((a) => a.generated_asset_id === asset.id);
  if (!attempt) {
    throw new PersonaDomainError(
      "No Stage B attempt linked to this asset.",
      "NOT_FOUND",
    );
  }

  const effectiveSlot = getAttemptEffectiveSlot(attempt);
  const prompt = buildReferencePackageAnglePromptDetailed(effectiveSlot).prompt;
  const promptValidation = validateAngleDirectionFromPrompt({
    slot: effectiveSlot,
    prompt,
  });

  const download =
    deps?.downloadMasterBytes ?? downloadPersonaCandidateBytes;
  const bytes = await download(asset.storage_path);
  const extractOrientation =
    deps?.extractOrientation ??
    ((bytes: Buffer) => extractFaceOrientationFromImageBytes(bytes));
  const orientationRaw = await extractOrientation(bytes, {
    slot: effectiveSlot,
  });
  const orientation = toOrientationEstimate(orientationRaw);

  const angleValidation = validateAngleDirectionFromOrientation({
    slot: effectiveSlot,
    orientation,
    promptValidation,
  });

  // Do not rewrite identity evidence. Do not auto-reassign.
  const nextStatus =
    angleValidation.angle_direction === "incorrect"
      ? ("failed" as const)
      : angleValidation.angle_direction === "uncertain"
        ? ("failed" as const)
        : attempt.status === "mismatch"
          ? ("mismatch" as const)
          : attempt.identity_decision === "identity_warning" ||
              attempt.identity_decision === "identity_match"
            ? asset.status === "approved"
              ? attempt.status === "accepted"
                ? ("accepted" as const)
                : ("review" as const)
              : ("review" as const)
            : attempt.status;

  const updated = await repo.updateAttempt(scope, attempt.id, {
    angle_direction: angleValidation.angle_direction,
    detected_orientation: angleValidation.detected_orientation,
    detected_yaw_degrees: angleValidation.detected_yaw_degrees,
    status: nextStatus,
    error_message:
      angleValidation.angle_direction === "correct"
        ? attempt.error_message
        : angleValidation.reason,
  });

  return {
    providerCalled: false,
    assetId: asset.id,
    requestedSlot: attempt.reference_slot,
    effectiveSlot,
    angle_direction: angleValidation.angle_direction,
    detected_orientation: angleValidation.detected_orientation,
    detected_yaw_degrees: angleValidation.detected_yaw_degrees,
    reason: angleValidation.reason,
    attemptId: updated.id,
    identityDecision: attempt.identity_decision,
  };
}
