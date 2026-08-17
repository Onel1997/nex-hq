import { randomUUID } from "node:crypto";
import type { BrainReportContent } from "@/brain/domains/reports";
import { findImageAsset } from "@/agents/image/normalized";
import type { ImageStudioAsset } from "@/agents/image/studio-schema";
import { generateImageAsset, ImageProviderNotConfiguredError, type ImageGenerationDependencies } from "@/agents/image/generate";
import type { ImageGenerateResult } from "@/agents/image/types-generation";
import { ImageOpenAiQuotaExceededError } from "@/agents/image/generation-errors";
import { getImageProviderModel } from "@/agents/image/providers/registry";
import { getActiveImageGenerationProfile, resolveOpenAiImageQuality, resolveOpenAiImageSize } from "@/lib/image/image-generation-config";
import { assertImagePaidGenerationEnabled } from "@/lib/image/image-paid-generation-guard";
import { buildImageStudioPersonaHandoff } from "@/lib/persona/future/image-studio-hooks";
import { traceBrandModelContract } from "@/lib/persona/domain/brand-model-contract";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import { brandModelTracesEqual } from "@/lib/image/image-generation-identity-contract";
import { resolveBrandModelGenerationIdentity } from "@/lib/image/resolve-brand-model-generation-identity";
import { resolveApprovedMasterArtwork } from "@/lib/design/master-artwork-authority/service";
import { resolveProductProductionContext } from "@/lib/image/product-production-context";
import {
  ensureImageProductionProject,
  persistGeneratedProductionAsset,
} from "@/lib/image/production-project/service";
import type { ImageProductionProjectRepository } from "@/lib/image/production-project/repository";
import { SupabaseImageProductionProjectRepository } from "@/lib/image/production-project/supabase-repository";
import { checksumImageArtwork, fingerprintImageGenerationInput } from "./fingerprint";
import { downloadFrozenMasterArtwork, uploadFrozenMasterArtwork } from "./artwork-storage";
import { estimateImageGenerationCost } from "./pricing";
import type { ImageGenerationJobRepository } from "./repository";
import { SupabaseImageGenerationJobRepository } from "./supabase-repository";
import {
  IMAGE_GENERATION_INPUT_VERSION,
  imageGenerationInputSnapshotSchema,
  type ImageGenerationInputSnapshot,
  type ImageGenerationJob,
  type PrepareImageGenerationJobRequest,
} from "./types";

type ReportRecord = { id: string; workspaceId: string; content: BrainReportContent };

async function loadReport(recordId: string): Promise<ReportRecord | null> {
  const { getBrainClient } = await import("@/brain/client");
  const row = await getBrainClient().getRecord("reports", recordId);
  return row ? { id: row.id, workspaceId: row.workspaceId, content: row.content as BrainReportContent } : null;
}

export type ImagePaidGenerationDependencies = {
  repository: ImageGenerationJobRepository;
  loadReport: (id: string) => Promise<ReportRecord | null>;
  validateBrandModel: (scope: WorkspaceScope, trace: PrepareImageGenerationJobRequest["brandModelTrace"]) => Promise<{ masterIdentityAssetId: string; displayName: string }>;
  resolveArtworkAuthority: typeof resolveApprovedMasterArtwork;
  resolveProductContext: typeof resolveProductProductionContext;
  projectRepository: ImageProductionProjectRepository;
  persistProductionAsset: typeof persistGeneratedProductionAsset;
  freezeArtwork: typeof uploadFrozenMasterArtwork;
  resolveArtwork: typeof downloadFrozenMasterArtwork;
  resolveIdentity: typeof resolveBrandModelGenerationIdentity;
  generate: typeof generateImageAsset;
  assertPaidEnabled: () => void;
  now: () => string;
  id: () => string;
  inputCostMaximumUsd?: string;
  generationDependencies?: Partial<ImageGenerationDependencies>;
};

function deps(overrides: Partial<ImagePaidGenerationDependencies>): ImagePaidGenerationDependencies {
  return {
    repository: new SupabaseImageGenerationJobRepository(), loadReport,
    validateBrandModel: async (scope, selected) => {
      const handoff = await buildImageStudioPersonaHandoff(scope, selected.personaId, {
        expectedIdentity: {
          identityLockSnapshotId: selected.identityLockSnapshotId,
          identityLockVersion: selected.identityLockVersion,
          identityFingerprint: selected.identityFingerprint,
        }, resolveAssetAccess: false,
      });
      const actual = traceBrandModelContract(handoff.contract);
      if (!brandModelTracesEqual(selected, actual)) throw new PersonaDomainError("The selected Brand Model changed before paid preparation.", "BRAND_MODEL_VERSION_MISMATCH");
      const master = handoff.contract.identity.masterIdentityReference;
      if (!master) throw new PersonaDomainError("Brand Model has no Master Identity Reference.", "BRAND_MODEL_INELIGIBLE");
      return { masterIdentityAssetId: master.assetId, displayName: handoff.contract.displayName };
    },
    freezeArtwork: uploadFrozenMasterArtwork, resolveArtwork: downloadFrozenMasterArtwork,
    resolveArtworkAuthority: resolveApprovedMasterArtwork,
    resolveProductContext: resolveProductProductionContext,
    projectRepository: new SupabaseImageProductionProjectRepository(),
    persistProductionAsset: persistGeneratedProductionAsset,
    resolveIdentity: resolveBrandModelGenerationIdentity, generate: generateImageAsset,
    assertPaidEnabled: assertImagePaidGenerationEnabled,
    now: () => new Date().toISOString(), id: randomUUID,
    ...overrides,
  };
}

function requireActor(scope: WorkspaceScope): asserts scope is WorkspaceScope & { actorId: string } {
  if (!scope.actorId) throw new PersonaDomainError("Authenticated owner actor is required.", "AUTHENTICATION_REQUIRED");
}

function getPlannedAsset(record: ReportRecord, request: PrepareImageGenerationJobRequest) {
  const sections = record.content.imageSections;
  if (!sections || record.content.reportId !== request.reportId) throw new PersonaDomainError("Image project is invalid.", "NOT_FOUND");
  const asset = findImageAsset({ productionAssets: sections.productionAssets as ImageStudioAsset[] }, request.assetId);
  if (!asset) throw new PersonaDomainError("Image production shot was not found.", "NOT_FOUND");
  return { sections, asset };
}

export async function prepareImageGenerationJob(
  scope: WorkspaceScope,
  request: PrepareImageGenerationJobRequest,
  overrides: Partial<ImagePaidGenerationDependencies> = {},
): Promise<ImageGenerationJob> {
  requireActor(scope);
  const d = deps(overrides);
  if (request.provider !== "openai") throw new PersonaDomainError("The current artwork + Brand Model strategy requires OpenAI image edits.", "WORKFLOW");
  const record = await d.loadReport(request.reportRecordId);
  if (!record) throw new PersonaDomainError("Image project was not found.", "NOT_FOUND");
  if (record.workspaceId !== scope.workspaceId) throw new PersonaDomainError("Image project belongs to another workspace.", "UNAUTHORIZED_WORKSPACE");
  const { sections, asset } = getPlannedAsset(record, request);
  await d.repository.assertCanPrepare(
    scope,
    request.reportRecordId,
    request.assetId,
  );
  if (!asset.brandModelTrace || !brandModelTracesEqual(asset.brandModelTrace, request.brandModelTrace)) {
    throw new PersonaDomainError("Planned shot and selected Brand Model trace do not match.", "BRAND_MODEL_VERSION_MISMATCH");
  }
  const contractTrace = sections.brandModelContract ? traceBrandModelContract(sections.brandModelContract) : null;
  if (!contractTrace || !brandModelTracesEqual(contractTrace, request.brandModelTrace)) {
    throw new PersonaDomainError("Image project is not bound to the selected Brand Model lock.", "BRAND_MODEL_VERSION_MISMATCH");
  }
  const canonical = await d.validateBrandModel(scope, request.brandModelTrace);
  const resolvedArtwork = await d.resolveArtworkAuthority(
    scope,
    request.masterArtwork.reference,
  );
  const artworkBytes = resolvedArtwork.bytes;
  const artwork = resolvedArtwork.artwork;
  const checksum = checksumImageArtwork(artworkBytes);
  if (checksum !== artwork.checksum) {
    throw new PersonaDomainError(
      "Durable Master Artwork checksum changed before preparation.",
      "WORKFLOW",
    );
  }
  const product = await d.resolveProductContext(request.product);
  if (!product.authoritative || product.authority !== "SHOPIFY_LIVE") {
    throw new PersonaDomainError(
      "Paid Image preparation requires an explicitly selected Shopify product.",
      "WORKFLOW",
    );
  }
  if (
    product.authority !== "SHOPIFY_LIVE" &&
    (asset.productName !== product.productName ||
      (product.color != null && asset.color !== product.color))
  ) {
    throw new PersonaDomainError(
      "Product/color context does not match the planned production shot.",
      "WORKFLOW",
    );
  }
  const productionProject = await ensureImageProductionProject(
    scope,
    {
      reportRecordId: request.reportRecordId,
      reportId: request.reportId,
      sections,
      brandModel: request.brandModelTrace,
      artwork,
      productContext: product,
    },
    d.projectRepository,
  );
  const profile = getActiveImageGenerationProfile();
  const size = resolveOpenAiImageSize(asset.dimensions ?? "2048x2048");
  const quality = resolveOpenAiImageQuality();
  const snapshot: ImageGenerationInputSnapshot = imageGenerationInputSnapshotSchema.parse({
    version: IMAGE_GENERATION_INPUT_VERSION,
    workspaceId: scope.workspaceId,
    brandModel: { ...request.brandModelTrace, displayName: canonical.displayName, masterIdentityAssetId: canonical.masterIdentityAssetId },
    masterArtwork: {
      artworkId: artwork.id,
      designId: artwork.designId,
      version: artwork.version,
      checksum,
      mimeType: artwork.mimeType,
      byteLength: artworkBytes.length,
      sourceType: artwork.sourceType,
      approvalStatus: "APPROVED",
      sourceReportId: artwork.sourceReportId,
      sourceHandoffAt: artwork.sourceHandoffAt,
      placement: artwork.placement,
      printMethod: artwork.printMethod,
      provenance: "DESIGN_STUDIO_DURABLE",
    },
    product,
    production: {
      projectId: productionProject.id,
      projectVersion: productionProject.version,
      reportRecordId: request.reportRecordId, reportId: request.reportId,
      projectName: String((sections as { projectName?: unknown }).projectName ?? "Image project"),
      assetId: asset.id, assetType: asset.assetType, shotTitle: asset.title ?? asset.productName,
      prompt: asset.prompt.openai, scene: asset.location, lighting: asset.lighting,
      poseDirection: asset.photographyStyle || null, provider: request.provider,
      model: getImageProviderModel(request.provider), dimensions: asset.dimensions ?? "2048x2048",
      quality: profile.quality, identityStrategy: "openai_master_identity_and_artwork_edit_high_fidelity",
      artworkStrategy: "openai_secondary_master_artwork_reference",
    },
  });
  const inputFingerprint = fingerprintImageGenerationInput(snapshot);
  const estimate = estimateImageGenerationCost({ size, quality, inputCostMaximumUsd: d.inputCostMaximumUsd });
  const artworkStoragePath = await d.freezeArtwork({ workspaceId: scope.workspaceId, bytes: artworkBytes, mimeType: artwork.mimeType, checksum });
  const preparedAt = d.now();
  const confirmationExpiresAt = new Date(
    new Date(preparedAt).getTime() + 30 * 60 * 1000,
  ).toISOString();
  return d.repository.createOrGet(scope, {
    inputSnapshot: snapshot,
    inputFingerprint,
    artworkStoragePath,
    estimate,
    preparedAt,
    confirmationExpiresAt,
  });
}

export async function confirmImageGenerationJob(scope: WorkspaceScope, jobId: string, fingerprint: string, overrides: Partial<ImagePaidGenerationDependencies> = {}) {
  requireActor(scope);
  const d = deps(overrides);
  return d.repository.confirm(scope, jobId, fingerprint, `img-confirm-${d.id()}`, d.now());
}

export async function cancelImageGenerationJob(scope: WorkspaceScope, jobId: string, fingerprint: string, overrides: Partial<ImagePaidGenerationDependencies> = {}) {
  const d = deps(overrides);
  return d.repository.cancel(scope, jobId, fingerprint, d.now());
}

export async function executeImageGenerationJob(
  scope: WorkspaceScope,
  jobId: string,
  fingerprint: string,
  retryKnownFailure: boolean,
  overrides: Partial<ImagePaidGenerationDependencies> = {},
): Promise<{ job: ImageGenerationJob; result?: ImageGenerateResult }> {
  requireActor(scope);
  const d = deps(overrides);
  d.assertPaidEnabled();
  const prepared = await d.repository.get(scope, jobId);
  if (!prepared) throw new PersonaDomainError("Image generation job was not found.", "NOT_FOUND");
  if (prepared.inputFingerprint !== fingerprint || prepared.confirmationFingerprint !== fingerprint || !prepared.confirmedAt) {
    throw new PersonaDomainError("Paid confirmation does not bind this exact input fingerprint.", "WORKFLOW");
  }
  if (prepared.status === "unknown_outcome") throw new PersonaDomainError("Provider outcome is unknown. Reconcile this attempt before any retry.", "WORKFLOW");
  if (prepared.status === "succeeded" || prepared.status === "running") return { job: prepared };
  const productionProject = await d.projectRepository.get(
    scope,
    prepared.productionProjectId,
  );
  if (
    !productionProject ||
    productionProject.version !== prepared.productionProjectVersion ||
    productionProject.id !== prepared.inputSnapshot.production.projectId ||
    productionProject.masterArtwork.id !== prepared.inputSnapshot.masterArtwork.artworkId ||
    productionProject.masterArtwork.checksum !== prepared.inputSnapshot.masterArtwork.checksum ||
    JSON.stringify(productionProject.productContext) !==
      JSON.stringify(prepared.inputSnapshot.product)
  ) {
    throw new PersonaDomainError(
      "Durable Image production project changed after confirmation. Prepare again.",
      "WORKFLOW",
    );
  }
  const brandModelTrace = {
    contractVersion: prepared.inputSnapshot.brandModel.contractVersion,
    brandModelId: prepared.inputSnapshot.brandModel.brandModelId,
    personaId: prepared.inputSnapshot.brandModel.personaId,
    identityLockSnapshotId: prepared.inputSnapshot.brandModel.identityLockSnapshotId,
    identityLockVersion: prepared.inputSnapshot.brandModel.identityLockVersion,
    identityFingerprint: prepared.inputSnapshot.brandModel.identityFingerprint,
    referencePackageVersion: prepared.inputSnapshot.brandModel.referencePackageVersion,
    referencePackageFingerprint: prepared.inputSnapshot.brandModel.referencePackageFingerprint,
  };

  // Re-read server-owned plan truth before consuming the confirmation.
  const currentReport = await d.loadReport(prepared.inputSnapshot.production.reportRecordId);
  if (!currentReport || currentReport.workspaceId !== scope.workspaceId) {
    throw new PersonaDomainError("Confirmed Image project is missing or outside the workspace.", "UNAUTHORIZED_WORKSPACE");
  }
  const currentSections = currentReport.content.imageSections;
  const currentAsset = currentSections
    ? findImageAsset(
        { productionAssets: currentSections.productionAssets as ImageStudioAsset[] },
        prepared.inputSnapshot.production.assetId,
      )
    : null;
  const currentContractTrace = currentSections?.brandModelContract
    ? traceBrandModelContract(currentSections.brandModelContract)
    : null;
  const frozen = prepared.inputSnapshot.production;
  if (
    currentReport.content.reportId !== frozen.reportId ||
    !currentAsset ||
    currentAsset.prompt.openai !== frozen.prompt ||
    (currentAsset.dimensions ?? "2048x2048") !== frozen.dimensions ||
    (prepared.inputSnapshot.product.authority !== "SHOPIFY_LIVE" &&
      (currentAsset.productName !== prepared.inputSnapshot.product.productName ||
        (prepared.inputSnapshot.product.color != null &&
          currentAsset.color !== prepared.inputSnapshot.product.color))) ||
    getImageProviderModel(frozen.provider) !== frozen.model ||
    !currentContractTrace ||
    !brandModelTracesEqual(currentContractTrace, brandModelTrace)
  ) {
    throw new PersonaDomainError(
      "Paid production input changed after confirmation. Prepare and confirm a new job.",
      "WORKFLOW",
    );
  }

  // Revalidate/download both authorities before the atomic paid-call claim.
  let identity;
  let artwork;
  let providerInvocationStarted = false;
  try {
    identity = await d.resolveIdentity(scope, brandModelTrace);
    if (identity.masterReference.assetId !== prepared.inputSnapshot.brandModel.masterIdentityAssetId) throw new PersonaDomainError("Master Identity asset changed.", "BRAND_MODEL_VERSION_MISMATCH");
    const durableArtwork = await d.resolveArtworkAuthority(scope, {
      id: prepared.inputSnapshot.masterArtwork.artworkId,
      designId: prepared.inputSnapshot.masterArtwork.designId,
      version: prepared.inputSnapshot.masterArtwork.version,
      checksum: prepared.inputSnapshot.masterArtwork.checksum,
    });
    artwork = await d.resolveArtwork({
      workspaceId: scope.workspaceId, storagePath: prepared.artworkStoragePath,
      expectedChecksum: prepared.inputSnapshot.masterArtwork.checksum,
      mimeType: prepared.inputSnapshot.masterArtwork.mimeType,
    });
    if (
      checksumImageArtwork(durableArtwork.bytes) !== artwork.checksum ||
      !durableArtwork.bytes.equals(artwork.bytes)
    ) {
      throw new PersonaDomainError(
        "Frozen paid input no longer matches durable Design authority.",
        "WORKFLOW",
      );
    }
  } catch (error) {
    throw error;
  }
  const claimed = await d.repository.claim(scope, jobId, fingerprint, retryKnownFailure, d.now());
  if (!claimed) {
    const current = await d.repository.get(scope, jobId);
    if (current && (current.status === "running" || current.status === "succeeded")) return { job: current };
    throw new PersonaDomainError("Image generation job is not executable or was already consumed.", "WORKFLOW");
  }

  try {
    const result = await d.generate({
      scope,
      request: {
        reportRecordId: claimed.inputSnapshot.production.reportRecordId,
        reportId: claimed.inputSnapshot.production.reportId,
        assetId: claimed.inputSnapshot.production.assetId,
        provider: claimed.inputSnapshot.production.provider,
        promptVariant: "openai",
        brandModelTrace,
      },
      paidExecution: {
        jobId: claimed.id, inputFingerprint: claimed.inputFingerprint,
        snapshot: claimed.inputSnapshot,
        artwork: {
          artworkId: claimed.inputSnapshot.masterArtwork.artworkId,
          designId: claimed.inputSnapshot.masterArtwork.designId,
          version: claimed.inputSnapshot.masterArtwork.version,
          checksum: claimed.inputSnapshot.masterArtwork.checksum,
          mimeType: artwork.mimeType, bytes: artwork.bytes,
          placement: claimed.inputSnapshot.masterArtwork.placement,
          printMethod: claimed.inputSnapshot.masterArtwork.printMethod,
        },
        onProviderInvocation: () => {
          providerInvocationStarted = true;
        },
      },
    }, { resolveIdentity: async () => identity, ...(d.generationDependencies ?? {}) });
    const providerRequestId = result.asset.generationProvenance?.providerRequestId ?? null;
    await d.persistProductionAsset(
      scope,
      { project: productionProject, job: claimed, result },
      d.projectRepository,
    );
    const succeeded = await d.repository.markSucceeded(scope, jobId, { providerRequestId, resultAssetIds: [result.asset.id], now: d.now() });
    return { job: succeeded, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image provider execution failed";
    if (
      error instanceof PersonaDomainError ||
      error instanceof ImageProviderNotConfiguredError ||
      error instanceof ImageOpenAiQuotaExceededError ||
      !providerInvocationStarted
    ) {
      const failed = await d.repository.markFailed(scope, jobId, {
        code: error instanceof Error ? error.name : "IMAGE_EXECUTION_FAILED",
        message,
        // Provider-not-configured fails before a paid request and is safe after
        // configuration is corrected. Persona/version failures require re-prepare.
        safeRetryAllowed:
          error instanceof ImageProviderNotConfiguredError ||
          error instanceof ImageOpenAiQuotaExceededError ||
          (!(error instanceof PersonaDomainError) && !providerInvocationStarted),
        now: d.now(),
      });
      return { job: failed };
    }
    // The provider may have accepted/charged before the response was lost.
    const providerRequestId =
      typeof error === "object" &&
      error !== null &&
      "requestId" in error &&
      typeof (error as { requestId?: unknown }).requestId === "string"
        ? (error as { requestId: string }).requestId
        : null;
    const unknown = await d.repository.markUnknown(scope, jobId, {
      providerRequestId,
      reason: message,
      now: d.now(),
    });
    return { job: unknown };
  }
}
