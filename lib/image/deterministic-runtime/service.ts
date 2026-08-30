import { randomUUID } from "node:crypto";

import { loadImage } from "canvas";
import {
  assertMasterArtworkImageIntegrity,
  assertSupportedRasterImageIntegrity,
} from "@/lib/design/master-artwork-authority/image-integrity";

import type { BrainReportContent } from "@/brain/domains/reports";
import { findImageAsset } from "@/agents/image/normalized";
import type { ImageStudioAsset } from "@/agents/image/studio-schema";
import {
  checksumImageArtwork,
  fingerprintImageGenerationInput,
} from "@/lib/image/paid-generation/fingerprint";
import {
  downloadFrozenMasterArtwork,
  uploadFrozenMasterArtwork,
} from "@/lib/image/paid-generation/artwork-storage";
import { estimateImageGenerationCost } from "@/lib/image/paid-generation/pricing";
import {
  getActiveImageGenerationProfile,
  resolveOpenAiImageQuality,
  resolveOpenAiImageSize,
} from "@/lib/image/image-generation-config";
import {
  imageGenerationInputSnapshotV2Schema,
  effectivePrintSurfaceForSnapshot,
  type ImageGenerationInputSnapshotV2,
} from "@/lib/image/paid-generation/types-v2";
import {
  assertPrintSurfaceReady,
  printSurfaceSchema,
  type PrintSurface,
} from "@/lib/image/print-surface/types";
import { compositeApprovedArtwork } from "@/lib/image/artwork-compositing/compositor";
import {
  COMPOSITOR_VERSION_V3,
  DEPTH_AWARE_SURFACE_INTEGRATION_VERSION_V1,
  DEPTH_AWARE_SURFACE_INTEGRATION_VERSION_V1_1,
  DEFAULT_DEPTH_AWARE_SURFACE_INTEGRATION,
  DEFAULT_FABRIC_AWARE_INTEGRATION,
  DEFAULT_OWNER_VERTICAL_DEPTH_AWARE_SURFACE_INTEGRATION,
  DEFAULT_SURFACE_REALISM_REFINEMENT_INTEGRATION,
  DEFAULT_SURFACE_CONFORMING_FABRIC_INTEGRATION,
} from "@/lib/image/artwork-compositing/types";
import { surfaceIntegrationEvidenceFromError } from "@/lib/image/artwork-compositing/surface-conforming-v1";
import { depthAwareEvidenceFromError } from "@/lib/image/artwork-compositing/depth-aware-surface-v1";
import { surfaceRealismRefinementEvidenceFromError } from "@/lib/image/artwork-compositing/surface-realism-refinement-v1";
import { STRICT_CONTAIN_FIT_VERSION } from "@/lib/image/artwork-compositing/strict-contain-fit";
import {
  createOwnerPrintFootprint,
  OWNER_PRINT_FOOTPRINT_ERROR,
} from "@/lib/image/owner-print-footprint";
import {
  createOwnerVerticalPlacement,
  OWNER_VERTICAL_PLACEMENT_ERROR,
  supportsOwnerVerticalPlacement,
} from "@/lib/image/owner-vertical-placement";
import {
  DEFAULT_NORMAL_ASSISTED_ORIENTED_FRONT_PRINT_PLANE_POLICY,
  orientedFrontPrintPlaneEvidenceFromError,
  supportsOrientedFrontPrintPlane,
} from "@/lib/image/deterministic-runtime/oriented-front-print-plane-v2";
import { buildImageStudioPersonaHandoff } from "@/lib/persona/future/image-studio-hooks";
import { traceBrandModelContract } from "@/lib/persona/domain/brand-model-contract";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import { brandModelTracesEqual } from "@/lib/image/image-generation-identity-contract";
import { resolveApprovedMasterArtwork } from "@/lib/design/master-artwork-authority/service";
import { resolveBrandModelGenerationIdentity } from "@/lib/image/resolve-brand-model-generation-identity";
import { buildDeterministicBaseProviderRequest } from "@/lib/image/deterministic-production/base-provider-request";
import {
  generateWithProvider,
  isImageProviderConfigured,
} from "@/agents/image/providers/registry";
import { assertImagePaidGenerationEnabled } from "@/lib/image/image-paid-generation-guard";
import {
  productProductionContextSchema,
  resolveProductProductionContext,
  type ProductProductionContext,
} from "@/lib/image/product-production-context";
import { ensureImageProductionProject } from "@/lib/image/production-project/service";
import type { ImageProductionProjectRepository } from "@/lib/image/production-project/repository";
import { SupabaseImageProductionProjectRepository } from "@/lib/image/production-project/supabase-repository";
import { loadFrozenProductReference } from "@/lib/product-library/storage";
import { completeFrozenProductReference } from "@/lib/product-library/freeze-product-references";
import type { ProductProfileRepository } from "@/lib/product-library/repository";
import {
  resolveGeneratedGarmentRelativeQuad,
  selectStageAProductReferences,
} from "@/lib/product-library/product-family";
import {
  garmentRegistrationV2Schema,
  printSurfaceForGarmentRegistration,
  registerGeneratedGarmentV2,
  type GarmentRegistrationV2,
  type NormalizedBounds,
} from "@/lib/image/deterministic-runtime/garment-registration-v2";
import {
  garmentRegistrationV3Schema,
  printIntentWithinGarment,
  printSurfaceForGarmentRegistrationV3,
  registerGeneratedGarmentV3,
  type GarmentRegistrationV3,
} from "@/lib/image/deterministic-runtime/garment-registration-v3";
import { extractFaceLandmarks68 } from "@/lib/persona/face-novelty-memory/local-face-landmarks";
import { SupabaseProductProfileRepository } from "@/lib/product-library/supabase-repository";
import {
  productProductionBindingV2Schema,
  type FrozenProductVisualReference,
  type ProductProfile,
} from "@/lib/product-library/types";
import { productVisualInputSchema } from "@/lib/product-library/product-reference-package";
import { assessManualProductEligibility } from "@/lib/product-library/service";
import { assertFamilySurfaceUsableForShopifyProduct } from "@/lib/product-library/print-surface-reuse";
import type { ProductionStageOutput } from "@/lib/image/deterministic-production/two-stage-attempt";
import { validateArtworkFidelityInput } from "@/lib/image/deterministic-runtime/fidelity";
import {
  inspectBasePrintPurity,
  type BasePrintPurityAssessment,
} from "@/lib/image/deterministic-runtime/base-print-purity";
import {
  DeterministicSyntheticBaseProvider,
  type BaseImageProvider,
} from "@/lib/image/deterministic-runtime/fake-base-provider";
import type { DeterministicJobRepository } from "@/lib/image/deterministic-runtime/repository";
import { SupabaseDeterministicJobRepository } from "@/lib/image/deterministic-runtime/supabase-job-repository";
import type { StageOutputRepository } from "@/lib/image/deterministic-runtime/stage-repository";
import { SupabaseStageOutputRepository } from "@/lib/image/deterministic-runtime/supabase-stage-repository";
import type { DeterministicAssetRepository } from "@/lib/image/deterministic-runtime/asset-repository";
import { SupabaseDeterministicAssetRepository } from "@/lib/image/deterministic-runtime/supabase-asset-repository";
import {
  loadDeterministicImageObject,
  persistDeterministicImageObject,
} from "@/lib/image/deterministic-runtime/storage";
import type { PrepareDeterministicJobRequest } from "@/lib/image/deterministic-runtime/prepare-types";
import {
  deterministicReviewRequestSchema,
  type DeterministicAsset,
  type DeterministicImageJob,
  type DeterministicRecovery,
} from "@/lib/image/deterministic-runtime/types";
import {
  semanticPlacementSnapshot,
} from "@/lib/image/semantic-print-placement";
import {
  printSurfaceFromProductTemplate,
  resolveAutomaticProductPlacement,
  resolveProductPlacementTemplate,
} from "@/lib/image/product-placement-templates";
import {
  contentShotById,
  resolveContentShotForSide,
} from "@/lib/image/content-packs";
import { resolveFrontLargeProductionTuning } from "@/lib/image/front-large-production-tuning";
import {
  createCreativeDirection,
  creativeDirectionPromptLines,
  socialCreativeDirectionV1Schema,
  type SocialCreativeDirectionV1,
} from "@/lib/image/social-creative-direction";
import {
  garmentSegmentationProvenanceSchema,
  type GarmentSegmentationProvider,
  type GarmentSegmentationProvenance,
  type GarmentSegmentationPolicy,
  type ValidatedGarmentSegmentation,
} from "@/lib/image/garment-segmentation/types";
import { garmentSegmentationIdempotencyKey } from "@/lib/image/garment-segmentation/sam3-http-adapter";
import { createGarmentSegmentationProviderFromEnvironment } from "@/lib/image/garment-segmentation/provider-factory";
import {
  garmentSegmentationPrompt,
  rejectedSegmentationProvenance,
  validateGarmentSegmentation,
} from "@/lib/image/garment-segmentation/validation";
import { garmentSegmentationMaskStoragePath } from "@/lib/image/garment-segmentation/storage";
import { includeGarmentSegmentationCost } from "@/lib/image/garment-segmentation/pricing";
import {
  DEFAULT_PRINT_READY_STAGE_A,
  assessLocalPrintReadyStageA,
  assessRegisteredPrintReadyStageA,
  type PrintReadyStageAAssessment,
} from "@/lib/image/deterministic-runtime/print-ready-stage-a";
import type {
  DepthEstimationProvider,
  DepthEstimationPolicy,
  DepthEstimationProvenance,
  ValidatedDepthEstimation,
} from "@/lib/image/depth-estimation/types";
import { depthEstimationProvenanceSchema } from "@/lib/image/depth-estimation/types";
import { createDepthEstimationProviderFromEnvironment } from "@/lib/image/depth-estimation/provider-factory";
import {
  depthEstimationIdempotencyKey,
  rejectedDepthProvenance,
  validateDepthEstimation,
} from "@/lib/image/depth-estimation/validation";
import { depthMapStoragePath } from "@/lib/image/depth-estimation/storage";
import { includeDepthEstimationCost } from "@/lib/image/depth-estimation/pricing";
import type {
  NormalEstimationPolicy,
  NormalEstimationProvider,
  NormalEstimationProvenance,
  ValidatedNormalEstimation,
} from "@/lib/image/normal-estimation/types";
import { NormalEstimationProviderOutcomeUnknownError } from "@/lib/image/normal-estimation/types";
import { createNormalEstimationProviderFromEnvironment } from "@/lib/image/normal-estimation/provider-factory";
import {
  normalEstimationIdempotencyKey,
  rejectedNormalProvenance,
  validateNormalEstimation,
} from "@/lib/image/normal-estimation/validation";
import { normalMapStoragePath } from "@/lib/image/normal-estimation/storage";
import { includeMidasNormalCost } from "@/lib/image/normal-estimation/pricing";
import {
  assessBrandModelIdentityConsistency,
  brandModelIdentityConsistencySchema,
  type BrandModelIdentityConsistency,
} from "@/lib/image/deterministic-runtime/identity-consistency";

type ReportRecord = {
  id: string;
  workspaceId: string;
  content: BrainReportContent;
};

async function loadReport(id: string): Promise<ReportRecord | null> {
  const { getBrainClient } = await import("@/brain/client");
  const row = await getBrainClient().getRecord("reports", id);
  return row
    ? {
        id: row.id,
        workspaceId: row.workspaceId,
        content: row.content as BrainReportContent,
      }
    : null;
}

type FrozenArtwork = Awaited<ReturnType<typeof resolveApprovedMasterArtwork>>;

export interface DeterministicRuntimeDependencies {
  jobs: DeterministicJobRepository;
  stages: StageOutputRepository;
  assets: DeterministicAssetRepository;
  products: ProductProfileRepository;
  projects: ImageProductionProjectRepository;
  loadReport: (id: string) => Promise<ReportRecord | null>;
  validateBrandModel: (
    scope: WorkspaceScope,
    selected: PrepareDeterministicJobRequest["brandModelTrace"],
  ) => Promise<{ displayName: string; masterIdentityAssetId: string }>;
  resolveArtwork: (
    scope: WorkspaceScope,
    reference: PrepareDeterministicJobRequest["masterArtwork"]["reference"],
  ) => Promise<FrozenArtwork>;
  resolveProductContext: typeof resolveProductProductionContext;
  ensureProject: typeof ensureImageProductionProject;
  freezeArtwork: typeof uploadFrozenMasterArtwork;
  loadArtwork: typeof downloadFrozenMasterArtwork;
  verifyProductReference: typeof loadFrozenProductReference;
  persistImageObject: typeof persistDeterministicImageObject;
  loadImageObject: typeof loadDeterministicImageObject;
  baseProvider: BaseImageProvider;
  resolveIdentity: typeof resolveBrandModelGenerationIdentity;
  generateBase: typeof generateWithProvider;
  isProviderConfigured: typeof isImageProviderConfigured;
  assertPaidEnabled: typeof assertImagePaidGenerationEnabled;
  composite: typeof compositeApprovedArtwork;
  inspectBasePrintPurity: typeof inspectBasePrintPurity;
  registerGarment: typeof registerGeneratedGarmentV2;
  registerGarmentV3: typeof registerGeneratedGarmentV3;
  garmentSegmenter: GarmentSegmentationProvider;
  normalEstimator: NormalEstimationProvider;
  depthEstimator: DepthEstimationProvider;
  detectFaceBounds: (bytes: Buffer) => Promise<NormalizedBounds | null>;
  assessBrandModelIdentity: typeof assessBrandModelIdentityConsistency;
  now: () => string;
  id: () => string;
  allowFakeExecution: () => boolean;
  inputCostMaximumUsd?: string;
}

function dependencies(
  overrides: Partial<DeterministicRuntimeDependencies>,
): DeterministicRuntimeDependencies {
  return {
    jobs: new SupabaseDeterministicJobRepository(),
    stages: new SupabaseStageOutputRepository(),
    assets: new SupabaseDeterministicAssetRepository(),
    products: new SupabaseProductProfileRepository(),
    projects: new SupabaseImageProductionProjectRepository(),
    loadReport,
    validateBrandModel: async (scope, selected) => {
      const handoff = await buildImageStudioPersonaHandoff(
        scope,
        selected.personaId,
        {
          expectedIdentity: {
            identityLockSnapshotId: selected.identityLockSnapshotId,
            identityLockVersion: selected.identityLockVersion,
            identityFingerprint: selected.identityFingerprint,
          },
          resolveAssetAccess: false,
        },
      );
      const actual = traceBrandModelContract(handoff.contract);
      if (!brandModelTracesEqual(selected, actual))
        throw new PersonaDomainError(
          "The selected Brand Model changed before v2 preparation.",
          "BRAND_MODEL_VERSION_MISMATCH",
        );
      const master = handoff.contract.identity.masterIdentityReference;
      if (!master)
        throw new PersonaDomainError(
          "Brand Model has no Master Identity Reference.",
          "BRAND_MODEL_INELIGIBLE",
        );
      return {
        displayName: handoff.contract.displayName,
        masterIdentityAssetId: master.assetId,
      };
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
    resolveIdentity: resolveBrandModelGenerationIdentity,
    generateBase: generateWithProvider,
    isProviderConfigured: isImageProviderConfigured,
    assertPaidEnabled: assertImagePaidGenerationEnabled,
    composite: compositeApprovedArtwork,
    inspectBasePrintPurity,
    registerGarment: registerGeneratedGarmentV2,
    registerGarmentV3: registerGeneratedGarmentV3,
    garmentSegmenter: createGarmentSegmentationProviderFromEnvironment(),
    normalEstimator: createNormalEstimationProviderFromEnvironment(),
    depthEstimator: createDepthEstimationProviderFromEnvironment(),
    detectFaceBounds: async (bytes) => {
      const [landmarks, image] = await Promise.all([
        extractFaceLandmarks68(bytes),
        loadImage(bytes),
      ]);
      if (landmarks.status !== "performed" || !landmarks.points?.length)
        return null;
      const xs = landmarks.points.map((point) => point.x);
      const ys = landmarks.points.map((point) => point.y);
      const left = Math.max(0, Math.min(...xs) / image.width);
      const top = Math.max(0, Math.min(...ys) / image.height);
      const right = Math.min(1, Math.max(...xs) / image.width);
      const bottom = Math.min(1, Math.max(...ys) / image.height);
      return {
        x: left,
        y: top,
        width: Math.max(0.001, right - left),
        height: Math.max(0.001, bottom - top),
      };
    },
    assessBrandModelIdentity: assessBrandModelIdentityConsistency,
    now: () => new Date().toISOString(),
    id: randomUUID,
    allowFakeExecution: () => process.env.NODE_ENV !== "production",
    ...overrides,
  };
}

function requireActor(
  scope: WorkspaceScope,
): asserts scope is WorkspaceScope & { actorId: string } {
  if (!scope.actorId)
    throw new PersonaDomainError(
      "Authenticated owner actor is required.",
      "AUTHENTICATION_REQUIRED",
    );
}

function plannedShot(
  record: ReportRecord,
  request: PrepareDeterministicJobRequest,
) {
  const sections = record.content.imageSections;
  if (!sections || record.content.reportId !== request.reportId)
    throw new PersonaDomainError("Image project is invalid.", "NOT_FOUND");
  const asset = findImageAsset(
    { productionAssets: sections.productionAssets as ImageStudioAsset[] },
    request.assetId,
  );
  if (!asset)
    throw new PersonaDomainError(
      "Image production shot was not found.",
      "NOT_FOUND",
    );
  if (
    !asset.brandModelTrace ||
    !brandModelTracesEqual(asset.brandModelTrace, request.brandModelTrace)
  ) {
    throw new PersonaDomainError(
      "Planned shot and selected Brand Model trace do not match.",
      "BRAND_MODEL_VERSION_MISMATCH",
    );
  }
  const reportTrace = sections.brandModelContract
    ? traceBrandModelContract(sections.brandModelContract)
    : null;
  if (
    !reportTrace ||
    !brandModelTracesEqual(reportTrace, request.brandModelTrace)
  ) {
    throw new PersonaDomainError(
      "Image project is not bound to the selected Brand Model lock.",
      "BRAND_MODEL_VERSION_MISMATCH",
    );
  }
  return { sections, asset };
}

function exactProductContext(
  profile: ProductProfile,
  context: ProductProductionContext,
  variantId: string,
) {
  if (
    profile.authority !== "SHOPIFY_LIVE" ||
    !profile.shopifyProductId ||
    context.authority !== "SHOPIFY_LIVE" ||
    !context.authoritative
  ) {
    throw new PersonaDomainError(
      "V2 production currently requires an exact Shopify-live Product profile.",
      "WORKFLOW",
    );
  }
  if (
    context.productId !== profile.shopifyProductId ||
    context.variantId !== variantId
  ) {
    throw new PersonaDomainError(
      "The live Product/variant no longer matches the frozen Product profile selection.",
      "WORKFLOW",
    );
  }
  if (!profile.variants.some((variant) => variant.variantId === variantId)) {
    throw new PersonaDomainError(
      "The selected variant is not present in the exact Product profile version.",
      "WORKFLOW",
    );
  }
}

function manualProductContext(
  profile: ProductProfile,
  variantId: string,
  printSurfaceId: string,
): ProductProductionContext {
  const eligibility = assessManualProductEligibility(
    profile,
    variantId,
    printSurfaceId,
  );
  if (!eligibility.eligible || !eligibility.selectedVariant) {
    throw new PersonaDomainError(
      eligibility.blockers.map((item) => item.message).join(" ") ||
        "Manual Product is not production-ready.",
      "WORKFLOW",
    );
  }
  const variant = eligibility.selectedVariant;
  return productProductionContextSchema.parse({
    version: "product-production-context-v1",
    productId: profile.productProfileId,
    variantId,
    productName: profile.name,
    productType: profile.productType,
    color: variant.color,
    size: variant.size,
    material:
      profile.construction.primaryMaterial ?? profile.construction.material,
    fit: profile.construction.fit,
    collection: profile.collections[0] ?? null,
    availability: "UNKNOWN",
    active: null,
    authority: "MANUAL_PROFILE",
    authoritative: false,
    provenance: {
      source: profile.provenance.source,
      sourceRecordId: profile.productProfileId,
      capturedAt: profile.provenance.capturedAt,
      sourceVersion: `product-profile-v${profile.version}`,
    },
  });
}

async function completeProductReferencesForPreparation(input: {
  scope: WorkspaceScope;
  profile: ProductProfile;
  color: string | null;
  side: "FRONT" | "BACK" | null;
  verifyProductReference: DeterministicRuntimeDependencies["verifyProductReference"];
}): Promise<FrozenProductVisualReference[]> {
  const references = selectStageAProductReferences({
    profile: input.profile,
    color: input.color,
    side: input.side,
  });
  if (!references.length) {
    throw new PersonaDomainError(
      "Für dieses Produkt sind noch keine verwendbaren Produktbilder hinterlegt.",
      "WORKFLOW",
    );
  }

  return Promise.all(
    references.map(async (reference) => {
      if (!reference.privateStoragePath || !reference.contentChecksumSha256) {
        throw new PersonaDomainError(
          "Die Produktbilder sind noch nicht vollständig vorbereitet. Öffne die Produktdetails und synchronisiere die Produktbilder erneut.",
          "WORKFLOW",
          { referenceId: reference.referenceId },
        );
      }

      const bytes = await input.verifyProductReference({
        workspaceId: input.scope.workspaceId,
        path: reference.privateStoragePath,
        expectedChecksum: reference.contentChecksumSha256,
      });

      try {
        // Legacy ProductProfile versions may not contain MIME/byteLength even
        // though their checksum-bound private object is complete. Derive those
        // immutable facts from the verified bytes and freeze them into the new
        // job snapshot; never trust browser metadata or a mutable remote URL.
        return completeFrozenProductReference(reference, bytes);
      } catch (error) {
        throw new PersonaDomainError(
          "Die privaten Produktbilder sind unvollständig oder stimmen nicht mit den gespeicherten Bilddaten überein. Öffne die Produktdetails und synchronisiere die Produktbilder erneut.",
          "WORKFLOW",
          {
            referenceId: reference.referenceId,
            reason: error instanceof Error ? error.message : "unknown",
          },
        );
      }
    }),
  );
}

function buildBasePrompt(input: {
  profile: ProductProfile;
  context: ProductProductionContext;
  asset: ImageStudioAsset;
  printSide?: "FRONT" | "BACK";
  creativeDirection: SocialCreativeDirectionV1;
}): string {
  const garment = [
    input.context.color,
    input.context.productType,
    input.context.material,
    input.context.fit,
  ]
    .filter(Boolean)
    .join(" ");
  const construction = [
    input.profile.construction.gsm
      ? `${input.profile.construction.gsm} GSM`
      : null,
    input.profile.construction.silhouette,
    input.profile.construction.neckline,
    input.profile.construction.collar,
    input.profile.construction.sleeveType,
    input.profile.construction.zipper,
    input.profile.construction.hood,
    input.profile.construction.pockets.length
      ? `pockets: ${input.profile.construction.pockets.join(", ")}`
      : null,
    input.profile.construction.waistband,
    input.profile.construction.cuffs,
  ]
    .filter(Boolean)
    .join("; ");
  return [
    "Create exactly one premium commercial campaign or product base image for later deterministic artwork compositing.",
    "Mandatory base purity: the entire visible target garment side must be plain, solid-color, blank, and unprinted.",
    "Product references may show listing-specific legacy prints. Copy only physical garment construction; remove and never reproduce every reference graphic, logo, brand word, typography, placeholder, or ghost print.",
    `Garment/product: ${garment || input.profile.productType}.`,
    construction ? `Exact construction knowledge: ${construction}.` : null,
    ...creativeDirectionPromptLines(input.creativeDirection),
    input.printSide === "BACK"
      ? "Show an explicit rear-facing garment view so the back print surface is visible."
      : input.printSide === "FRONT"
        ? "Show an explicit front-facing garment view so the front print surface is visible."
        : null,
    `The structured creative direction controls scene and presentation only; it may not override verified Product construction, color, size, material, or fit.`,
    "Keep the calibrated print surface and surrounding garment fabric completely blank, clean, frontally readable, gently tensioned, and unobstructed. Mild natural cloth curvature and fine fabric texture are welcome; major folds or occlusions across the print zone are not.",
    "Do not draw, infer, recreate, reference, or include the approved Master Artwork, any logo, any typography, or any other garment design.",
    "The result must feel intentionally art-directed and commercially publishable, never like a generic stock scene or accidental location snapshot.",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function prepareDeterministicImageJob(
  scope: WorkspaceScope,
  request: PrepareDeterministicJobRequest,
  overrides: Partial<DeterministicRuntimeDependencies> = {},
): Promise<DeterministicImageJob> {
  requireActor(scope);
  const d = dependencies(overrides);
  const record = await d.loadReport(request.reportRecordId);
  if (!record)
    throw new PersonaDomainError("Image project was not found.", "NOT_FOUND");
  if (record.workspaceId !== scope.workspaceId)
    throw new PersonaDomainError(
      "Image project belongs to another workspace.",
      "UNAUTHORIZED_WORKSPACE",
    );
  const { sections, asset } = plannedShot(record, request);
  const identity = await d.validateBrandModel(scope, request.brandModelTrace);
  const resolvedArtwork = await d.resolveArtwork(
    scope,
    request.masterArtwork.reference,
  );
  if (
    checksumImageArtwork(resolvedArtwork.bytes) !==
    resolvedArtwork.artwork.checksum
  )
    throw new PersonaDomainError(
      "Approved Artwork checksum changed before v2 preparation.",
      "WORKFLOW",
    );

  const profile = await d.products.getVersion(
    scope,
    request.productProfile.profileKey,
    request.productProfile.version,
  );
  if (!profile)
    throw new PersonaDomainError(
      "The selected Product profile version was not found.",
      "NOT_FOUND",
    );
  if (profile.workspaceId !== scope.workspaceId)
    throw new PersonaDomainError(
      "Product profile belongs to another workspace.",
      "UNAUTHORIZED_WORKSPACE",
    );
  const context =
    profile.authority === "MANUAL_PROFILE"
      ? manualProductContext(
          profile,
          request.productProfile.variantId,
          request.printSurface.printSurfaceId,
        )
      : await d.resolveProductContext({
          authority: "SHOPIFY_LIVE",
          productId: profile.shopifyProductId!,
          variantId: request.productProfile.variantId,
        });
  if (profile.authority === "SHOPIFY_LIVE")
    exactProductContext(profile, context, request.productProfile.variantId);
  let surface: PrintSurface;
  let persistedSurfaceOwner: ProductProfile | null = null;
  if (request.printSurface.authority === "NEXHQ_PRODUCT_TEMPLATE") {
    if (!request.semanticPlacement) {
      throw new PersonaDomainError(
        "A Product placement template requires exact semantic placement.",
        "WORKFLOW",
      );
    }
    const template = resolveProductPlacementTemplate({
      productType: profile.productType,
      printSide: request.semanticPlacement.printSide,
      placementPreset: request.semanticPlacement.placementPreset,
    });
    const familySurfaces =
      profile.authority === "SHOPIFY_LIVE" && profile.shopifyProductId
        ? (await d.products.listLatest(scope)).flatMap((candidate) =>
            candidate.printSurfaces.filter(
              (candidateSurface) =>
                candidateSurface.reuse?.scope === "PRODUCT_FAMILY" &&
                candidateSurface.reuse.equivalenceAuthority ===
                  "OWNER_CONFIRMED" &&
                candidateSurface.reuse.compatibleShopifyProductIds.includes(
                  profile.shopifyProductId!,
                ),
            ),
          )
        : [];
    const authoritativeResolution = resolveAutomaticProductPlacement({
      productProfileId: profile.productProfileId,
      productType: profile.productType,
      variantId: context.variantId,
      printSide: request.semanticPlacement.printSide,
      placementPreset: request.semanticPlacement.placementPreset,
      printSurfaces: [...profile.printSurfaces, ...familySurfaces],
    });
    if (
      !template ||
      !authoritativeResolution.ok ||
      authoritativeResolution.authority !== "NEXHQ_PRODUCT_TEMPLATE" ||
      template.templateId !== request.printSurface.templateId ||
      template.version !== request.printSurface.templateVersion ||
      template.templateId !== request.printSurface.printSurfaceId ||
      template.version !== request.printSurface.version
    ) {
      throw new PersonaDomainError(
        "The requested NexHQ Product placement template is not valid for this exact Product and placement.",
        "WORKFLOW",
      );
    }
    surface = printSurfaceFromProductTemplate({
      template,
      productProfileId: profile.productProfileId,
    });
  } else {
    const surfaceOwnerKey =
      request.printSurface.ownerProfileKey ?? profile.productProfileId;
    const surfaceOwnerVersion =
      request.printSurface.ownerProfileVersion ?? profile.version;
    const surfaceOwner =
      surfaceOwnerKey === profile.productProfileId &&
      surfaceOwnerVersion === profile.version
        ? profile
        : await d.products.getVersion(
            scope,
            surfaceOwnerKey,
            surfaceOwnerVersion,
          );
    if (!surfaceOwner || surfaceOwner.workspaceId !== scope.workspaceId) {
      throw new PersonaDomainError(
        "The PrintSurface owner profile/version was not found in this workspace.",
        "WORKFLOW",
      );
    }
    persistedSurfaceOwner = surfaceOwner;
    const storedSurface = surfaceOwner.printSurfaces.find(
      (candidate) =>
        candidate.printSurfaceId === request.printSurface.printSurfaceId &&
        candidate.version === request.printSurface.version,
    );
    if (
      !storedSurface ||
      storedSurface.productProfileId !== surfaceOwner.productProfileId ||
      (storedSurface.variantId && storedSurface.variantId !== context.variantId)
    )
      throw new PersonaDomainError(
        "The exact PrintSurface version is not bound to this Product/variant.",
        "WORKFLOW",
      );
    surface = storedSurface;
    if (
      surfaceOwner.productProfileId !== profile.productProfileId &&
      profile.authority === "SHOPIFY_LIVE" &&
      profile.shopifyProductId
    ) {
      try {
        assertFamilySurfaceUsableForShopifyProduct({
          surface,
          selectedProfile: profile,
          selectedShopifyProductId: profile.shopifyProductId,
        });
      } catch (error) {
        throw new PersonaDomainError(
          error instanceof Error
            ? error.message
            : "The inherited PrintSurface is not authorized for this Product.",
          "WORKFLOW",
        );
      }
    } else if (surfaceOwner.productProfileId !== profile.productProfileId) {
      throw new PersonaDomainError(
        "Cross-profile PrintSurface reuse is allowed only for explicitly confirmed Shopify Product families.",
        "WORKFLOW",
      );
    }
  }
  let productFamilyPlacement:
    | ImageGenerationInputSnapshotV2["productFamilyPlacement"]
    | undefined;
  if (request.ownerArtworkPlacement) {
    const family = profile.productFamily;
    const side = request.semanticPlacement?.printSide;
    const template = family?.placementTemplates.find(
      (candidate) => candidate.side === side && candidate.status === "READY",
    );
    const color = family?.colors.find(
      (candidate) =>
        candidate.colorName.toLocaleLowerCase("de-DE") ===
        context.color?.toLocaleLowerCase("de-DE"),
    );
    if (
      !family ||
      !side ||
      !template ||
      !color ||
      template.templateId !== request.ownerArtworkPlacement.templateId ||
      template.version !== request.ownerArtworkPlacement.templateVersion
    ) {
      throw new PersonaDomainError(
        "Die gespeicherte Produktfamilien-Platzierung ist veraltet. Prüfe Produkt, Farbe und Druckseite erneut.",
        "WORKFLOW",
      );
    }
    if (request.semanticPlacement?.placementPreset === "FRONT_LARGE") {
      const requestedLargeFront = printIntentWithinGarment({
        productType: profile.productType,
        printableArea: template.normalizedRegion,
        placement: request.ownerArtworkPlacement,
        placementPreset: "FRONT_LARGE",
      });
      if (
        !requestedLargeFront ||
        requestedLargeFront.width < 0.5 ||
        requestedLargeFront.height < 0.42
      ) {
        throw new PersonaDomainError(
          "Druckfläche konnte in dieser Größe auf dem Shirt nicht sicher angewendet werden.",
          "WORKFLOW",
        );
      }
    }
    const generatedQuad = resolveGeneratedGarmentRelativeQuad({
      productType: profile.productType,
      side,
      // New jobs register the complete physical printable area first. The
      // immutable Artwork's contain scale/translation is applied exactly once
      // by Stage B after the generated garment has been registered.
      placement: {
        ...request.ownerArtworkPlacement,
        uniformScale: 1,
        offsetX: 0,
        offsetY: 0,
      },
    });
    if (!generatedQuad) {
      throw new PersonaDomainError(
        "Für diesen Produkttyp ist die Platzierung auf generierten Bildern noch nicht sicher verfügbar.",
        "WORKFLOW",
      );
    }
    const xs = generatedQuad.map((point) => point.x);
    const ys = generatedQuad.map((point) => point.y);
    surface = printSurfaceSchema.parse({
      ...surface,
      quad: generatedQuad,
      boundingBox: {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      },
      warpMode: "NONE",
    });
    productFamilyPlacement = {
      contractVersion: "product-family-production-placement-v1",
      productFamilyId: family.familyId,
      colorKey: color.colorKey,
      side,
      placementTemplateId: template.templateId,
      placementTemplateVersion: template.version,
      printableArea: template.normalizedRegion,
      ownerPlacement: request.ownerArtworkPlacement,
      artworkFit: {
        contractVersion: STRICT_CONTAIN_FIT_VERSION,
        fitMode: "CONTAIN",
        ratioPreserved: true,
        cropAllowed: false,
        distortionAllowed: false,
        failureMode: "FAIL_CLOSED",
      },
      outputMapping: "GENERATED_GARMENT_RELATIVE_V3",
    };
  }
  assertPrintSurfaceReady(surface);
  const garmentSegmentationPolicy: GarmentSegmentationPolicy | undefined =
    productFamilyPlacement?.outputMapping ===
    "GENERATED_GARMENT_RELATIVE_V3"
      ? (() => {
          const descriptor = d.garmentSegmenter.describe();
          return {
            contractVersion: "garment-segmentation-policy-v1",
            required: true,
            provider: descriptor.provider,
            adapterVersion: descriptor.adapterVersion,
            model: descriptor.model,
            maximumCostUsd: descriptor.maximumCostUsd,
          };
        })()
      : undefined;
  const semanticPlacement = request.semanticPlacement
    ? (() => {
        const resolution = resolveAutomaticProductPlacement({
          productProfileId: profile.productProfileId,
          productType: profile.productType,
          variantId: context.variantId,
          printSide: request.semanticPlacement.printSide,
          placementPreset: request.semanticPlacement.placementPreset,
          printSurfaces: persistedSurfaceOwner
            ? persistedSurfaceOwner.productProfileId === profile.productProfileId
              ? profile.printSurfaces
              : [...profile.printSurfaces, surface]
            : [surface],
        });
        if (
          !resolution.ok ||
          resolution.surface.printSurfaceId !== surface.printSurfaceId ||
          resolution.surface.version !== surface.version
        ) {
          throw new PersonaDomainError(
            "Die semantische Platzierung passt nicht zur exakten Druckfläche.",
            "WORKFLOW",
          );
        }
        return semanticPlacementSnapshot({
          printSide: request.semanticPlacement.printSide,
          placementPreset: request.semanticPlacement.placementPreset,
          surface,
        });
      })()
    : undefined;
  if (request.semanticPlacement && contentShotById(asset.id)) {
    const compatibleShot = resolveContentShotForSide(
      asset.id,
      request.semanticPlacement.printSide,
    );
    if (!compatibleShot || compatibleShot.id !== asset.id) {
      throw new PersonaDomainError(
        "Die gewählte Aufnahme zeigt nicht die ausgewählte Druckseite. Wähle die passende Vorder- oder Rückansicht.",
        "WORKFLOW",
      );
    }
  }
  const frozenProductReferences =
    await completeProductReferencesForPreparation({
      scope,
      profile,
      color: context.color,
      side: request.semanticPlacement?.printSide ?? null,
      verifyProductReference: d.verifyProductReference,
    });
  const verticalPlacementPreset = request.semanticPlacement?.placementPreset;
  if (
    productFamilyPlacement &&
    productFamilyPlacement.side === "FRONT" &&
    /shirt|tee/i.test(profile.productType) &&
    supportsOwnerVerticalPlacement(verticalPlacementPreset)
  ) {
    const blankReference = frozenProductReferences.find(
      (reference) =>
        reference.purpose === "BLANK_PRODUCT" &&
        reference.productSide === productFamilyPlacement?.side &&
        reference.familyColorKey === productFamilyPlacement?.colorKey &&
        reference.providerEligible !== false,
    );
    if (!blankReference?.width || !blankReference.height) {
      throw new PersonaDomainError(
        "Das Blank-Produktbild benötigt vollständige Bildmaße für die vertikale Artwork-Platzierung.",
        "WORKFLOW",
      );
    }
    try {
      const artworkImage = await loadImage(resolvedArtwork.bytes);
      const ownerPrintFootprint =
        verticalPlacementPreset === "FRONT_LARGE"
          ? createOwnerPrintFootprint({
              placementPreset: "FRONT_LARGE",
              printableArea: productFamilyPlacement.printableArea,
              ownerPlacement: productFamilyPlacement.ownerPlacement,
              artworkWidth: artworkImage.width,
              artworkHeight: artworkImage.height,
              referenceWidth: blankReference.width,
              referenceHeight: blankReference.height,
            })
          : undefined;
      const expectedRegistrationIntent = ownerPrintFootprint
        ? {
            width: ownerPrintFootprint.requestedTemplateGarmentWidthRatio,
            height: ownerPrintFootprint.requestedTemplateGarmentHeightRatio,
            centerY: ownerPrintFootprint.requestedCenterY,
          }
        : printIntentWithinGarment({
            productType: profile.productType,
            printableArea: productFamilyPlacement.printableArea,
            placement: productFamilyPlacement.ownerPlacement,
            placementPreset: verticalPlacementPreset,
          });
      if (!expectedRegistrationIntent) {
        throw new Error(OWNER_VERTICAL_PLACEMENT_ERROR);
      }
      productFamilyPlacement = {
        ...productFamilyPlacement,
        ...(ownerPrintFootprint ? { ownerPrintFootprint } : {}),
        ownerVerticalPlacement: createOwnerVerticalPlacement({
          placementPreset: verticalPlacementPreset!,
          printableArea: productFamilyPlacement.printableArea,
          ownerPlacement: productFamilyPlacement.ownerPlacement,
          artworkWidth: artworkImage.width,
          artworkHeight: artworkImage.height,
          referenceWidth: blankReference.width,
          referenceHeight: blankReference.height,
          expectedTorsoFootprint: {
            width: expectedRegistrationIntent.width,
            height: expectedRegistrationIntent.height,
            centerY:
              "centerY" in expectedRegistrationIntent
                ? expectedRegistrationIntent.centerY
                : expectedRegistrationIntent.y +
                  expectedRegistrationIntent.height / 2,
          },
        }),
      };
    } catch (error) {
      throw new PersonaDomainError(
        error instanceof Error
          ? error.message
          : verticalPlacementPreset === "FRONT_LARGE"
            ? OWNER_PRINT_FOOTPRINT_ERROR
            : OWNER_VERTICAL_PLACEMENT_ERROR,
        "WORKFLOW",
      );
    }
  }

  if (
    productFamilyPlacement &&
    supportsOrientedFrontPrintPlane(
      profile.productType,
      productFamilyPlacement.side,
      verticalPlacementPreset,
    )
  ) {
    productFamilyPlacement = {
      ...productFamilyPlacement,
      orientedFrontPrintPlane:
        DEFAULT_NORMAL_ASSISTED_ORIENTED_FRONT_PRINT_PLANE_POLICY,
    };
  }

  const project = await d.ensureProject(
    scope,
    {
      reportRecordId: request.reportRecordId,
      reportId: request.reportId,
      sections,
      brandModel: request.brandModelTrace,
      artwork: resolvedArtwork.artwork,
      productContext: context,
    },
    d.projects,
  );
  const selectedVariant = profile.variants.find(
    (variant) => variant.variantId === context.variantId,
  )!;
  const product = productProductionBindingV2Schema.parse({
    version: "product-production-binding-v2",
    productProfileId: profile.productProfileId,
    profileVersion: profile.version,
    authority: profile.authority,
    shopifyProductId:
      profile.authority === "SHOPIFY_LIVE" ? profile.shopifyProductId : null,
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
    sourceContext: profile.sourceContext,
    provenance: {
      source: profile.provenance.source,
      capturedAt: profile.provenance.capturedAt,
      sourceVersion: profile.provenance.sourceVersion,
    },
  });
  const productVisualInput = productVisualInputSchema.parse({
    contractVersion: "product-visual-input-v2",
    productProfileId: profile.productProfileId,
    profileVersion: profile.version,
    authority: profile.authority,
    status: profile.status,
    productType: profile.productType,
    sourceContext: profile.sourceContext,
    shopifyProductId:
      profile.authority === "SHOPIFY_LIVE" ? profile.shopifyProductId : null,
    variantId: context.variantId,
    color: product.color,
    size: product.size,
    material: product.material,
    gsm: profile.construction.gsm,
    fit: product.fit,
    construction: profile.construction,
    referencePackage: {
      schemaVersion: "product-reference-package-v1",
      packageId: `${profile.productProfileId}:v${profile.version}`,
      authority: profile.authority,
      productProfileId: profile.productProfileId,
      shopifyProductId: profile.shopifyProductId,
      productVersion: profile.provenance.sourceVersion,
      references: frozenProductReferences,
      capturedAt: profile.provenance.capturedAt,
      provenance: profile.provenance.source,
    },
  });
  const profileConfig = getActiveImageGenerationProfile();
  const creativeDirection = socialCreativeDirectionV1Schema.parse(
    request.creativeDirection ??
      createCreativeDirection({
        shotId: asset.id,
        contentMode: contentShotById(asset.id)?.intents.includes("SHOPIFY")
          ? "SHOPIFY_MOCKUP"
          : "SOCIAL_CONTENT",
      }),
  );
  if (creativeDirection.shotType !== asset.id) {
    throw new PersonaDomainError(
      "Die kreative Richtung gehört nicht zur ausgewählten Einzelaufnahme.",
      "WORKFLOW",
    );
  }
  const contentShot = contentShotById(asset.id);
  if (
    contentShot &&
    ((creativeDirection.contentMode === "SHOPIFY_MOCKUP" &&
      !contentShot.intents.includes("SHOPIFY")) ||
      (creativeDirection.contentMode === "SOCIAL_CONTENT" &&
        !contentShot.intents.some((intent) => intent !== "SHOPIFY")))
  ) {
    throw new PersonaDomainError(
      "Die ausgewählte Aufnahme passt nicht zum gewählten Inhaltsziel.",
      "WORKFLOW",
    );
  }
  const printReadyStageA =
    productFamilyPlacement?.side === "FRONT" &&
    request.semanticPlacement?.placementPreset === "FRONT_LARGE" &&
    /shirt|tee/i.test(context.productType) &&
    Boolean(contentShot?.requiresBrandModel)
      ? DEFAULT_PRINT_READY_STAGE_A
      : undefined;
  const depthEstimationPolicy: DepthEstimationPolicy | undefined =
    printReadyStageA
      ? (() => {
          const requiredRaw =
            process.env.NEXHQ_DEPTH_REQUIRED_IN_PRODUCTION?.trim().toLowerCase();
          const requiredInProduction =
            requiredRaw == null || requiredRaw === ""
              ? true
              : ["1", "true", "yes", "on"].includes(requiredRaw);
          if (requiredInProduction && !d.depthEstimator.isConfigured()) {
            throw new PersonaDomainError(
              "Depth Anything V2 benötigt FAL_KEY und einen konfigurierten maximalen Depth-Kostenrahmen.",
              "WORKFLOW",
            );
          }
          const descriptor = d.depthEstimator.isConfigured()
            ? d.depthEstimator.describe()
            : {
                provider: "fal" as const,
                model: "fal-ai/image-preprocessors/depth-anything/v2",
                adapterVersion: "nexhq-fal-depth-anything-v2-v1" as const,
                maximumCostUsd: 0,
              };
          return {
            contractVersion: "nexhq-depth-estimation-policy-v1",
            provider: descriptor.provider,
            model: descriptor.model,
            adapterVersion: descriptor.adapterVersion,
            requiredInProduction,
            localFallbackAllowed: !requiredInProduction,
            maximumCostUsd: descriptor.maximumCostUsd,
            minimumDynamicRange: 0.04,
            maximumDiscontinuityFraction: 0.08,
          };
        })()
      : undefined;
  const normalEstimationPolicy: NormalEstimationPolicy | undefined =
    productFamilyPlacement?.orientedFrontPrintPlane?.contractVersion ===
    "nexhq-oriented-front-print-plane-v2.2-normal-assisted"
      ? (() => {
          if (!d.normalEstimator.isConfigured()) {
            throw new PersonaDomainError(
              "MiDaS Normal benötigt FAL_KEY und einen konfigurierten maximalen MiDaS-Kostenrahmen.",
              "WORKFLOW",
            );
          }
          const descriptor = d.normalEstimator.describe();
          return {
            contractVersion: "nexhq-normal-estimation-policy-v1" as const,
            provider: descriptor.provider,
            model: descriptor.model,
            adapterVersion: descriptor.adapterVersion,
            required: true,
            maximumCostUsd: descriptor.maximumCostUsd,
            minimumUsableSamples: 120,
            minimumFieldConsistency: 0.55,
          };
        })()
      : undefined;
  const automaticPlacementTuning = request.productionOverride
    || request.ownerArtworkPlacement
    ? null
    : resolveFrontLargeProductionTuning({
        productType: context.productType,
        placementPreset: request.semanticPlacement?.placementPreset,
        surface,
      });
  const snapshot: ImageGenerationInputSnapshotV2 =
    imageGenerationInputSnapshotV2Schema.parse({
      version: "image-generation-input-v2",
      productionMode: "DETERMINISTIC_COMPOSITE",
      workspaceId: scope.workspaceId,
      brandModel: { ...request.brandModelTrace, ...identity },
      identityConditioning: {
        contractVersion: "brand-model-production-identity-v1",
        authoritySource: "PERSONA_MASTER_IDENTITY_LOCK",
        identityLockActive: true,
        genericIdentityFallbackAllowed: false,
        providerStrategy:
          "MASTER_PLUS_CANONICAL_SUPPORT_PACKAGE_HIGH_FIDELITY",
        masterIdentityAssetId: identity.masterIdentityAssetId,
        supportingReferenceCount: 5,
        referencePackageVersion:
          request.brandModelTrace.referencePackageVersion,
        referencePackageFingerprint:
          request.brandModelTrace.referencePackageFingerprint,
        outputConsistencyGate: {
          required: contentShot?.requiresBrandModel ?? true,
          contractVersion:
            "nexhq-brand-model-identity-consistency-v1",
          evaluatorVersion: "local-vladmandic-1.7.x-v1",
          thresholdVersion: "v1.0.0",
          maximumEuclideanDistance: 0.55,
          failureMode: "FAIL_CLOSED",
        },
      },
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
      ...(request.productionOverride || automaticPlacementTuning
        ? {
            printSurfaceOverride: {
              contractVersion: "print-surface-production-override-v1",
              basePrintSurfaceId: surface.printSurfaceId,
              basePrintSurfaceVersion: surface.version,
              quad:
                request.productionOverride?.quad ??
                automaticPlacementTuning!.quad,
              provenance: request.productionOverride
                ? "OWNER_JOB_FINE_TUNING"
                : "NEXHQ_FRONT_LARGE_TUNING_V4",
            },
          }
        : {}),
      ...(semanticPlacement ? { semanticPlacement } : {}),
      ...(productFamilyPlacement ? { productFamilyPlacement } : {}),
      ...(garmentSegmentationPolicy
        ? { garmentSegmentationPolicy }
        : {}),
      ...(normalEstimationPolicy ? { normalEstimationPolicy } : {}),
      ...(depthEstimationPolicy ? { depthEstimationPolicy } : {}),
      ...(printReadyStageA ? { printReadyStageA } : {}),
      shot: {
        assetId: asset.id,
        assetType: asset.assetType,
        title: asset.title ?? asset.productName,
        scene: creativeDirection.sceneType,
        lighting: creativeDirection.lighting,
        poseDirection: creativeDirection.subjectDirection,
        campaignDirection: "Owner-selected structured creative direction",
      },
      creativeDirection,
      production: {
        projectId: project.id,
        projectVersion: project.version,
        reportRecordId: request.reportRecordId,
        reportId: request.reportId,
      },
      baseGeneration: {
        provider: "openai",
        model: profileConfig.model,
        dimensions: asset.dimensions ?? "2048x2048",
        quality: resolveOpenAiImageQuality(),
        assetCount: 1,
        personaStrategy: "MASTER_IDENTITY_REFERENCE",
        productStrategy: "PRODUCT_REFERENCES_AND_METADATA",
        artworkStrategy: "NO_MASTER_ARTWORK_INPUT",
        prompt: buildBasePrompt({
          profile,
          context,
          asset,
          printSide: request.semanticPlacement?.printSide,
          creativeDirection,
        }),
      },
      compositing: {
        compositorVersion: COMPOSITOR_VERSION_V3,
        artworkPlacementMode: "CONTAIN_UNIFORM_ASPECT_LOCKED",
        sampling: "BILINEAR_SOURCE_PIXEL",
        blending: "FABRIC_AWARE_PRINT_V1",
        shadingFactor: 1,
        fabricIntegration: productFamilyPlacement
          ? /shirt|tee/i.test(context.productType)
            ? productFamilyPlacement.ownerVerticalPlacement
              ? request.semanticPlacement?.placementPreset === "FRONT_LARGE"
                ? DEFAULT_SURFACE_REALISM_REFINEMENT_INTEGRATION
                : DEFAULT_OWNER_VERTICAL_DEPTH_AWARE_SURFACE_INTEGRATION
              : DEFAULT_DEPTH_AWARE_SURFACE_INTEGRATION
            : DEFAULT_SURFACE_CONFORMING_FABRIC_INTEGRATION
          : DEFAULT_FABRIC_AWARE_INTEGRATION,
        artworkContainFit: {
          contractVersion: STRICT_CONTAIN_FIT_VERSION,
          fitMode: "CONTAIN",
          ratioPreserved: true,
          cropAllowed: false,
          distortionAllowed: false,
          failureMode: "FAIL_CLOSED",
        },
        automaticProviderRetryOnCompositeFailure: false,
      },
    });
  const inputFingerprint = fingerprintImageGenerationInput(snapshot);
  const rawEstimate = estimateImageGenerationCost({
    size: resolveOpenAiImageSize(asset.dimensions ?? "2048x2048"),
    quality: resolveOpenAiImageQuality(),
    inputCostMaximumUsd: d.inputCostMaximumUsd,
  });
  const estimate = includeDepthEstimationCost(includeMidasNormalCost(includeGarmentSegmentationCost(
    {
      ...rawEstimate,
      basis:
        "Stage A only: one potential base-image output plus the configured Persona/Product-reference input allowance. Stage B deterministic compositing has no provider charge.",
    },
    garmentSegmentationPolicy,
  ), normalEstimationPolicy), depthEstimationPolicy);
  const artworkStoragePath = await d.freezeArtwork({
    workspaceId: scope.workspaceId,
    bytes: resolvedArtwork.bytes,
    mimeType: resolvedArtwork.artwork.mimeType,
    checksum: resolvedArtwork.artwork.checksum,
  });
  const preparedAt = d.now();
  return d.jobs.createOrGet(scope, {
    snapshot,
    fingerprint: inputFingerprint,
    artworkStoragePath,
    estimate,
    preparedAt,
    confirmationExpiresAt: new Date(
      new Date(preparedAt).getTime() + 30 * 60 * 1000,
    ).toISOString(),
  });
}

export async function confirmDeterministicImageJob(
  scope: WorkspaceScope,
  jobId: string,
  fingerprint: string,
  overrides: Partial<DeterministicRuntimeDependencies> = {},
) {
  requireActor(scope);
  const d = dependencies(overrides);
  return d.jobs.confirm(
    scope,
    jobId,
    fingerprint,
    `img-v2-confirm-${d.id()}`,
    d.now(),
  );
}

function assertExactJob(job: DeterministicImageJob, fingerprint: string) {
  if (
    job.inputSnapshot.version !== "image-generation-input-v2" ||
    job.inputSnapshot.productionMode !== "DETERMINISTIC_COMPOSITE"
  )
    throw new PersonaDomainError(
      "V2 executor refuses non-v2 or draft jobs.",
      "WORKFLOW",
    );
  if (job.inputSnapshot.baseGeneration.assetCount !== 1)
    throw new PersonaDomainError(
      "V2 execution requires exactly one asset.",
      "WORKFLOW",
    );
  if (
    job.inputFingerprint !== fingerprint ||
    fingerprintImageGenerationInput(job.inputSnapshot) !== fingerprint
  )
    throw new PersonaDomainError(
      "V2 execution fingerprint mismatch.",
      "WORKFLOW",
    );
}

function productContextFromSnapshot(
  job: DeterministicImageJob,
): ProductProductionContext {
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
    authority:
      product.authority === "SHOPIFY_LIVE"
        ? "SHOPIFY_LIVE"
        : product.authority === "MANUAL_PROFILE"
          ? "MANUAL_PROFILE"
          : "UNKNOWN",
    authoritative: product.authority === "SHOPIFY_LIVE",
    provenance: {
      source: product.provenance.source,
      sourceRecordId: product.variantId ?? product.shopifyProductId,
      capturedAt: product.provenance.capturedAt,
      sourceVersion: product.provenance.sourceVersion,
    },
  };
}

function registeredSurfaceFromBase(
  job: DeterministicImageJob,
  base: Pick<ProductionStageOutput, "provenance">,
): PrintSurface {
  const v3 = garmentRegistrationV3Schema.safeParse(
    base.provenance.garmentRegistration,
  );
  if (v3.success) {
    return printSurfaceForGarmentRegistrationV3(
      effectivePrintSurfaceForSnapshot(job.inputSnapshot),
      v3.data,
    );
  }
  const parsed = garmentRegistrationV2Schema.safeParse(
    base.provenance.garmentRegistration,
  );
  if (!parsed.success) return effectivePrintSurfaceForSnapshot(job.inputSnapshot);
  return printSurfaceForGarmentRegistration(
    effectivePrintSurfaceForSnapshot(job.inputSnapshot),
    parsed.data,
  );
}

async function garmentMaskFromStoredBase(input: {
  scope: WorkspaceScope;
  job: DeterministicImageJob;
  base: NonNullable<
    Awaited<ReturnType<StageOutputRepository["getSucceededBase"]>>
  >;
  dependencies: DeterministicRuntimeDependencies;
}) {
  const policy = input.job.inputSnapshot.garmentSegmentationPolicy;
  if (!policy) return undefined;
  const parsed = garmentSegmentationProvenanceSchema.safeParse(
    input.base.provenance.garmentSegmentation,
  );
  if (
    !parsed.success ||
    parsed.data.status !== "VALIDATED" ||
    !parsed.data.mask ||
    parsed.data.sourceBaseChecksumSha256 !== input.base.checksumSha256 ||
    parsed.data.jobId !== input.job.id ||
    parsed.data.policy.model !== policy.model ||
    parsed.data.policy.adapterVersion !== policy.adapterVersion
  ) {
    throw new Error(
      "The frozen SAM 3 garment segmentation is missing or invalid.",
    );
  }
  const path = garmentSegmentationMaskStoragePath({
    workspaceId: input.scope.workspaceId,
    jobId: input.job.id,
    sourceBaseChecksumSha256: input.base.checksumSha256,
    maskChecksumSha256: parsed.data.mask.checksumSha256,
  });
  const bytes = await input.dependencies.loadImageObject({
    workspaceId: input.scope.workspaceId,
    path,
    expectedChecksum: parsed.data.mask.checksumSha256,
  });
  return {
    contractVersion: "garment-segmentation-v1" as const,
    bytes,
    checksumSha256: parsed.data.mask.checksumSha256,
    sourceBaseChecksumSha256: parsed.data.sourceBaseChecksumSha256,
    width: parsed.data.mask.width,
    height: parsed.data.mask.height,
  };
}

function assertStoredBaseStageBEligibility(input: {
  job: DeterministicImageJob;
  base: Pick<ProductionStageOutput, "checksumSha256" | "provenance">;
}): void {
  if (
    input.job.inputSnapshot.identityConditioning &&
    input.base.provenance.providerMode === "REAL_PAID"
  ) {
    const identity = brandModelIdentityConsistencySchema.safeParse(
      input.base.provenance.identityConsistency,
    );
    if (!identity.success || identity.data.status !== "PASS") {
      throw new Error(
        "Deterministic Stage B retry requires a frozen passed identity assessment.",
      );
    }
  }
  if (
    input.job.inputSnapshot.productFamilyPlacement?.outputMapping ===
    "GENERATED_GARMENT_RELATIVE_V3"
  ) {
    const registration = garmentRegistrationV3Schema.safeParse(
      input.base.provenance.garmentRegistration,
    );
    if (
      !registration.success ||
      registration.data.status !== "REGISTERED"
    ) {
      throw new Error(
        "Deterministic Stage B retry requires the frozen valid garment registration.",
      );
    }
  }
  const purity = input.base.provenance.basePrintPurity;
  if (
    input.job.inputSnapshot.compositing.fabricIntegration?.surfaceConforming &&
    (typeof purity !== "object" ||
      purity === null ||
      (purity as { status?: unknown }).status !== "PASS")
  ) {
    throw new Error(
      "Deterministic Stage B retry requires a frozen clean Stage-A Base.",
    );
  }
}

function controlledCompositeFailure(error: unknown): {
  code:
    | "DEPTH_ESTIMATION_FAILED"
    | "SURFACE_REALISM_REFINEMENT_UNSAFE"
    | "DEPTH_AWARE_SURFACE_UNSAFE"
    | "SURFACE_INTEGRATION_UNSAFE"
    | "ORIENTED_PLANE_TYPOGRAPHY_UNSAFE"
    | "DETERMINISTIC_COMPOSITE_FAILED";
  message: string;
  provenance: Record<string, unknown>;
} {
  const attachedDepth =
    typeof error === "object" && error !== null && "depthEstimation" in error
      ? depthEstimationProvenanceSchema.safeParse(
          (error as { depthEstimation?: unknown }).depthEstimation,
        )
      : null;
  if (error instanceof DepthEstimationRuntimeError) {
    return {
      code: "DEPTH_ESTIMATION_FAILED",
      message: "Die Stofftiefe konnte für dieses Bild nicht zuverlässig bestimmt werden.",
      provenance: { depthEstimation: error.provenance },
    };
  }
  const depthAwareIntegration = depthAwareEvidenceFromError(error);
  const surfaceRealismRefinement =
    surfaceRealismRefinementEvidenceFromError(error);
  const surfaceIntegration = surfaceIntegrationEvidenceFromError(error);
  const orientedFrontPrintPlane =
    orientedFrontPrintPlaneEvidenceFromError(error);
  if (orientedFrontPrintPlane) {
    return {
      code: "ORIENTED_PLANE_TYPOGRAPHY_UNSAFE",
      message:
        "Die Front-Druckfläche konnte nicht sicher an die sichtbare Shirt-Ausrichtung angepasst werden.",
      provenance: {
        orientedFrontPrintPlane,
        ...(attachedDepth?.success
          ? { depthEstimation: attachedDepth.data }
          : {}),
      },
    };
  }
  if (surfaceRealismRefinement) {
    return {
      code: "SURFACE_REALISM_REFINEMENT_UNSAFE",
      message:
        "Das Artwork konnte nicht sicher stärker an Perspektive, Stoffrichtung und Shirt-Oberfläche angepasst werden. Es wurde kein Ergebnis zur Freigabe erstellt.",
      provenance: {
        surfaceRealismRefinement,
        ...(attachedDepth?.success
          ? { depthEstimation: attachedDepth.data }
          : {}),
      },
    };
  }
  if (depthAwareIntegration) {
    return {
      code: "DEPTH_AWARE_SURFACE_UNSAFE",
      message:
        "Das Artwork konnte nicht sicher an Perspektive, Körperneigung und Stoffoberfläche angepasst werden. Es wurde kein Ergebnis zur Freigabe erstellt.",
      provenance: {
        depthAwareIntegration,
        ...(attachedDepth?.success
          ? { depthEstimation: attachedDepth.data }
          : {}),
      },
    };
  }
  if (surfaceIntegration) {
    return {
      code: "SURFACE_INTEGRATION_UNSAFE",
      message:
        "Die Shirt-Oberfläche konnte für eine sichere Druckintegration nicht zuverlässig ausgewertet werden.",
      provenance: {
        surfaceIntegration,
        ...(attachedDepth?.success
          ? { depthEstimation: attachedDepth.data }
          : {}),
      },
    };
  }
  return {
    code: "DETERMINISTIC_COMPOSITE_FAILED",
    message:
      error instanceof Error ? error.message : "Deterministic composite failed.",
    provenance: attachedDepth?.success
      ? { depthEstimation: attachedDepth.data }
      : {},
  };
}

class DepthEstimationRuntimeError extends Error {
  constructor(readonly provenance: DepthEstimationProvenance) {
    super("Die Stofftiefe konnte für dieses Bild nicht zuverlässig bestimmt werden.");
    this.name = "DepthEstimationRuntimeError";
  }
}

function attachDepthEstimation<T>(
  error: T,
  depthEstimation: DepthEstimationProvenance,
): T {
  if (typeof error === "object" && error !== null) {
    Object.assign(error, { depthEstimation });
  }
  return error;
}

async function storedValidatedDepth(input: {
  scope: WorkspaceScope;
  job: DeterministicImageJob;
  base: NonNullable<Awaited<ReturnType<StageOutputRepository["getSucceededBase"]>>>;
  dependencies: DeterministicRuntimeDependencies;
}): Promise<ValidatedDepthEstimation | null> {
  const stages = await input.dependencies.stages.list(input.scope, input.job.id);
  for (const stage of [...stages].reverse()) {
    const parsed = depthEstimationProvenanceSchema.safeParse(
      stage.provenance.depthEstimation,
    );
    if (
      !parsed.success ||
      parsed.data.status !== "VALIDATED" ||
      !parsed.data.depthMapChecksumSha256 ||
      !parsed.data.normalizedDimensions ||
      !parsed.data.normalization ||
      parsed.data.sourceBaseChecksumSha256 !== input.base.checksumSha256 ||
      parsed.data.jobId !== input.job.id
    ) {
      continue;
    }
    const bytes = await input.dependencies.loadImageObject({
      workspaceId: input.scope.workspaceId,
      path: depthMapStoragePath({
        workspaceId: input.scope.workspaceId,
        jobId: input.job.id,
        sourceBaseChecksumSha256: input.base.checksumSha256,
        depthMapChecksumSha256: parsed.data.depthMapChecksumSha256,
      }),
      expectedChecksum: parsed.data.depthMapChecksumSha256,
    });
    return {
      provenance: parsed.data as ValidatedDepthEstimation["provenance"],
      normalizedDepthMapPngBytes: bytes,
    };
  }
  return null;
}

async function resolveDepthForComposite(input: {
  scope: WorkspaceScope;
  job: DeterministicImageJob;
  base: NonNullable<Awaited<ReturnType<StageOutputRepository["getSucceededBase"]>>>;
  baseBytes: Buffer;
  printSurface: PrintSurface;
  dependencies: DeterministicRuntimeDependencies;
}): Promise<ValidatedDepthEstimation | null> {
  const policy = input.job.inputSnapshot.depthEstimationPolicy;
  if (!policy || input.base.provenance.providerMode !== "REAL_PAID") return null;
  const existing = await storedValidatedDepth(input);
  if (existing) return existing;
  const image = await loadImage(input.baseBytes);
  const idempotencyKey = depthEstimationIdempotencyKey({
    jobId: input.job.id,
    sourceBaseChecksumSha256: input.base.checksumSha256,
    provider: policy.provider,
    model: policy.model,
    adapterVersion: policy.adapterVersion,
  });
  let providerRequestId: string | null = null;
  try {
    if (!input.dependencies.depthEstimator.isConfigured()) {
      if (policy.localFallbackAllowed) return null;
      throw new Error("PROVIDER_UNAVAILABLE");
    }
    const result = await input.dependencies.depthEstimator.estimateDepth({
      jobId: input.job.id,
      baseImage: {
        bytes: input.baseBytes,
        checksumSha256: input.base.checksumSha256,
        mimeType: "image/png",
      },
      idempotencyKey,
    });
    providerRequestId = result.providerRequestId;
    const validated = await validateDepthEstimation({
      policy,
      result,
      jobId: input.job.id,
      sourceBaseChecksumSha256: input.base.checksumSha256,
      sourceWidth: image.width,
      sourceHeight: image.height,
      printableRegion: input.printSurface.boundingBox!,
      idempotencyKey,
    });
    await input.dependencies.persistImageObject({
      workspaceId: input.scope.workspaceId,
      path: depthMapStoragePath({
        workspaceId: input.scope.workspaceId,
        jobId: input.job.id,
        sourceBaseChecksumSha256: input.base.checksumSha256,
        depthMapChecksumSha256:
          validated.provenance.depthMapChecksumSha256,
      }),
      bytes: validated.normalizedDepthMapPngBytes,
      expectedChecksum: validated.provenance.depthMapChecksumSha256,
    });
    return validated;
  } catch (error) {
    const value = error instanceof Error ? error.message : "PROVIDER_RESPONSE_INVALID";
    const known = [
      "PROVIDER_UNAVAILABLE",
      "SOURCE_BINDING_MISMATCH",
      "DEPTH_DECODE_FAILED",
      "DEPTH_DIMENSIONS_INVALID",
      "DEPTH_DYNAMIC_RANGE_WEAK",
      "DEPTH_DISCONTINUITY_UNSAFE",
    ].includes(value)
      ? value
      : "PROVIDER_RESPONSE_INVALID";
    throw new DepthEstimationRuntimeError(
      rejectedDepthProvenance({
        policy,
        jobId: input.job.id,
        sourceBaseChecksumSha256: input.base.checksumSha256,
        sourceWidth: image.width,
        sourceHeight: image.height,
        idempotencyKey,
        reason: known as Parameters<typeof rejectedDepthProvenance>[0]["reason"],
        providerRequestId,
      }),
    );
  }
}

async function compositeFromStoredBase(
  scope: WorkspaceScope,
  job: DeterministicImageJob,
  d: DeterministicRuntimeDependencies,
  base: NonNullable<
    Awaited<ReturnType<StageOutputRepository["getSucceededBase"]>>
  >,
  attempt: number,
): Promise<DeterministicAsset> {
  assertStoredBaseStageBEligibility({ job, base });
  const baseBytes = await d.loadImageObject({
    workspaceId: scope.workspaceId,
    path: base.storagePath,
    expectedChecksum: base.checksumSha256,
  });
  assertSupportedRasterImageIntegrity(baseBytes);
  const artwork = await d.loadArtwork({
    workspaceId: scope.workspaceId,
    storagePath: job.artworkStoragePath,
    expectedChecksum: job.inputSnapshot.masterArtwork.checksum,
    mimeType: job.inputSnapshot.masterArtwork.mimeType,
  });
  // Never pass untrusted or historically truncated Artwork to native canvas.
  // A malformed PNG can crash inside libpng before JavaScript can catch it.
  assertMasterArtworkImageIntegrity(
    artwork.bytes,
    job.inputSnapshot.masterArtwork.mimeType,
  );
  const image = await loadImage(artwork.bytes);
  const fidelity = validateArtworkFidelityInput({
    job,
    artworkBytes: artwork.bytes,
    sourceWidth: image.width,
    sourceHeight: image.height,
  });
  const garmentMask = await garmentMaskFromStoredBase({
    scope,
    job,
    base,
    dependencies: d,
  });
  const registeredSurface = registeredSurfaceFromBase(job, base);
  const depth = await resolveDepthForComposite({
    scope,
    job,
    base,
    baseBytes,
    printSurface: registeredSurface,
    dependencies: d,
  });
  const footprintContract =
    job.inputSnapshot.productFamilyPlacement?.ownerPrintFootprint ?? null;
  const verticalPlacementContract =
    job.inputSnapshot.productFamilyPlacement?.ownerVerticalPlacement ?? null;
  const orientedPlaneContract =
    job.inputSnapshot.productFamilyPlacement?.orientedFrontPrintPlane ?? null;
  const authorityRegistration =
    footprintContract || verticalPlacementContract || orientedPlaneContract
    ? garmentRegistrationV3Schema.safeParse(
        base.provenance.garmentRegistration,
      )
    : null;
  if (
    footprintContract &&
    (!authorityRegistration?.success ||
      authorityRegistration.data.status !== "REGISTERED" ||
      !authorityRegistration.data.garmentBodyBounds ||
      !authorityRegistration.data.placementEvidence?.ownerPrintFootprint)
  ) {
    throw new Error(OWNER_PRINT_FOOTPRINT_ERROR);
  }
  const footprintEvidence =
    footprintContract && authorityRegistration?.success
      ? authorityRegistration.data.placementEvidence!.ownerPrintFootprint!
      : null;
  if (
    verticalPlacementContract &&
    (!authorityRegistration?.success ||
      authorityRegistration.data.status !== "REGISTERED" ||
      !authorityRegistration.data.garmentBodyBounds ||
      !authorityRegistration.data.placementEvidence?.ownerVerticalPlacement)
  ) {
    throw new Error(OWNER_VERTICAL_PLACEMENT_ERROR);
  }
  const verticalPlacementEvidence =
    verticalPlacementContract && authorityRegistration?.success
      ? authorityRegistration.data.placementEvidence!.ownerVerticalPlacement!
      : null;
  if (
    orientedPlaneContract &&
    (!authorityRegistration?.success ||
      authorityRegistration.data.status !== "REGISTERED" ||
      authorityRegistration.data.orientedFrontPrintPlane?.status !== "READY" ||
      authorityRegistration.data.orientedFrontPrintPlane.contractVersion !==
        orientedPlaneContract.contractVersion)
  ) {
    throw new Error(
      "Die Front-Druckfläche konnte nicht sicher an die sichtbare Shirt-Ausrichtung angepasst werden.",
    );
  }
  let result: Awaited<ReturnType<typeof compositeApprovedArtwork>>;
  try {
    result = await d.composite(
    {
      compositorVersion: job.inputSnapshot.compositing.compositorVersion,
      baseImage: {
        id: base.stageOutputId,
        bytes: baseBytes,
        checksumSha256: base.checksumSha256,
      },
      artwork: {
        id: job.inputSnapshot.masterArtwork.artworkId,
        version: job.inputSnapshot.masterArtwork.version,
        bytes: artwork.bytes,
        checksumSha256: artwork.checksum,
      },
      printSurface: registeredSurface,
      shadingFactor: job.inputSnapshot.compositing.shadingFactor,
      fabricIntegration: job.inputSnapshot.compositing.fabricIntegration,
      ...(job.inputSnapshot.compositing.artworkContainFit
        ? {
            artworkContainPlacement: {
              contractVersion: STRICT_CONTAIN_FIT_VERSION,
              fitMode: "CONTAIN" as const,
              uniformScale:
                job.inputSnapshot.productFamilyPlacement?.ownerPrintFootprint
                  ? 1
                  : (job.inputSnapshot.productFamilyPlacement?.ownerPlacement
                      .uniformScale ?? 1),
              offsetX:
                job.inputSnapshot.productFamilyPlacement?.ownerPrintFootprint
                  ? 0
                  : (job.inputSnapshot.productFamilyPlacement?.ownerPlacement
                      .offsetX ?? 0),
              offsetY:
                job.inputSnapshot.productFamilyPlacement?.ownerPrintFootprint
                  ? 0
                  : (job.inputSnapshot.productFamilyPlacement?.ownerPlacement
                      .offsetY ?? 0),
            },
          }
        : {}),
      ...(footprintContract &&
      authorityRegistration?.success &&
      footprintEvidence
        ? {
            ownerPrintFootprint: {
              contract: footprintContract,
              garmentBodyBounds:
                authorityRegistration.data.garmentBodyBounds!,
              requestedWidthRatio:
                footprintEvidence.requestedWidthRatio,
              requestedHeightRatio:
                footprintEvidence.requestedHeightRatio,
              registeredWidthRatio:
                footprintEvidence.registeredWidthRatio,
              registeredHeightRatio:
                footprintEvidence.registeredHeightRatio,
              registrationScaleDelta:
                footprintEvidence.registrationScaleDelta,
              registrationClampReasons:
                authorityRegistration.data.placementEvidence?.clampReasons ??
                [],
            },
          }
        : {}),
      ...(verticalPlacementContract &&
      authorityRegistration?.success &&
      verticalPlacementEvidence
        ? {
            ownerVerticalPlacement: {
              contract: verticalPlacementContract,
              garmentBodyBounds:
                authorityRegistration.data.garmentBodyBounds!,
              registeredY: verticalPlacementEvidence.registeredY,
              clampDelta: verticalPlacementEvidence.clampDelta,
              clampReason: verticalPlacementEvidence.clampReason,
            },
          }
        : {}),
      ...(orientedPlaneContract && authorityRegistration?.success
        ? {
            orientedFrontPrintPlane:
              authorityRegistration.data.orientedFrontPrintPlane!,
          }
        : {}),
      ...(garmentMask ? { garmentMask } : {}),
      ...(depth
        ? {
            depthMap: {
              contractVersion: "nexhq-depth-estimation-v1" as const,
              bytes: depth.normalizedDepthMapPngBytes,
              checksumSha256: depth.provenance.depthMapChecksumSha256,
              sourceBaseChecksumSha256:
                depth.provenance.sourceBaseChecksumSha256,
              width: depth.provenance.normalizedDimensions.width,
              height: depth.provenance.normalizedDimensions.height,
              provider: "fal" as const,
              model: depth.provenance.model,
              adapterVersion: depth.provenance.adapterVersion,
              dynamicRange: depth.provenance.normalization.dynamicRange,
              discontinuityFraction:
                depth.provenance.normalization.discontinuityFraction,
              minimumDynamicRange:
                depth.provenance.policy.minimumDynamicRange,
              maximumDiscontinuityFraction:
                depth.provenance.policy.maximumDiscontinuityFraction,
            },
          }
        : {}),
    },
    d.now(),
  );
  } catch (error) {
    if (depth) attachDepthEstimation(error, depth.provenance);
    throw error;
  }
  const finalPath = `workspace/${scope.workspaceId}/deterministic-v2/${job.id}/composite/${result.outputChecksumSha256}.png`;
  await d.persistImageObject({
    workspaceId: scope.workspaceId,
    path: finalPath,
    bytes: result.pngBytes,
    expectedChecksum: result.outputChecksumSha256,
  });
  const compositeStage: ProductionStageOutput = {
    stageOutputId: d.id(),
    jobId: job.id,
    stage: "DETERMINISTIC_COMPOSITE",
    stageAttempt: attempt,
    status: "SUCCEEDED",
    assetId: null,
    storagePath: finalPath,
    checksumSha256: result.outputChecksumSha256,
    providerRequestId: null,
    provenance: {
      ...result.provenance,
      ...(depth ? { depthEstimation: depth.provenance } : {}),
      fidelityValidation: fidelity,
      baseStageOutputId: base.stageOutputId,
    },
    failureCode: null,
    failureMessage: null,
    createdAt: d.now(),
  };
  const persistedComposite = await d.stages.insert(scope, compositeStage);
  const asset = await d.assets.record(scope, {
    id: d.id(),
    job,
    productContext: productContextFromSnapshot(job),
    baseStageOutputId: base.stageOutputId,
    baseProviderRequestId: base.providerRequestId,
    compositeStageOutputId: persistedComposite.stageOutputId,
    storagePath: finalPath,
    compositingProvenance: result.provenance,
    generatedAt: d.now(),
  });
  await d.jobs.markSucceeded(
    scope,
    job.id,
    asset.id,
    base.providerRequestId,
    d.now(),
  );
  return asset;
}

async function segmentStageABase(input: {
  scope: WorkspaceScope;
  job: DeterministicImageJob;
  generated: {
    bytes: Buffer;
    checksumSha256: string;
  };
  faceBounds: NormalizedBounds | null;
  registrationHint: NormalizedBounds | null;
  dependencies: DeterministicRuntimeDependencies;
}): Promise<{
  provenance: GarmentSegmentationProvenance;
  validated: ValidatedGarmentSegmentation | null;
}> {
  const policy = input.job.inputSnapshot.garmentSegmentationPolicy;
  if (!policy) {
    throw new Error("Segmentation helper requires a frozen SAM 3 policy.");
  }
  const prompt = garmentSegmentationPrompt(
    input.job.inputSnapshot.product.productType,
  );
  const idempotencyKey = garmentSegmentationIdempotencyKey({
    jobId: input.job.id,
    sourceBaseChecksumSha256: input.generated.checksumSha256,
    provider: policy.provider,
    model: policy.model,
    adapterVersion: policy.adapterVersion,
  });
  if (!input.dependencies.garmentSegmenter.isConfigured()) {
    return {
      provenance: rejectedSegmentationProvenance({
        policy,
        sourceBaseChecksumSha256: input.generated.checksumSha256,
        jobId: input.job.id,
        garmentType: input.job.inputSnapshot.product.productType,
        side: input.job.inputSnapshot.productFamilyPlacement!.side,
        prompt,
        idempotencyKey,
        reason: "PROVIDER_UNAVAILABLE",
      }),
      validated: null,
    };
  }
  try {
    const providerResult =
      await input.dependencies.garmentSegmenter.segmentGarment({
        baseImage: {
          bytes: input.generated.bytes,
          checksumSha256: input.generated.checksumSha256,
          mimeType: "image/png",
        },
        jobId: input.job.id,
        garmentType: input.job.inputSnapshot.product.productType,
        side: input.job.inputSnapshot.productFamilyPlacement!.side,
        textPrompt: prompt,
        optionalRegistrationHint: input.registrationHint,
        idempotencyKey,
      });
    const validation = await validateGarmentSegmentation({
      providerResult,
      policy,
      baseImageBytes: input.generated.bytes,
      sourceBaseChecksumSha256: input.generated.checksumSha256,
      jobId: input.job.id,
      garmentType: input.job.inputSnapshot.product.productType,
      side: input.job.inputSnapshot.productFamilyPlacement!.side,
      prompt,
      idempotencyKey,
      registrationHint: input.registrationHint,
      faceBounds: input.faceBounds,
    });
    if (!validation.ok) {
      return { provenance: validation.provenance, validated: null };
    }
    const mask = validation.segmentation.provenance.mask;
    const path = garmentSegmentationMaskStoragePath({
      workspaceId: input.scope.workspaceId,
      jobId: input.job.id,
      sourceBaseChecksumSha256: input.generated.checksumSha256,
      maskChecksumSha256: mask.checksumSha256,
    });
    try {
      await input.dependencies.persistImageObject({
        workspaceId: input.scope.workspaceId,
        path,
        bytes: validation.segmentation.normalizedMaskPngBytes,
        expectedChecksum: mask.checksumSha256,
      });
    } catch {
      return {
        provenance: garmentSegmentationProvenanceSchema.parse({
          ...validation.segmentation.provenance,
          status: "REJECTED",
          validationReason: "MASK_STORAGE_FAILED",
          selectedCandidateId: null,
          mask: null,
        }),
        validated: null,
      };
    }
    return {
      provenance: validation.segmentation.provenance,
      validated: validation.segmentation,
    };
  } catch {
    return {
      provenance: rejectedSegmentationProvenance({
        policy,
        sourceBaseChecksumSha256: input.generated.checksumSha256,
        jobId: input.job.id,
        garmentType: input.job.inputSnapshot.product.productType,
        side: input.job.inputSnapshot.productFamilyPlacement!.side,
        prompt,
        idempotencyKey,
        reason: "PROVIDER_RESPONSE_INVALID",
      }),
      validated: null,
    };
  }
}

async function estimateStageANormals(input: {
  scope: WorkspaceScope;
  job: DeterministicImageJob;
  generated: { bytes: Buffer; checksumSha256: string };
  segmentation: ValidatedGarmentSegmentation;
  dependencies: DeterministicRuntimeDependencies;
}): Promise<{
  provenance: NormalEstimationProvenance;
  validated: ValidatedNormalEstimation | null;
}> {
  const policy = input.job.inputSnapshot.normalEstimationPolicy;
  if (!policy) throw new Error("Normal helper requires a frozen MiDaS policy.");
  const image = await loadImage(input.generated.bytes);
  const idempotencyKey = normalEstimationIdempotencyKey({
    jobId: input.job.id,
    sourceBaseChecksumSha256: input.generated.checksumSha256,
    provider: policy.provider,
    model: policy.model,
    adapterVersion: policy.adapterVersion,
  });
  if (!input.dependencies.normalEstimator.isConfigured()) {
    return {
      provenance: rejectedNormalProvenance({
        policy,
        jobId: input.job.id,
        sourceBaseChecksumSha256: input.generated.checksumSha256,
        sourceWidth: image.width,
        sourceHeight: image.height,
        idempotencyKey,
        reason: "PROVIDER_UNAVAILABLE",
        status: "MISSING",
      }),
      validated: null,
    };
  }
  let providerRequestId: string | null = null;
  try {
    const result = await input.dependencies.normalEstimator.estimateNormals({
      jobId: input.job.id,
      baseImage: {
        bytes: input.generated.bytes,
        checksumSha256: input.generated.checksumSha256,
        mimeType: "image/png",
      },
      idempotencyKey,
    });
    providerRequestId = result.providerRequestId;
    const validated = await validateNormalEstimation({
      policy,
      result,
      jobId: input.job.id,
      sourceBaseChecksumSha256: input.generated.checksumSha256,
      sourceWidth: image.width,
      sourceHeight: image.height,
      garmentMaskBytes: input.segmentation.normalizedMaskPngBytes,
      idempotencyKey,
    });
    try {
      await input.dependencies.persistImageObject({
        workspaceId: input.scope.workspaceId,
        path: normalMapStoragePath({
          workspaceId: input.scope.workspaceId,
          jobId: input.job.id,
          sourceBaseChecksumSha256: input.generated.checksumSha256,
          normalMapChecksumSha256: validated.provenance.normalMapChecksumSha256,
        }),
        bytes: validated.normalizedNormalMapPngBytes,
        expectedChecksum: validated.provenance.normalMapChecksumSha256,
      });
    } catch {
      return {
        provenance: rejectedNormalProvenance({ policy, jobId: input.job.id, sourceBaseChecksumSha256: input.generated.checksumSha256, sourceWidth: image.width, sourceHeight: image.height, idempotencyKey, reason: "NORMAL_STORAGE_FAILED", providerRequestId }),
        validated: null,
      };
    }
    return { provenance: validated.provenance, validated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "PROVIDER_RESPONSE_INVALID";
    const validationReasons = ["SOURCE_BINDING_MISMATCH", "NORMAL_DECODE_FAILED", "NORMAL_DIMENSIONS_INVALID", "NORMAL_FIELD_DEGENERATE", "NORMAL_SAMPLES_INSUFFICIENT", "NORMAL_FIELD_UNSTABLE"] as const;
    const validationReason = validationReasons.find((reason) => reason === message);
    const unknown =
      error instanceof NormalEstimationProviderOutcomeUnknownError ||
      /timeout|unknown outcome|connection reset/i.test(message);
    return {
      provenance: rejectedNormalProvenance({
        policy,
        jobId: input.job.id,
        sourceBaseChecksumSha256: input.generated.checksumSha256,
        sourceWidth: image.width,
        sourceHeight: image.height,
        idempotencyKey,
        reason: unknown ? "PROVIDER_OUTCOME_UNKNOWN" : validationReason ?? "PROVIDER_RESPONSE_INVALID",
        status: unknown ? "UNKNOWN_OUTCOME" : "REJECTED",
        providerRequestId,
      }),
      validated: null,
    };
  }
}

async function persistBaseAndComposite(
  scope: WorkspaceScope,
  claimed: DeterministicImageJob,
  generated: {
    bytes: Buffer;
    checksumSha256: string;
    providerRequestId: string | null;
    provenance: Record<string, unknown>;
    identityConsistency?: BrandModelIdentityConsistency;
  },
  d: DeterministicRuntimeDependencies,
): Promise<void> {
  const path = `workspace/${scope.workspaceId}/deterministic-v2/${claimed.id}/base/${generated.checksumSha256}.png`;
  await d.persistImageObject({
    workspaceId: scope.workspaceId,
    path,
    bytes: generated.bytes,
    expectedChecksum: generated.checksumSha256,
  });
  if (generated.identityConsistency?.status === "FAIL") {
    await d.stages.insert(scope, {
      stageOutputId: d.id(),
      jobId: claimed.id,
      stage: "BASE_GENERATION",
      stageAttempt: claimed.attemptCount,
      status: "SUCCEEDED",
      assetId: d.id(),
      storagePath: path,
      checksumSha256: generated.checksumSha256,
      providerRequestId: generated.providerRequestId,
      provenance: {
        ...generated.provenance,
        identityConsistency: generated.identityConsistency,
        basePrintPurity: null,
      },
      failureCode: null,
      failureMessage: null,
      createdAt: d.now(),
    });
    await d.jobs.markFailed(scope, claimed.id, {
      code: "BRAND_MODEL_IDENTITY_MISMATCH",
      message:
        "Das erzeugte Bild stimmt nicht sicher genug mit dem gewählten Markenmodel überein.",
      now: d.now(),
    });
    return;
  }
  let garmentRegistration:
    | GarmentRegistrationV2
    | GarmentRegistrationV3
    | null = null;
  let garmentSegmentation: GarmentSegmentationProvenance | null = null;
  let validatedGarmentSegmentation: ValidatedGarmentSegmentation | null = null;
  let normalEstimation: NormalEstimationProvenance | null = null;
  let validatedNormalEstimation: ValidatedNormalEstimation | null = null;
  let registeredSurface = effectivePrintSurfaceForSnapshot(
    claimed.inputSnapshot,
  );
  const productFamilyPlacement = claimed.inputSnapshot.productFamilyPlacement;
  const outputMapping = productFamilyPlacement?.outputMapping;
  const definition = contentShotById(claimed.inputSnapshot.shot.assetId);
  const faceBounds =
    productFamilyPlacement && definition?.requiresBrandModel
      ? await d.detectFaceBounds(generated.bytes)
      : null;
  let printReadinessPreflight: PrintReadyStageAAssessment | null = null;
  let printReadinessPostflight: PrintReadyStageAAssessment | null = null;
  if (claimed.inputSnapshot.printReadyStageA) {
    printReadinessPreflight = await assessLocalPrintReadyStageA({
      bytes: generated.bytes,
      faceBounds,
    });
    if (printReadinessPreflight.status === "FAIL") {
      await d.stages.insert(scope, {
        stageOutputId: d.id(),
        jobId: claimed.id,
        stage: "BASE_GENERATION",
        stageAttempt: claimed.attemptCount,
        status: "SUCCEEDED",
        assetId: d.id(),
        storagePath: path,
        checksumSha256: generated.checksumSha256,
        providerRequestId: generated.providerRequestId,
        provenance: {
          ...generated.provenance,
          ...(generated.identityConsistency
            ? { identityConsistency: generated.identityConsistency }
            : {}),
          printReadiness: {
            contract: claimed.inputSnapshot.printReadyStageA,
            preflight: printReadinessPreflight,
            postflight: null,
          },
          basePrintPurity: null,
        },
        failureCode: null,
        failureMessage: null,
        createdAt: d.now(),
      });
      await d.jobs.markFailed(scope, claimed.id, {
        code: "STAGE_A_NOT_PRINT_READY",
        message:
          "Das Basisbild zeigt nicht genügend freie Shirt-Frontfläche für den gewählten großen Frontprint.",
        now: d.now(),
      });
      return;
    }
  }
  if (claimed.inputSnapshot.garmentSegmentationPolicy) {
    if (!productFamilyPlacement) {
      throw new Error(
        "Frozen SAM 3 policy requires Product Family placement authority.",
      );
    }
    const registrationHint = registeredSurface.boundingBox;
    const segmentation = await segmentStageABase({
      scope,
      job: claimed,
      generated,
      faceBounds,
      registrationHint,
      dependencies: d,
    });
    garmentSegmentation = segmentation.provenance;
    validatedGarmentSegmentation = segmentation.validated;
  }
  if (
    claimed.inputSnapshot.normalEstimationPolicy &&
    validatedGarmentSegmentation
  ) {
    const normals = await estimateStageANormals({
      scope,
      job: claimed,
      generated,
      segmentation: validatedGarmentSegmentation,
      dependencies: d,
    });
    normalEstimation = normals.provenance;
    validatedNormalEstimation = normals.validated;
  }
  if (
    productFamilyPlacement &&
    (!claimed.inputSnapshot.garmentSegmentationPolicy ||
      validatedGarmentSegmentation) &&
    (!claimed.inputSnapshot.normalEstimationPolicy ||
      validatedNormalEstimation) &&
    (outputMapping === "GENERATED_GARMENT_RELATIVE_V2" ||
      outputMapping === "GENERATED_GARMENT_RELATIVE_V3")
  ) {
    const registrationOwnerPlacement = productFamilyPlacement.artworkFit
      ? {
          ...productFamilyPlacement.ownerPlacement,
          uniformScale: 1,
          offsetX: 0,
          offsetY: 0,
        }
      : productFamilyPlacement.ownerPlacement;
    const registrationInput = {
      bytes: generated.bytes,
      productType: claimed.inputSnapshot.product.productType,
      productColor: claimed.inputSnapshot.product.color,
      side: productFamilyPlacement.side,
      printableArea: productFamilyPlacement.printableArea,
      ownerPlacement: registrationOwnerPlacement,
      faceBounds,
      requireFaceBounds:
        Boolean(definition?.requiresBrandModel) &&
        productFamilyPlacement.side === "FRONT",
    };
    if (outputMapping === "GENERATED_GARMENT_RELATIVE_V3") {
      const v3 = await d.registerGarmentV3({
        ...registrationInput,
        ...(productFamilyPlacement.ownerPrintFootprint
          ? {
              ownerPrintFootprint:
                productFamilyPlacement.ownerPrintFootprint,
            }
          : {}),
        ...(productFamilyPlacement.ownerVerticalPlacement
          ? {
              ownerVerticalPlacement:
                productFamilyPlacement.ownerVerticalPlacement,
            }
          : {}),
        ...(productFamilyPlacement.orientedFrontPrintPlane
          ? {
              orientedFrontPrintPlane:
                productFamilyPlacement.orientedFrontPrintPlane,
            }
          : {}),
        placementPreset:
          claimed.inputSnapshot.semanticPlacement?.placementPreset ?? null,
        ...(validatedGarmentSegmentation
          ? {
              segmentationMask: {
                bytes:
                  validatedGarmentSegmentation.normalizedMaskPngBytes,
                checksumSha256:
                  validatedGarmentSegmentation.provenance.mask
                    .checksumSha256,
                width:
                  validatedGarmentSegmentation.provenance.mask.width,
                height:
                  validatedGarmentSegmentation.provenance.mask.height,
              },
            }
          : {}),
        ...(validatedNormalEstimation
          ? {
              normalMap: {
                bytes: validatedNormalEstimation.normalizedNormalMapPngBytes,
                checksumSha256:
                  validatedNormalEstimation.provenance.normalMapChecksumSha256,
                width:
                  validatedNormalEstimation.provenance.normalizedDimensions.width,
                height:
                  validatedNormalEstimation.provenance.normalizedDimensions.height,
              },
            }
          : {}),
      });
      garmentRegistration = v3;
      if (claimed.inputSnapshot.printReadyStageA) {
        printReadinessPostflight = assessRegisteredPrintReadyStageA({
          imageWidth: v3.imageWidth,
          imageHeight: v3.imageHeight,
          faceBounds: v3.faceBounds,
          garmentBounds: v3.garmentBounds,
          torsoBounds: v3.frontTorsoEnvelope?.torsoBounds ?? null,
          torsoStatus:
            v3.frontTorsoEnvelope?.status === "READY" ? "READY" : "UNSAFE",
          torsoConfidence: v3.frontTorsoEnvelope?.confidence ?? 0,
          maskCoverage: v3.maskCoverage,
        });
      }
      if (v3.status === "REGISTERED") {
        registeredSurface = printSurfaceForGarmentRegistrationV3(
          registeredSurface,
          v3,
        );
      }
    } else {
      const v2 = await d.registerGarment(registrationInput);
      garmentRegistration = v2;
      if (v2.status === "REGISTERED") {
        registeredSurface = printSurfaceForGarmentRegistration(
          registeredSurface,
          v2,
        );
      }
    }
  }
  const purity: BasePrintPurityAssessment | null =
    (!claimed.inputSnapshot.garmentSegmentationPolicy ||
      validatedGarmentSegmentation) &&
    (!garmentRegistration || garmentRegistration.status === "REGISTERED")
      ? await d.inspectBasePrintPurity({
          bytes: generated.bytes,
          printSurface: registeredSurface,
        })
      : null;
  const base = await d.stages.insert(scope, {
    stageOutputId: d.id(),
    jobId: claimed.id,
    stage: "BASE_GENERATION",
    stageAttempt: claimed.attemptCount,
    status: "SUCCEEDED",
    assetId: d.id(),
    storagePath: path,
    checksumSha256: generated.checksumSha256,
    providerRequestId: generated.providerRequestId,
    provenance: {
      ...generated.provenance,
      ...(generated.identityConsistency
        ? { identityConsistency: generated.identityConsistency }
        : {}),
      ...(garmentSegmentation ? { garmentSegmentation } : {}),
      ...(normalEstimation ? { normalEstimation } : {}),
      ...(garmentRegistration ? { garmentRegistration } : {}),
      ...(claimed.inputSnapshot.printReadyStageA
        ? {
            printReadiness: {
              contract: claimed.inputSnapshot.printReadyStageA,
              preflight: printReadinessPreflight,
              postflight: printReadinessPostflight,
            },
          }
        : {}),
      basePrintPurity: purity,
    },
    failureCode: null,
    failureMessage: null,
    createdAt: d.now(),
  });
  if (
    claimed.inputSnapshot.garmentSegmentationPolicy &&
    !validatedGarmentSegmentation
  ) {
    await d.jobs.markFailed(scope, claimed.id, {
      code: "GARMENT_SEGMENTATION_UNSAFE",
      message: "Kleidungsstück konnte auf diesem Bild nicht sicher erkannt werden.",
      now: d.now(),
    });
    return;
  }
  if (
    claimed.inputSnapshot.normalEstimationPolicy &&
    !validatedNormalEstimation
  ) {
    await d.jobs.markFailed(scope, claimed.id, {
      code:
        normalEstimation?.status === "UNKNOWN_OUTCOME"
          ? "MIDAS_NORMAL_UNKNOWN_OUTCOME"
          : normalEstimation?.validationReason === "PROVIDER_UNAVAILABLE"
            ? "MIDAS_NORMAL_MISSING"
            : "MIDAS_NORMAL_INVALID",
      message:
        normalEstimation?.status === "UNKNOWN_OUTCOME"
          ? "Der Ausgang der Normalen-Analyse ist unbekannt. Es wurde kein Ergebnis erstellt."
          : "Die Shirt-Oberflächenrichtung konnte nicht sicher bestimmt werden.",
      now: d.now(),
    });
    return;
  }
  if (garmentRegistration?.status === "LOW_CONFIDENCE") {
    const largeFrontUnsafe =
      "placementEvidence" in garmentRegistration &&
      garmentRegistration.reason === "LARGE_FRONT_UNSAFE";
    const frontTorsoUnsafe =
      "frontTorsoEnvelope" in garmentRegistration &&
      garmentRegistration.reason === "FRONT_TORSO_UNSAFE";
    const verticalPlacementUnsafe =
      garmentRegistration.reason === "OWNER_VERTICAL_PLACEMENT_UNSAFE";
    const orientedPlaneUnsafe =
      garmentRegistration.reason.startsWith("ORIENTED_PLANE_") ||
      garmentRegistration.reason.startsWith("NORMAL_") ||
      garmentRegistration.reason.startsWith("MIDAS_") ||
      garmentRegistration.reason === "DEPTH_NORMAL_CONTRADICTORY";
    await d.jobs.markFailed(scope, claimed.id, {
      ...(claimed.inputSnapshot.printReadyStageA && !orientedPlaneUnsafe
        ? {
            code: "STAGE_A_NOT_PRINT_READY",
            message:
              "Das Basisbild zeigt nicht genügend freie Shirt-Frontfläche für den gewählten großen Frontprint.",
          }
        : {
      code: orientedPlaneUnsafe
        ? garmentRegistration.reason
        : verticalPlacementUnsafe
        ? "OWNER_VERTICAL_PLACEMENT_UNSAFE"
        : frontTorsoUnsafe
        ? "GARMENT_REGISTRATION_FRONT_TORSO_UNSAFE"
        : largeFrontUnsafe
          ? "GARMENT_REGISTRATION_LARGE_FRONT_UNSAFE"
          : "GARMENT_REGISTRATION_LOW_CONFIDENCE",
      message: orientedPlaneUnsafe
        ? "Die Front-Druckfläche konnte nicht sicher an die sichtbare Shirt-Ausrichtung angepasst werden."
        : verticalPlacementUnsafe
        ? OWNER_VERTICAL_PLACEMENT_ERROR
        : frontTorsoUnsafe
        ? "Die Front-Druckfläche konnte auf diesem Bild nicht zuverlässig auf den Shirt-Torso begrenzt werden."
        : largeFrontUnsafe
          ? "Der gewählte große Frontprint konnte auf diesem Bild nicht sicher innerhalb der tatsächlichen Shirt-Frontfläche erhalten werden."
          : "Druckfläche konnte auf diesem Bild nicht sicher erkannt werden.",
          }),
      now: d.now(),
    });
    return;
  }
  if (
    claimed.inputSnapshot.printReadyStageA &&
    printReadinessPostflight?.status !== "PASS"
  ) {
    await d.jobs.markFailed(scope, claimed.id, {
      code: "STAGE_A_NOT_PRINT_READY",
      message:
        "Das Basisbild zeigt nicht genügend freie Shirt-Frontfläche für den gewählten großen Frontprint.",
      now: d.now(),
    });
    return;
  }
  if (!purity || purity.status !== "PASS") {
    await d.jobs.markFailed(scope, claimed.id, {
      code: "BASE_PRINT_ZONE_CONTAMINATED",
      message:
        "The generated base garment was not demonstrably blank in the target print area. Deterministic Artwork compositing was refused.",
      now: d.now(),
    });
    return;
  }
  await compositeFromStoredBase(
    scope,
    claimed,
    d,
    base as NonNullable<
      Awaited<ReturnType<StageOutputRepository["getSucceededBase"]>>
    >,
    1,
  );
}

function brandModelTraceFromSnapshot(job: DeterministicImageJob) {
  const brandModel = job.inputSnapshot.brandModel;
  return {
    contractVersion: brandModel.contractVersion,
    brandModelId: brandModel.brandModelId,
    personaId: brandModel.personaId,
    identityLockSnapshotId: brandModel.identityLockSnapshotId,
    identityLockVersion: brandModel.identityLockVersion,
    identityFingerprint: brandModel.identityFingerprint,
    referencePackageVersion: brandModel.referencePackageVersion,
    referencePackageFingerprint: brandModel.referencePackageFingerprint,
  };
}

async function resolveRealStageARequest(
  scope: WorkspaceScope,
  job: DeterministicImageJob,
  d: DeterministicRuntimeDependencies,
) {
  if (job.inputSnapshot.baseGeneration.provider !== "openai") {
    throw new PersonaDomainError(
      "The confirmed deterministic base provider is not supported by the current production executor.",
      "WORKFLOW",
    );
  }
  d.assertPaidEnabled();
  if (!d.isProviderConfigured("openai")) {
    throw new PersonaDomainError(
      "OpenAI Image production is not configured.",
      "WORKFLOW",
    );
  }
  if (job.inputSnapshot.garmentSegmentationPolicy) {
    if (!d.garmentSegmenter.isConfigured()) {
      throw new PersonaDomainError(
        "SAM-3-Kleidungssegmentierung ist serverseitig nicht vollständig konfiguriert.",
        "WORKFLOW",
      );
    }
    const descriptor = d.garmentSegmenter.describe();
    const frozen = job.inputSnapshot.garmentSegmentationPolicy;
    if (
      descriptor.provider !== frozen.provider ||
      descriptor.adapterVersion !== frozen.adapterVersion ||
      descriptor.model !== frozen.model
    ) {
      throw new PersonaDomainError(
        "Die SAM-3-Konfiguration stimmt nicht mehr mit dem vorbereiteten Auftrag überein. Bereite den Auftrag neu vor.",
        "WORKFLOW",
      );
    }
  }
  if (job.inputSnapshot.depthEstimationPolicy) {
    const frozen = job.inputSnapshot.depthEstimationPolicy;
    if (!d.depthEstimator.isConfigured() && frozen.requiredInProduction) {
      throw new PersonaDomainError(
        "fal Depth Anything V2 ist serverseitig nicht vollständig konfiguriert.",
        "WORKFLOW",
      );
    }
    const descriptor = d.depthEstimator.isConfigured()
      ? d.depthEstimator.describe()
      : null;
    if (
      descriptor &&
      (descriptor.provider !== frozen.provider ||
        descriptor.adapterVersion !== frozen.adapterVersion ||
        descriptor.model !== frozen.model)
    ) {
      throw new PersonaDomainError(
        "Die Depth-Konfiguration stimmt nicht mehr mit dem vorbereiteten Auftrag überein. Bereite den Auftrag neu vor.",
        "WORKFLOW",
      );
    }
  }
  if (job.inputSnapshot.normalEstimationPolicy) {
    const frozen = job.inputSnapshot.normalEstimationPolicy;
    if (!d.normalEstimator.isConfigured()) {
      throw new PersonaDomainError(
        "fal MiDaS Normal ist serverseitig nicht vollständig konfiguriert.",
        "WORKFLOW",
      );
    }
    const descriptor = d.normalEstimator.describe();
    if (
      descriptor.provider !== frozen.provider ||
      descriptor.adapterVersion !== frozen.adapterVersion ||
      descriptor.model !== frozen.model
    ) {
      throw new PersonaDomainError(
        "Die MiDaS-Normal-Konfiguration stimmt nicht mehr mit dem vorbereiteten Auftrag überein. Bereite den Auftrag neu vor.",
        "WORKFLOW",
      );
    }
  }

  // Revalidate every authority and load private reference bytes before the
  // atomic paid-call claim. None of these bytes come from browser paths.
  const currentArtwork = await d.resolveArtwork(scope, {
    id: job.inputSnapshot.masterArtwork.artworkId,
    designId: job.inputSnapshot.masterArtwork.designId,
    version: job.inputSnapshot.masterArtwork.version,
    checksum: job.inputSnapshot.masterArtwork.checksum,
  });
  if (
    checksumImageArtwork(currentArtwork.bytes) !==
    job.inputSnapshot.masterArtwork.checksum
  ) {
    throw new PersonaDomainError(
      "Approved Artwork authority changed before Stage A execution.",
      "WORKFLOW",
    );
  }

  const identity = await d.resolveIdentity(
    scope,
    brandModelTraceFromSnapshot(job),
  );
  if (
    identity.masterReference.assetId !==
      job.inputSnapshot.brandModel.masterIdentityAssetId ||
    !brandModelTracesEqual(
      identity.trace.brandModel,
      brandModelTraceFromSnapshot(job),
    )
  ) {
    throw new PersonaDomainError(
      "The selected Brand Model reference package changed before Stage A execution.",
      "BRAND_MODEL_VERSION_MISMATCH",
    );
  }
  const frozenConditioning = job.inputSnapshot.identityConditioning;
  if (
    frozenConditioning &&
    (frozenConditioning.masterIdentityAssetId !==
      identity.masterReference.assetId ||
      frozenConditioning.referencePackageVersion !==
        identity.trace.referencePackageVersion ||
      frozenConditioning.referencePackageFingerprint !==
        identity.trace.brandModel.referencePackageFingerprint ||
      identity.supportingReferences.length !==
        frozenConditioning.supportingReferenceCount)
  ) {
    throw new PersonaDomainError(
      "The resolved Persona package does not match the frozen identity-conditioning contract.",
      "BRAND_MODEL_VERSION_MISMATCH",
    );
  }

  const packageReferences =
    job.inputSnapshot.productVisualInput.referencePackage.references;
  const productReferences = await Promise.all(
    packageReferences.map(async (reference) => {
      if (
        !reference.privateStoragePath ||
        !reference.contentChecksumSha256 ||
        !reference.mimeType ||
        !reference.byteLength
      ) {
        throw new PersonaDomainError(
          "Ein eingefrorenes Produktbild ist unvollständig. Bereite einen neuen Durchlauf vor.",
          "WORKFLOW",
        );
      }
      const bytes = await d.verifyProductReference({
        workspaceId: scope.workspaceId,
        path: reference.privateStoragePath,
        expectedChecksum: reference.contentChecksumSha256,
      });
      let completeReference: FrozenProductVisualReference;
      try {
        completeReference = completeFrozenProductReference(reference, bytes);
      } catch (error) {
        throw new PersonaDomainError(
          "Ein eingefrorenes Produktbild stimmt nicht mit den privaten Originaldaten überein. Bereite einen neuen Durchlauf vor.",
          "WORKFLOW",
          {
            referenceId: reference.referenceId,
            reason: error instanceof Error ? error.message : "unknown",
          },
        );
      }
      return {
        referenceId: completeReference.referenceId,
        role: completeReference.role,
        mimeType: completeReference.mimeType,
        bytes,
      };
    }),
  );
  const request = buildDeterministicBaseProviderRequest({
    snapshot: job.inputSnapshot,
    identity,
    productReferences,
  });
  if (request.artwork) {
    throw new PersonaDomainError(
      "Deterministic Stage A must not contain Artwork input.",
      "WORKFLOW",
    );
  }
  return { request, identity, productReferences };
}

export async function executeFakeDeterministicJob(
  scope: WorkspaceScope,
  jobId: string,
  fingerprint: string,
  overrides: Partial<DeterministicRuntimeDependencies> = {},
): Promise<DeterministicRecovery> {
  const d = dependencies(overrides);
  if (!d.allowFakeExecution())
    throw new PersonaDomainError(
      "Synthetic Stage A is disabled in production runtime.",
      "WORKFLOW",
    );
  const before = await d.jobs.get(scope, jobId);
  if (!before)
    throw new PersonaDomainError("Deterministic job not found.", "NOT_FOUND");
  assertExactJob(before, fingerprint);
  const existingBase = await d.stages.getSucceededBase(scope, jobId);
  if (existingBase) {
    if (before.status === "succeeded")
      return getDeterministicRecovery(scope, jobId, overrides);
    if (before.status === "unknown_outcome")
      throw new PersonaDomainError(
        "Unknown provider outcome must be reconciled before compositing.",
        "WORKFLOW",
      );
    if (before.status !== "running")
      throw new PersonaDomainError(
        "Use Retry Composite after a composite failure.",
        "WORKFLOW",
      );
    const attempt =
      (await d.stages.list(scope, jobId)).filter(
        (stage) => stage.stage === "DETERMINISTIC_COMPOSITE",
      ).length + 1;
    try {
      await compositeFromStoredBase(scope, before, d, existingBase, attempt);
    } catch (error) {
      const failure = controlledCompositeFailure(error);
      await d.stages.insert(scope, {
        stageOutputId: d.id(),
        jobId,
        stage: "DETERMINISTIC_COMPOSITE",
        stageAttempt: attempt,
        status: "FAILED",
        assetId: null,
        storagePath: null,
        checksumSha256: null,
        providerRequestId: null,
        provenance: {
          retryBoundary: "REUSE_PERSISTED_BASE",
          automaticProviderRetry: false,
          baseStageOutputId: existingBase.stageOutputId,
          runtimeBoundary: "CONTROLLED_JS_FAILURE",
          ...failure.provenance,
        },
        failureCode: failure.code,
        failureMessage: failure.message,
        createdAt: d.now(),
      });
      await d.jobs.markFailed(scope, jobId, {
        code: failure.code,
        message: failure.message,
        now: d.now(),
      });
    }
    return getDeterministicRecovery(scope, jobId, overrides);
  }
  const claimed = await d.jobs.claimBase(scope, jobId, fingerprint, d.now());
  if (!claimed)
    throw new PersonaDomainError(
      "Job is not confirmed, confirmation expired, or execution was already claimed.",
      "WORKFLOW",
    );
  try {
    const generated = await d.baseProvider.generate(claimed.inputSnapshot);
    await persistBaseAndComposite(scope, claimed, generated, d);
  } catch (error) {
    const base = await d.stages.getSucceededBase(scope, jobId);
    if (base) {
      const failure = controlledCompositeFailure(error);
      await d.stages.insert(scope, {
        stageOutputId: d.id(),
        jobId,
        stage: "DETERMINISTIC_COMPOSITE",
        stageAttempt: 1,
        status: "FAILED",
        assetId: null,
        storagePath: null,
        checksumSha256: null,
        providerRequestId: null,
        provenance: {
          retryBoundary: "REUSE_PERSISTED_BASE",
          automaticProviderRetry: false,
          baseStageOutputId: base.stageOutputId,
          ...failure.provenance,
        },
        failureCode: failure.code,
        failureMessage: failure.message,
        createdAt: d.now(),
      });
      await d.jobs.markFailed(scope, jobId, {
        code: failure.code,
        message: failure.message,
        now: d.now(),
      });
    } else
      await d.jobs.markUnknown(scope, jobId, {
        providerRequestId: null,
        reason:
          "Stage A claim completed without a durable base result; fail closed before any retry.",
        now: d.now(),
      });
  }
  return getDeterministicRecovery(scope, jobId, overrides);
}

/**
 * Executes the one confirmed paid Stage A attempt through the existing
 * deterministic v2 seam, then applies Stage B locally. The provider request is
 * built only from Persona, Product, and creative direction; Artwork is loaded
 * solely for preflight authority validation and later deterministic Stage B.
 */
export async function executeRealDeterministicJob(
  scope: WorkspaceScope,
  jobId: string,
  fingerprint: string,
  overrides: Partial<DeterministicRuntimeDependencies> = {},
): Promise<DeterministicRecovery> {
  requireActor(scope);
  const d = dependencies(overrides);
  const before = await d.jobs.get(scope, jobId);
  if (!before)
    throw new PersonaDomainError("Deterministic job not found.", "NOT_FOUND");
  assertExactJob(before, fingerprint);
  if (before.status === "unknown_outcome")
    throw new PersonaDomainError(
      "Unknown provider outcome must be reconciled before any paid retry.",
      "WORKFLOW",
    );
  if (before.status === "succeeded")
    return getDeterministicRecovery(scope, jobId, overrides);

  const existingBase = await d.stages.getSucceededBase(scope, jobId);
  if (existingBase) {
    if (before.status !== "running")
      throw new PersonaDomainError(
        "Use Retry Composite after a deterministic composite failure.",
        "WORKFLOW",
      );
    await compositeFromStoredBase(
      scope,
      before,
      d,
      existingBase,
      (await d.stages.list(scope, jobId)).filter(
        (stage) => stage.stage === "DETERMINISTIC_COMPOSITE",
      ).length + 1,
    );
    return getDeterministicRecovery(scope, jobId, overrides);
  }

  // Resolve/check all private production inputs before consuming the one paid
  // claim. A configuration or authority failure leaves the job confirmed.
  const resolved = await resolveRealStageARequest(scope, before, d);
  assertSupportedRasterImageIntegrity(resolved.identity.masterReference.bytes);
  const claimed = await d.jobs.claimBase(scope, jobId, fingerprint, d.now());
  if (!claimed) {
    const current = await d.jobs.get(scope, jobId);
    if (current?.status === "succeeded")
      return getDeterministicRecovery(scope, jobId, overrides);
    throw new PersonaDomainError(
      "Job is not confirmed, confirmation expired, or paid execution was already claimed.",
      "WORKFLOW",
    );
  }

  let providerRequestId: string | null = null;
  try {
    const result = await d.generateBase("openai", resolved.request);
    providerRequestId = result.providerRequestId ?? null;
    if (result.status !== "completed" || !result.imageBytes?.length) {
      throw new Error("The Image provider returned no completed base image.");
    }
    // Validate fully in JavaScript before face-api/canvas/native image runtimes.
    // A corrupt provider result must become UNKNOWN_OUTCOME, never SIGSEGV Node.
    assertSupportedRasterImageIntegrity(result.imageBytes);
    const checksumSha256 = checksumImageArtwork(result.imageBytes);
    const identityConsistency = claimed.inputSnapshot.identityConditioning
      ?.outputConsistencyGate.required
      ? await d.assessBrandModelIdentity({
          masterIdentityBytes: resolved.identity.masterReference.bytes,
          generatedBaseBytes: result.imageBytes,
          identityLockSnapshotId:
            claimed.inputSnapshot.brandModel.identityLockSnapshotId,
          masterIdentityAssetId:
            resolved.identity.masterReference.assetId,
          identityLockVersion:
            claimed.inputSnapshot.brandModel.identityLockVersion,
          referencePackageVersion:
            claimed.inputSnapshot.brandModel.referencePackageVersion,
          supportingReferenceCount:
            resolved.identity.supportingReferences.length,
        })
      : undefined;
    await persistBaseAndComposite(
      scope,
      claimed,
      {
        bytes: result.imageBytes,
        checksumSha256,
        providerRequestId,
        ...(identityConsistency ? { identityConsistency } : {}),
        provenance: {
          providerMode: "REAL_PAID",
          provider: result.providerId,
          model: result.modelId,
          providerRequestId,
          inputFingerprint: claimed.inputFingerprint,
          requestIdentity: {
            personaId: claimed.inputSnapshot.brandModel.personaId,
            brandModelId: claimed.inputSnapshot.brandModel.brandModelId,
            identityLockVersion:
              claimed.inputSnapshot.brandModel.identityLockVersion,
            masterIdentityAssetId:
              resolved.identity.masterReference.assetId,
            supportingReferenceIds:
              resolved.identity.supportingReferences.map(
                (reference) => reference.assetId,
              ),
          },
          productReferenceIds: resolved.productReferences.map(
            (reference) => reference.referenceId,
          ),
          artworkInputIncluded: false,
          assetCount: 1,
        },
      },
      d,
    );
  } catch (error) {
    if (
      !providerRequestId &&
      typeof error === "object" &&
      error !== null &&
      "requestId" in error &&
      typeof (error as { requestId?: unknown }).requestId === "string"
    ) {
      providerRequestId = (error as { requestId: string }).requestId;
    }
    const base = await d.stages.getSucceededBase(scope, jobId);
    const failure = controlledCompositeFailure(error);
    if (base) {
      await d.stages.insert(scope, {
        stageOutputId: d.id(),
        jobId,
        stage: "DETERMINISTIC_COMPOSITE",
        stageAttempt:
          (await d.stages.list(scope, jobId)).filter(
            (stage) => stage.stage === "DETERMINISTIC_COMPOSITE",
          ).length + 1,
        status: "FAILED",
        assetId: null,
        storagePath: null,
        checksumSha256: null,
        providerRequestId: null,
        provenance: {
          retryBoundary: "REUSE_PERSISTED_BASE",
          automaticProviderRetry: false,
          baseStageOutputId: base.stageOutputId,
          ...failure.provenance,
        },
        failureCode: failure.code,
        failureMessage: failure.message,
        createdAt: d.now(),
      });
      await d.jobs.markFailed(scope, jobId, {
        code: failure.code,
        message: failure.message,
        now: d.now(),
      });
    } else {
      await d.jobs.markUnknown(scope, jobId, {
        providerRequestId,
        reason:
          "The paid Stage A claim was consumed without a durable base result. Reconciliation is required before any retry. " +
          failure.message,
        now: d.now(),
      });
    }
  }
  return getDeterministicRecovery(scope, jobId, overrides);
}

export async function retryDeterministicComposite(
  scope: WorkspaceScope,
  jobId: string,
  fingerprint: string,
  overrides: Partial<DeterministicRuntimeDependencies> = {},
): Promise<DeterministicRecovery> {
  const d = dependencies(overrides);
  const job = await d.jobs.get(scope, jobId);
  if (!job)
    throw new PersonaDomainError("Deterministic job not found.", "NOT_FOUND");
  assertExactJob(job, fingerprint);
  const base = await d.stages.getSucceededBase(scope, jobId);
  if (!base)
    throw new PersonaDomainError(
      "Composite retry requires the exact stored successful base.",
      "WORKFLOW",
    );
  if (
    job.failureCode === "DEPTH_AWARE_SURFACE_UNSAFE" &&
    (job.inputSnapshot.compositing.fabricIntegration?.depthAware
      ?.contractVersion === DEPTH_AWARE_SURFACE_INTEGRATION_VERSION_V1 ||
      job.inputSnapshot.compositing.fabricIntegration?.depthAware
        ?.contractVersion === DEPTH_AWARE_SURFACE_INTEGRATION_VERSION_V1_1)
  ) {
    throw new PersonaDomainError(
      "Der eingefrorene Depth-Aware-Vertrag verwendet noch eine historische Evidenzrichtlinie. Bitte bereite einen neuen Auftrag vor.",
      "WORKFLOW",
    );
  }
  if (!(await d.jobs.claimCompositeRetry(scope, jobId, fingerprint, d.now())))
    throw new PersonaDomainError(
      "Only a deterministic composite failure can be retried.",
      "WORKFLOW",
    );
  const attempt =
    (await d.stages.list(scope, jobId)).filter(
      (stage) => stage.stage === "DETERMINISTIC_COMPOSITE",
    ).length + 1;
  try {
    await compositeFromStoredBase(
      scope,
      { ...job, status: "running" },
      d,
      base,
      attempt,
    );
  } catch (error) {
    const failure = controlledCompositeFailure(error);
    await d.stages.insert(scope, {
      stageOutputId: d.id(),
      jobId,
      stage: "DETERMINISTIC_COMPOSITE",
      stageAttempt: attempt,
      status: "FAILED",
      assetId: null,
      storagePath: null,
      checksumSha256: null,
      providerRequestId: null,
      provenance: {
        retryBoundary: "REUSE_PERSISTED_BASE",
        automaticProviderRetry: false,
        baseStageOutputId: base.stageOutputId,
        ...failure.provenance,
      },
      failureCode: failure.code,
      failureMessage: failure.message,
      createdAt: d.now(),
    });
    await d.jobs.markFailed(scope, jobId, {
      code: failure.code,
      message: failure.message,
      now: d.now(),
    });
  }
  return getDeterministicRecovery(scope, jobId, overrides);
}

export type DeterministicCompositeRetryEligibility = {
  eligible: boolean;
  boundary: "DETERMINISTIC_STAGE_B_ONLY" | "DEPTH_THEN_STAGE_B";
  openAiRequired: false;
  samRequired: false;
  depthRequired?: boolean;
  reason: string;
};

/**
 * Read-only authority check for the owner history library. This deliberately
 * performs the same private-byte and frozen-evidence checks needed by Stage B,
 * but never claims the job and never invokes a provider.
 */
export async function getDeterministicCompositeRetryEligibility(
  scope: WorkspaceScope,
  jobId: string,
  overrides: Partial<DeterministicRuntimeDependencies> = {},
): Promise<DeterministicCompositeRetryEligibility> {
  const refused = (reason: string): DeterministicCompositeRetryEligibility => ({
    eligible: false,
    boundary: "DETERMINISTIC_STAGE_B_ONLY",
    openAiRequired: false,
    samRequired: false,
    depthRequired: false,
    reason,
  });
  const d = dependencies(overrides);
  const job = await d.jobs.get(scope, jobId);
  if (!job) return refused("Auftrag nicht gefunden.");
  if (job.status === "unknown_outcome")
    return refused("Ein unbekannter Provider-Ausgang muss zuerst geklärt werden.");
  if (
    job.status !== "failed" ||
    ![
      "DETERMINISTIC_COMPOSITE_FAILED",
      "SURFACE_INTEGRATION_UNSAFE",
      "DEPTH_AWARE_SURFACE_UNSAFE",
      "SURFACE_REALISM_REFINEMENT_UNSAFE",
      "DEPTH_ESTIMATION_FAILED",
    ].includes(
      job.failureCode ?? "",
    )
  )
    return refused("Der Auftrag ist kein sicher wiederholbarer Artwork-Fehler.");
  if (
    job.failureCode === "DEPTH_AWARE_SURFACE_UNSAFE" &&
    (job.inputSnapshot.compositing.fabricIntegration?.depthAware
      ?.contractVersion === DEPTH_AWARE_SURFACE_INTEGRATION_VERSION_V1 ||
      job.inputSnapshot.compositing.fabricIntegration?.depthAware
        ?.contractVersion === DEPTH_AWARE_SURFACE_INTEGRATION_VERSION_V1_1)
  ) {
    return refused(
      "Der eingefrorene Depth-Aware-Vertrag verwendet noch eine historische Evidenzrichtlinie. Bitte neuen Auftrag vorbereiten.",
    );
  }

  const [base, stages, asset] = await Promise.all([
    d.stages.getSucceededBase(scope, jobId),
    d.stages.list(scope, jobId),
    d.assets.getByJob(scope, jobId),
  ]);
  if (asset || stages.some((stage) => stage.stage === "DETERMINISTIC_COMPOSITE" && stage.status === "SUCCEEDED"))
    return refused("Für diesen Auftrag existiert bereits ein fertiges Ergebnis.");
  if (!base) return refused("Das gespeicherte Basisbild fehlt.");
  if (!job.inputSnapshot.garmentSegmentationPolicy)
    return refused("Eine validierte Kleidungsmaske fehlt.");

  try {
    assertStoredBaseStageBEligibility({ job, base });
    const baseBytes = await d.loadImageObject({
      workspaceId: scope.workspaceId,
      path: base.storagePath,
      expectedChecksum: base.checksumSha256,
    });
    assertSupportedRasterImageIntegrity(baseBytes);
    const artwork = await d.loadArtwork({
      workspaceId: scope.workspaceId,
      storagePath: job.artworkStoragePath,
      expectedChecksum: job.inputSnapshot.masterArtwork.checksum,
      mimeType: job.inputSnapshot.masterArtwork.mimeType,
    });
    assertMasterArtworkImageIntegrity(
      artwork.bytes,
      job.inputSnapshot.masterArtwork.mimeType,
    );
    await garmentMaskFromStoredBase({ scope, job, base, dependencies: d });
    if (
      job.inputSnapshot.depthEstimationPolicy &&
      job.failureCode !== "DEPTH_ESTIMATION_FAILED" &&
      !(await storedValidatedDepth({ scope, job, base, dependencies: d }))
    ) {
      return refused("Die validierte Tiefenkarte fehlt.");
    }
  } catch (error) {
    return refused(
      error instanceof Error
        ? error.message
        : "Die gespeicherten Produktionsdaten sind unvollständig.",
    );
  }

  return {
    eligible: true,
    boundary:
      job.failureCode === "DEPTH_ESTIMATION_FAILED"
        ? "DEPTH_THEN_STAGE_B"
        : "DETERMINISTIC_STAGE_B_ONLY",
    openAiRequired: false,
    samRequired: false,
    depthRequired: job.failureCode === "DEPTH_ESTIMATION_FAILED",
    reason:
      job.failureCode === "DEPTH_ESTIMATION_FAILED"
        ? "Basisbild, Identitätsprüfung, Kleidungsmaske und Registrierung sind gültig; nur Depth und die lokale Artwork-Anwendung werden fortgesetzt."
        : "Basisbild, Identitätsprüfung, Kleidungsmaske, Registrierung, Depth und Artwork sind gültig.",
  };
}

function recoveryState(
  job: DeterministicImageJob,
  stages: ProductionStageOutput[],
  asset: DeterministicAsset | null,
): DeterministicRecovery["state"] {
  if (asset?.reviewStatus === "APPROVED") return "APPROVED";
  if (asset?.reviewStatus === "REJECTED") return "REJECTED";
  if (asset) return "REVIEW_REQUIRED";
  if (job.status === "unknown_outcome") return "UNKNOWN_PROVIDER_OUTCOME";
  if (job.status === "cancelled") return "CANCELLED";
  if (
    job.status === "failed" &&
    [
      "DETERMINISTIC_COMPOSITE_FAILED",
      "SURFACE_INTEGRATION_UNSAFE",
      "DEPTH_AWARE_SURFACE_UNSAFE",
      "SURFACE_REALISM_REFINEMENT_UNSAFE",
      "DEPTH_ESTIMATION_FAILED",
    ].includes(
      job.failureCode ?? "",
    )
  )
    return "COMPOSITE_FAILED";
  if (job.status === "failed") return "BASE_FAILED";
  if (job.status === "awaiting_confirmation") return "AWAITING_CONFIRMATION";
  if (job.status === "confirmed") return "CONFIRMED";
  const baseReady = stages.some(
    (stage) =>
      stage.stage === "BASE_GENERATION" && stage.status === "SUCCEEDED",
  );
  const compositeReady = stages.some(
    (stage) =>
      stage.stage === "DETERMINISTIC_COMPOSITE" &&
      stage.status === "SUCCEEDED",
  );
  if (compositeReady) return "SAVING_RESULT";
  if (baseReady) return "COMPOSITING";
  if (job.status === "running") return "BASE_RUNNING";
  return "BASE_READY";
}

export async function getDeterministicRecovery(
  scope: WorkspaceScope,
  jobId: string,
  overrides: Partial<DeterministicRuntimeDependencies> = {},
): Promise<DeterministicRecovery> {
  const d = dependencies(overrides);
  const job = await d.jobs.get(scope, jobId);
  if (!job)
    throw new PersonaDomainError("Deterministic job not found.", "NOT_FOUND");
  const [stages, asset] = await Promise.all([
    d.stages.list(scope, jobId),
    d.assets.getByJob(scope, jobId),
  ]);
  return { state: recoveryState(job, stages, asset), job, stages, asset };
}

export async function getDeterministicRecoveries(
  scope: WorkspaceScope,
  jobs: readonly DeterministicImageJob[],
  overrides: Partial<DeterministicRuntimeDependencies> = {},
): Promise<DeterministicRecovery[]> {
  if (!jobs.length) return [];
  if (jobs.some((job) => job.workspaceId !== scope.workspaceId)) {
    throw new PersonaDomainError(
      "Deterministic job belongs to another workspace.",
      "UNAUTHORIZED_WORKSPACE",
    );
  }
  const d = dependencies(overrides);
  const jobIds = jobs.map((job) => job.id);
  const [stagesByJob, assetsByJob] = await Promise.all([
    d.stages.listByJobs
      ? d.stages.listByJobs(scope, jobIds)
      : Promise.all(jobIds.map((id) => d.stages.list(scope, id))).then(
          (groups) => new Map(jobIds.map((id, index) => [id, groups[index] ?? []])),
        ),
    d.assets.getByJobs
      ? d.assets.getByJobs(scope, jobIds)
      : Promise.all(jobIds.map((id) => d.assets.getByJob(scope, id))).then(
          (assets) =>
            new Map(
              assets.flatMap((asset, index) =>
                asset ? ([[jobIds[index], asset]] as const) : [],
              ),
            ),
        ),
  ]);
  return jobs.map((job) => {
    const stages = stagesByJob.get(job.id) ?? [];
    const asset = assetsByJob.get(job.id) ?? null;
    return { state: recoveryState(job, stages, asset), job, stages, asset };
  });
}

export async function listDeterministicJobs(
  scope: WorkspaceScope,
  projectId?: string,
  overrides: Partial<DeterministicRuntimeDependencies> = {},
  limit?: number,
) {
  const jobs = await dependencies(overrides).jobs.list(
    scope,
    projectId || limit ? { ...(projectId ? { projectId } : {}), ...(limit ? { limit } : {}) } : undefined,
  );
  return jobs.sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

export async function reviewDeterministicAsset(
  scope: WorkspaceScope,
  assetId: string,
  input: unknown,
  overrides: Partial<DeterministicRuntimeDependencies> = {},
) {
  requireActor(scope);
  const d = dependencies(overrides);
  const request = deterministicReviewRequestSchema.parse(input);
  if (
    request.decision === "APPROVED" &&
    Object.values(request.checklist).some((value) => value !== "PASS")
  ) {
    throw new PersonaDomainError(
      "Vor der Freigabe müssen alle Mockup-Prüfpunkte bestanden sein.",
      "WORKFLOW",
    );
  }
  return d.assets.review(scope, assetId, request, d.now());
}
