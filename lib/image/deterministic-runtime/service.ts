import { randomUUID } from "node:crypto";

import { loadImage } from "canvas";

import type { BrainReportContent } from "@/brain/domains/reports";
import { findImageAsset } from "@/agents/image/normalized";
import type { ImageStudioAsset } from "@/agents/image/studio-schema";
import { checksumImageArtwork, fingerprintImageGenerationInput } from "@/lib/image/paid-generation/fingerprint";
import { downloadFrozenMasterArtwork, uploadFrozenMasterArtwork } from "@/lib/image/paid-generation/artwork-storage";
import { estimateImageGenerationCost } from "@/lib/image/paid-generation/pricing";
import { getActiveImageGenerationProfile, resolveOpenAiImageQuality, resolveOpenAiImageSize } from "@/lib/image/image-generation-config";
import { imageGenerationInputSnapshotV2Schema, type ImageGenerationInputSnapshotV2 } from "@/lib/image/paid-generation/types-v2";
import { assertPrintSurfaceReady } from "@/lib/image/print-surface/types";
import { compositeApprovedArtwork } from "@/lib/image/artwork-compositing/compositor";
import { buildImageStudioPersonaHandoff } from "@/lib/persona/future/image-studio-hooks";
import { traceBrandModelContract } from "@/lib/persona/domain/brand-model-contract";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import { brandModelTracesEqual } from "@/lib/image/image-generation-identity-contract";
import { resolveApprovedMasterArtwork } from "@/lib/design/master-artwork-authority/service";
import { resolveProductProductionContext, type ProductProductionContext } from "@/lib/image/product-production-context";
import { ensureImageProductionProject } from "@/lib/image/production-project/service";
import type { ImageProductionProjectRepository } from "@/lib/image/production-project/repository";
import { SupabaseImageProductionProjectRepository } from "@/lib/image/production-project/supabase-repository";
import { loadFrozenProductReference } from "@/lib/product-library/storage";
import type { ProductProfileRepository } from "@/lib/product-library/repository";
import { SupabaseProductProfileRepository } from "@/lib/product-library/supabase-repository";
import { productProductionBindingV2Schema, type ProductProfile } from "@/lib/product-library/types";
import { productVisualInputSchema } from "@/lib/product-library/product-reference-package";
import type { ProductionStageOutput } from "@/lib/image/deterministic-production/two-stage-attempt";
import { validateArtworkFidelityInput } from "@/lib/image/deterministic-runtime/fidelity";
import { DeterministicSyntheticBaseProvider, type BaseImageProvider } from "@/lib/image/deterministic-runtime/fake-base-provider";
import type { DeterministicJobRepository } from "@/lib/image/deterministic-runtime/repository";
import { SupabaseDeterministicJobRepository } from "@/lib/image/deterministic-runtime/supabase-job-repository";
import type { StageOutputRepository } from "@/lib/image/deterministic-runtime/stage-repository";
import { SupabaseStageOutputRepository } from "@/lib/image/deterministic-runtime/supabase-stage-repository";
import type { DeterministicAssetRepository } from "@/lib/image/deterministic-runtime/asset-repository";
import { SupabaseDeterministicAssetRepository } from "@/lib/image/deterministic-runtime/supabase-asset-repository";
import { loadDeterministicImageObject, persistDeterministicImageObject } from "@/lib/image/deterministic-runtime/storage";
import type { PrepareDeterministicJobRequest } from "@/lib/image/deterministic-runtime/prepare-types";
import { deterministicReviewRequestSchema, type DeterministicAsset, type DeterministicImageJob, type DeterministicRecovery } from "@/lib/image/deterministic-runtime/types";

type ReportRecord = { id: string; workspaceId: string; content: BrainReportContent };

async function loadReport(id: string): Promise<ReportRecord | null> {
  const { getBrainClient } = await import("@/brain/client");
  const row = await getBrainClient().getRecord("reports", id);
  return row ? { id: row.id, workspaceId: row.workspaceId, content: row.content as BrainReportContent } : null;
}

type FrozenArtwork = Awaited<ReturnType<typeof resolveApprovedMasterArtwork>>;

export interface DeterministicRuntimeDependencies {
  jobs: DeterministicJobRepository;
  stages: StageOutputRepository;
  assets: DeterministicAssetRepository;
  products: ProductProfileRepository;
  projects: ImageProductionProjectRepository;
  loadReport: (id: string) => Promise<ReportRecord | null>;
  validateBrandModel: (scope: WorkspaceScope, selected: PrepareDeterministicJobRequest["brandModelTrace"]) => Promise<{ displayName: string; masterIdentityAssetId: string }>;
  resolveArtwork: (scope: WorkspaceScope, reference: PrepareDeterministicJobRequest["masterArtwork"]["reference"]) => Promise<FrozenArtwork>;
  resolveProductContext: typeof resolveProductProductionContext;
  ensureProject: typeof ensureImageProductionProject;
  freezeArtwork: typeof uploadFrozenMasterArtwork;
  loadArtwork: typeof downloadFrozenMasterArtwork;
  verifyProductReference: typeof loadFrozenProductReference;
  persistImageObject: typeof persistDeterministicImageObject;
  loadImageObject: typeof loadDeterministicImageObject;
  baseProvider: BaseImageProvider;
  composite: typeof compositeApprovedArtwork;
  now: () => string;
  id: () => string;
  allowFakeExecution: () => boolean;
  inputCostMaximumUsd?: string;
}

function dependencies(overrides: Partial<DeterministicRuntimeDependencies>): DeterministicRuntimeDependencies {
  return {
    jobs: new SupabaseDeterministicJobRepository(),
    stages: new SupabaseStageOutputRepository(),
    assets: new SupabaseDeterministicAssetRepository(),
    products: new SupabaseProductProfileRepository(),
    projects: new SupabaseImageProductionProjectRepository(),
    loadReport,
    validateBrandModel: async (scope, selected) => {
      const handoff = await buildImageStudioPersonaHandoff(scope, selected.personaId, {
        expectedIdentity: {
          identityLockSnapshotId: selected.identityLockSnapshotId,
          identityLockVersion: selected.identityLockVersion,
          identityFingerprint: selected.identityFingerprint,
        },
        resolveAssetAccess: false,
      });
      const actual = traceBrandModelContract(handoff.contract);
      if (!brandModelTracesEqual(selected, actual)) throw new PersonaDomainError("The selected Brand Model changed before v2 preparation.", "BRAND_MODEL_VERSION_MISMATCH");
      const master = handoff.contract.identity.masterIdentityReference;
      if (!master) throw new PersonaDomainError("Brand Model has no Master Identity Reference.", "BRAND_MODEL_INELIGIBLE");
      return { displayName: handoff.contract.displayName, masterIdentityAssetId: master.assetId };
    },
    resolveArtwork: resolveApprovedMasterArtwork,
    resolveProductContext: resolveProductProductionContext,
    ensureProject: ensureImageProductionProject,
    freezeArtwork: uploadFrozenMasterArtwork,
    loadArtwork: downloadFrozenMasterArtwork,
    verifyProductReference: loadFrozenProductReference,
    persistImageObject: persistDeterministicImageObject,
    loadImageObject: loadDeterministicImageObject,
    baseProvider: new DeterministicSyntheticBaseProvider(),
    composite: compositeApprovedArtwork,
    now: () => new Date().toISOString(),
    id: randomUUID,
    allowFakeExecution: () => process.env.NODE_ENV !== "production",
    ...overrides,
  };
}

function requireActor(scope: WorkspaceScope): asserts scope is WorkspaceScope & { actorId: string } {
  if (!scope.actorId) throw new PersonaDomainError("Authenticated owner actor is required.", "AUTHENTICATION_REQUIRED");
}

function plannedShot(record: ReportRecord, request: PrepareDeterministicJobRequest) {
  const sections = record.content.imageSections;
  if (!sections || record.content.reportId !== request.reportId) throw new PersonaDomainError("Image project is invalid.", "NOT_FOUND");
  const asset = findImageAsset({ productionAssets: sections.productionAssets as ImageStudioAsset[] }, request.assetId);
  if (!asset) throw new PersonaDomainError("Image production shot was not found.", "NOT_FOUND");
  if (!asset.brandModelTrace || !brandModelTracesEqual(asset.brandModelTrace, request.brandModelTrace)) {
    throw new PersonaDomainError("Planned shot and selected Brand Model trace do not match.", "BRAND_MODEL_VERSION_MISMATCH");
  }
  const reportTrace = sections.brandModelContract ? traceBrandModelContract(sections.brandModelContract) : null;
  if (!reportTrace || !brandModelTracesEqual(reportTrace, request.brandModelTrace)) {
    throw new PersonaDomainError("Image project is not bound to the selected Brand Model lock.", "BRAND_MODEL_VERSION_MISMATCH");
  }
  return { sections, asset };
}

function exactProductContext(profile: ProductProfile, context: ProductProductionContext, variantId: string) {
  if (profile.authority !== "SHOPIFY_LIVE" || !profile.shopifyProductId || context.authority !== "SHOPIFY_LIVE" || !context.authoritative) {
    throw new PersonaDomainError("V2 production currently requires an exact Shopify-live Product profile.", "WORKFLOW");
  }
  if (context.productId !== profile.shopifyProductId || context.variantId !== variantId) {
    throw new PersonaDomainError("The live Product/variant no longer matches the frozen Product profile selection.", "WORKFLOW");
  }
  if (!profile.variants.some((variant) => variant.variantId === variantId)) {
    throw new PersonaDomainError("The selected variant is not present in the exact Product profile version.", "WORKFLOW");
  }
}

function buildBasePrompt(input: { profile: ProductProfile; context: ProductProductionContext; asset: ImageStudioAsset }): string {
  const garment = [input.context.color, input.context.productType, input.context.material, input.context.fit].filter(Boolean).join(" ");
  return [
    "Create one clean campaign base image for later deterministic artwork compositing.",
    `Garment/product: ${garment || input.profile.productType}.`,
    `Scene: ${input.asset.location}. Lighting: ${input.asset.lighting}.`,
    input.asset.photographyStyle ? `Pose/camera: ${input.asset.photographyStyle}.` : null,
    "Keep the calibrated print surface clear and unobstructed.",
    "Do not draw, infer, recreate, reference, or include the approved Master Artwork, any logo, or any typography.",
  ].filter(Boolean).join(" ");
}

export async function prepareDeterministicImageJob(
  scope: WorkspaceScope,
  request: PrepareDeterministicJobRequest,
  overrides: Partial<DeterministicRuntimeDependencies> = {},
): Promise<DeterministicImageJob> {
  requireActor(scope);
  const d = dependencies(overrides);
  const record = await d.loadReport(request.reportRecordId);
  if (!record) throw new PersonaDomainError("Image project was not found.", "NOT_FOUND");
  if (record.workspaceId !== scope.workspaceId) throw new PersonaDomainError("Image project belongs to another workspace.", "UNAUTHORIZED_WORKSPACE");
  const { sections, asset } = plannedShot(record, request);
  const identity = await d.validateBrandModel(scope, request.brandModelTrace);
  const resolvedArtwork = await d.resolveArtwork(scope, request.masterArtwork.reference);
  if (checksumImageArtwork(resolvedArtwork.bytes) !== resolvedArtwork.artwork.checksum) throw new PersonaDomainError("Approved Artwork checksum changed before v2 preparation.", "WORKFLOW");

  const profile = await d.products.getVersion(scope, request.productProfile.profileKey, request.productProfile.version);
  if (!profile) throw new PersonaDomainError("The selected Product profile version was not found.", "NOT_FOUND");
  if (profile.workspaceId !== scope.workspaceId) throw new PersonaDomainError("Product profile belongs to another workspace.", "UNAUTHORIZED_WORKSPACE");
  const context = await d.resolveProductContext({ authority: "SHOPIFY_LIVE", productId: profile.shopifyProductId!, variantId: request.productProfile.variantId });
  exactProductContext(profile, context, request.productProfile.variantId);
  const surface = profile.printSurfaces.find((candidate) => candidate.printSurfaceId === request.printSurface.printSurfaceId && candidate.version === request.printSurface.version);
  if (!surface || surface.productProfileId !== profile.productProfileId || surface.variantId !== context.variantId) throw new PersonaDomainError("The exact PrintSurface version is not bound to this Product/variant.", "WORKFLOW");
  assertPrintSurfaceReady(surface);
  if (!profile.references.length) throw new PersonaDomainError("Frozen Product references are required before v2 preparation.", "WORKFLOW");
  for (const reference of profile.references) {
    if (!reference.privateStoragePath || !reference.contentChecksumSha256) throw new PersonaDomainError("Product reference is not frozen and checksummed.", "WORKFLOW");
    await d.verifyProductReference({ workspaceId: scope.workspaceId, path: reference.privateStoragePath, expectedChecksum: reference.contentChecksumSha256 });
  }

  const project = await d.ensureProject(scope, {
    reportRecordId: request.reportRecordId,
    reportId: request.reportId,
    sections,
    brandModel: request.brandModelTrace,
    artwork: resolvedArtwork.artwork,
    productContext: context,
  }, d.projects);
  const selectedVariant = profile.variants.find((variant) => variant.variantId === context.variantId)!;
  const product = productProductionBindingV2Schema.parse({
    version: "product-production-binding-v2",
    productProfileId: profile.productProfileId,
    profileVersion: profile.version,
    authority: profile.authority,
    shopifyProductId: profile.shopifyProductId,
    variantId: context.variantId,
    productName: context.productName,
    productType: context.productType,
    color: context.color ?? selectedVariant.color,
    size: context.size ?? selectedVariant.size,
    material: context.material ?? profile.construction.material,
    fit: context.fit ?? profile.construction.fit,
    collection: context.collection ?? profile.collections[0] ?? null,
    availability: context.availability,
    active: context.active,
    provenance: { source: profile.provenance.source, capturedAt: profile.provenance.capturedAt, sourceVersion: profile.provenance.sourceVersion },
  });
  const productVisualInput = productVisualInputSchema.parse({
    contractVersion: "product-visual-input-v1",
    productProfileId: profile.productProfileId,
    authority: profile.authority,
    shopifyProductId: profile.shopifyProductId,
    variantId: context.variantId,
    color: product.color,
    material: product.material,
    fit: product.fit,
    construction: profile.construction,
    referencePackage: {
      schemaVersion: "product-reference-package-v1",
      packageId: `${profile.productProfileId}:v${profile.version}`,
      authority: profile.authority,
      productProfileId: profile.productProfileId,
      shopifyProductId: profile.shopifyProductId,
      productVersion: profile.provenance.sourceVersion,
      references: profile.references,
      capturedAt: profile.provenance.capturedAt,
      provenance: profile.provenance.source,
    },
  });
  const profileConfig = getActiveImageGenerationProfile();
  const snapshot: ImageGenerationInputSnapshotV2 = imageGenerationInputSnapshotV2Schema.parse({
    version: "image-generation-input-v2",
    productionMode: "DETERMINISTIC_COMPOSITE",
    workspaceId: scope.workspaceId,
    brandModel: { ...request.brandModelTrace, ...identity },
    product,
    productVisualInput,
    masterArtwork: {
      artworkId: resolvedArtwork.artwork.id,
      designId: resolvedArtwork.artwork.designId,
      version: resolvedArtwork.artwork.version,
      checksum: resolvedArtwork.artwork.checksum,
      mimeType: resolvedArtwork.artwork.mimeType,
      byteLength: resolvedArtwork.bytes.length,
      sourceType: resolvedArtwork.artwork.sourceType,
      approvalStatus: "APPROVED",
      sourceReportId: resolvedArtwork.artwork.sourceReportId,
      sourceHandoffAt: resolvedArtwork.artwork.sourceHandoffAt,
      placement: resolvedArtwork.artwork.placement,
      printMethod: resolvedArtwork.artwork.printMethod,
      provenance: "DESIGN_STUDIO_DURABLE",
    },
    printSurface: surface,
    shot: {
      assetId: asset.id,
      assetType: asset.assetType,
      title: asset.title ?? asset.productName,
      scene: asset.location,
      lighting: asset.lighting,
      poseDirection: asset.photographyStyle || null,
      campaignDirection: sections.visualDirection ?? sections.projectName,
    },
    production: { projectId: project.id, projectVersion: project.version, reportRecordId: request.reportRecordId, reportId: request.reportId },
    baseGeneration: {
      provider: "openai",
      model: profileConfig.model,
      dimensions: asset.dimensions ?? "2048x2048",
      quality: resolveOpenAiImageQuality(),
      assetCount: 1,
      personaStrategy: "MASTER_IDENTITY_REFERENCE",
      productStrategy: "PRODUCT_REFERENCES_AND_METADATA",
      artworkStrategy: "NO_MASTER_ARTWORK_INPUT",
      prompt: buildBasePrompt({ profile, context, asset }),
    },
    compositing: {
      compositorVersion: "nexhq-deterministic-compositor-v1",
      sampling: "BILINEAR_SOURCE_PIXEL",
      blending: "SOURCE_OVER",
      shadingFactor: 1,
      automaticProviderRetryOnCompositeFailure: false,
    },
  });
  const inputFingerprint = fingerprintImageGenerationInput(snapshot);
  const rawEstimate = estimateImageGenerationCost({ size: resolveOpenAiImageSize(asset.dimensions ?? "2048x2048"), quality: resolveOpenAiImageQuality(), inputCostMaximumUsd: d.inputCostMaximumUsd });
  const estimate = { ...rawEstimate, basis: "Stage A only: one potential base-image output plus the configured Persona/Product-reference input allowance. Stage B deterministic compositing has no provider charge." };
  const artworkStoragePath = await d.freezeArtwork({ workspaceId: scope.workspaceId, bytes: resolvedArtwork.bytes, mimeType: resolvedArtwork.artwork.mimeType, checksum: resolvedArtwork.artwork.checksum });
  const preparedAt = d.now();
  return d.jobs.createOrGet(scope, {
    snapshot,
    fingerprint: inputFingerprint,
    artworkStoragePath,
    estimate,
    preparedAt,
    confirmationExpiresAt: new Date(new Date(preparedAt).getTime() + 30 * 60 * 1000).toISOString(),
  });
}

export async function confirmDeterministicImageJob(scope: WorkspaceScope, jobId: string, fingerprint: string, overrides: Partial<DeterministicRuntimeDependencies> = {}) {
  requireActor(scope);
  const d = dependencies(overrides);
  return d.jobs.confirm(scope, jobId, fingerprint, `img-v2-confirm-${d.id()}`, d.now());
}

function assertExactJob(job: DeterministicImageJob, fingerprint: string) {
  if (job.inputSnapshot.version !== "image-generation-input-v2" || job.inputSnapshot.productionMode !== "DETERMINISTIC_COMPOSITE") throw new PersonaDomainError("V2 executor refuses non-v2 or draft jobs.", "WORKFLOW");
  if (job.inputSnapshot.baseGeneration.assetCount !== 1) throw new PersonaDomainError("V2 execution requires exactly one asset.", "WORKFLOW");
  if (job.inputFingerprint !== fingerprint || fingerprintImageGenerationInput(job.inputSnapshot) !== fingerprint) throw new PersonaDomainError("V2 execution fingerprint mismatch.", "WORKFLOW");
}

function productContextFromSnapshot(job: DeterministicImageJob): ProductProductionContext {
  const product = job.inputSnapshot.product;
  return {
    version: "product-production-context-v1",
    productId: product.shopifyProductId,
    variantId: product.variantId,
    productName: product.productName,
    productType: product.productType,
    color: product.color,
    size: product.size,
    material: product.material,
    fit: product.fit,
    collection: product.collection,
    availability: product.availability,
    active: product.active,
    authority: product.authority === "SHOPIFY_LIVE" ? "SHOPIFY_LIVE" : "UNKNOWN",
    authoritative: product.authority === "SHOPIFY_LIVE",
    provenance: { source: product.provenance.source, sourceRecordId: product.variantId ?? product.shopifyProductId, capturedAt: product.provenance.capturedAt, sourceVersion: product.provenance.sourceVersion },
  };
}

async function compositeFromStoredBase(scope: WorkspaceScope, job: DeterministicImageJob, d: DeterministicRuntimeDependencies, base: NonNullable<Awaited<ReturnType<StageOutputRepository["getSucceededBase"]>>>, attempt: number): Promise<DeterministicAsset> {
  const baseBytes = await d.loadImageObject({ workspaceId: scope.workspaceId, path: base.storagePath, expectedChecksum: base.checksumSha256 });
  const artwork = await d.loadArtwork({ workspaceId: scope.workspaceId, storagePath: job.artworkStoragePath, expectedChecksum: job.inputSnapshot.masterArtwork.checksum, mimeType: job.inputSnapshot.masterArtwork.mimeType });
  const image = await loadImage(artwork.bytes);
  const fidelity = validateArtworkFidelityInput({ job, artworkBytes: artwork.bytes, sourceWidth: image.width, sourceHeight: image.height });
  const result = await d.composite({
    baseImage: { id: base.stageOutputId, bytes: baseBytes, checksumSha256: base.checksumSha256 },
    artwork: { id: job.inputSnapshot.masterArtwork.artworkId, version: job.inputSnapshot.masterArtwork.version, bytes: artwork.bytes, checksumSha256: artwork.checksum },
    printSurface: job.inputSnapshot.printSurface,
    shadingFactor: job.inputSnapshot.compositing.shadingFactor,
  }, d.now());
  const finalPath = `workspace/${scope.workspaceId}/deterministic-v2/${job.id}/composite/${result.outputChecksumSha256}.png`;
  await d.persistImageObject({ workspaceId: scope.workspaceId, path: finalPath, bytes: result.pngBytes, expectedChecksum: result.outputChecksumSha256 });
  const compositeStage: ProductionStageOutput = {
    stageOutputId: d.id(), jobId: job.id, stage: "DETERMINISTIC_COMPOSITE", stageAttempt: attempt,
    status: "SUCCEEDED", assetId: null, storagePath: finalPath, checksumSha256: result.outputChecksumSha256,
    providerRequestId: null, provenance: { ...result.provenance, fidelityValidation: fidelity, baseStageOutputId: base.stageOutputId },
    failureCode: null, failureMessage: null, createdAt: d.now(),
  };
  const persistedComposite = await d.stages.insert(scope, compositeStage);
  const asset = await d.assets.record(scope, {
    id: d.id(), job, productContext: productContextFromSnapshot(job), baseStageOutputId: base.stageOutputId,
    baseProviderRequestId: base.providerRequestId,
    compositeStageOutputId: persistedComposite.stageOutputId, storagePath: finalPath,
    compositingProvenance: result.provenance, generatedAt: d.now(),
  });
  await d.jobs.markSucceeded(scope, job.id, asset.id, base.providerRequestId, d.now());
  return asset;
}

export async function executeFakeDeterministicJob(scope: WorkspaceScope, jobId: string, fingerprint: string, overrides: Partial<DeterministicRuntimeDependencies> = {}): Promise<DeterministicRecovery> {
  const d = dependencies(overrides);
  if (!d.allowFakeExecution()) throw new PersonaDomainError("Synthetic Stage A is disabled in production runtime.", "WORKFLOW");
  const before = await d.jobs.get(scope, jobId);
  if (!before) throw new PersonaDomainError("Deterministic job not found.", "NOT_FOUND");
  assertExactJob(before, fingerprint);
  const existingBase = await d.stages.getSucceededBase(scope, jobId);
  if (existingBase) {
    if (before.status === "succeeded") return getDeterministicRecovery(scope, jobId, overrides);
    if (before.status === "unknown_outcome") throw new PersonaDomainError("Unknown provider outcome must be reconciled before compositing.", "WORKFLOW");
    if (before.status !== "running") throw new PersonaDomainError("Use Retry Composite after a composite failure.", "WORKFLOW");
    await compositeFromStoredBase(scope, before, d, existingBase, (await d.stages.list(scope, jobId)).filter((stage) => stage.stage === "DETERMINISTIC_COMPOSITE").length + 1);
    return getDeterministicRecovery(scope, jobId, overrides);
  }
  const claimed = await d.jobs.claimBase(scope, jobId, fingerprint, d.now());
  if (!claimed) throw new PersonaDomainError("Job is not confirmed, confirmation expired, or execution was already claimed.", "WORKFLOW");
  try {
    const generated = await d.baseProvider.generate(claimed.inputSnapshot);
    const path = `workspace/${scope.workspaceId}/deterministic-v2/${jobId}/base/${generated.checksumSha256}.png`;
    await d.persistImageObject({ workspaceId: scope.workspaceId, path, bytes: generated.bytes, expectedChecksum: generated.checksumSha256 });
    const base = await d.stages.insert(scope, {
      stageOutputId: d.id(), jobId, stage: "BASE_GENERATION", stageAttempt: claimed.attemptCount,
      status: "SUCCEEDED", assetId: d.id(), storagePath: path, checksumSha256: generated.checksumSha256,
      providerRequestId: generated.providerRequestId, provenance: generated.provenance,
      failureCode: null, failureMessage: null, createdAt: d.now(),
    });
    await compositeFromStoredBase(scope, claimed, d, base as NonNullable<Awaited<ReturnType<StageOutputRepository["getSucceededBase"]>>>, 1);
  } catch (error) {
    const base = await d.stages.getSucceededBase(scope, jobId);
    if (base) {
      const message = error instanceof Error ? error.message : "Composite failed.";
      await d.stages.insert(scope, { stageOutputId: d.id(), jobId, stage: "DETERMINISTIC_COMPOSITE", stageAttempt: 1, status: "FAILED", assetId: null, storagePath: null, checksumSha256: null, providerRequestId: null, provenance: { retryBoundary: "REUSE_PERSISTED_BASE", automaticProviderRetry: false, baseStageOutputId: base.stageOutputId }, failureCode: "DETERMINISTIC_COMPOSITE_FAILED", failureMessage: message, createdAt: d.now() });
      await d.jobs.markFailed(scope, jobId, { code: "DETERMINISTIC_COMPOSITE_FAILED", message, now: d.now() });
    } else await d.jobs.markUnknown(scope, jobId, "Stage A claim completed without a durable base result; fail closed before any retry.", d.now());
  }
  return getDeterministicRecovery(scope, jobId, overrides);
}

export async function retryDeterministicComposite(scope: WorkspaceScope, jobId: string, fingerprint: string, overrides: Partial<DeterministicRuntimeDependencies> = {}): Promise<DeterministicRecovery> {
  const d = dependencies(overrides);
  const job = await d.jobs.get(scope, jobId);
  if (!job) throw new PersonaDomainError("Deterministic job not found.", "NOT_FOUND");
  assertExactJob(job, fingerprint);
  const base = await d.stages.getSucceededBase(scope, jobId);
  if (!base) throw new PersonaDomainError("Composite retry requires the exact stored successful base.", "WORKFLOW");
  if (!await d.jobs.claimCompositeRetry(scope, jobId, fingerprint, d.now())) throw new PersonaDomainError("Only a deterministic composite failure can be retried.", "WORKFLOW");
  const attempt = (await d.stages.list(scope, jobId)).filter((stage) => stage.stage === "DETERMINISTIC_COMPOSITE").length + 1;
  try {
    await compositeFromStoredBase(scope, { ...job, status: "running" }, d, base, attempt);
  } catch (error) {
    await d.stages.insert(scope, { stageOutputId: d.id(), jobId, stage: "DETERMINISTIC_COMPOSITE", stageAttempt: attempt, status: "FAILED", assetId: null, storagePath: null, checksumSha256: null, providerRequestId: null, provenance: { retryBoundary: "REUSE_PERSISTED_BASE", automaticProviderRetry: false, baseStageOutputId: base.stageOutputId }, failureCode: "DETERMINISTIC_COMPOSITE_FAILED", failureMessage: error instanceof Error ? error.message : "Composite retry failed.", createdAt: d.now() });
    await d.jobs.markFailed(scope, jobId, { code: "DETERMINISTIC_COMPOSITE_FAILED", message: error instanceof Error ? error.message : "Composite retry failed.", now: d.now() });
  }
  return getDeterministicRecovery(scope, jobId, overrides);
}

function recoveryState(job: DeterministicImageJob, stages: ProductionStageOutput[], asset: DeterministicAsset | null): DeterministicRecovery["state"] {
  if (asset?.reviewStatus === "APPROVED") return "APPROVED";
  if (asset?.reviewStatus === "REJECTED") return "REJECTED";
  if (asset) return "REVIEW_REQUIRED";
  if (job.status === "unknown_outcome") return "UNKNOWN_PROVIDER_OUTCOME";
  if (job.status === "cancelled") return "CANCELLED";
  if (job.status === "failed" && job.failureCode === "DETERMINISTIC_COMPOSITE_FAILED") return "COMPOSITE_FAILED";
  if (job.status === "failed") return "BASE_FAILED";
  if (job.status === "awaiting_confirmation") return "AWAITING_CONFIRMATION";
  if (job.status === "confirmed") return "CONFIRMED";
  if (stages.some((stage) => stage.stage === "BASE_GENERATION" && stage.status === "SUCCEEDED")) return "BASE_READY";
  return "COMPOSITING";
}

export async function getDeterministicRecovery(scope: WorkspaceScope, jobId: string, overrides: Partial<DeterministicRuntimeDependencies> = {}): Promise<DeterministicRecovery> {
  const d = dependencies(overrides);
  const job = await d.jobs.get(scope, jobId);
  if (!job) throw new PersonaDomainError("Deterministic job not found.", "NOT_FOUND");
  const [stages, asset] = await Promise.all([d.stages.list(scope, jobId), d.assets.getByJob(scope, jobId)]);
  return { state: recoveryState(job, stages, asset), job, stages, asset };
}

export async function listDeterministicJobs(scope: WorkspaceScope, projectId?: string, overrides: Partial<DeterministicRuntimeDependencies> = {}) {
  return dependencies(overrides).jobs.list(scope, projectId ? { projectId } : undefined);
}

export async function reviewDeterministicAsset(scope: WorkspaceScope, assetId: string, input: unknown, overrides: Partial<DeterministicRuntimeDependencies> = {}) {
  requireActor(scope);
  const d = dependencies(overrides);
  const request = deterministicReviewRequestSchema.parse(input);
  if (request.decision === "APPROVED" && Object.values(request.checklist).some((value) => value !== "PASS")) {
    throw new PersonaDomainError("All mockup checks must pass before human approval.", "WORKFLOW");
  }
  return d.assets.review(scope, assetId, request, d.now());
}
