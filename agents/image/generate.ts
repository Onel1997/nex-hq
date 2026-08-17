import type {
  BrainImageSections,
  BrainReportContent,
} from "@/brain/domains/reports";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import {
  brandModelContractSchema,
  brandModelTraceSchema,
  traceBrandModelContract,
  type BrandModelTrace,
} from "@/lib/persona/domain/brand-model-contract";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { findImageAsset } from "./normalized";
import {
  generateWithProvider,
  getImageProviderIdentityStrategy,
  getImageProviderModel,
  isImageProviderConfigured,
} from "./providers/registry";
import { uploadImageAsset } from "./storage";
import {
  OPENAI_QUOTA_USER_MESSAGE,
  toOpenAiQuotaError,
} from "./generation-errors";
import { getOpenAiImageModel } from "@/lib/image/image-generation-config";
import type {
  ImageGenerationRequest,
  ImageGenerationResult,
} from "./providers/image-provider";
import type {
  ImageGenerateRequest,
  ImageGenerateResult,
} from "./types-generation";
import type { ImageStudioAsset } from "./studio-schema";
import {
  brandModelTracesEqual,
  imageGenerationProvenanceSchema,
  type ImageGenerationProvenance,
} from "@/lib/image/image-generation-identity-contract";
import {
  resolveBrandModelGenerationIdentity,
  type ResolvedImageIdentityInput,
} from "@/lib/image/resolve-brand-model-generation-identity";
import { assertImagePaidGenerationEnabled } from "@/lib/image/image-paid-generation-guard";
import type { ImageGenerationInputSnapshot } from "@/lib/image/paid-generation/types";
import type { ImageProviderArtworkInput } from "./providers/image-provider";

async function normalizeSectionsForGeneration(
  sections: BrainImageSections | undefined,
): Promise<BrainImageSections | undefined> {
  if (!sections || sections.productionAssets?.length) return sections;
  // Legacy migration pulls in server-only commerce/context readers. Current V3
  // projects take the lightweight path; legacy records load it only on demand.
  const { normalizeImageSections } = await import("./migrate-legacy");
  return normalizeImageSections(sections);
}

async function resolveProviderImageBytes(
  result: ImageGenerationResult,
): Promise<Buffer> {
  if (result.imageBytes) return result.imageBytes;

  if (result.url) {
    const res = await fetch(result.url);
    if (!res.ok) {
      throw new Error(`Failed to fetch provider image URL: ${res.status}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  throw new Error("Image provider returned no image data");
}

export class ImageProviderNotConfiguredError extends Error {
  readonly provider: ImageGenerateRequest["provider"];

  constructor(provider: ImageGenerateRequest["provider"]) {
    const dict = getDictionary(DEFAULT_LOCALE);
    super(dict.image.errors.providerNotConfigured);
    this.name = "ImageProviderNotConfiguredError";
    this.provider = provider;
  }
}

function updateAssetInSections(
  sections: BrainImageSections,
  assetId: string,
  patch: Partial<ImageStudioAsset>,
): BrainImageSections {
  const productionAssets = (sections.productionAssets ?? []).map((asset) =>
    asset.id === assetId ? { ...asset, ...patch } : asset,
  );
  return { ...sections, productionAssets };
}

export type ImageGenerationReportRecord = {
  id: string;
  workspaceId: string;
  content: BrainReportContent;
};

export type ImageGenerationDependencies = {
  assertExecutionAllowed: () => void;
  isProviderConfigured: typeof isImageProviderConfigured;
  loadReport: (recordId: string) => Promise<ImageGenerationReportRecord | null>;
  updateSections: (
    recordId: string,
    sections: BrainImageSections,
  ) => Promise<void>;
  generateProvider: (
    provider: ImageGenerateRequest["provider"],
    request: ImageGenerationRequest,
  ) => Promise<ImageGenerationResult>;
  upload: typeof uploadImageAsset;
  resolveIdentity: (
    scope: WorkspaceScope,
    trace: BrandModelTrace,
  ) => Promise<ResolvedImageIdentityInput>;
  getProviderModel: typeof getImageProviderModel;
  getIdentityStrategy: typeof getImageProviderIdentityStrategy;
  now: () => string;
  operationId: () => string;
  /** Unit/legacy seam only; no application route enables this. */
  allowTestOnlyUnconfirmedExecution: boolean;
};

async function loadReport(
  recordId: string,
): Promise<ImageGenerationReportRecord | null> {
  // Keep the service-role Brain client out of the module graph used by provider
  // contract tests. It is loaded only for a real server execution.
  const { getBrainClient } = await import("@/brain/client");
  const record = await getBrainClient().getRecord("reports", recordId);
  if (!record) return null;
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    content: record.content as BrainReportContent,
  };
}

async function updateSections(
  recordId: string,
  sections: BrainImageSections,
): Promise<void> {
  const { getBrainClient } = await import("@/brain/client");
  await getBrainClient().updateRecord(
    "reports",
    recordId,
    { content: { imageSections: sections } },
    { type: "agent", id: "image" },
  );
}

function dependencies(
  overrides: Partial<ImageGenerationDependencies>,
): ImageGenerationDependencies {
  return {
    assertExecutionAllowed: assertImagePaidGenerationEnabled,
    isProviderConfigured: isImageProviderConfigured,
    loadReport,
    updateSections,
    generateProvider: generateWithProvider,
    upload: uploadImageAsset,
    resolveIdentity: resolveBrandModelGenerationIdentity,
    getProviderModel: getImageProviderModel,
    getIdentityStrategy: getImageProviderIdentityStrategy,
    now: () => new Date().toISOString(),
    operationId: () => crypto.randomUUID(),
    allowTestOnlyUnconfirmedExecution: false,
    ...overrides,
  };
}

function resolvePersistedBrandModelTrace(input: {
  requestTrace?: BrandModelTrace;
  assetTrace?: BrandModelTrace;
  projectContract?: unknown;
}): BrandModelTrace | null {
  const hasAny = Boolean(
    input.requestTrace || input.assetTrace || input.projectContract,
  );
  if (!hasAny) return null;
  if (!input.requestTrace || !input.assetTrace || !input.projectContract) {
    throw new Error(
      "Persona generation requires matching request, planned-asset, and project contract traces.",
    );
  }
  const requestTrace = brandModelTraceSchema.parse(input.requestTrace);
  const assetTrace = brandModelTraceSchema.parse(input.assetTrace);
  const projectTrace = traceBrandModelContract(
    brandModelContractSchema.parse(input.projectContract),
  );
  if (
    !brandModelTracesEqual(requestTrace, assetTrace) ||
    !brandModelTracesEqual(assetTrace, projectTrace)
  ) {
    throw new Error(
      "Persona identity trace does not match the planned Image project.",
    );
  }
  return assetTrace;
}

function buildGenerationProvenance(input: {
  attemptId: string;
  provider: ImageGenerateRequest["provider"];
  model: string;
  identity: ResolvedImageIdentityInput | null;
  identityStrategy: ImageGenerationProvenance["identityStrategy"];
  startedAt: string;
  providerRequestId?: string | null;
  completedAt?: string | null;
  paidExecution?: { jobId: string; inputFingerprint: string; snapshot: ImageGenerationInputSnapshot };
}): ImageGenerationProvenance {
  return imageGenerationProvenanceSchema.parse({
    attemptId: input.attemptId,
    provider: input.provider,
    model: input.model,
    providerRequestId: input.providerRequestId ?? null,
    identityStrategy: input.identityStrategy,
    identity: input.identity?.trace ?? null,
    ...(input.paidExecution
      ? {
          paidGeneration: {
            jobId: input.paidExecution.jobId,
            productionProjectId:
              input.paidExecution.snapshot.production.projectId,
            productionProjectVersion:
              input.paidExecution.snapshot.production.projectVersion,
            inputFingerprint: input.paidExecution.inputFingerprint,
            masterArtwork: {
              artworkId: input.paidExecution.snapshot.masterArtwork.artworkId,
              designId: input.paidExecution.snapshot.masterArtwork.designId,
              version: input.paidExecution.snapshot.masterArtwork.version,
              checksum: input.paidExecution.snapshot.masterArtwork.checksum,
            },
            product: input.paidExecution.snapshot.product,
            shotId: input.paidExecution.snapshot.production.assetId,
          },
        }
      : {}),
    startedAt: input.startedAt,
    completedAt: input.completedAt ?? null,
  });
}

export async function generateImageAsset(
  input: {
    scope: WorkspaceScope;
    request: ImageGenerateRequest;
    /** Present only after an atomic durable job claim. */
    paidExecution?: {
      jobId: string;
      inputFingerprint: string;
      snapshot: ImageGenerationInputSnapshot;
      artwork: ImageProviderArtworkInput;
      /** Lets the durable job classify failures before vs after paid invocation. */
      onProviderInvocation?: () => void;
    };
  },
  dependencyOverrides: Partial<ImageGenerationDependencies> = {},
): Promise<ImageGenerateResult> {
  const { request, scope } = input;
  const deps = dependencies(dependencyOverrides);

  // The current Image workflow has no durable scoped confirmation/idempotency
  // authority. Production defaults closed before any provider-capable work.
  deps.assertExecutionAllowed();
  if (!input.paidExecution && !deps.allowTestOnlyUnconfirmedExecution) {
    throw new Error(
      "A durable confirmed Image generation job is required before provider execution.",
    );
  }
  if (!deps.isProviderConfigured(request.provider)) {
    throw new ImageProviderNotConfiguredError(request.provider);
  }

  const record = await deps.loadReport(request.reportRecordId);
  if (!record) throw new Error("Image project not found in Brain");
  if (record.workspaceId !== scope.workspaceId) {
    throw new Error("Image project belongs to another workspace.");
  }

  const content = record.content;
  const imageSections = await normalizeSectionsForGeneration(
    content.imageSections,
  );
  if (!imageSections || content.reportId !== request.reportId) {
    throw new Error("Invalid image project record");
  }

  const asset = findImageAsset(
    { productionAssets: imageSections.productionAssets as ImageStudioAsset[] },
    request.assetId,
  );
  if (!asset) throw new Error(`Asset not found: ${request.assetId}`);

  if (input.paidExecution) {
    const frozen = input.paidExecution.snapshot;
    if (
      frozen.workspaceId !== scope.workspaceId ||
      frozen.production.reportRecordId !== request.reportRecordId ||
      frozen.production.reportId !== request.reportId ||
      frozen.production.assetId !== request.assetId ||
      frozen.production.provider !== request.provider ||
      frozen.production.prompt !== asset.prompt.openai ||
      frozen.production.dimensions !== (asset.dimensions ?? "2048x2048") ||
      frozen.product.productName !== asset.productName ||
      frozen.product.color !== asset.color
    ) {
      throw new Error(
        "Paid Image production truth changed after confirmation. Prepare and confirm a new job.",
      );
    }
  }

  const persistedTrace = resolvePersistedBrandModelTrace({
    requestTrace: request.brandModelTrace,
    assetTrace: asset.brandModelTrace,
    projectContract: imageSections.brandModelContract,
  });
  const identity = persistedTrace
    ? await deps.resolveIdentity(scope, persistedTrace)
    : null;
  const identityStrategy = deps.getIdentityStrategy(
    request.provider,
    identity != null,
    input.paidExecution != null,
  );
  const providerModel = deps.getProviderModel(request.provider);
  const prompt =
    request.promptVariant === "flux"
      ? asset.prompt.flux
      : request.promptVariant === "midjourney"
        ? asset.prompt.midjourney
        : asset.prompt.openai;
  const attemptId = deps.operationId();
  const startedAt = deps.now();
  const startedProvenance = buildGenerationProvenance({
    attemptId,
    provider: request.provider,
    model: providerModel,
    identity,
    identityStrategy,
    startedAt,
    paidExecution: input.paidExecution,
  });

  await deps.updateSections(
    request.reportRecordId,
    updateAssetInSections(imageSections, asset.id, {
      status: "generating",
      generationProvenance: startedProvenance,
    }),
  );

  try {
    input.paidExecution?.onProviderInvocation?.();
    const result = await deps.generateProvider(request.provider, {
      prompt,
      dimensions: asset.dimensions ?? "2048x2048",
      assetType: asset.assetType,
      ...(identity ? { identity } : {}),
      ...(input.paidExecution ? { artwork: input.paidExecution.artwork } : {}),
      ...(input.paidExecution
        ? {
            production: {
              product: input.paidExecution.snapshot.product,
              shot: {
                scene: input.paidExecution.snapshot.production.scene,
                lighting: input.paidExecution.snapshot.production.lighting,
                poseDirection:
                  input.paidExecution.snapshot.production.poseDirection,
                shotTitle: input.paidExecution.snapshot.production.shotTitle,
              },
            },
          }
        : {}),
    });
    if (identity && result.identityStrategy !== identityStrategy) {
      throw new Error(
        "Image provider did not use the required Brand Model identity strategy.",
      );
    }
    const imageBytes = await resolveProviderImageBytes(result);
    const uploaded = await deps.upload({
      workspaceId: scope.workspaceId,
      reportId: request.reportId,
      assetKey: `${asset.id}:${request.provider}:${attemptId}`,
      imageBytes,
    });
    const completedAt = deps.now();
    const completedProvenance = buildGenerationProvenance({
      attemptId,
      provider: request.provider,
      model: result.modelId || providerModel,
      identity,
      identityStrategy,
      startedAt,
      providerRequestId: result.providerRequestId ?? null,
      completedAt,
      paidExecution: input.paidExecution,
    });
    const completedPatch: Partial<ImageStudioAsset> = {
      status: "completed",
      // Signed access is returned to the current UI only. Brain persists the
      // private path and durable asset record, never an expiring URL.
      imageUrl: undefined,
      storagePath: uploaded.storagePath,
      createdAt: completedAt,
      message: undefined,
      generationProvenance: completedProvenance,
    };
    const refreshed = await deps.loadReport(request.reportRecordId);
    const refreshedSections = await normalizeSectionsForGeneration(
      refreshed?.content.imageSections,
    );
    await deps.updateSections(
      request.reportRecordId,
      updateAssetInSections(
        refreshedSections ?? imageSections,
        asset.id,
        completedPatch,
      ),
    );

    return {
      asset: {
        id: asset.id,
        title: asset.title ?? asset.productName,
        type: asset.assetType,
        dimensions: asset.dimensions ?? "2048x2048",
        platform: asset.platform,
        provider: request.provider,
        status: "completed",
        imageUrl: uploaded.url,
        storagePath: uploaded.storagePath,
        createdAt: completedAt,
        generationProvenance: completedProvenance,
      },
      providerConfigured: true,
    };
  } catch (error) {
    const quotaError = toOpenAiQuotaError(error, getOpenAiImageModel());
    const message = quotaError
      ? OPENAI_QUOTA_USER_MESSAGE
      : error instanceof Error
        ? error.message
        : "Image generation failed";
    const refreshed = await deps.loadReport(request.reportRecordId);
    const refreshedSections = await normalizeSectionsForGeneration(
      refreshed?.content.imageSections,
    );
    await deps.updateSections(
      request.reportRecordId,
      updateAssetInSections(
        refreshedSections ?? imageSections,
        asset.id,
        {
          status: quotaError ? "pending" : "failed",
          message,
          ...(!quotaError ? { createdAt: deps.now() } : {}),
          generationProvenance: startedProvenance,
        },
      ),
    );
    if (quotaError) throw quotaError;
    throw error;
  }
}
