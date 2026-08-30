import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import { createCanvas } from "canvas";

import type { BrainReportContent } from "@/brain/domains/reports";
import type { ApprovedMasterArtwork } from "@/lib/design/master-artwork-authority/types";
import { MemoryImageProductionProjectRepository } from "@/lib/image/production-project/memory-repository";
import { MemoryProductProfileRepository } from "@/lib/product-library/memory-repository";
import { productProfileSchema } from "@/lib/product-library/types";
import { MemoryDeterministicJobRepository } from "@/lib/image/deterministic-runtime/memory-job-repository";
import { MemoryStageOutputRepository } from "@/lib/image/deterministic-runtime/memory-stage-repository";
import { MemoryDeterministicAssetRepository } from "@/lib/image/deterministic-runtime/memory-asset-repository";
import { DeterministicSyntheticBaseProvider } from "@/lib/image/deterministic-runtime/fake-base-provider";
import {
  confirmDeterministicImageJob,
  executeFakeDeterministicJob,
  executeRealDeterministicJob,
  getDeterministicRecovery,
  listDeterministicJobs,
  prepareDeterministicImageJob,
  retryDeterministicComposite,
  reviewDeterministicAsset,
  type DeterministicRuntimeDependencies,
} from "@/lib/image/deterministic-runtime/service";
import { compositeApprovedArtwork } from "@/lib/image/artwork-compositing/compositor";
import { SurfaceIntegrationUnsafeError } from "@/lib/image/artwork-compositing/surface-conforming-v1";
import { DepthAwareSurfaceUnsafeError } from "@/lib/image/artwork-compositing/depth-aware-surface-v1";
import { SurfaceRealismRefinementUnsafeError } from "@/lib/image/artwork-compositing/surface-realism-refinement-v1";
import { fingerprintImageGenerationInput } from "@/lib/image/paid-generation/fingerprint";
import { effectivePrintSurfaceForSnapshot } from "@/lib/image/paid-generation/types-v2";
import { createCreativeDirection } from "@/lib/image/social-creative-direction";
import { resolveProductPlacementTemplate } from "@/lib/image/product-placement-templates";
import { defaultOwnerArtworkPlacement } from "@/lib/product-library/product-family";
import type { ImageGenerationRequest } from "@/agents/image/providers/image-provider";
import { BASE_PRINT_PURITY_THRESHOLDS } from "@/lib/image/deterministic-runtime/base-print-purity";
import {
  DEPTH_AWARE_SURFACE_INTEGRATION_VERSION_V1_1,
  DEFAULT_DEPTH_AWARE_SURFACE_INTEGRATION,
} from "@/lib/image/artwork-compositing/types";

const WS = randomUUID();
const ACTOR = randomUUID();
const REPORT_RECORD = randomUUID();
const REPORT = randomUUID();
const ARTWORK_ID = randomUUID();
const PRODUCT_ID = "gid://shopify/Product/100";
const VARIANT_ID = "gid://shopify/ProductVariant/101";
const PROFILE = `shopify:${PRODUCT_ID}`;
const NOW = "2026-08-17T14:00:00.000Z";

function productReferencePng(color = "#151515"): Buffer {
  const canvas = createCanvas(24, 24);
  const context = canvas.getContext("2d");
  context.fillStyle = color;
  context.fillRect(0, 0, 24, 24);
  return canvas.toBuffer("image/png");
}

const REF_BYTES = productReferencePng();
const REF_CHECKSUM = createHash("sha256").update(REF_BYTES).digest("hex");

const trace = {
  contractVersion: "brand-model-v1" as const,
  brandModelId: "brand-model-test",
  personaId: "persona-test",
  identityLockSnapshotId: randomUUID(),
  identityLockVersion: 3,
  identityFingerprint: "identity-fingerprint-v3",
  referencePackageVersion: "package-v3",
  referencePackageFingerprint: "package-fingerprint-v3",
};

const IDENTITY_SUPPORT_ROLES = [
  "front",
  "three_quarter_left",
  "three_quarter_right",
  "left_profile",
  "right_profile",
] as const;

function resolvedIdentityFixture() {
  const masterBytes = productReferencePng("#8b6f5a");
  return {
    trace: {
      brandModel: trace,
      referencePackageVersion: trace.referencePackageVersion,
      masterIdentityAssetId: "master-persona",
      masterIdentityChecksum: "persona-checksum",
      supportingReferences: IDENTITY_SUPPORT_ROLES.map((role) => ({
        role,
        assetId: `support-${role}`,
        checksum: `checksum-${role}`,
        mimeType: "image/png",
      })),
    },
    masterReference: {
      assetId: "master-persona",
      checksum: "persona-checksum",
      mimeType: "image/png",
      bytes: masterBytes,
    },
    supportingReferences: IDENTITY_SUPPORT_ROLES.map((role) => ({
      role,
      assetId: `support-${role}`,
      checksum: `checksum-${role}`,
      mimeType: "image/png",
      bytes: productReferencePng(role.includes("left") ? "#7f6653" : "#92745e"),
    })),
    constraints: {
      displayName: "Approved fixture model",
      canonicalIdentityDescription: "same person",
      immutableFeatures: "locked identity",
      prohibitedChanges: "identity substitution",
      approvedHairVariations: "locked",
      approvedExpressionRange: "neutral",
      approvedBodyProportions: "locked",
      approvedAgeRange: "adult",
      defaultStyling: "controlled",
    },
  };
}

function artworkPng(): Buffer {
  const canvas = createCanvas(80, 48);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, 80, 48);
  context.fillStyle = "#ff214f";
  context.fillRect(5, 5, 70, 38);
  context.clearRect(20, 15, 40, 18);
  context.fillStyle = "#ffffff";
  context.fillRect(24, 19, 32, 10);
  return canvas.toBuffer("image/png");
}

function approved(bytes: Buffer): ApprovedMasterArtwork {
  return {
    contractVersion: "design-master-artwork-v1",
    id: ARTWORK_ID,
    workspaceId: WS,
    designId: "design-runtime",
    version: "V1",
    checksum: createHash("sha256").update(bytes).digest("hex"),
    mimeType: "image/png",
    byteLength: bytes.length,
    sourceType: "uploaded",
    storagePath: `workspace/${WS}/designs/runtime.png`,
    status: "APPROVED",
    placement: null,
    printMethod: null,
    sourceReportId: null,
    sourceHandoffAt: NOW,
    provenance: {
      authority: "DESIGN_STUDIO",
      humanApproved: true,
      source: "test owner approval",
    },
    approvedBy: ACTOR,
    approvedAt: NOW,
    createdAt: NOW,
  };
}

function report(): {
  id: string;
  workspaceId: string;
  content: BrainReportContent;
} {
  const master = {
    assetId: "master-persona",
    checksum: "persona-checksum",
    mimeType: "image/png",
    width: 1024,
    height: 1024,
    status: "approved" as const,
    sourceType: "user_upload" as const,
    rightsConfirmed: true,
  };
  const contract = {
    contractVersion: "brand-model-v1",
    issuedAt: NOW,
    workspaceId: WS,
    personaId: trace.personaId,
    brandModelId: trace.brandModelId,
    displayName: "Approved fixture model",
    role: "primary",
    sourceUpdatedAt: NOW,
    identity: {
      locked: true,
      identityLockSnapshotId: trace.identityLockSnapshotId,
      lockVersion: 3,
      lockedAt: NOW,
      fingerprint: trace.identityFingerprint,
      policyVersion: "v1",
      identityReview: { id: randomUUID(), reviewedAt: NOW, reviewedBy: ACTOR },
      provenance: { sourceCandidateId: null, sourceCreationProjectId: null },
      referencePackage: {
        version: trace.referencePackageVersion,
        fingerprint: trace.referencePackageFingerprint,
      },
      masterIdentityReference: master,
      approvedReferencePackage: [],
      constraints: {
        canonicalIdentityDescription: "same fixture person",
        immutableFeatures: "identity",
        flexibleFeatures: "pose",
        prohibitedChanges: "identity",
        approvedHairVariations: "same",
        approvedExpressionRange: "neutral",
        approvedBodyProportions: "same",
        approvedAgeRange: "adult",
        defaultStyling: "neutral",
      },
    },
    approvals: {
      brandCastApproved: true,
      brandCastApprovedAt: NOW,
      brandCastApprovedBy: ACTOR,
      imageUseApproved: true,
      imageUseApprovedAt: NOW,
      imageUseApprovedBy: ACTOR,
      videoUseApproved: false,
      videoUseApprovedAt: null,
      videoUseApprovedBy: null,
    },
    eligibility: {
      identityLocked: true,
      validIdentityLock: true,
      identityReviewPassed: true,
      referenceRightsConfirmed: true,
      brandCastApproved: true,
      imageUseApproved: true,
      videoUseApproved: false,
      imageIdentityReady: true,
      videoIdentityReady: false,
      imageEligible: true,
      videoEligible: false,
      imageBlockingReasons: [],
      videoBlockingReasons: ["not approved"],
      lockVersion: 3,
      identityFingerprint: trace.identityFingerprint,
    },
  };
  return {
    id: REPORT_RECORD,
    workspaceId: WS,
    content: {
      kind: "reports",
      reportId: REPORT,
      reportType: "image-project",
      generatedAt: NOW,
      imageSections: {
        schemaVersion: "3.0",
        projectName: "Synthetic v2 runtime",
        visualDirection: "clean studio",
        brandModelContract: contract,
        productionAssets: [
          {
            id: "hero",
            assetType: "hero_image",
            outputCategory: "editorial_campaign",
            productName: "Zip Hoodie",
            collection: "Core",
            color: "Black",
            material: "Cotton",
            location: "Neutral studio",
            lighting: "Soft controlled light",
            photographyStyle: "Front-facing",
            cameraStyle: "50mm",
            prompt: {
              openai: "Legacy prompt not used for artwork.",
              flux: "fixture",
              midjourney: "fixture",
            },
            priority: "hero",
            status: "pending",
            title: "Hero front",
            dimensions: "1024x1536",
            brandModelTrace: trace,
          },
        ],
      } as never,
    } as unknown as BrainReportContent,
  };
}

async function harness(options: {
  failCompositeOnce?: boolean;
  failSurfaceOnce?: boolean;
  failDepthOnce?: boolean;
  failSurfaceRealismOnce?: boolean;
} = {}) {
  const artwork = artworkPng();
  const artworkAuthority = approved(artwork);
  const jobs = new MemoryDeterministicJobRepository();
  const stages = new MemoryStageOutputRepository();
  const assets = new MemoryDeterministicAssetRepository();
  const products = new MemoryProductProfileRepository();
  const projects = new MemoryImageProductionProjectRepository();
  const baseProvider = new DeterministicSyntheticBaseProvider();
  const objects = new Map<string, Buffer>();
  const frozenArtwork = new Map<string, Buffer>();
  let compositeCalls = 0;
  await products.createVersion(
    { workspaceId: WS, actorId: ACTOR },
    productProfileSchema.parse({
      schemaVersion: "product-profile-v1",
      productProfileId: PROFILE,
      workspaceId: WS,
      name: "Zip Hoodie",
      productType: "zip_hoodie",
      authority: "SHOPIFY_LIVE",
      shopifyProductId: PRODUCT_ID,
      variants: [
        {
          variantId: VARIANT_ID,
          shopifyVariantId: VARIANT_ID,
          title: "Black / L",
          color: "Black",
          size: "L",
          available: true,
          active: true,
          updatedAt: NOW,
        },
      ],
      colorways: ["Black"],
      sizes: ["L"],
      collections: ["Core"],
      active: true,
      available: true,
      construction: {
        material: "Cotton",
        gsm: 420,
        fit: "Oversized",
        construction: "zip hoodie",
        collar: "hood",
        sleeves: "long",
        zipper: "full",
        pockets: ["kangaroo"],
        seams: [],
      },
      references: [
        {
          referenceId: "product-ref",
          source: "SHOPIFY_MEDIA",
          role: "FEATURED",
          sourceImageId: "shopify-image-1",
          sourceUrl: "https://cdn.shopify.com/s/files/fixture.png",
          privateStoragePath: `${WS}/product-references/${REF_CHECKSUM}.png`,
          contentChecksumSha256: REF_CHECKSUM,
          mimeType: "image/png",
          byteLength: REF_BYTES.length,
          width: 1000,
          height: 1200,
          altText: null,
          variantIds: [],
        },
      ],
      printSurfaces: [
        {
          contractVersion: "print-surface-v1",
          printSurfaceId: "front-left-chest",
          version: 1,
          productProfileId: PROFILE,
          variantId: VARIANT_ID,
          region: "front_left_chest",
          geometryStatus: "HUMAN_DEFINED",
          quad: [
            { x: 0.35, y: 0.4 },
            { x: 0.65, y: 0.4 },
            { x: 0.64, y: 0.65 },
            { x: 0.36, y: 0.65 },
          ],
          boundingBox: null,
          orientationDegrees: 0,
          perspectiveAnchors: [],
          clippingMaskReference: null,
          safeMargin: { top: 0, right: 0, bottom: 0, left: 0 },
          artworkScale: 1,
          rotationDegrees: 0,
          warpMode: "PERSPECTIVE",
          provenance: {
            source: "OWNER_CALIBRATION",
            calibratedBy: ACTOR,
            calibratedAt: NOW,
          },
        },
      ],
      embroideryRegions: [],
      provenance: {
        source: "Shopify read + owner calibration",
        capturedAt: NOW,
        sourceVersion: NOW,
      },
      version: 1,
      createdBy: ACTOR,
      createdAt: NOW,
      updatedAt: NOW,
    }),
  );
  let projectCounter = 0;
  const deps: Partial<DeterministicRuntimeDependencies> = {
    jobs,
    stages,
    assets,
    products,
    projects,
    baseProvider,
    loadReport: async () => report(),
    validateBrandModel: async () => ({
      displayName: "Approved fixture model",
      masterIdentityAssetId: "master-persona",
    }),
    assessBrandModelIdentity: async (input) => ({
      contractVersion: "nexhq-brand-model-identity-consistency-v1",
      status: "PASS",
      reason: "IDENTITY_CONFIRMED",
      authoritySource: "PERSONA_MASTER_IDENTITY_LOCK",
      identityLockActive: true,
      identityFallbackPrevented: true,
      identityLockSnapshotId: input.identityLockSnapshotId,
      masterIdentityAssetId: input.masterIdentityAssetId,
      evaluatorVersion: "local-vladmandic-1.7.x-v1",
      thresholdVersion: "v1.0.0",
      maximumEuclideanDistance: 0.55,
      euclideanDistance: 0.2,
      similarity: 0.9,
      masterDetection: {
        status: "performed",
        confidence: 0.99,
        faceCount: 1,
      },
      generatedDetection: {
        status: "performed",
        confidence: 0.95,
        faceCount: 1,
      },
    }),
    resolveArtwork: async () => ({ artwork: artworkAuthority, bytes: artwork }),
    resolveProductContext: async () => ({
      version: "product-production-context-v1",
      productId: PRODUCT_ID,
      variantId: VARIANT_ID,
      productName: "Zip Hoodie",
      productType: "zip_hoodie",
      color: "Black",
      size: "L",
      material: "Cotton",
      fit: "Oversized",
      collection: "Core",
      availability: "AVAILABLE",
      active: true,
      authority: "SHOPIFY_LIVE",
      authoritative: true,
      provenance: {
        source: "Shopify fixture read",
        sourceRecordId: VARIANT_ID,
        capturedAt: NOW,
        sourceVersion: NOW,
      },
    }),
    ensureProject: async (scope, input) => {
      projectCounter += 1;
      return projects.upsertFromPreparation(
        { ...scope, actorId: scope.actorId! },
        {
          contractVersion: "image-production-project-v1",
          workspaceId: scope.workspaceId,
          reportRecordId: input.reportRecordId,
          reportId: input.reportId,
          projectName: "Synthetic v2 runtime",
          campaignDirection: {
            visualDirection: "clean studio",
            collectionName: "Core",
          },
          brandModel: input.brandModel,
          masterArtwork: { ...input.artwork, storagePath: undefined } as never,
          productContext: await (
            deps.resolveProductContext as NonNullable<
              typeof deps.resolveProductContext
            >
          )({
            authority: "SHOPIFY_LIVE",
            productId: PRODUCT_ID,
            variantId: VARIANT_ID,
          }),
          shotPlan: [
            {
              id: "hero",
              assetType: "hero_image",
              title: "Hero front",
              prompt: "fixture",
              scene: "Neutral studio",
              lighting: "Soft controlled light",
              poseDirection: "Front-facing",
              dimensions: "1024x1536",
            },
          ],
          createdBy: ACTOR,
        },
      );
    },
    freezeArtwork: async ({ checksum, bytes }) => {
      const path = `${WS}/master-artwork/${checksum}.png`;
      frozenArtwork.set(path, Buffer.from(bytes));
      return path;
    },
    loadArtwork: (async ({ storagePath, expectedChecksum, mimeType }) => {
      const bytes = frozenArtwork.get(storagePath)!;
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        expectedChecksum,
      );
      return { bytes, checksum: expectedChecksum, mimeType };
    }) as DeterministicRuntimeDependencies["loadArtwork"],
    verifyProductReference: async ({ expectedChecksum }) => {
      assert.equal(expectedChecksum, REF_CHECKSUM);
      return REF_BYTES;
    },
    persistImageObject: async ({ path, bytes, expectedChecksum }) => {
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        expectedChecksum,
      );
      const previous = objects.get(path);
      if (previous) assert.deepEqual(previous, bytes);
      else objects.set(path, Buffer.from(bytes));
    },
    loadImageObject: async ({ path, expectedChecksum }) => {
      const bytes = objects.get(path)!;
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        expectedChecksum,
      );
      return Buffer.from(bytes);
    },
    composite: async (...args) => {
      compositeCalls += 1;
      if (options.failCompositeOnce && compositeCalls === 1)
        throw new Error("synthetic composite fault");
      if (options.failSurfaceOnce && compositeCalls === 1)
        throw new SurfaceIntegrationUnsafeError({
          contractVersion: "nexhq-surface-conforming-integration-v1",
          status: "REFUSED",
          reason: "TYPOGRAPHY_DISTORTION_RISK",
          warpEnabled: false,
          warpStrength: 0.016,
          maximumAppliedWarpPx: 4.87,
          clampReasons: ["TYPOGRAPHY_SAFETY_BOUND"],
          curvatureEvidence: 0.66,
          foldResponseEvidence: 0.33,
          shadingResponseEvidence: 0.24,
          textureResponseEvidence: 0.12,
          maskClippingCoverage: 1,
          effectivePrintRealismConfidence: 0.47,
          flatOverlayRisk: 0.32,
          typographyDistortionEstimate: 0.2437,
          gridColumns: 7,
          gridRows: 9,
          deterministic: true,
          sourceAuthorityPreserved: true,
          failClosedReason: "TYPOGRAPHY_DISTORTION_RISK",
        });
      if (options.failDepthOnce && compositeCalls === 1)
        throw new DepthAwareSurfaceUnsafeError({
          contractVersion: "nexhq-depth-aware-surface-integration-v1",
          status: "REFUSED",
          reason: "UNSAFE_LOCAL_WARP_REQUIRED",
          estimator: "LOCAL_STAGE_A_RELATIVE_DEPTH_V1",
          depthEvidenceAvailable: true,
          localPlaneTiltDegrees: 8.2,
          localPerspectiveEstimate: 0.58,
          depthConfidence: 0.76,
          surfaceConfidence: 0.71,
          appliedLocalWarpStrength: 0.012,
          maximumLocalWarpPx: 5.1,
          typographyRisk: 0.034,
          globalFootprintPreserved: true,
          secondaryScaleApplied: false,
          secondaryTranslationApplied: false,
          maskCoverage: 1,
          clampReasons: [
            "LOCAL_WARP_BOUND",
            "FOOTPRINT_BOUNDARY_PINNED",
          ],
          deterministic: true,
          sourceBaseOnly: true,
          sourceAuthorityPreserved: true,
          failClosedReason: "UNSAFE_LOCAL_WARP_REQUIRED",
        });
      if (options.failSurfaceRealismOnce && compositeCalls === 1)
        throw new SurfaceRealismRefinementUnsafeError({
          contractVersion: "nexhq-surface-realism-refinement-v1",
          status: "REFUSED",
          reason: "UNSAFE_REFINEMENT_REQUIRED",
          strongerPlaneGuidanceUsed: true,
          realDepthUsed: true,
          localFallbackUsed: false,
          surfaceDirectionEvidenceUsed: true,
          footprintPinned: true,
          registeredYPreserved: true,
          secondContainApplied: false,
          secondGlobalScaleApplied: false,
          secondGlobalTranslationApplied: false,
          horizontalSurfaceSlope: 0.22,
          verticalSurfaceSlope: 0.18,
          planeGuidanceStrength: 0.58,
          perspectiveGuidanceStrength: 0.46,
          curvatureEvidence: 0.42,
          evidenceConfidence: 0.8,
          localWarpStrength: 0.014,
          maximumLocalWarpPx: 5.4,
          shadingTransferStrength: 0.28,
          textureTransferStrength: 0.12,
          typographyRisk: 0.04,
          maskCoverage: 1,
          clampedNodeFraction: 0.14,
          deterministic: true,
          sourceAuthorityPreserved: true,
          failClosedReason: "UNSAFE_REFINEMENT_REQUIRED",
        });
      return compositeApprovedArtwork(...args);
    },
    allowFakeExecution: () => true,
    inputCostMaximumUsd: "0.20",
    now: () => NOW,
    id: randomUUID,
  };
  const request = {
    reportRecordId: REPORT_RECORD,
    reportId: REPORT,
    assetId: "hero",
    brandModelTrace: trace,
    masterArtwork: {
      reference: {
        id: ARTWORK_ID,
        designId: "design-runtime",
        version: "V1",
        checksum: artworkAuthority.checksum,
      },
    },
    productProfile: { profileKey: PROFILE, version: 1, variantId: VARIANT_ID },
    printSurface: { printSurfaceId: "front-left-chest", version: 1 },
    semanticPlacement: {
      printSide: "FRONT" as const,
      placementPreset: "FRONT_LEFT_CHEST" as const,
    },
    creativeDirection: createCreativeDirection({
      shotId: "hero",
      contentMode: "SOCIAL_CONTENT",
      presetId: "MINIMAL_INTERIOR",
      source: "OWNER_SELECTED",
    }),
  };
  return {
    deps,
    request,
    jobs,
    stages,
    assets,
    baseProvider,
    objects,
    artwork,
    get compositeCalls() {
      return compositeCalls;
    },
    get projectCounter() {
      return projectCounter;
    },
  };
}

describe("deterministic v2 no-provider runtime", () => {
  it("completes legacy Product reference MIME and byte length before Prepare succeeds", async () => {
    const h = await harness();
    const products = h.deps.products as MemoryProductProfileRepository;
    const current = await products.getVersion({ workspaceId: WS }, PROFILE, 1);
    assert.ok(current);
    await products.createVersion(
      { workspaceId: WS, actorId: ACTOR },
      {
        ...current!,
        version: 2,
        references: current!.references.map((reference) => ({
          ...reference,
          mimeType: null,
          byteLength: null,
        })),
      },
    );

    const prepared = await prepareDeterministicImageJob(
      { workspaceId: WS, actorId: ACTOR },
      {
        ...h.request,
        productProfile: { ...h.request.productProfile, version: 2 },
      },
      h.deps,
    );
    const frozen =
      prepared.inputSnapshot.productVisualInput.referencePackage.references[0]!;
    assert.equal(frozen.mimeType, "image/png");
    assert.equal(frozen.byteLength, REF_BYTES.length);
    assert.equal(frozen.contentChecksumSha256, REF_CHECKSUM);
  });

  it("blocks Prepare when a Product reference has no private frozen identity", async () => {
    const h = await harness();
    const products = h.deps.products as MemoryProductProfileRepository;
    const current = await products.getVersion({ workspaceId: WS }, PROFILE, 1);
    assert.ok(current);
    await products.createVersion(
      { workspaceId: WS, actorId: ACTOR },
      {
        ...current!,
        version: 2,
        references: current!.references.map((reference) => ({
          ...reference,
          privateStoragePath: null,
        })),
      },
    );

    await assert.rejects(
      () =>
        prepareDeterministicImageJob(
          { workspaceId: WS, actorId: ACTOR },
          {
            ...h.request,
            productProfile: { ...h.request.productProfile, version: 2 },
          },
          h.deps,
        ),
      /Produktbilder sind noch nicht vollständig vorbereitet/,
    );
  });

  it("blocks Prepare when checksum-verified Product bytes do not match the frozen checksum", async () => {
    const h = await harness();
    await assert.rejects(
      () =>
        prepareDeterministicImageJob(
          { workspaceId: WS, actorId: ACTOR },
          h.request,
          {
            ...h.deps,
            verifyProductReference: async () =>
              productReferencePng("#fafafa"),
          },
        ),
      /privaten Produktbilder sind unvollständig|gespeicherten Bilddaten/,
    );
  });

  it("prepares with a server-verified NexHQ Product template without manual calibration", async () => {
    const h = await harness();
    const products = h.deps.products as MemoryProductProfileRepository;
    const current = await products.getVersion({ workspaceId: WS }, PROFILE, 1);
    assert.ok(current);
    await products.createVersion(
      { workspaceId: WS, actorId: ACTOR },
      { ...current!, version: 2, printSurfaces: [] },
    );
    const template = resolveProductPlacementTemplate({
      productType: "zip_hoodie",
      printSide: "FRONT",
      placementPreset: "FRONT_LEFT_CHEST",
    });
    assert.ok(template);
    const prepared = await prepareDeterministicImageJob(
      { workspaceId: WS, actorId: ACTOR },
      {
        ...h.request,
        productProfile: { ...h.request.productProfile, version: 2 },
        printSurface: {
          printSurfaceId: template!.templateId,
          version: template!.version,
          authority: "NEXHQ_PRODUCT_TEMPLATE",
          templateId: template!.templateId,
          templateVersion: template!.version,
        },
      },
      h.deps,
    );
    assert.equal(
      prepared.inputSnapshot.printSurface.provenance.source,
      "NEXHQ_PRODUCT_TEMPLATE",
    );
    assert.equal(
      prepared.inputSnapshot.semanticPlacement?.resolvedPrintSurfaceId,
      template!.templateId,
    );
  });

  it("freezes the new larger, higher rectangular tuning for a T-shirt front-large prepare", async () => {
    const h = await harness();
    const products = h.deps.products as MemoryProductProfileRepository;
    const current = await products.getVersion({ workspaceId: WS }, PROFILE, 1);
    assert.ok(current);
    const originalQuad = current!.printSurfaces[0]!.quad!;
    await products.createVersion(
      { workspaceId: WS, actorId: ACTOR },
      {
        ...current!,
        version: 2,
        name: "Heavy Oversized Tee",
        productType: "T-Shirt",
        printSurfaces: [
          {
            ...current!.printSurfaces[0]!,
            region: "front_center",
            displayName: "Großer Frontprint",
          },
        ],
      },
    );
    h.deps.resolveProductContext = async () => ({
      version: "product-production-context-v1",
      productId: PRODUCT_ID,
      variantId: VARIANT_ID,
      productName: "Heavy Oversized Tee",
      productType: "T-Shirt",
      color: "Beige",
      size: "L",
      material: "Cotton",
      fit: "Oversized",
      collection: "Core",
      availability: "AVAILABLE",
      active: true,
      authority: "SHOPIFY_LIVE",
      authoritative: true,
      provenance: {
        source: "Shopify fixture read",
        sourceRecordId: VARIANT_ID,
        capturedAt: NOW,
        sourceVersion: NOW,
      },
    });
    const prepared = await prepareDeterministicImageJob(
      { workspaceId: WS, actorId: ACTOR },
      {
        ...h.request,
        productProfile: { ...h.request.productProfile, version: 2 },
        semanticPlacement: {
          printSide: "FRONT",
          placementPreset: "FRONT_LARGE",
        },
      },
      h.deps,
    );
    assert.equal(
      prepared.inputSnapshot.printSurfaceOverride?.provenance,
      "NEXHQ_FRONT_LARGE_TUNING_V4",
    );
    const effective = effectivePrintSurfaceForSnapshot(prepared.inputSnapshot);
    assert.equal(effective.warpMode, "NONE");
    assert.ok(
      effective.quad![1].x - effective.quad![0].x >
        Math.max(...originalQuad.map((point) => point.x)) -
          Math.min(...originalQuad.map((point) => point.x)),
    );
    const originalCenterY =
      (Math.min(...originalQuad.map((point) => point.y)) +
        Math.max(...originalQuad.map((point) => point.y))) /
      2;
    const effectiveCenterY =
      (effective.quad![0].y + effective.quad![3].y) / 2;
    assert.ok(effectiveCenterY > originalCenterY);
    assert.deepEqual(
      prepared.inputSnapshot.printSurface.quad,
      originalQuad,
      "canonical Product geometry remains frozen and unchanged",
    );
  });

  it("fresh Product Family Prepare freezes normal-assisted V2.2 and includes MiDaS without executing providers", async () => {
    const h = await harness();
    const products = h.deps.products as MemoryProductProfileRepository;
    const current = await products.getVersion({ workspaceId: WS }, PROFILE, 1);
    assert.ok(current);
    const templateId = "family:tee:front";
    await products.createVersion(
      { workspaceId: WS, actorId: ACTOR },
      {
        ...current!,
        version: 2,
        name: "Heavy Oversized Tee",
        productType: "T-Shirt",
        productFamily: {
          contractVersion: "product-family-v1",
          familyId: "family:tee",
          garmentType: "T-Shirt",
          supplierName: "MarketPrint",
          active: true,
          shopifyMappingMode: "EXPLICIT",
          colors: [
            {
              colorId: "black",
              colorName: "Black",
              colorKey: "black",
              active: true,
              shopifyMappings: [
                {
                  shopifyProductId: PRODUCT_ID,
                  shopifyVariantIds: [VARIANT_ID],
                },
              ],
            },
          ],
          placementTemplates: [
            {
              templateId,
              side: "FRONT",
              version: 1,
              normalizedRegion: { x: 0.2, y: 0.16, width: 0.6, height: 0.62 },
              calibrationAssetReferenceId: "product-ref",
              detection: "OWNER_CORRECTED",
              status: "READY",
              appliesTo: "ALL_COLORS",
              updatedBy: ACTOR,
              updatedAt: NOW,
            },
          ],
        },
        references: current!.references.map((reference) => ({
          ...reference,
          purpose: "BLANK_PRODUCT" as const,
          familyColorKey: "black",
          productSide: "FRONT" as const,
          providerEligible: true,
          width: 1000,
          height: 1200,
        })),
        printSurfaces: current!.printSurfaces.map((surface) => ({
          ...surface,
          region: "front_center" as const,
          displayName: "Großer Frontprint",
        })),
      },
    );
    h.deps.resolveProductContext = async () => ({
      version: "product-production-context-v1",
      productId: PRODUCT_ID,
      variantId: VARIANT_ID,
      productName: "Heavy Oversized Tee",
      productType: "T-Shirt",
      color: "Black",
      size: "L",
      material: "Cotton",
      fit: "Oversized",
      collection: "Core",
      availability: "AVAILABLE",
      active: true,
      authority: "SHOPIFY_LIVE",
      authoritative: true,
      provenance: {
        source: "Shopify fixture read",
        sourceRecordId: VARIANT_ID,
        capturedAt: NOW,
        sourceVersion: NOW,
      },
    });
    let samCalls = 0;
    let normalCalls = 0;
    h.deps.garmentSegmenter = {
      isConfigured: () => true,
      describe: () => ({
        provider: "fal",
        model: "fal-ai/sam-3/image",
        adapterVersion: "nexhq-fal-sam3-image-v1",
        maximumCostUsd: 0.005,
      }),
      segmentGarment: async () => {
        samCalls += 1;
        throw new Error("Prepare must not call SAM");
      },
    };
    h.deps.normalEstimator = {
      isConfigured: () => true,
      describe: () => ({
        provider: "fal",
        model: "fal-ai/image-preprocessors/midas",
        adapterVersion: "nexhq-fal-midas-v1",
        maximumCostUsd: 0.0123,
      }),
      estimateNormals: async () => {
        normalCalls += 1;
        throw new Error("Prepare must not call MiDaS");
      },
    };
    const prepared = await prepareDeterministicImageJob(
      { workspaceId: WS, actorId: ACTOR },
      {
        ...h.request,
        productProfile: { ...h.request.productProfile, version: 2 },
        semanticPlacement: {
          printSide: "FRONT",
          placementPreset: "FRONT_LARGE",
        },
        ownerArtworkPlacement: defaultOwnerArtworkPlacement({
          templateId,
          version: 1,
        }),
      },
      h.deps,
    );
    assert.equal(
      prepared.inputSnapshot.productFamilyPlacement?.orientedFrontPrintPlane
        ?.contractVersion,
      "nexhq-oriented-front-print-plane-v2.2-normal-assisted",
    );
    assert.equal(
      prepared.inputSnapshot.normalEstimationPolicy?.model,
      "fal-ai/image-preprocessors/midas",
    );
    assert.equal(
      prepared.inputSnapshot.normalEstimationPolicy?.maximumCostUsd,
      0.0123,
    );
    assert.match(prepared.estimate.pricingVersion, /fal-midas-normal-v1/);
    assert.equal(samCalls, 0);
    assert.equal(normalCalls, 0);
  });

  it("runs Prepare → Estimate → Confirm → fake Base → Composite → reload → human review", async () => {
    const h = await harness();
    const scope = { workspaceId: WS, actorId: ACTOR };
    const prepared = await prepareDeterministicImageJob(
      scope,
      h.request,
      h.deps,
    );
    assert.equal(
      prepared.inputSnapshot.productionMode,
      "DETERMINISTIC_COMPOSITE",
    );
    assert.equal(
      prepared.inputSnapshot.baseGeneration.artworkStrategy,
      "NO_MASTER_ARTWORK_INPUT",
    );
    assert.equal(prepared.inputSnapshot.baseGeneration.assetCount, 1);
    assert.equal(
      prepared.inputSnapshot.compositing.compositorVersion,
      "nexhq-deterministic-compositor-v3-fabric-aware-v1",
    );
    assert.equal(
      prepared.inputSnapshot.compositing.fabricIntegration?.mode,
      "FABRIC_AWARE_PRINT_V1",
    );
    assert.equal(
      prepared.inputSnapshot.creativeDirection?.contractVersion,
      "social-creative-direction-v1",
    );
    assert.match(
      prepared.inputSnapshot.baseGeneration.prompt,
      /MINIMAL_INTERIOR/,
    );
    assert.match(
      prepared.inputSnapshot.baseGeneration.prompt,
      /commercially publishable|premium commercial/i,
    );
    assert.match(
      prepared.inputSnapshot.baseGeneration.prompt,
      /gently tensioned/i,
    );
    assert.match(prepared.estimate.basis, /Stage A only/i);
    assert.equal(
      prepared.inputFingerprint,
      fingerprintImageGenerationInput(prepared.inputSnapshot),
    );
    assert.equal(
      prepared.inputSnapshot.productVisualInput.referencePackage.references[0]!
        .contentChecksumSha256,
      REF_CHECKSUM,
    );
    await confirmDeterministicImageJob(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      h.deps,
    );
    const executed = await executeFakeDeterministicJob(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      h.deps,
    );
    assert.equal(executed.state, "REVIEW_REQUIRED");
    assert.equal(h.baseProvider.calls, 1);
    assert.equal(
      executed.stages.filter(
        (stage) => (stage as { stage?: string }).stage === "BASE_GENERATION",
      ).length,
      1,
    );
    assert.equal(
      executed.stages.filter(
        (stage) =>
          (stage as { stage?: string }).stage === "DETERMINISTIC_COMPOSITE",
      ).length,
      1,
    );
    assert.equal(executed.asset?.reviewStatus, "REVIEW_REQUIRED");
    assert.equal(executed.asset?.generationJobId, prepared.id);
    const recovered = await getDeterministicRecovery(
      { workspaceId: WS },
      prepared.id,
      h.deps,
    );
    assert.equal(recovered.state, "REVIEW_REQUIRED");
    assert.equal(
      recovered.asset?.mockupReview.artworkFidelityExact,
      "NEEDS_REVIEW",
    );
    const approvedAsset = await reviewDeterministicAsset(
      scope,
      recovered.asset!.id,
      {
        decision: "APPROVED",
        checklist: {
          identity: "PASS",
          productFidelity: "PASS",
          artworkFidelityExact: "PASS",
          placement: "PASS",
          perspective: "PASS",
          lightingIntegration: "PASS",
        },
        note: "Synthetic workflow accepted.",
      },
      h.deps,
    );
    assert.equal(approvedAsset.reviewStatus, "APPROVED");
    assert.equal(
      (await getDeterministicRecovery(scope, prepared.id, h.deps)).state,
      "APPROVED",
    );
  });

  it("executes one configured real Stage A seam with Persona/Product bytes and no Artwork input", async () => {
    const h = await harness();
    const scope = { workspaceId: WS, actorId: ACTOR };
    const prepared = await prepareDeterministicImageJob(scope, h.request, h.deps);
    assert.equal(prepared.inputSnapshot.identityConditioning?.identityLockActive, true);
    assert.equal(
      prepared.inputSnapshot.identityConditioning
        ?.genericIdentityFallbackAllowed,
      false,
    );
    assert.equal(
      prepared.inputSnapshot.identityConditioning?.supportingReferenceCount,
      5,
    );
    await confirmDeterministicImageJob(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      h.deps,
    );
    const captured: ImageGenerationRequest[] = [];
    let paidCalls = 0;
    const recovery = await executeRealDeterministicJob(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      {
        ...h.deps,
        assertPaidEnabled: () => undefined,
        isProviderConfigured: () => true,
        resolveIdentity: async () => resolvedIdentityFixture(),
        generateBase: async (_provider, request) => {
          paidCalls += 1;
          captured.push(request);
          const base = await h.baseProvider.generate(prepared.inputSnapshot);
          return {
            prompt: request.prompt,
            dimensions: request.dimensions,
            assetType: request.assetType,
            status: "completed",
            providerId: "openai",
            modelId: "gpt-image-1",
            providerRequestId: "provider-request-real-seam",
            imageBytes: base.bytes,
          };
        },
      },
    );
    assert.equal(recovery.state, "REVIEW_REQUIRED");
    assert.equal(paidCalls, 1);
    assert.equal(captured.length, 1);
    assert.equal(captured[0]!.artwork, undefined);
    assert.equal(
      (captured[0]!.identity?.masterReference.bytes.length ?? 0) > 0,
      true,
    );
    assert.equal(captured[0]!.identity?.supportingReferences.length, 5);
    assert.equal(
      captured[0]!.identity?.supportingReferences.every(
        (reference) => reference.bytes.length > 0,
      ),
      true,
    );
    assert.equal(captured[0]!.production?.productReferences?.length, 1);
    assert.deepEqual(
      captured[0]!.production?.productReferences?.[0]?.bytes,
      REF_BYTES,
    );
    assert.equal(
      recovery.stages.find((stage) => stage.stage === "BASE_GENERATION")
        ?.providerRequestId,
      "provider-request-real-seam",
    );
    await executeRealDeterministicJob(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      {
        ...h.deps,
        assertPaidEnabled: () => undefined,
        isProviderConfigured: () => true,
        generateBase: async () => {
          paidCalls += 1;
          throw new Error("duplicate provider call");
        },
      },
    );
    assert.equal(paidCalls, 1, "a succeeded job cannot consume Stage A twice");
  });

  it("persists the paid Base but fails closed before Stage B when identity consistency is weak", async () => {
    const h = await harness();
    const scope = { workspaceId: WS, actorId: ACTOR };
    const prepared = await prepareDeterministicImageJob(scope, h.request, h.deps);
    await confirmDeterministicImageJob(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      h.deps,
    );
    const recovery = await executeRealDeterministicJob(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      {
        ...h.deps,
        assertPaidEnabled: () => undefined,
        isProviderConfigured: () => true,
        resolveIdentity: async () => resolvedIdentityFixture(),
        assessBrandModelIdentity: async (input) => ({
          contractVersion: "nexhq-brand-model-identity-consistency-v1",
          status: "FAIL",
          reason: "IDENTITY_DISTANCE_TOO_HIGH",
          authoritySource: "PERSONA_MASTER_IDENTITY_LOCK",
          identityLockActive: true,
          identityFallbackPrevented: true,
          identityLockSnapshotId: input.identityLockSnapshotId,
          masterIdentityAssetId: input.masterIdentityAssetId,
          evaluatorVersion: "local-vladmandic-1.7.x-v1",
          thresholdVersion: "v1.0.0",
          maximumEuclideanDistance: 0.55,
          euclideanDistance: 0.72,
          similarity: 0.64,
          masterDetection: {
            status: "performed",
            confidence: 0.99,
            faceCount: 1,
          },
          generatedDetection: {
            status: "performed",
            confidence: 0.93,
            faceCount: 1,
          },
        }),
        generateBase: async (_provider, request) => {
          const base = await h.baseProvider.generate(prepared.inputSnapshot);
          return {
            prompt: request.prompt,
            dimensions: request.dimensions,
            assetType: request.assetType,
            status: "completed",
            providerId: "openai",
            modelId: "gpt-image-1",
            providerRequestId: "identity-drift-provider-request",
            imageBytes: base.bytes,
          };
        },
      },
    );
    assert.equal(recovery.state, "BASE_FAILED");
    assert.equal(recovery.job.failureCode, "BRAND_MODEL_IDENTITY_MISMATCH");
    assert.equal(recovery.asset, null);
    assert.equal(h.compositeCalls, 0);
    const base = recovery.stages.find(
      (stage) => stage.stage === "BASE_GENERATION",
    );
    assert.equal(base?.status, "SUCCEEDED");
    assert.equal(
      (base?.provenance.identityConsistency as { status?: string })?.status,
      "FAIL",
    );
  });

  it("contains an identity-stage exception as a durable unknown outcome without a second paid attempt", async () => {
    const h = await harness();
    const scope = { workspaceId: WS, actorId: ACTOR };
    const prepared = await prepareDeterministicImageJob(scope, h.request, h.deps);
    await confirmDeterministicImageJob(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      h.deps,
    );
    let paidCalls = 0;
    const overrides: Partial<DeterministicRuntimeDependencies> = {
      ...h.deps,
      assertPaidEnabled: () => undefined,
      isProviderConfigured: () => true,
      resolveIdentity: async () => resolvedIdentityFixture(),
      assessBrandModelIdentity: async () => {
        throw new Error("controlled identity evaluator fault");
      },
      generateBase: async (_provider, request) => {
        paidCalls += 1;
        const base = await h.baseProvider.generate(prepared.inputSnapshot);
        return {
          prompt: request.prompt,
          dimensions: request.dimensions,
          assetType: request.assetType,
          status: "completed",
          providerId: "openai",
          modelId: "gpt-image-1",
          providerRequestId: "identity-exception-provider-request",
          imageBytes: base.bytes,
        };
      },
    };
    const recovery = await executeRealDeterministicJob(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      overrides,
    );
    assert.equal(recovery.state, "UNKNOWN_PROVIDER_OUTCOME");
    assert.equal(recovery.job.providerRequestId, "identity-exception-provider-request");
    assert.equal(recovery.job.status, "unknown_outcome");
    assert.equal(paidCalls, 1);
    await assert.rejects(
      () =>
        executeRealDeterministicJob(
          scope,
          prepared.id,
          prepared.inputFingerprint,
          overrides,
        ),
      /reconciled/i,
    );
    assert.equal(paidCalls, 1);
  });

  it("persists but quarantines a contaminated Base before deterministic Artwork compositing", async () => {
    const h = await harness();
    const scope = { workspaceId: WS, actorId: ACTOR };
    const prepared = await prepareDeterministicImageJob(scope, h.request, h.deps);
    await confirmDeterministicImageJob(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      h.deps,
    );
    const result = await executeFakeDeterministicJob(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      {
        ...h.deps,
        inspectBasePrintPurity: async () => ({
          contractVersion: "base-print-purity-v2",
          status: "SUSPECTED_CONTAMINATION",
          reason: "GRAPHIC_PATTERN",
          assessedRegion: { x: 10, y: 10, width: 100, height: 100 },
          analysisRegion: { x: 16, y: 38, width: 88, height: 56 },
          medianColor: { red: 190, green: 170, blue: 150 },
          outlierFraction: 0.2,
          sharpOutlierFraction: 0.08,
          largestSharpComponentFraction: 0.02,
          thresholds: BASE_PRINT_PURITY_THRESHOLDS,
        }),
      },
    );
    assert.equal(result.state, "BASE_FAILED");
    assert.equal(result.job.failureCode, "BASE_PRINT_ZONE_CONTAMINATED");
    assert.equal(result.asset, null);
    assert.equal(h.compositeCalls, 0);
    assert.equal(h.baseProvider.calls, 1);
    assert.equal(
      result.stages.filter((stage) => stage.stage === "BASE_GENERATION").length,
      1,
    );
    assert.equal(
      result.stages.filter((stage) => stage.stage === "DETERMINISTIC_COMPOSITE")
        .length,
      0,
    );
    await assert.rejects(
      () =>
        executeFakeDeterministicJob(
          scope,
          prepared.id,
          prepared.inputFingerprint,
          h.deps,
        ),
      /Retry Composite/i,
    );
    assert.equal(h.baseProvider.calls, 1, "the failed paid boundary cannot run twice");
  });

  it("quarantines an ambiguous real provider failure and never retries the paid claim", async () => {
    const h = await harness();
    const scope = { workspaceId: WS, actorId: ACTOR };
    const prepared = await prepareDeterministicImageJob(scope, h.request, h.deps);
    await confirmDeterministicImageJob(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      h.deps,
    );
    let providerCalls = 0;
    const overrides: Partial<DeterministicRuntimeDependencies> = {
      ...h.deps,
      assertPaidEnabled: () => undefined,
      isProviderConfigured: () => true,
      resolveIdentity: async () => resolvedIdentityFixture(),
      generateBase: async () => {
        providerCalls += 1;
        throw Object.assign(new Error("connection lost after submission"), {
          requestId: "ambiguous-provider-request",
        });
      },
    };
    const first = await executeRealDeterministicJob(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      overrides,
    );
    assert.equal(first.state, "UNKNOWN_PROVIDER_OUTCOME");
    assert.equal(first.job.providerRequestId, "ambiguous-provider-request");
    assert.equal(providerCalls, 1);
    await assert.rejects(
      () =>
        executeRealDeterministicJob(
          scope,
          prepared.id,
          prepared.inputFingerprint,
          overrides,
        ),
      /reconciled/i,
    );
    assert.equal(providerCalls, 1);
  });

  it("reuses the stored base when composite retry follows a Stage B failure", async () => {
    const h = await harness({ failCompositeOnce: true });
    const scope = { workspaceId: WS, actorId: ACTOR };
    const prepared = await prepareDeterministicImageJob(
      scope,
      h.request,
      h.deps,
    );
    await confirmDeterministicImageJob(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      h.deps,
    );
    const failed = await executeFakeDeterministicJob(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      h.deps,
    );
    assert.equal(failed.state, "COMPOSITE_FAILED");
    assert.equal(h.baseProvider.calls, 1);
    const retried = await retryDeterministicComposite(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      h.deps,
    );
    assert.equal(retried.state, "REVIEW_REQUIRED");
    assert.equal(
      h.baseProvider.calls,
      1,
      "Stage A must not be repaid or repeated",
    );
    assert.equal(
      retried.stages.filter(
        (stage) => (stage as { stage?: string }).stage === "BASE_GENERATION",
      ).length,
      1,
    );
    assert.equal(
      retried.stages.filter(
        (stage) =>
          (stage as { stage?: string }).stage === "DETERMINISTIC_COMPOSITE",
      ).length,
      2,
    );
  });

  it("retries a surface-safety refusal with only deterministic Stage B", async () => {
    const h = await harness({ failSurfaceOnce: true });
    const scope = { workspaceId: WS, actorId: ACTOR };
    const prepared = await prepareDeterministicImageJob(
      scope,
      h.request,
      h.deps,
    );
    await confirmDeterministicImageJob(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      h.deps,
    );
    const failed = await executeFakeDeterministicJob(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      h.deps,
    );
    assert.equal(failed.state, "COMPOSITE_FAILED");
    assert.equal(failed.job.failureCode, "SURFACE_INTEGRATION_UNSAFE");
    const baseCallsBeforeRetry = h.baseProvider.calls;
    const retried = await retryDeterministicComposite(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      h.deps,
    );
    assert.equal(retried.state, "REVIEW_REQUIRED");
    assert.equal(h.baseProvider.calls, baseCallsBeforeRetry);
    assert.equal(
      retried.stages.filter((stage) => stage.stage === "BASE_GENERATION")
        .length,
      1,
    );
  });

  it("persists a depth-aware refusal and retries only deterministic Stage B", async () => {
    const h = await harness({ failDepthOnce: true });
    const scope = { workspaceId: WS, actorId: ACTOR };
    const prepared = await prepareDeterministicImageJob(
      scope,
      h.request,
      h.deps,
    );
    await confirmDeterministicImageJob(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      h.deps,
    );
    const failed = await executeFakeDeterministicJob(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      h.deps,
    );
    assert.equal(failed.state, "COMPOSITE_FAILED");
    assert.equal(failed.job.failureCode, "DEPTH_AWARE_SURFACE_UNSAFE");
    const failedComposite = failed.stages.find(
      (stage) => stage.stage === "DETERMINISTIC_COMPOSITE",
    );
    assert.equal(
      (failedComposite?.provenance.depthAwareIntegration as {
        globalFootprintPreserved?: unknown;
      })?.globalFootprintPreserved,
      true,
    );
    const baseCallsBeforeRetry = h.baseProvider.calls;
    const retried = await retryDeterministicComposite(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      h.deps,
    );
    assert.equal(retried.state, "REVIEW_REQUIRED");
    assert.equal(h.baseProvider.calls, baseCallsBeforeRetry);
    assert.equal(
      retried.stages.filter((stage) => stage.stage === "BASE_GENERATION")
        .length,
      1,
      "depth-aware retry must reuse the exact Base and cannot trigger a provider",
    );
  });

  it("does not reinterpret a frozen V1.1 depth refusal during Stage-B retry", async () => {
    const h = await harness({ failDepthOnce: true });
    const scope = { workspaceId: WS, actorId: ACTOR };
    const prepared = await prepareDeterministicImageJob(
      scope,
      h.request,
      h.deps,
    );
    await confirmDeterministicImageJob(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      h.deps,
    );
    const failed = await executeFakeDeterministicJob(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      h.deps,
    );
    assert.equal(failed.job.failureCode, "DEPTH_AWARE_SURFACE_UNSAFE");
    const stored = h.jobs.jobs.get(prepared.id)!;
    const historical = structuredClone(stored);
    historical.inputSnapshot.compositing.fabricIntegration = structuredClone(
      DEFAULT_DEPTH_AWARE_SURFACE_INTEGRATION,
    );
    historical.inputSnapshot.compositing.fabricIntegration.depthAware!.contractVersion =
      DEPTH_AWARE_SURFACE_INTEGRATION_VERSION_V1_1;
    const historicalFingerprint = fingerprintImageGenerationInput(
      historical.inputSnapshot,
    );
    historical.inputFingerprint = historicalFingerprint;
    h.jobs.jobs.set(prepared.id, historical);
    const baseCalls = h.baseProvider.calls;
    await assert.rejects(
      retryDeterministicComposite(
        scope,
        prepared.id,
        historicalFingerprint,
        h.deps,
      ),
      /historische Evidenzrichtlinie/,
    );
    assert.equal(h.baseProvider.calls, baseCalls);
  });

  it("persists surface-realism refusal and retries with no new paid stage", async () => {
    const h = await harness({ failSurfaceRealismOnce: true });
    const scope = { workspaceId: WS, actorId: ACTOR };
    const prepared = await prepareDeterministicImageJob(
      scope,
      h.request,
      h.deps,
    );
    await confirmDeterministicImageJob(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      h.deps,
    );
    const failed = await executeFakeDeterministicJob(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      h.deps,
    );
    assert.equal(failed.state, "COMPOSITE_FAILED");
    assert.equal(
      failed.job.failureCode,
      "SURFACE_REALISM_REFINEMENT_UNSAFE",
    );
    const failedComposite = failed.stages.find(
      (stage) => stage.stage === "DETERMINISTIC_COMPOSITE",
    );
    assert.equal(
      (failedComposite?.provenance.surfaceRealismRefinement as {
        footprintPinned?: unknown;
      })?.footprintPinned,
      true,
    );
    const baseCallsBeforeRetry = h.baseProvider.calls;
    const retried = await retryDeterministicComposite(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      h.deps,
    );
    assert.equal(retried.state, "REVIEW_REQUIRED");
    assert.equal(
      h.baseProvider.calls,
      baseCallsBeforeRetry,
      "surface-realism retry must reuse Base and deterministic Stage B inputs",
    );
  });

  it("fails closed for uncalibrated geometry and fingerprint changes for every critical domain", async () => {
    const h = await harness();
    const profile = await (
      h.deps.products as MemoryProductProfileRepository
    ).getVersion({ workspaceId: WS }, PROFILE, 1);
    profile!.printSurfaces[0] = {
      ...profile!.printSurfaces[0]!,
      version: 2,
      geometryStatus: "REQUIRES_CALIBRATION",
      quad: null,
    };
    await (h.deps.products as MemoryProductProfileRepository).createVersion(
      { workspaceId: WS, actorId: ACTOR },
      { ...profile!, version: 2 },
    );
    await assert.rejects(
      () =>
        prepareDeterministicImageJob(
          { workspaceId: WS, actorId: ACTOR },
          {
            ...h.request,
            productProfile: { ...h.request.productProfile, version: 2 },
            printSurface: { ...h.request.printSurface, version: 2 },
          },
          h.deps,
        ),
      /calibration/i,
    );

    const prepared = await prepareDeterministicImageJob(
      { workspaceId: WS, actorId: ACTOR },
      h.request,
      h.deps,
    );
    const changes = [
      {
        ...prepared.inputSnapshot,
        printSurface: { ...prepared.inputSnapshot.printSurface, version: 2 },
      },
      {
        ...prepared.inputSnapshot,
        product: {
          ...prepared.inputSnapshot.product,
          variantId: "variant-changed",
        },
      },
      {
        ...prepared.inputSnapshot,
        productVisualInput: {
          ...prepared.inputSnapshot.productVisualInput,
          referencePackage: {
            ...prepared.inputSnapshot.productVisualInput.referencePackage,
            packageId: "changed",
          },
        },
      },
      {
        ...prepared.inputSnapshot,
        masterArtwork: {
          ...prepared.inputSnapshot.masterArtwork,
          checksum: "a".repeat(64),
        },
      },
      {
        ...prepared.inputSnapshot,
        brandModel: {
          ...prepared.inputSnapshot.brandModel,
          identityFingerprint: "changed",
        },
      },
    ];
    for (const changed of changes)
      assert.notEqual(
        fingerprintImageGenerationInput(changed),
        prepared.inputFingerprint,
      );
  });

  it("requires explicit human checklist approval and isolates workspaces", async () => {
    const h = await harness();
    const scope = { workspaceId: WS, actorId: ACTOR };
    const prepared = await prepareDeterministicImageJob(
      scope,
      h.request,
      h.deps,
    );
    assert.equal((await h.jobs.list({ workspaceId: randomUUID() })).length, 0);
    await confirmDeterministicImageJob(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      h.deps,
    );
    const recovery = await executeFakeDeterministicJob(
      scope,
      prepared.id,
      prepared.inputFingerprint,
      h.deps,
    );
    await assert.rejects(
      () =>
        reviewDeterministicAsset(
          scope,
          recovery.asset!.id,
          {
            decision: "APPROVED",
            checklist: {
              identity: "PASS",
              productFidelity: "PASS",
              artworkFidelityExact: "NEEDS_REVIEW",
              placement: "PASS",
              perspective: "PASS",
              lightingIntegration: "PASS",
            },
            note: null,
          },
          h.deps,
        ),
      /müssen.*bestanden/i,
    );
    await assert.rejects(
      () =>
        getDeterministicRecovery(
          { workspaceId: randomUUID() },
          prepared.id,
          h.deps,
        ),
      /not found/i,
    );
  });

  it("keeps a rejected historical job stored after a new PrintSurface prepare", async () => {
    const h = await harness();
    const scope = { workspaceId: WS, actorId: ACTOR };
    const first = await prepareDeterministicImageJob(scope, h.request, h.deps);
    await confirmDeterministicImageJob(
      scope,
      first.id,
      first.inputFingerprint,
      h.deps,
    );
    const executed = await executeFakeDeterministicJob(
      scope,
      first.id,
      first.inputFingerprint,
      h.deps,
    );
    const rejected = await reviewDeterministicAsset(
      scope,
      executed.asset!.id,
      {
        decision: "REJECTED",
        checklist: {
          identity: "NEEDS_REVIEW",
          productFidelity: "NEEDS_REVIEW",
          artworkFidelityExact: "NEEDS_REVIEW",
          placement: "NEEDS_REVIEW",
          perspective: "NEEDS_REVIEW",
          lightingIntegration: "NEEDS_REVIEW",
        },
        note: "Rejected for a new PrintSurface run.",
      },
      h.deps,
    );
    assert.equal(rejected.reviewStatus, "REJECTED");
    assert.equal(
      (await getDeterministicRecovery(scope, first.id, h.deps)).state,
      "REJECTED",
    );
    assert.equal(h.baseProvider.calls, 1);

    const profile = await (
      h.deps.products as MemoryProductProfileRepository
    ).getVersion({ workspaceId: WS }, PROFILE, 1);
    await (h.deps.products as MemoryProductProfileRepository).createVersion(
      { workspaceId: WS, actorId: ACTOR },
      {
        ...profile!,
        version: 2,
        printSurfaces: [
          {
            ...profile!.printSurfaces[0]!,
            version: 2,
            quad: [
              { x: 0.22, y: 0.28 },
              { x: 0.78, y: 0.28 },
              { x: 0.76, y: 0.74 },
              { x: 0.24, y: 0.74 },
            ],
          },
        ],
      },
    );
    const second = await prepareDeterministicImageJob(
      scope,
      {
        ...h.request,
        productProfile: { ...h.request.productProfile, version: 2 },
        printSurface: { printSurfaceId: "front-left-chest", version: 2 },
      },
      h.deps,
    );
    assert.notEqual(second.id, first.id);
    assert.notEqual(second.inputFingerprint, first.inputFingerprint);
    assert.equal(
      h.baseProvider.calls,
      1,
      "Prepare must not call a generation provider",
    );

    const listed = await listDeterministicJobs(scope, undefined, h.deps);
    assert.equal(
      listed.some((job) => job.id === first.id && job.status === "succeeded"),
      true,
    );
    assert.equal(
      listed.some(
        (job) => job.id === second.id && job.status === "awaiting_confirmation",
      ),
      true,
    );
    assert.equal(
      (await getDeterministicRecovery(scope, first.id, h.deps)).state,
      "REJECTED",
    );
    assert.equal(
      (await getDeterministicRecovery(scope, first.id, h.deps)).asset
        ?.reviewStatus,
      "REJECTED",
    );
  });
});
