import { createHash } from "node:crypto";

import {
  UGC_VIDEO_AUDIO_REFERENCE_LIMIT,
  UGC_VIDEO_IMAGE_REFERENCE_LIMIT,
  UGC_VIDEO_REFERENCE_LIMIT,
  UGC_VIDEO_REFERENCE_MAX_BYTES,
  UGC_VIDEO_REFERENCE_MIME_TYPES,
  UGC_VIDEO_REFERENCE_TOTAL_MAX_BYTES,
  UGC_VIDEO_VIDEO_REFERENCE_LIMIT,
  ugcVideoGenerationSetupSchema,
  type UgcVideoGenerationSetup,
  type UgcVideoProviderError,
  type UgcVideoQueueObservation,
  type UgcVideoRun,
} from "@/lib/ugc-video-studio/contracts";
import {
  UgcVideoProviderDiagnosticError,
  UgcVideoProviderSubmitUnknownOutcomeError,
  type UgcVideoProviderStatus,
  UgcVideoProvider,
  UgcVideoProviderReference,
  type UgcVideoProviderSubmission,
} from "@/lib/ugc-video-studio/provider";
import { FalSeedanceProvider } from "@/lib/ugc-video-studio/providers/fal-seedance";
import { FalKlingMotionControlProvider } from "@/lib/ugc-video-studio/providers/fal-kling-motion-control";
import { FalVideoEditProvider } from "@/lib/ugc-video-studio/providers/fal-video-edit";
import {
  assertKlingMotionReferences,
  assertKlingMotionCostAllowed,
  estimateKlingMotionMaximumCostUsd,
  getKlingMotionCostCap,
  KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
  KlingMotionReferenceError,
} from "@/lib/ugc-video-studio/kling-motion-config";
import {
  assertSeedanceCostAllowed,
  estimateSeedanceMaximumCostUsd,
  parseUgcVideoCostCap,
  SEEDANCE_25_COST_CAP_ENV,
  SEEDANCE_25_REFERENCE_MODEL_ID,
} from "@/lib/ugc-video-studio/seedance-config";
import {
  isUgcVideoEditModelId,
  ugcVideoModelById,
} from "@/lib/ugc-video-studio/model-registry";
import {
  assertUgcVideoEditSetup,
  estimateUgcVideoEditCostUsd,
  UgcVideoEditInputError,
} from "@/lib/ugc-video-studio/video-edit-config";
import {
  UGC_VIDEO_SERVER_JOB_VERSION,
  ugcVideoJobManifestSchema,
  type UgcVideoJobManifest,
} from "@/lib/ugc-video-studio/server-contracts";
import {
  sha256UgcVideo,
  SupabaseUgcVideoJobStore,
  UGC_VIDEO_RESULT_MAX_BYTES,
  UgcVideoResultTooLargeError,
  UgcVideoJobStateError,
  UgcVideoStorageError,
  UgcVideoStorageSetupError,
  type UgcVideoJobScope,
  type UgcVideoJobStore,
} from "@/lib/ugc-video-studio/server-storage";

export class UgcVideoGenerationError extends Error {
  constructor(
    readonly code:
      | "INVALID_REQUEST"
      | "REFERENCE_LIMIT_EXCEEDED"
      | "REFERENCE_INVALID"
      | "PROVIDER_NOT_CONFIGURED"
      | "DUPLICATE_REQUEST_RUNNING"
      | "IDEMPOTENCY_CONFLICT"
      | "UGC_VIDEO_RESULT_TOO_LARGE"
      | "UGC_VIDEO_STORAGE_SETUP_FAILED"
      | "UGC_VIDEO_STORAGE_FAILED"
      | "RESULT_PERSISTENCE_FAILED"
      | "JOB_NOT_FOUND"
      | "JOB_STATE_INCONSISTENT",
    message: string,
    readonly status: number,
    readonly technicalDetails?: string,
    readonly providerSubmissionPossible = false,
  ) {
    super(message);
    this.name = "UgcVideoGenerationError";
  }
}

function fingerprint(input: {
  jobId: string;
  setup: UgcVideoGenerationSetup;
  references: UgcVideoProviderReference[];
}): string {
  const hash = createHash("sha256");
  hash.update(input.jobId);
  hash.update(JSON.stringify(input.setup));
  for (const reference of input.references) {
    hash.update(reference.metadata.id);
    hash.update(String(reference.metadata.order));
    hash.update(reference.bytes);
  }
  return hash.digest("hex");
}

function validateReferences(
  setup: UgcVideoGenerationSetup,
  references: UgcVideoProviderReference[],
): void {
  if (references.length !== setup.references.length) {
    throw new UgcVideoGenerationError(
      "REFERENCE_INVALID",
      "Die Referenzen konnten nicht vollständig gelesen werden.",
      400,
      `metadata=${setup.references.length};files=${references.length}`,
    );
  }
  if (references.length > UGC_VIDEO_REFERENCE_LIMIT) {
    throw new UgcVideoGenerationError(
      "REFERENCE_LIMIT_EXCEEDED",
      "Für dieses Modell sind zu viele Referenzen ausgewählt.",
      400,
    );
  }
  if (
    setup.modelId === "kling-v3-pro-motion-control" &&
    (references.length > 3 ||
      references.some((reference) => reference.metadata.mediaType === "AUDIO"))
  ) {
    throw new UgcVideoGenerationError(
      "REFERENCE_LIMIT_EXCEEDED",
      "Kling Motion Control erlaubt ein Charakterbild, ein Bewegungs-Referenzvideo und optional eine Gesichtsreferenz.",
      400,
    );
  }
  if (setup.mode === "VIDEO_EDIT") {
    try {
      assertUgcVideoEditSetup(setup);
    } catch (error) {
      if (error instanceof UgcVideoEditInputError) {
        throw new UgcVideoGenerationError(
          "REFERENCE_INVALID",
          error.message,
          400,
          error.code,
        );
      }
      throw error;
    }
  }
  const counts = { IMAGE: 0, VIDEO: 0, AUDIO: 0 };
  let totalBytes = 0;
  for (let index = 0; index < references.length; index += 1) {
    const reference = references[index]!;
    const metadata = setup.references[index]!;
    const allowedMimeTypes = UGC_VIDEO_REFERENCE_MIME_TYPES[metadata.mediaType];
    counts[metadata.mediaType] += 1;
    if (
      reference.metadata.id !== metadata.id ||
      reference.metadata.order !== index ||
      reference.metadata.mediaType !== metadata.mediaType ||
      reference.metadata.mimeType.toLowerCase() !== metadata.mimeType.toLowerCase() ||
      reference.bytes.byteLength !== metadata.byteLength ||
      reference.bytes.byteLength > UGC_VIDEO_REFERENCE_MAX_BYTES[metadata.mediaType] ||
      !(allowedMimeTypes as readonly string[]).includes(
        metadata.mimeType.toLowerCase(),
      )
    ) {
      throw new UgcVideoGenerationError(
        "REFERENCE_INVALID",
        "Mindestens eine Referenz ist ungültig oder zu groß.",
        400,
        `reference=${metadata.id};order=${index};expectedBytes=${metadata.byteLength};receivedBytes=${reference.bytes.byteLength};mime=${metadata.mimeType};mediaType=${metadata.mediaType}`,
      );
    }
    totalBytes += reference.bytes.byteLength;
  }
  if (
    counts.IMAGE > UGC_VIDEO_IMAGE_REFERENCE_LIMIT ||
    counts.VIDEO > UGC_VIDEO_VIDEO_REFERENCE_LIMIT ||
    counts.AUDIO > UGC_VIDEO_AUDIO_REFERENCE_LIMIT
  ) {
    throw new UgcVideoGenerationError(
      "REFERENCE_LIMIT_EXCEEDED",
      "Die Referenzanzahl überschreitet das Limit des Modells.",
      400,
      `images=${counts.IMAGE};videos=${counts.VIDEO};audio=${counts.AUDIO}`,
    );
  }
  if (counts.AUDIO && !counts.IMAGE && !counts.VIDEO) {
    throw new UgcVideoGenerationError(
      "REFERENCE_INVALID",
      "Eine Audio-Referenz benötigt mindestens ein Bild oder Video.",
      400,
    );
  }
  if (
    setup.modelId === "seedance-2.5" &&
    setup.references.some(
      (reference) =>
        reference.mediaType === "VIDEO" &&
        reference.durationSeconds !== null &&
        reference.durationSeconds > 30.2,
    )
  ) {
    throw new UgcVideoGenerationError(
      "REFERENCE_INVALID",
      "Das Referenzvideo ist für Seedance 2.5 zu lang.",
      400,
      "seedance_video_reference_duration_exceeds_30_2_seconds",
    );
  }
  const maximumTotalBytes = setup.mode === "VIDEO_EDIT"
    ? setup.modelId === "seedance-2-fast-video-edit"
      ? 80 * 1024 * 1024
      : 230 * 1024 * 1024
    : UGC_VIDEO_REFERENCE_TOTAL_MAX_BYTES;
  if (totalBytes > maximumTotalBytes) {
    throw new UgcVideoGenerationError(
      "REFERENCE_INVALID",
      "Die Referenzen sind zusammen zu groß.",
      413,
      `receivedBytes=${totalBytes};maximumBytes=${maximumTotalBytes}`,
    );
  }
}

type UgcProviderExecution = {
  provider: UgcVideoProvider;
  providerModel: string;
  estimatedMaximumCostUsd: number;
  configuredName: string;
};

function resolveProviderExecution(input: {
  setup: UgcVideoGenerationSetup;
  injectedProvider?: UgcVideoProvider;
  injectedCostCapUsd?: number | null;
  costLimitPolicy?: "REQUIRE_CONFIGURED_CAP" | "OWNER_ESTIMATE_ONLY";
}): UgcProviderExecution {
  if (input.setup.mode === "VIDEO_EDIT" && isUgcVideoEditModelId(input.setup.modelId)) {
    assertUgcVideoEditSetup(input.setup);
    const model = ugcVideoModelById(input.setup.modelId)!;
    return {
      provider:
        input.injectedProvider ??
        new FalVideoEditProvider(input.setup.modelId, process.env.FAL_KEY),
      providerModel: model.providerModelId!,
      estimatedMaximumCostUsd: estimateUgcVideoEditCostUsd({
        modelId: input.setup.modelId,
        duration: input.setup.duration,
      }),
      configuredName: model.name,
    };
  }
  if (input.setup.modelId === "seedance-2.5") {
    const costCap =
      input.injectedCostCapUsd === undefined
        ? parseUgcVideoCostCap(process.env[SEEDANCE_25_COST_CAP_ENV])
        : input.injectedCostCapUsd;
    return {
      provider:
        input.injectedProvider ?? new FalSeedanceProvider(process.env.FAL_KEY),
      providerModel: SEEDANCE_25_REFERENCE_MODEL_ID,
      estimatedMaximumCostUsd:
        input.costLimitPolicy === "OWNER_ESTIMATE_ONLY"
          ? estimateSeedanceMaximumCostUsd({
              quality: input.setup.quality,
              aspectRatio: input.setup.aspectRatio,
              duration: input.setup.duration,
              hasVideoReference: input.setup.references.some(
                (reference) => reference.mediaType === "VIDEO",
              ),
            })
          : assertSeedanceCostAllowed({
              setup: input.setup,
              configuredCostCapUsd: costCap,
            }),
      configuredName: "Seedance 2.5",
    };
  }
  if (input.setup.modelId === "kling-v3-pro-motion-control") {
    const costCap =
      input.injectedCostCapUsd === undefined
        ? getKlingMotionCostCap(process.env)
        : input.injectedCostCapUsd;
    return {
      provider:
        input.injectedProvider ??
        new FalKlingMotionControlProvider(process.env.FAL_KEY),
      providerModel: KLING_V3_PRO_MOTION_CONTROL_MODEL_ID,
      estimatedMaximumCostUsd:
        input.costLimitPolicy === "OWNER_ESTIMATE_ONLY"
          ? (assertKlingMotionReferences(input.setup),
            estimateKlingMotionMaximumCostUsd({
              characterOrientation:
                input.setup.klingMotion.characterOrientation,
              selectedDurationSeconds: Number(input.setup.duration),
            }))
          : assertKlingMotionCostAllowed({
              setup: input.setup,
              configuredCostCapUsd: costCap,
            }),
      configuredName: "Kling V3 Pro Motion Control",
    };
  }
  throw new UgcVideoGenerationError(
    "PROVIDER_NOT_CONFIGURED",
    "Das ausgewählte Modell ist noch nicht live verbunden.",
    503,
  );
}

function providerForManifest(
  manifest: UgcVideoJobManifest,
  injected?: UgcVideoProvider,
): UgcVideoProvider {
  if (injected) return injected;
  if (manifest.setup.modelId === "seedance-2.5") {
    return new FalSeedanceProvider(process.env.FAL_KEY);
  }
  if (manifest.setup.modelId === "kling-v3-pro-motion-control") {
    return new FalKlingMotionControlProvider(process.env.FAL_KEY);
  }
  if (manifest.setup.mode === "VIDEO_EDIT" && isUgcVideoEditModelId(manifest.setup.modelId)) {
    return new FalVideoEditProvider(manifest.setup.modelId, process.env.FAL_KEY);
  }
  throw new UgcVideoGenerationError(
    "PROVIDER_NOT_CONFIGURED",
    "Das Modell dieses Videoauftrags ist nicht mehr verfügbar.",
    503,
  );
}

function terminalProviderMessage(error: UgcVideoProviderError): string {
  const evidence = `${error.providerCode ?? ""} ${error.providerMessage} ${error.providerBody ?? ""}`.toLowerCase();
  return /content[_ -]?policy|moderation|partner_validation|likeness|privacy/.test(
    evidence,
  )
    ? "Diese Referenz kann von diesem Videomodell nicht verarbeitet werden."
    : "Das Video konnte nicht erstellt werden.";
}

function toPublicResultUrl(jobId: string, resultId: string): string {
  return `/api/ugc-video-studio/assets/${jobId}/${resultId}`;
}

function isMp4(bytes: Buffer): boolean {
  return bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp";
}

async function downloadProviderVideo(
  url: string,
  fetcher: typeof fetch,
): Promise<{ bytes: Buffer; mimeType: "video/mp4" }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("provider_video_url_invalid");
  }
  if (parsed.protocol !== "https:") throw new Error("provider_video_url_unsafe");
  const response = await fetcher(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`provider_video_download_${response.status}`);
  if (response.url && new URL(response.url).protocol !== "https:") {
    throw new Error("provider_video_redirect_unsafe");
  }
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > UGC_VIDEO_RESULT_MAX_BYTES
  ) {
    throw new UgcVideoResultTooLargeError(declaredLength);
  }
  const mimeType = (response.headers.get("content-type") ?? "video/mp4")
    .split(";")[0]!
    .trim()
    .toLowerCase();
  if (mimeType !== "video/mp4") throw new Error(`provider_video_mime_${mimeType}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > UGC_VIDEO_RESULT_MAX_BYTES) {
    throw new UgcVideoResultTooLargeError(bytes.length);
  }
  if (!bytes.length || !isMp4(bytes)) {
    throw new Error("provider_video_corrupt");
  }
  return { bytes, mimeType: "video/mp4" };
}

function manifestToRun(manifest: UgcVideoJobManifest): UgcVideoRun {
  const providerError = providerErrorForManifest(manifest);
  return {
    id: manifest.jobId,
    createdAt: manifest.createdAt,
    updatedAt: manifest.updatedAt,
    status: manifest.status,
    setup: manifest.setup,
    results: manifest.result ? [manifest.result.publicView] : [],
    message: manifest.message,
    provider: manifest.provider,
    providerModel: manifest.providerModel,
    providerRequestId: manifest.providerRequestId,
    ...(manifest.providerPrompt
      ? { providerPrompt: manifest.providerPrompt }
      : {}),
    estimatedMaximumCostUsd: manifest.estimatedMaximumCostUsd,
    actualCostUsd: manifest.actualCostUsd,
    providerError,
    queueObservations: manifest.queueObservations,
  };
}

function providerErrorForManifest(
  manifest: UgcVideoJobManifest,
): UgcVideoProviderError | null {
  if (manifest.providerError) return manifest.providerError;
  const legacy = manifest.technicalError?.match(
    /^fal_(submit|status|result)_(\d{3}):(.+)$/i,
  );
  if (!legacy) return null;
  return {
    phase: legacy[1]!.toUpperCase() as UgcVideoProviderError["phase"],
    httpStatus: Number(legacy[2]),
    providerCode: null,
    providerMessage: legacy[3]!.trim().slice(0, 4000),
    providerBody: null,
    requestId: manifest.providerRequestId,
    endpoint: manifest.providerModel,
    occurredAt: manifest.updatedAt,
    truncated: false,
  };
}

function appendQueueObservation(
  manifest: UgcVideoJobManifest,
  status: UgcVideoProviderStatus,
  observedAt: string,
): UgcVideoQueueObservation[] {
  const next: UgcVideoQueueObservation = {
    status: status.status,
    queuePosition: status.queuePosition,
    observedAt,
    logs: status.logs,
    inferenceTimeSeconds: status.inferenceTimeSeconds,
    metrics: status.metrics,
    truncated: status.truncated,
  };
  return [...manifest.queueObservations, next].slice(-8);
}

export const UGC_VIDEO_OBSERVATION_CHECKPOINT_MS = 60_000;

function elapsedSinceLastObservation(
  manifest: UgcVideoJobManifest,
  observedAt: string,
): number {
  const previous = Date.parse(
    manifest.providerStatusCheckedAt ?? manifest.updatedAt,
  );
  const current = Date.parse(observedAt);
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return Infinity;
  return Math.max(0, current - previous);
}

/** Persist only semantic status evidence or a bounded recovery checkpoint. */
export function shouldPersistUgcObservation(input: {
  manifest: UgcVideoJobManifest;
  providerStatus: NonNullable<UgcVideoJobManifest["providerStatus"]>;
  queuePosition: number | null;
  observationError: string | null;
  observedAt: string;
}): boolean {
  return (
    input.manifest.providerStatus !== input.providerStatus ||
    input.manifest.providerQueuePosition !== input.queuePosition ||
    input.manifest.providerObservationError !== input.observationError ||
    elapsedSinceLastObservation(input.manifest, input.observedAt) >=
      UGC_VIDEO_OBSERVATION_CHECKPOINT_MS
  );
}

function providerErrorSummary(error: UgcVideoProviderError): string {
  return `fal_${error.phase.toLowerCase()}_${error.httpStatus ?? "unknown"}:${error.providerMessage}`.slice(
    0,
    4000,
  );
}

function isVideoEditRecoveryContractFailure(
  manifest: UgcVideoJobManifest,
  error: unknown,
): error is UgcVideoProviderDiagnosticError {
  if (
    manifest.setup.mode !== "VIDEO_EDIT" ||
    !(error instanceof UgcVideoProviderDiagnosticError)
  ) return false;
  return (
    (error.diagnostic.phase === "STATUS" || error.diagnostic.phase === "RESULT") &&
    (error.diagnostic.httpStatus === 405 || error.diagnostic.httpStatus === 422)
  );
}

function resultDownloadDiagnostic(
  manifest: UgcVideoJobManifest,
  error: unknown,
  occurredAt: string,
): UgcVideoProviderError {
  return {
    phase: "RESULT_DOWNLOAD",
    httpStatus: null,
    providerCode:
      error instanceof UgcVideoResultTooLargeError
        ? "UGC_VIDEO_RESULT_TOO_LARGE"
        : error instanceof UgcVideoStorageError
          ? "UGC_VIDEO_STORAGE_FAILED"
          : "UGC_VIDEO_RESULT_DOWNLOAD_FAILED",
    providerMessage:
      error instanceof Error ? error.message.slice(0, 4000) : "Ergebnis konnte nicht gespeichert werden.",
    providerBody: null,
    requestId: manifest.providerRequestId,
    endpoint: manifest.providerModel,
    occurredAt,
    truncated: false,
  };
}

export type GenerateUgcVideoJobDependencies = {
  store?: UgcVideoJobStore;
  provider?: UgcVideoProvider;
  fetcher?: typeof fetch;
  configuredCostCapUsd?: number | null;
  costLimitPolicy?: "REQUIRE_CONFIGURED_CAP" | "OWNER_ESTIMATE_ONLY";
  now?: () => string;
  /** Runs only after the initial manifest has been persisted and read back. */
  onDurableJobReady?: (manifest: UgcVideoJobManifest) => Promise<void>;
};

const DURABLE_MANIFEST_WRITE_ATTEMPTS = 3;
const SUBMITTING_WITHOUT_HANDLE_TIMEOUT_MS = 2 * 60 * 1000;

function manifestStateDetails(error: unknown, stage: string): string {
  if (error instanceof UgcVideoJobStateError) {
    return `${stage}:${error.technicalDetails}`.slice(0, 4000);
  }
  if (error instanceof UgcVideoStorageError) {
    return `${stage}:${error.technicalDetails}`.slice(0, 4000);
  }
  return `${stage}:${error instanceof Error ? error.name : "unknown"}`.slice(
    0,
    4000,
  );
}

async function readDurableManifest(input: {
  store: UgcVideoJobStore;
  scope: UgcVideoJobScope;
  jobId: string;
}): Promise<UgcVideoJobManifest | null> {
  try {
    return await input.store.readManifest(input.scope, input.jobId);
  } catch (error) {
    throw new UgcVideoGenerationError(
      "JOB_STATE_INCONSISTENT",
      "Der Auftrag konnte nicht vollständig geladen werden.",
      503,
      manifestStateDetails(error, "manifest_read_failed"),
    );
  }
}

async function persistAndConfirmManifest(input: {
  store: UgcVideoJobStore;
  scope: UgcVideoJobScope;
  manifest: UgcVideoJobManifest;
  stage: string;
  providerSubmissionPossible: boolean;
}): Promise<UgcVideoJobManifest> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < DURABLE_MANIFEST_WRITE_ATTEMPTS; attempt += 1) {
    try {
      await input.store.writeManifest(input.manifest);
      const persisted = await input.store.readManifest(
        input.scope,
        input.manifest.jobId,
      );
      if (
        persisted &&
        persisted.jobId === input.manifest.jobId &&
        persisted.workspaceId === input.manifest.workspaceId &&
        persisted.actorId === input.manifest.actorId &&
        persisted.requestFingerprint === input.manifest.requestFingerprint &&
        persisted.updatedAt === input.manifest.updatedAt
      ) {
        return persisted;
      }
      lastError = new Error("manifest_read_after_write_mismatch");
    } catch (error) {
      lastError = error;
    }
  }
  throw new UgcVideoGenerationError(
    input.providerSubmissionPossible
      ? "JOB_STATE_INCONSISTENT"
      : "UGC_VIDEO_STORAGE_SETUP_FAILED",
    input.providerSubmissionPossible
      ? "Der angenommene Videoauftrag konnte nicht vollständig gespeichert werden. Es wird kein neuer Auftrag gestartet."
      : "Der private Videospeicher konnte nicht vorbereitet werden.",
    503,
    manifestStateDetails(lastError, input.stage),
    input.providerSubmissionPossible,
  );
}

export async function generateUgcVideoJob(
  input: {
    scope: UgcVideoJobScope;
    jobId: string;
    setup: UgcVideoGenerationSetup;
    references: UgcVideoProviderReference[];
  },
  dependencies: GenerateUgcVideoJobDependencies = {},
): Promise<UgcVideoRun> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.jobId)) {
    throw new UgcVideoGenerationError(
      "INVALID_REQUEST",
      "Der Videoauftrag ist ungültig.",
      400,
    );
  }
  const setup = ugcVideoGenerationSetupSchema.parse(input.setup);
  validateReferences(setup, input.references);
  let execution: UgcProviderExecution;
  try {
    execution = resolveProviderExecution({
      setup,
      ...(dependencies.provider ? { injectedProvider: dependencies.provider } : {}),
      ...(dependencies.configuredCostCapUsd !== undefined
        ? { injectedCostCapUsd: dependencies.configuredCostCapUsd }
        : {}),
      ...(dependencies.costLimitPolicy
        ? { costLimitPolicy: dependencies.costLimitPolicy }
        : {}),
    });
  } catch (error) {
    if (error instanceof KlingMotionReferenceError) {
      throw new UgcVideoGenerationError(
        "REFERENCE_INVALID",
        error.message,
        400,
        error.reason,
      );
    }
    throw error;
  }
  const { provider, providerModel, estimatedMaximumCostUsd, configuredName } =
    execution;
  if (!provider.isConfigured()) {
    throw new UgcVideoGenerationError(
      "PROVIDER_NOT_CONFIGURED",
      `${configuredName} ist serverseitig noch nicht vollständig eingerichtet.`,
      503,
    );
  }
  const store = dependencies.store ?? new SupabaseUgcVideoJobStore();
  const now = dependencies.now ?? (() => new Date().toISOString());
  const requestFingerprint = fingerprint({
    jobId: input.jobId,
    setup,
    references: input.references,
  });
  try {
    await store.ensureReady({
      requiredResultBytes: UGC_VIDEO_RESULT_MAX_BYTES,
    });
  } catch (error) {
    throw new UgcVideoGenerationError(
      "UGC_VIDEO_STORAGE_SETUP_FAILED",
      "Der private Videospeicher konnte nicht vorbereitet werden.",
      503,
      error instanceof UgcVideoStorageSetupError
        ? error.technicalDetails
        : error instanceof Error
          ? error.message
          : "ugc_video_storage_preflight_failed",
    );
  }
  const claim = await store.claim({
    scope: input.scope,
    jobId: input.jobId,
    requestFingerprint,
  });
  if (claim === "EXISTS") {
    const existing = await readDurableManifest({
      store,
      scope: input.scope,
      jobId: input.jobId,
    });
    if (!existing) {
      throw new UgcVideoGenerationError(
        "JOB_STATE_INCONSISTENT",
        "Der gespeicherte Videoauftrag ist unvollständig. Es wird kein neuer Auftrag gestartet.",
        503,
        "claim_exists_without_manifest",
      );
    }
    if (existing.requestFingerprint !== requestFingerprint) {
      throw new UgcVideoGenerationError(
        "IDEMPOTENCY_CONFLICT",
        "Die Auftrags-ID wurde bereits für ein anderes Setup verwendet.",
        409,
      );
    }
    return manifestToRun(existing);
  }

  const timestamp = now();
  let manifest: UgcVideoJobManifest = ugcVideoJobManifestSchema.parse({
    version: UGC_VIDEO_SERVER_JOB_VERSION,
    jobId: input.jobId,
    workspaceId: input.scope.workspaceId,
    actorId: input.scope.actorId,
    requestFingerprint,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: "RUNNING",
    setup,
    originalPrompt: setup.prompt,
    providerPrompt: null,
    referenceAuthority: input.references.map((reference) => ({
      id: reference.metadata.id,
      order: reference.metadata.order,
      name: reference.metadata.name,
      mimeType: reference.metadata.mimeType,
      mediaType: reference.metadata.mediaType,
      byteLength: reference.bytes.byteLength,
      durationSeconds: reference.metadata.durationSeconds,
      sha256: sha256UgcVideo(reference.bytes),
    })),
    provider: "fal",
    providerModel,
    providerRequestId: null,
    providerSubmittedAt: null,
    providerStatus: "SUBMITTING",
    providerStatusCheckedAt: null,
    providerStatusUrl: null,
    providerResponseUrl: null,
    providerCancelUrl: null,
    providerQueuePosition: null,
    providerObservationError: null,
    providerError: null,
    queueObservations: [],
    estimatedMaximumCostUsd,
    actualCostUsd: null,
    providerResult: null,
    result: null,
    message: "Video wird erstellt …",
    technicalError: null,
  });
  manifest = await persistAndConfirmManifest({
    store,
    scope: input.scope,
    manifest,
    stage: "initial_manifest",
    providerSubmissionPossible: false,
  });

  if (dependencies.onDurableJobReady) {
    try {
      await dependencies.onDurableJobReady(manifest);
    } catch (error) {
      manifest = ugcVideoJobManifestSchema.parse({
        ...manifest,
        status: "FAILED",
        providerStatus: "FAILED",
        updatedAt: now(),
        message: "Das Video konnte nicht für die Erstellung vorbereitet werden.",
        technicalError: "durable_job_reference_binding_failed",
      });
      await persistAndConfirmManifest({
        store,
        scope: input.scope,
        manifest,
        stage: "reference_binding_failure",
        providerSubmissionPossible: false,
      });
      throw error;
    }
  }

  let submission: UgcVideoProviderSubmission;
  try {
    submission = await provider.submit({
      clientRequestId: input.jobId,
      endUserId: input.scope.actorId,
      setup,
      references: input.references,
    });
  } catch (error) {
    const unknown = error instanceof UgcVideoProviderSubmitUnknownOutcomeError;
    const diagnostic =
      error instanceof UgcVideoProviderDiagnosticError
        ? error.diagnostic
        : unknown
          ? error.diagnostic
          : null;
    manifest = ugcVideoJobManifestSchema.parse({
      ...manifest,
      status: unknown ? "UNKNOWN_OUTCOME" : "FAILED",
      providerStatus: unknown ? null : "FAILED",
      updatedAt: now(),
      message: unknown
        ? "Der Anbieterstatus ist unklar. Es wird kein neuer Auftrag gestartet."
        : "Das Video konnte nicht erstellt werden.",
      providerObservationError: null,
      providerError: diagnostic,
      technicalError:
        diagnostic
          ? providerErrorSummary(diagnostic)
          : error instanceof Error
            ? `${error.name}: ${error.message}`.slice(0, 4000)
          : "unknown_video_generation_error",
    });
    manifest = await persistAndConfirmManifest({
      store,
      scope: input.scope,
      manifest,
      stage: "submission_failure_manifest",
      providerSubmissionPossible: true,
    });
    return manifestToRun(manifest);
  }

  const acceptedManifest = ugcVideoJobManifestSchema.parse({
    ...manifest,
    provider: submission.provider,
    providerModel: submission.providerModel,
    providerRequestId: submission.providerRequestId,
    providerPrompt: submission.providerPrompt,
    providerSubmittedAt: now(),
    providerStatus: submission.providerStatus,
    providerStatusUrl: submission.statusUrl,
    providerResponseUrl: submission.responseUrl,
    providerCancelUrl: submission.cancelUrl,
    providerQueuePosition: submission.queuePosition,
    updatedAt: now(),
    message: "Video wird erstellt …",
    technicalError: null,
  });
  try {
    manifest = await persistAndConfirmManifest({
      store,
      scope: input.scope,
      manifest: acceptedManifest,
      stage: "provider_acceptance_manifest",
      providerSubmissionPossible: true,
    });
    return manifestToRun(manifest);
  } catch (error) {
    const persistenceDetails =
      error instanceof UgcVideoGenerationError
        ? error.technicalDetails
        : manifestStateDetails(error, "provider_acceptance_manifest");
    const unknownManifest = ugcVideoJobManifestSchema.parse({
      ...acceptedManifest,
      status: "UNKNOWN_OUTCOME",
      updatedAt: now(),
      message:
        "Der Anbieterstatus ist unklar. Es wird kein neuer Auftrag gestartet.",
      providerObservationError: persistenceDetails,
      technicalError: persistenceDetails,
    });
    manifest = await persistAndConfirmManifest({
      store,
      scope: input.scope,
      manifest: unknownManifest,
      stage: "provider_acceptance_quarantine",
      providerSubmissionPossible: true,
    });
    return manifestToRun(manifest);
  }
}

export type ObserveUgcVideoJobDependencies = Pick<
  GenerateUgcVideoJobDependencies,
  "store" | "provider" | "fetcher" | "now"
>;

async function persistCompletedProviderResult(input: {
  scope: UgcVideoJobScope;
  manifest: UgcVideoJobManifest;
  store: UgcVideoJobStore;
  fetcher: typeof fetch;
  now: () => string;
  provider: UgcVideoProvider;
}): Promise<UgcVideoJobManifest> {
  let manifest = input.manifest;
  if (manifest.result) return manifest;
  if (!manifest.providerRequestId) {
    throw new Error("provider_request_id_missing");
  }
  const response = manifest.providerResult
    ? {
        provider: manifest.provider,
        providerModel: manifest.providerModel,
        providerRequestId: manifest.providerRequestId,
        providerPrompt: manifest.providerPrompt ?? manifest.originalPrompt,
        referenceOrder: manifest.referenceAuthority
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((reference) => reference.id),
        result: manifest.providerResult,
        actualCostUsd: manifest.actualCostUsd,
      }
    : await input.provider.getResult({
        providerRequestId: manifest.providerRequestId,
        setup: manifest.setup,
        providerPrompt: manifest.providerPrompt ?? manifest.originalPrompt,
        referenceOrder: manifest.referenceAuthority
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((reference) => reference.id),
        queueHandle: {
          endpoint: manifest.providerModel,
          statusUrl: manifest.providerStatusUrl,
          responseUrl: manifest.providerResponseUrl,
          cancelUrl: manifest.providerCancelUrl,
        },
      });
  manifest = ugcVideoJobManifestSchema.parse({
    ...manifest,
    providerStatus: "COMPLETED",
    providerStatusCheckedAt: input.now(),
    providerResult: response.result,
    actualCostUsd: response.actualCostUsd,
    updatedAt: input.now(),
    providerObservationError: null,
  });
  await input.store.writeManifest(manifest);

  const downloaded = await downloadProviderVideo(response.result.url, input.fetcher);
  const resultId = `result-${sha256UgcVideo(
    `${manifest.jobId}:${manifest.providerRequestId}`,
  ).slice(0, 32)}`;
  const storagePath = await input.store.persistResult({
    scope: input.scope,
    jobId: manifest.jobId,
    resultId,
    bytes: downloaded.bytes,
    mimeType: downloaded.mimeType,
  });
  const publicUrl = toPublicResultUrl(manifest.jobId, resultId);
  const publicView = {
    ...response.result,
    id: resultId,
    url: publicUrl,
    downloadUrl: `${publicUrl}?download=1`,
    mimeType: downloaded.mimeType,
    byteLength: downloaded.bytes.length,
    providerModel: response.providerModel,
  };
  manifest = ugcVideoJobManifestSchema.parse({
    ...manifest,
    status: "SUCCEEDED",
    result: {
      publicView,
      storagePath,
      byteLength: downloaded.bytes.length,
      sha256: sha256UgcVideo(downloaded.bytes),
    },
    updatedAt: input.now(),
    message: "Dein Video wurde erfolgreich erstellt.",
    technicalError: null,
    providerObservationError: null,
  });
  await input.store.writeManifest(manifest);
  return manifest;
}

/**
 * Observe a previously submitted paid request. A known provider request ID is
 * never submitted again and a transient observation error remains RUNNING.
 */
export async function observeUgcVideoJob(
  input: { scope: UgcVideoJobScope; jobId: string },
  dependencies: ObserveUgcVideoJobDependencies = {},
): Promise<UgcVideoRun> {
  const store = dependencies.store ?? new SupabaseUgcVideoJobStore();
  const fetcher = dependencies.fetcher ?? fetch;
  const now = dependencies.now ?? (() => new Date().toISOString());
  let manifest = await readDurableManifest({
    store,
    scope: input.scope,
    jobId: input.jobId,
  });
  if (!manifest) {
    throw new UgcVideoGenerationError(
      "JOB_NOT_FOUND",
      "Der Videoauftrag wurde nicht gefunden.",
      404,
    );
  }
  const provider = providerForManifest(manifest, dependencies.provider);
  if (manifest.status === "SUCCEEDED" || manifest.status === "FAILED") {
    return manifestToRun(manifest);
  }
  if (!manifest.providerRequestId) {
    if (
      manifest.status === "RUNNING" &&
      manifest.providerStatus === "SUBMITTING"
    ) {
      const observedAt = now();
      const submittingSince = Date.parse(manifest.updatedAt);
      const observationTime = Date.parse(observedAt);
      if (
        Number.isFinite(submittingSince) &&
        Number.isFinite(observationTime) &&
        observationTime - submittingSince >=
          SUBMITTING_WITHOUT_HANDLE_TIMEOUT_MS
      ) {
        manifest = ugcVideoJobManifestSchema.parse({
          ...manifest,
          status: "UNKNOWN_OUTCOME",
          providerStatusCheckedAt: observedAt,
          updatedAt: observedAt,
          message:
            "Der Anbieterstatus ist unklar. Es wird kein neuer Auftrag gestartet.",
          providerObservationError:
            "provider_acceptance_handle_not_persisted",
          technicalError: "provider_request_id_missing_after_submission",
        });
        await store.writeManifest(manifest);
      }
      return manifestToRun(manifest);
    }
    if (manifest.status !== "UNKNOWN_OUTCOME") {
      manifest = ugcVideoJobManifestSchema.parse({
        ...manifest,
        status: "UNKNOWN_OUTCOME",
        updatedAt: now(),
        message:
          "Der Anbieterstatus ist unklar. Es wird kein neuer Auftrag gestartet.",
        technicalError: "provider_request_id_missing_after_submission",
      });
      await store.writeManifest(manifest);
    }
    return manifestToRun(manifest);
  }
  if (!provider.isConfigured()) {
    throw new UgcVideoGenerationError(
      "PROVIDER_NOT_CONFIGURED",
      "Das gewählte Videomodell ist serverseitig noch nicht vollständig eingerichtet.",
      503,
    );
  }

  try {
    const providerStatus = await provider.getStatus(manifest.providerRequestId, {
      endpoint: manifest.providerModel,
      statusUrl: manifest.providerStatusUrl,
      responseUrl: manifest.providerResponseUrl,
      cancelUrl: manifest.providerCancelUrl,
    });
    const observedAt = now();
    if (
      providerStatus.status === "IN_QUEUE" ||
      providerStatus.status === "IN_PROGRESS"
    ) {
      if (
        !shouldPersistUgcObservation({
          manifest,
          providerStatus: providerStatus.status,
          queuePosition: providerStatus.queuePosition,
          observationError: null,
          observedAt,
        })
      ) {
        return manifestToRun(manifest);
      }
      const queueObservations = appendQueueObservation(
        manifest,
        providerStatus,
        observedAt,
      );
      manifest = ugcVideoJobManifestSchema.parse({
        ...manifest,
        status: "RUNNING",
        providerStatus: providerStatus.status,
        providerStatusCheckedAt: observedAt,
        providerQueuePosition: providerStatus.queuePosition,
        queueObservations,
        providerObservationError: null,
        updatedAt: observedAt,
        message: "Video wird erstellt …",
        technicalError: null,
      });
      await store.writeManifest(manifest);
      return manifestToRun(manifest);
    }
    const queueObservations = appendQueueObservation(
      manifest,
      providerStatus,
      observedAt,
    );
    if (providerStatus.status === "FAILED") {
      const providerError: UgcVideoProviderError = {
        phase: "STATUS",
        httpStatus: null,
        providerCode: null,
        providerMessage:
          providerStatus.error ?? "Der Anbieter hat den Auftrag abgelehnt.",
        providerBody: null,
        requestId: manifest.providerRequestId,
        endpoint: manifest.providerModel,
        occurredAt: observedAt,
        truncated: providerStatus.truncated,
      };
      manifest = ugcVideoJobManifestSchema.parse({
        ...manifest,
        status: "FAILED",
        providerStatus: "FAILED",
        providerStatusCheckedAt: observedAt,
        queueObservations,
        providerError,
        providerObservationError: null,
        updatedAt: now(),
        message: terminalProviderMessage(providerError),
        technicalError: providerErrorSummary(providerError),
      });
      await store.writeManifest(manifest);
      return manifestToRun(manifest);
    }
    manifest = ugcVideoJobManifestSchema.parse({
      ...manifest,
      status: "RUNNING",
      providerStatus: "COMPLETED",
      providerStatusCheckedAt: observedAt,
      providerQueuePosition: null,
      queueObservations,
      providerObservationError: null,
      updatedAt: observedAt,
      message: "Video wird gespeichert …",
      technicalError: null,
    });
    await store.writeManifest(manifest);
    manifest = await persistCompletedProviderResult({
      scope: input.scope,
      manifest,
      store,
      fetcher,
      now,
      provider,
    });
    return manifestToRun(manifest);
  } catch (error) {
    if (isVideoEditRecoveryContractFailure(manifest, error)) {
      const observedAt = now();
      console.warn("[xeriamo-ugc] video_edit_recovery_quarantined", {
        model: manifest.setup.modelId,
        recoveryStage: error.diagnostic.phase.toLowerCase(),
        providerStatus: error.diagnostic.httpStatus,
        providerUrlSource:
          error.diagnostic.phase === "STATUS" && manifest.providerStatusUrl
            ? "authoritative"
            : error.diagnostic.phase === "RESULT" && manifest.providerResponseUrl
              ? "authoritative"
              : "legacy-sdk",
      });
      manifest = ugcVideoJobManifestSchema.parse({
        ...manifest,
        status: "UNKNOWN_OUTCOME",
        providerStatusCheckedAt: observedAt,
        providerObservationError: providerErrorSummary(error.diagnostic),
        providerError: error.diagnostic,
        updatedAt: observedAt,
        message: "Der Anbieterstatus konnte nicht sicher abgerufen werden.",
        technicalError: providerErrorSummary(error.diagnostic),
      });
      await store.writeManifest(manifest);
      return manifestToRun(manifest);
    }
    if (error instanceof UgcVideoProviderDiagnosticError && error.terminal) {
      manifest = ugcVideoJobManifestSchema.parse({
        ...manifest,
        status: "FAILED",
        providerStatus: "FAILED",
        providerStatusCheckedAt: now(),
        providerObservationError: null,
        providerError: error.diagnostic,
        updatedAt: now(),
        message: terminalProviderMessage(error.diagnostic),
        technicalError: providerErrorSummary(error.diagnostic),
      });
      await store.writeManifest(manifest);
      return manifestToRun(manifest);
    }
    const storageFailure =
      error instanceof UgcVideoResultTooLargeError ||
      error instanceof UgcVideoStorageError;
    if (storageFailure) {
      const occurredAt = now();
      const providerError = resultDownloadDiagnostic(
        manifest,
        error,
        occurredAt,
      );
      manifest = ugcVideoJobManifestSchema.parse({
        ...manifest,
        status: "FAILED",
        updatedAt: occurredAt,
        providerError,
        message:
          error instanceof UgcVideoResultTooLargeError
            ? "Das erzeugte Video ist größer als das aktuell erlaubte Speicherlimit."
            : "Das Video wurde erstellt, konnte aber nicht gespeichert werden.",
        technicalError: `${error.name}: ${error.message}`.slice(0, 4000),
      });
      await store.writeManifest(manifest);
      return manifestToRun(manifest);
    }
    if (
      manifest.providerStatus === "COMPLETED" &&
      !(error instanceof UgcVideoProviderDiagnosticError)
    ) {
      const occurredAt = now();
      const providerError = resultDownloadDiagnostic(
        manifest,
        error,
        occurredAt,
      );
      manifest = ugcVideoJobManifestSchema.parse({
        ...manifest,
        status: "FAILED",
        updatedAt: occurredAt,
        providerError,
        providerObservationError: null,
        message: "Das Video wurde erstellt, konnte aber nicht gespeichert werden.",
        technicalError: providerErrorSummary(providerError),
      });
      await store.writeManifest(manifest);
      return manifestToRun(manifest);
    }

    // The paid submission remains known. A genuinely transient queue/result
    // observation problem stays RUNNING and never triggers resubmission.
    const observationError =
      error instanceof UgcVideoProviderDiagnosticError
        ? providerErrorSummary(error.diagnostic)
        : error instanceof Error
          ? `${error.name}: ${error.message}`.slice(0, 4000)
          : "unknown_provider_observation_error";
    const observedAt = now();
    if (
      !shouldPersistUgcObservation({
        manifest,
        providerStatus: manifest.providerStatus ?? "IN_PROGRESS",
        queuePosition: manifest.providerQueuePosition,
        observationError,
        observedAt,
      })
    ) {
      return manifestToRun(manifest);
    }
    manifest = ugcVideoJobManifestSchema.parse({
      ...manifest,
      status: "RUNNING",
      providerStatusCheckedAt: observedAt,
      providerObservationError: observationError,
      updatedAt: observedAt,
      message: "Video wird erstellt …",
      providerError:
        error instanceof UgcVideoProviderDiagnosticError
          ? error.diagnostic
          : manifest.providerError,
    });
    await store.writeManifest(manifest);
    return manifestToRun(manifest);
  }
}

/**
 * Explicit storage-only continuation for a known provider result. This never
 * receives a provider dependency and therefore cannot resubmit a paid job.
 */
export async function recoverUgcVideoResultStorage(
  input: {
    scope: UgcVideoJobScope;
    jobId: string;
  },
  dependencies: Pick<
    GenerateUgcVideoJobDependencies,
    "store" | "fetcher" | "now"
  > = {},
): Promise<UgcVideoRun> {
  const store = dependencies.store ?? new SupabaseUgcVideoJobStore();
  const fetcher = dependencies.fetcher ?? fetch;
  const now = dependencies.now ?? (() => new Date().toISOString());
  await store.ensureReady();
  let manifest = await readDurableManifest({
    store,
    scope: input.scope,
    jobId: input.jobId,
  });
  if (!manifest) {
    throw new UgcVideoGenerationError(
      "JOB_NOT_FOUND",
      "Der Videoauftrag wurde nicht gefunden.",
      404,
    );
  }
  if (manifest.result) return manifestToRun(manifest);
  if (
    manifest.status === "UNKNOWN_OUTCOME" ||
    !manifest.providerRequestId ||
    !manifest.providerResult
  ) {
    throw new UgcVideoGenerationError(
      "RESULT_PERSISTENCE_FAILED",
      "Für diesen Auftrag ist keine sichere Speicherfortsetzung verfügbar.",
      409,
    );
  }

  try {
    const downloaded = await downloadProviderVideo(
      manifest.providerResult.url,
      fetcher,
    );
    const resultId = `result-${sha256UgcVideo(
      `${manifest.jobId}:${manifest.providerRequestId}`,
    ).slice(0, 32)}`;
    const storagePath = await store.persistResult({
      scope: input.scope,
      jobId: input.jobId,
      resultId,
      bytes: downloaded.bytes,
      mimeType: downloaded.mimeType,
    });
    const publicUrl = toPublicResultUrl(input.jobId, resultId);
    const publicView = {
      ...manifest.providerResult,
      id: resultId,
      url: publicUrl,
      downloadUrl: `${publicUrl}?download=1`,
      mimeType: downloaded.mimeType,
      byteLength: downloaded.bytes.length,
    };
    manifest = ugcVideoJobManifestSchema.parse({
      ...manifest,
      status: "SUCCEEDED",
      result: {
        publicView,
        storagePath,
        byteLength: downloaded.bytes.length,
        sha256: sha256UgcVideo(downloaded.bytes),
      },
      updatedAt: now(),
      message: "Das bereits erzeugte Video wurde erfolgreich gespeichert.",
      technicalError: null,
    });
    await store.writeManifest(manifest);
    return manifestToRun(manifest);
  } catch (error) {
    const tooLarge = error instanceof UgcVideoResultTooLargeError;
    const occurredAt = now();
    const providerError = resultDownloadDiagnostic(
      manifest,
      error,
      occurredAt,
    );
    manifest = ugcVideoJobManifestSchema.parse({
      ...manifest,
      status: "FAILED",
      updatedAt: occurredAt,
      providerError,
      message: tooLarge
        ? "Das erzeugte Video ist größer als das aktuell erlaubte Speicherlimit."
        : "Das Video wurde erstellt, konnte aber nicht gespeichert werden.",
      technicalError: providerErrorSummary(providerError),
    });
    await store.writeManifest(manifest);
    return manifestToRun(manifest);
  }
}
