/**
 * Phase 2.3D.9 — Create mirrored version (local horizontal flip salvage).
 *
 * No OpenAI. No FLUX. Preserves original asset. Creates a NEW derived asset
 * on the SAME canonical requested slot, then re-runs orientation + identity.
 */

import { randomUUID } from "node:crypto";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import { getPersonaRepository } from "@/lib/persona/repositories/factory";
import { logPersonaAuditEvent } from "@/lib/persona/audit/persona-events";
import {
  isMasterIdentityReference,
  parseMasterIdentityNotes,
  getMasterIdentityReferenceForPersona,
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
  evaluateIdentityConsistency,
  type IdentityConsistencyEvaluation,
} from "./identity-consistency";
import {
  isAngleDirectionUsable,
  validateAngleDirectionFromOrientation,
  validateAngleDirectionFromPrompt,
} from "./angle-direction";
import { extractFaceOrientationFromImageBytes } from "./extract-orientation";
import type { OrientationEstimate } from "./orientation-from-landmarks";
import { getReferencePackageRepository } from "./repository";
import {
  assertSlotMayBeRegenerated,
  resolveReferencePackageSlotCoverage,
} from "./coverage";
import { slotToReferenceMeta, type ReferencePackageAttemptStatus } from "./slots";
import {
  buildReferencePackageAssetNotes,
  getAttemptEffectiveSlot,
  parseReferencePackageAssetNotes,
} from "./types";
import { horizontalMirrorImageBytes } from "./horizontal-mirror";
import {
  canProposeMirrorSalvage,
  MIRROR_SALVAGE_POLICY_VERSION,
  MIRROR_SALVAGE_PROVIDER,
  type DerivationType,
} from "./mirror-salvage";
import { buildReferencePackageAnglePromptDetailed } from "./prompts";

export type CreateMirroredVersionDeps = {
  downloadBytes?: (storagePath: string) => Promise<Buffer>;
  uploadBytes?: typeof uploadPersonaReferenceBytes;
  mirrorBytes?: (source: Buffer) => Promise<Buffer>;
  extractOrientation?: (
    bytes: Buffer,
    opts?: { slot?: string },
  ) => Promise<OrientationEstimate> | OrientationEstimate;
  extractEmbedding?: typeof extractFaceEmbedding;
  /** Test guard: must never be invoked. */
  editFromMaster?: (...args: unknown[]) => Promise<unknown>;
  /** Test guard: must never be invoked. */
  fluxGenerate?: (...args: unknown[]) => Promise<unknown>;
  skipStorageUpload?: boolean;
};

export type CreateMirroredVersionInput = {
  assetId: string;
  confirmed?: boolean;
};

export type CreateMirroredVersionResult = {
  providerCalled: false;
  openaiCalled: false;
  fluxCalled: false;
  newImageGenerated: true;
  derivationType: DerivationType;
  provider: typeof MIRROR_SALVAGE_PROVIDER;
  providerCost: 0;
  sourceAssetId: string;
  sourceAttemptId: string;
  assetId: string;
  attemptId: string;
  originalRequestedSlot: string;
  effectiveSlot: string;
  angleDirection: string | null;
  detectedOrientation: string | null;
  identityDecision: string | null;
  identityDistance: number | null;
  identitySimilarity: number | null;
  assetStatus: "review" | "rejected";
  derivedFromAssetId: string;
  derivedAt: string;
  derivedBy: string;
  policyVersion: typeof MIRROR_SALVAGE_POLICY_VERSION;
};

export async function createMirroredReferenceVersion(
  scope: WorkspaceScope,
  personaId: string,
  input: CreateMirroredVersionInput,
  deps?: CreateMirroredVersionDeps,
): Promise<CreateMirroredVersionResult> {
  if (input.confirmed === false) {
    throw new PersonaDomainError(
      "Confirmation required to create mirrored version.",
      "WORKFLOW",
    );
  }

  const personaRepo = getPersonaRepository();
  const persona = await personaRepo.getPersona(scope, personaId);
  if (!persona) {
    throw new PersonaDomainError("Persona not found", "NOT_FOUND", { personaId });
  }

  const sourceAsset = await personaRepo.getReferenceAsset(scope, input.assetId);
  if (!sourceAsset || sourceAsset.persona_id !== personaId) {
    throw new PersonaDomainError("Reference asset not found", "NOT_FOUND", {
      assetId: input.assetId,
    });
  }

  if (
    isMasterIdentityReference(sourceAsset) ||
    parseMasterIdentityNotes(sourceAsset.notes)
  ) {
    throw new PersonaDomainError(
      "Master Identity Reference cannot create a mirrored version.",
      "WORKFLOW",
    );
  }

  const pkgMeta = parseReferencePackageAssetNotes(sourceAsset.notes);
  if (!pkgMeta) {
    throw new PersonaDomainError(
      "Only Stage B generated supporting references can be mirrored.",
      "WORKFLOW",
    );
  }

  const pkgRepo = getReferencePackageRepository();
  const attempts = await pkgRepo.listAttemptsForPersona(scope, personaId);
  const sourceAttempt = attempts.find(
    (a) => a.generated_asset_id === sourceAsset.id,
  );
  if (!sourceAttempt) {
    throw new PersonaDomainError(
      "No Stage B attempt linked to this asset.",
      "NOT_FOUND",
    );
  }

  const canonicalSlot = sourceAttempt.reference_slot;

  const gate = canProposeMirrorSalvage({
    isMaster: false,
    isStageBGenerated: true,
    identityLocked: persona.identity_lock_status === "approved",
    assetStatus: sourceAsset.status,
    identityDecision: sourceAttempt.identity_decision,
    angleDirection: sourceAttempt.angle_direction,
    detectedOrientation: sourceAttempt.detected_orientation,
    slot: canonicalSlot,
  });
  if (!gate.ok) {
    throw new PersonaDomainError(gate.reason, "WORKFLOW", {
      assetId: sourceAsset.id,
      attemptId: sourceAttempt.id,
    });
  }

  const assets = await personaRepo.listReferenceAssets(scope, personaId);
  const coverage = resolveReferencePackageSlotCoverage({ attempts, assets });
  assertSlotMayBeRegenerated(coverage, canonicalSlot);

  const originalSnapshot = {
    assetId: sourceAsset.id,
    storagePath: sourceAsset.storage_path,
    status: sourceAsset.status,
    notes: sourceAsset.notes,
    attemptId: sourceAttempt.id,
    providerRequestId: sourceAttempt.provider_request_id,
    costEur: sourceAttempt.cost_eur,
    identityDecision: sourceAttempt.identity_decision,
    identityDistance: sourceAttempt.identity_distance,
    identitySimilarity: sourceAttempt.identity_similarity,
    angleDirection: sourceAttempt.angle_direction,
    detectedOrientation: sourceAttempt.detected_orientation,
  };

  const download = deps?.downloadBytes ?? downloadPersonaCandidateBytes;
  const sourceBytes = await download(sourceAsset.storage_path);
  if (!sourceBytes.length) {
    throw new PersonaDomainError(
      "Source reference bytes are empty.",
      "STORAGE_UPLOAD_FAILED",
    );
  }

  const mirror = deps?.mirrorBytes ?? horizontalMirrorImageBytes;
  const mirroredBytes = await mirror(sourceBytes);

  if (mirroredBytes === sourceBytes) {
    throw new PersonaDomainError(
      "FAIL CLOSED: mirror must produce derived bytes (not overwrite source buffer).",
      "WORKFLOW",
    );
  }

  const masterBundle = await getMasterIdentityReferenceForPersona(
    scope,
    personaId,
  );
  if (!masterBundle) {
    throw new PersonaDomainError(
      "Master Identity Reference is required for identity re-evaluation.",
      "WORKFLOW",
    );
  }
  const masterBytes = await download(masterBundle.reference.storage_path);

  const builtPrompt = buildReferencePackageAnglePromptDetailed(canonicalSlot);
  const promptValidation = validateAngleDirectionFromPrompt({
    slot: canonicalSlot,
    prompt: builtPrompt.prompt,
  });

  const extractOrientation =
    deps?.extractOrientation ??
    ((bytes: Buffer) => extractFaceOrientationFromImageBytes(bytes));
  const orientationRaw = await extractOrientation(mirroredBytes, {
    slot: canonicalSlot,
  });

  const angleValidation = validateAngleDirectionFromOrientation({
    slot: canonicalSlot,
    orientation: orientationRaw,
    promptValidation,
  });

  const extract = deps?.extractEmbedding ?? extractFaceEmbedding;
  const masterEmb = await extract(masterBytes);
  const generatedEmb = await extract(mirroredBytes);
  const evaluation: IdentityConsistencyEvaluation = evaluateIdentityConsistency({
    masterEmbedding:
      masterEmb.status === "performed" ? masterEmb.embedding : null,
    generatedEmbedding:
      generatedEmb.status === "performed" ? generatedEmb.embedding : null,
  });

  const identityEligibleForReview =
    evaluation.decision === "identity_match" ||
    evaluation.decision === "identity_warning";
  const angleOk = isAngleDirectionUsable(angleValidation.angle_direction);
  // Derived assets enter review when angle is correct and identity is match/warning.
  // No automatic approval. identity_mismatch stays unusable.
  const acceptedForReview = angleOk && identityEligibleForReview;

  const now = new Date().toISOString();
  const derivedBy = scope.actorId ?? "workspace-user";
  const derivationType: DerivationType = "horizontal_mirror";

  const attempt = await pkgRepo.createAttempt(scope, {
    session_id: sourceAttempt.session_id,
    persona_id: personaId,
    master_reference_id: sourceAttempt.master_reference_id,
    reference_slot: canonicalSlot,
    status: "identity_check",
    provider: MIRROR_SALVAGE_PROVIDER,
    provider_direction_strategy: "canonical",
    provider_requested_direction: canonicalSlot,
    derived_from_asset_id: sourceAsset.id,
    derivation_type: derivationType,
    derived_at: now,
    derived_by: derivedBy,
  });

  const newAssetId = randomUUID();
  const meta = slotToReferenceMeta(canonicalSlot);
  const notes = buildReferencePackageAssetNotes({
    slot: canonicalSlot,
    attemptId: attempt.id,
    masterReferenceId: sourceAttempt.master_reference_id,
    identityDecision: evaluation.decision,
    angleDirection: angleValidation.angle_direction,
    detectedOrientation: angleValidation.detected_orientation,
    requestedSlot: canonicalSlot,
    effectiveSlot: canonicalSlot,
    providerDirectionStrategy: "canonical",
    providerRequestedDirection: canonicalSlot,
    derivationType,
    derivedFromAssetId: sourceAsset.id,
    derivedAt: now,
    derivedBy,
    originalRequestedSlot: canonicalSlot,
  });

  let createdAssetId: string;
  const upload = deps?.uploadBytes ?? uploadPersonaReferenceBytes;

  if (deps?.skipStorageUpload) {
    const storagePath = buildPersonaReferenceStoragePath({
      workspaceId: scope.workspaceId,
      personaId,
      assetId: newAssetId,
      filename: `${canonicalSlot}-mirror.png`,
    });
    const dims = extractImageDimensions(mirroredBytes, "image/png");
    const asset = await personaRepo.createReferenceAsset(scope, {
      persona_id: personaId,
      asset_type: meta.asset_type,
      storage_path: storagePath,
      mime_type: "image/png",
      width: dims.width,
      height: dims.height,
      file_size_bytes: mirroredBytes.length,
      checksum: checksumBytes(mirroredBytes),
      view_angle: meta.view_angle,
      framing: meta.framing,
      expression: "neutral",
      body_visibility: "partial",
      notes,
      source_type: "generated_external",
      rights_confirmed: false,
      status: acceptedForReview ? "review" : "rejected",
      is_primary: false,
    });
    createdAssetId = asset.id;
  } else {
    const uploaded = await upload({
      workspaceId: scope.workspaceId,
      personaId,
      assetId: newAssetId,
      filename: `${canonicalSlot}-mirror.png`,
      bytes: mirroredBytes,
      mimeType: "image/png",
    });
    const asset = await personaRepo.createReferenceAsset(scope, {
      persona_id: personaId,
      asset_type: meta.asset_type,
      storage_path: uploaded.storagePath,
      mime_type: "image/png",
      width: uploaded.width,
      height: uploaded.height,
      file_size_bytes: mirroredBytes.length,
      checksum: uploaded.checksum,
      view_angle: meta.view_angle,
      framing: meta.framing,
      expression: "neutral",
      body_visibility: "partial",
      notes,
      source_type: "generated_external",
      rights_confirmed: false,
      status: acceptedForReview ? "review" : "rejected",
      is_primary: false,
    });
    createdAssetId = asset.id;
  }

  const createdAsset = await personaRepo.getReferenceAsset(scope, createdAssetId);
  if (
    createdAsset?.is_primary ||
    isMasterIdentityReference(createdAsset ?? { notes: "", is_primary: false })
  ) {
    await personaRepo.updateReferenceAsset(scope, createdAssetId, {
      is_primary: false,
    });
  }

  const status: ReferencePackageAttemptStatus = !angleOk
    ? "failed"
    : evaluation.decision === "identity_mismatch"
      ? "mismatch"
      : acceptedForReview
        ? "review"
        : "failed";

  const updatedAttempt = await pkgRepo.updateAttempt(scope, attempt.id, {
    status,
    generated_asset_id: createdAssetId,
    provider: MIRROR_SALVAGE_PROVIDER,
    provider_request_id: null,
    cost_eur: 0,
    identity_decision: evaluation.decision,
    identity_distance: evaluation.euclideanDistance,
    identity_similarity: evaluation.similarity,
    angle_direction: angleValidation.angle_direction,
    detected_orientation: angleValidation.detected_orientation,
    detected_yaw_degrees: angleValidation.detected_yaw_degrees,
    provider_direction_strategy: "canonical",
    provider_requested_direction: canonicalSlot,
    derived_from_asset_id: sourceAsset.id,
    derivation_type: derivationType,
    derived_at: now,
    derived_by: derivedBy,
    error_message: acceptedForReview
      ? null
      : !angleOk
        ? angleValidation.reason
        : evaluation.reason,
  });

  const sourceAssetAfter = await personaRepo.getReferenceAsset(
    scope,
    originalSnapshot.assetId,
  );
  const sourceAttemptAfter = (
    await pkgRepo.listAttemptsForPersona(scope, personaId)
  ).find((a) => a.id === originalSnapshot.attemptId);

  if (
    !sourceAssetAfter ||
    sourceAssetAfter.storage_path !== originalSnapshot.storagePath ||
    sourceAssetAfter.status !== originalSnapshot.status ||
    sourceAssetAfter.notes !== originalSnapshot.notes
  ) {
    throw new PersonaDomainError(
      "FAIL CLOSED: mirror salvage must not mutate the original asset.",
      "WORKFLOW",
    );
  }
  if (
    !sourceAttemptAfter ||
    sourceAttemptAfter.provider_request_id !==
      originalSnapshot.providerRequestId ||
    sourceAttemptAfter.cost_eur !== originalSnapshot.costEur ||
    sourceAttemptAfter.identity_decision !==
      originalSnapshot.identityDecision ||
    sourceAttemptAfter.angle_direction !== originalSnapshot.angleDirection ||
    sourceAttemptAfter.detected_orientation !==
      originalSnapshot.detectedOrientation
  ) {
    throw new PersonaDomainError(
      "FAIL CLOSED: mirror salvage must not mutate the original attempt evidence.",
      "WORKFLOW",
    );
  }

  if (createdAssetId === originalSnapshot.assetId) {
    throw new PersonaDomainError(
      "FAIL CLOSED: derived asset must receive a new assetId.",
      "WORKFLOW",
    );
  }

  await logPersonaAuditEvent({
    workspaceId: scope.workspaceId,
    eventType: "reference.mirror_salvage_created",
    recordId: personaId,
    actorId: scope.actorId,
    payload: {
      event: "reference.mirror_salvage_created",
      personaId,
      sourceAssetId: sourceAsset.id,
      sourceAttemptId: sourceAttempt.id,
      derivedAssetId: createdAssetId,
      derivedAttemptId: updatedAttempt.id,
      derivationType,
      originalRequestedSlot: canonicalSlot,
      effectiveSlot: getAttemptEffectiveSlot(updatedAttempt),
      angleDirection: angleValidation.angle_direction,
      detectedOrientation: angleValidation.detected_orientation,
      identityDecision: evaluation.decision,
      provider: MIRROR_SALVAGE_PROVIDER,
      providerCost: 0,
      policyVersion: MIRROR_SALVAGE_POLICY_VERSION,
      timestamp: now,
    },
  });

  return {
    providerCalled: false,
    openaiCalled: false,
    fluxCalled: false,
    newImageGenerated: true,
    derivationType,
    provider: MIRROR_SALVAGE_PROVIDER,
    providerCost: 0,
    sourceAssetId: sourceAsset.id,
    sourceAttemptId: sourceAttempt.id,
    assetId: createdAssetId,
    attemptId: updatedAttempt.id,
    originalRequestedSlot: canonicalSlot,
    effectiveSlot: getAttemptEffectiveSlot(updatedAttempt),
    angleDirection: angleValidation.angle_direction,
    detectedOrientation: angleValidation.detected_orientation,
    identityDecision: evaluation.decision,
    identityDistance: evaluation.euclideanDistance,
    identitySimilarity: evaluation.similarity,
    assetStatus: acceptedForReview ? "review" : "rejected",
    derivedFromAssetId: sourceAsset.id,
    derivedAt: now,
    derivedBy,
    policyVersion: MIRROR_SALVAGE_POLICY_VERSION,
  };
}
