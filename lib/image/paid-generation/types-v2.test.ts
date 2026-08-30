import assert from "node:assert/strict";
import test from "node:test";

import { buildDeterministicBaseProviderRequest } from "@/lib/image/deterministic-production/base-provider-request";
import { fingerprintImageGenerationInput } from "@/lib/image/paid-generation/fingerprint";
import {
  DEFAULT_DEPTH_AWARE_SURFACE_INTEGRATION,
  DEFAULT_SURFACE_REALISM_REFINEMENT_INTEGRATION,
  DEFAULT_SURFACE_CONFORMING_FABRIC_INTEGRATION,
} from "@/lib/image/artwork-compositing/types";
import {
  anyImageGenerationInputSnapshotSchema,
  effectivePrintSurfaceForSnapshot,
  imageGenerationInputSnapshotV2Schema,
  mockupHumanReviewSchema,
} from "@/lib/image/paid-generation/types-v2";
import {
  DEFAULT_ORIENTED_FRONT_PRINT_PLANE_POLICY,
  ORIENTED_FRONT_PRINT_PLANE_VERSION,
} from "@/lib/image/deterministic-runtime/oriented-front-print-plane-v2";

function snapshot() {
  return imageGenerationInputSnapshotV2Schema.parse({
    version: "image-generation-input-v2",
    productionMode: "DETERMINISTIC_COMPOSITE",
    workspaceId: "11111111-1111-4111-8111-111111111111",
    brandModel: {
      contractVersion: "brand-model-v1",
      brandModelId: "model-1",
      personaId: "persona-1",
      identityLockSnapshotId: "lock-1",
      identityLockVersion: 3,
      identityFingerprint: "identity-fingerprint",
      referencePackageVersion: "5/5",
      referencePackageFingerprint: "package-fingerprint",
      displayName: "Approved model",
      masterIdentityAssetId: "master-identity-1",
    },
    product: {
      version: "product-production-binding-v2",
      productProfileId: "shopify:gid://shopify/Product/1",
      profileVersion: 1,
      shopifyProductId: "gid://shopify/Product/1",
      variantId: "gid://shopify/ProductVariant/1",
      productName: "Zip Hoodie",
      productType: "Zip Hoodie",
      color: "Black",
      size: "L",
      material: "Cotton",
      fit: "Oversized",
      collection: "Core",
      availability: "AVAILABLE",
      active: true,
      authority: "SHOPIFY_LIVE",
      provenance: {
        source: "Shopify Admin GraphQL live read",
        sourceRecordId: "gid://shopify/ProductVariant/1",
        capturedAt: "2026-08-17T12:00:00.000Z",
        sourceVersion: "2026-08-17T11:00:00.000Z",
      },
    },
    productVisualInput: {
      contractVersion: "product-visual-input-v1",
      productProfileId: "shopify:gid://shopify/Product/1",
      authority: "SHOPIFY_LIVE",
      shopifyProductId: "gid://shopify/Product/1",
      variantId: "gid://shopify/ProductVariant/1",
      color: "Black",
      material: "Cotton",
      fit: "Oversized",
      construction: { zipper: "full" },
      referencePackage: {
        schemaVersion: "product-reference-package-v1",
        packageId: "shopify:product-1:v1",
        authority: "SHOPIFY_LIVE",
        productProfileId: "shopify:product-1",
        shopifyProductId: "gid://shopify/Product/1",
        productVersion: "2026-08-17T11:00:00.000Z",
        references: [
          {
            referenceId: "image-1",
            source: "SHOPIFY_MEDIA",
            role: "FEATURED",
            sourceImageId: "image-1",
            sourceUrl: "https://cdn.shopify.com/image.png",
            privateStoragePath: "workspace/product-references/image-1.png",
            contentChecksumSha256: "d".repeat(64),
            width: 1000,
            height: 1200,
            altText: null,
            variantIds: [],
          },
        ],
        capturedAt: "2026-08-17T12:00:00.000Z",
        provenance: "Shopify read",
      },
    },
    masterArtwork: {
      artworkId: "22222222-2222-4222-8222-222222222222",
      designId: "design-1",
      version: "V1",
      checksum: "a".repeat(64),
      mimeType: "image/png",
      byteLength: 100,
      sourceType: "uploaded",
      approvalStatus: "APPROVED",
      sourceReportId: null,
      sourceHandoffAt: "2026-08-17T12:00:00.000Z",
      placement: null,
      printMethod: null,
      provenance: "DESIGN_STUDIO_DURABLE",
    },
    printSurface: {
      contractVersion: "print-surface-v1",
      printSurfaceId: "surface-1",
      productProfileId: "shopify:product-1",
      variantId: "gid://shopify/ProductVariant/1",
      region: "front_center",
      geometryStatus: "HUMAN_DEFINED",
      quad: [
        { x: 0.3, y: 0.3 },
        { x: 0.7, y: 0.3 },
        { x: 0.7, y: 0.7 },
        { x: 0.3, y: 0.7 },
      ],
      boundingBox: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 },
      orientationDegrees: 0,
      perspectiveAnchors: [],
      clippingMaskReference: null,
      safeMargin: { top: 0, right: 0, bottom: 0, left: 0 },
      artworkScale: 1,
      rotationDegrees: 0,
      warpMode: "PERSPECTIVE",
      provenance: {
        source: "OWNER_CALIBRATION",
        calibratedBy: "owner",
        calibratedAt: "2026-08-17T12:00:00.000Z",
      },
    },
    semanticPlacement: {
      contractVersion: "semantic-print-placement-v1",
      printSide: "FRONT",
      placementPreset: "FRONT_LARGE",
      displayLabel: "Großer Frontprint",
      resolvedPrintSurfaceId: "surface-1",
      resolvedPrintSurfaceVersion: 1,
      resolvedRegion: "front_center",
    },
    shot: {
      assetId: "shot-1",
      assetType: "campaign_primary",
      title: "Studio front",
      scene: "Neutral studio",
      lighting: "Soft key and fill",
      poseDirection: "front",
      campaignDirection: "clean product campaign",
    },
    creativeDirection: {
      contractVersion: "social-creative-direction-v1",
      contentMode: "SOCIAL_CONTENT",
      shotType: "shot-1",
      presetId: "URBAN_STREET",
      sceneType: "URBAN_STREET",
      locationType: "STREET",
      lighting: "DIFFUSED_DAYLIGHT",
      camera: { framing: "FULL_BODY", angle: "EYE_LEVEL" },
      composition: "OFF_CENTER",
      subjectDirection: "WALKING",
      productPresentation: "WORN",
      mood: "URBAN",
      channelIntent: "INSTAGRAM_FEED",
      aspectIntent: "4:5",
      customDirection: null,
      source: "OWNER_SELECTED",
    },
    production: {
      projectId: "33333333-3333-4333-8333-333333333333",
      projectVersion: 1,
      reportRecordId: "44444444-4444-4444-8444-444444444444",
      reportId: "55555555-5555-4555-8555-555555555555",
    },
    baseGeneration: {
      provider: "openai",
      model: "gpt-image-1",
      dimensions: "1024x1536",
      quality: "low",
      assetCount: 1,
      personaStrategy: "MASTER_IDENTITY_REFERENCE",
      productStrategy: "PRODUCT_REFERENCES_AND_METADATA",
      artworkStrategy: "NO_MASTER_ARTWORK_INPUT",
      prompt: "Create a front-facing garment base.",
    },
    compositing: {
      compositorVersion: "nexhq-deterministic-compositor-v3-fabric-aware-v1",
      artworkPlacementMode: "CONTAIN_UNIFORM_ASPECT_LOCKED",
      sampling: "BILINEAR_SOURCE_PIXEL",
      blending: "FABRIC_AWARE_PRINT_V1",
      shadingFactor: 1,
      fabricIntegration: {
        mode: "FABRIC_AWARE_PRINT_V1",
        maxDisplacementRatio: 0.012,
        lightingStrength: 0.2,
        textureStrength: 0.08,
        inkOpacity: 0.96,
      },
      automaticProviderRetryOnCompositeFailure: false,
    },
  });
}

test("v2 freezes WHO, Product, Artwork, PrintSurface, shot and two-stage settings", () => {
  const parsed = snapshot();
  assert.equal(parsed.productionMode, "DETERMINISTIC_COMPOSITE");
  assert.equal(
    parsed.baseGeneration.artworkStrategy,
    "NO_MASTER_ARTWORK_INPUT",
  );
  assert.equal(parsed.baseGeneration.assetCount, 1);
  assert.equal(
    parsed.compositing.artworkPlacementMode,
    "CONTAIN_UNIFORM_ASPECT_LOCKED",
  );
  assert.equal(
    parsed.compositing.fabricIntegration?.mode,
    "FABRIC_AWARE_PRINT_V1",
  );
});

test("new Brand Model conditioning is fingerprint-bound while historical snapshots remain parseable", () => {
  const historical = snapshot();
  assert.equal(historical.identityConditioning, undefined);
  const current = structuredClone(historical) as typeof historical & {
    identityConditioning: Record<string, unknown>;
  };
  current.identityConditioning = {
    contractVersion: "brand-model-production-identity-v1",
    authoritySource: "PERSONA_MASTER_IDENTITY_LOCK",
    identityLockActive: true,
    genericIdentityFallbackAllowed: false,
    providerStrategy:
      "MASTER_PLUS_CANONICAL_SUPPORT_PACKAGE_HIGH_FIDELITY",
    masterIdentityAssetId: historical.brandModel.masterIdentityAssetId,
    supportingReferenceCount: 5,
    referencePackageVersion: historical.brandModel.referencePackageVersion,
    referencePackageFingerprint:
      historical.brandModel.referencePackageFingerprint,
    outputConsistencyGate: {
      required: true,
      contractVersion: "nexhq-brand-model-identity-consistency-v1",
      evaluatorVersion: "local-vladmandic-1.7.x-v1",
      thresholdVersion: "v1.0.0",
      maximumEuclideanDistance: 0.55,
      failureMode: "FAIL_CLOSED",
    },
  };
  const parsed = imageGenerationInputSnapshotV2Schema.parse(current);
  assert.equal(parsed.identityConditioning?.identityLockActive, true);
  assert.equal(
    parsed.identityConditioning?.genericIdentityFallbackAllowed,
    false,
  );
  assert.notEqual(
    fingerprintImageGenerationInput(historical),
    fingerprintImageGenerationInput(parsed),
  );

  const invalid = structuredClone(current);
  invalid.identityConditioning.masterIdentityAssetId = "different-master";
  assert.throws(() => imageGenerationInputSnapshotV2Schema.parse(invalid));
});

test("historical compositor-v2 snapshot remains parseable without fabric integration", () => {
  const historical = structuredClone(snapshot());
  historical.compositing = {
    compositorVersion: "nexhq-deterministic-compositor-v2",
    artworkPlacementMode: "CONTAIN_UNIFORM_ASPECT_LOCKED",
    sampling: "BILINEAR_SOURCE_PIXEL",
    blending: "SOURCE_OVER",
    shadingFactor: 1,
    automaticProviderRetryOnCompositeFailure: false,
  };
  const parsed = imageGenerationInputSnapshotV2Schema.parse(historical);
  assert.equal(
    parsed.compositing.compositorVersion,
    "nexhq-deterministic-compositor-v2",
  );
  assert.equal(parsed.compositing.fabricIntegration, undefined);
});

test("SAM 3 policy is optional for history and fingerprint-bound for new V3 jobs", () => {
  const historical = snapshot();
  assert.equal(historical.garmentSegmentationPolicy, undefined);

  const withSegmentation = structuredClone(historical) as typeof historical & {
    productFamilyPlacement: {
      contractVersion: "product-family-production-placement-v1";
      productFamilyId: string;
      colorKey: string;
      side: "FRONT";
      placementTemplateId: string;
      placementTemplateVersion: number;
      printableArea: { x: number; y: number; width: number; height: number };
      ownerPlacement: {
        contractVersion: "owner-artwork-placement-v1";
        templateId: string;
        templateVersion: number;
        uniformScale: number;
        offsetX: number;
        offsetY: number;
        aspectRatioPolicy: "LOCKED_UNIFORM_CONTAIN";
      };
      outputMapping: "GENERATED_GARMENT_RELATIVE_V3";
    };
    garmentSegmentationPolicy: {
      contractVersion: "garment-segmentation-policy-v1";
      required: true;
      provider: "SAM3";
      adapterVersion: "nexhq-sam3-http-v1";
      model: string;
      maximumCostUsd: number;
    };
  };
  withSegmentation.productFamilyPlacement = {
    contractVersion: "product-family-production-placement-v1",
    productFamilyId: "family-1",
    colorKey: "black",
    side: "FRONT",
    placementTemplateId: "front-template",
    placementTemplateVersion: 1,
    printableArea: { x: 0.2, y: 0.2, width: 0.6, height: 0.62 },
    ownerPlacement: {
      contractVersion: "owner-artwork-placement-v1",
      templateId: "front-template",
      templateVersion: 1,
      uniformScale: 0.92,
      offsetX: 0,
      offsetY: 0.12,
      aspectRatioPolicy: "LOCKED_UNIFORM_CONTAIN",
    },
    outputMapping: "GENERATED_GARMENT_RELATIVE_V3",
  };
  withSegmentation.garmentSegmentationPolicy = {
    contractVersion: "garment-segmentation-policy-v1",
    required: true,
    provider: "SAM3",
    adapterVersion: "nexhq-sam3-http-v1",
    model: "sam3-production",
    maximumCostUsd: 0.01,
  };
  const parsed = imageGenerationInputSnapshotV2Schema.parse(withSegmentation);
  assert.equal(parsed.garmentSegmentationPolicy?.model, "sam3-production");
  assert.notEqual(
    fingerprintImageGenerationInput(historical),
    fingerprintImageGenerationInput(parsed),
  );

  const changedModel = structuredClone(parsed);
  changedModel.garmentSegmentationPolicy!.model = "sam3-production-v2";
  assert.notEqual(
    fingerprintImageGenerationInput(parsed),
    fingerprintImageGenerationInput(
      imageGenerationInputSnapshotV2Schema.parse(changedModel),
    ),
  );
});

test("SAM 3 policy fails closed outside garment-relative V3", () => {
  const invalid = structuredClone(snapshot()) as Record<string, unknown>;
  invalid.garmentSegmentationPolicy = {
    contractVersion: "garment-segmentation-policy-v1",
    required: true,
    provider: "SAM3",
    adapterVersion: "nexhq-sam3-http-v1",
    model: "sam3-production",
    maximumCostUsd: 0.01,
  };
  assert.throws(() => imageGenerationInputSnapshotV2Schema.parse(invalid));
});

test("fabric-aware integration policy is fingerprint-bound", () => {
  const current = snapshot();
  const changed = structuredClone(current);
  changed.compositing.fabricIntegration!.lightingStrength = 0.24;
  assert.notEqual(
    fingerprintImageGenerationInput(current),
    fingerprintImageGenerationInput(
      imageGenerationInputSnapshotV2Schema.parse(changed),
    ),
  );
});

test("surface-conforming policy is optional for history, versioned, and fingerprint-bound for new Product Family jobs", () => {
  const historical = snapshot();
  assert.equal(
    historical.compositing.fabricIntegration?.surfaceConforming,
    undefined,
  );
  const current = structuredClone(historical);
  current.compositing.fabricIntegration = structuredClone(
    DEFAULT_SURFACE_CONFORMING_FABRIC_INTEGRATION,
  );
  const parsed = imageGenerationInputSnapshotV2Schema.parse(current);
  assert.equal(
    parsed.compositing.fabricIntegration?.surfaceConforming?.contractVersion,
    "nexhq-surface-conforming-integration-v1",
  );
  assert.notEqual(
    fingerprintImageGenerationInput(historical),
    fingerprintImageGenerationInput(parsed),
  );
});

test("depth-aware policy is optional for history and fingerprint-bound for new T-shirt Product Family jobs", () => {
  const historical = snapshot();
  assert.equal(historical.compositing.fabricIntegration?.depthAware, undefined);
  const current = structuredClone(historical);
  current.compositing.fabricIntegration = structuredClone(
    DEFAULT_DEPTH_AWARE_SURFACE_INTEGRATION,
  );
  const parsed = imageGenerationInputSnapshotV2Schema.parse(current);
  assert.equal(
    parsed.compositing.fabricIntegration?.depthAware?.contractVersion,
    "nexhq-depth-aware-surface-integration-v1.2-hybrid-low-depth",
  );
  const frozenV1_1 = structuredClone(parsed);
  frozenV1_1.compositing.fabricIntegration!.depthAware!.contractVersion =
    "nexhq-depth-aware-surface-integration-v1.1-garment-plane";
  assert.equal(
    imageGenerationInputSnapshotV2Schema.parse(frozenV1_1).compositing
      .fabricIntegration?.depthAware?.contractVersion,
    "nexhq-depth-aware-surface-integration-v1.1-garment-plane",
    "historical V1.1 snapshots remain parseable without hybrid reinterpretation",
  );
  const frozenV1 = structuredClone(parsed);
  frozenV1.compositing.fabricIntegration!.depthAware!.contractVersion =
    "nexhq-depth-aware-surface-integration-v1";
  assert.equal(
    imageGenerationInputSnapshotV2Schema.parse(frozenV1).compositing
      .fabricIntegration?.depthAware?.contractVersion,
    "nexhq-depth-aware-surface-integration-v1",
    "historical V1 snapshots must remain parseable without reinterpretation",
  );
  assert.notEqual(
    fingerprintImageGenerationInput(historical),
    fingerprintImageGenerationInput(parsed),
  );
});

test("surface-realism refinement is optional for history, versioned, and fingerprint-bound", () => {
  const historical = snapshot();
  assert.equal(
    historical.compositing.fabricIntegration?.surfaceRealismRefinement,
    undefined,
  );
  const current = structuredClone(historical);
  current.compositing.fabricIntegration = structuredClone(
    DEFAULT_SURFACE_REALISM_REFINEMENT_INTEGRATION,
  );
  const parsed = imageGenerationInputSnapshotV2Schema.parse(current);
  assert.equal(
    parsed.compositing.fabricIntegration?.surfaceRealismRefinement
      ?.contractVersion,
    "nexhq-surface-realism-refinement-v1",
  );
  assert.notEqual(
    fingerprintImageGenerationInput(historical),
    fingerprintImageGenerationInput(parsed),
  );
});

test("oriented front-plane policy is optional for history and frozen only for eligible fresh T-shirt fronts", () => {
  const historical = snapshot();
  assert.equal(
    historical.productFamilyPlacement?.orientedFrontPrintPlane,
    undefined,
  );
  const current = structuredClone(historical);
  current.product.productType = "Vacancy T-Shirt";
  current.semanticPlacement = {
    ...current.semanticPlacement!,
    printSide: "FRONT",
    placementPreset: "FRONT_LARGE",
    displayLabel: "Großer Frontprint",
    resolvedRegion: "front_center",
  };
  current.productFamilyPlacement = {
    contractVersion: "product-family-production-placement-v1",
    productFamilyId: "family-1",
    colorKey: "black",
    side: "FRONT",
    placementTemplateId: "front-template",
    placementTemplateVersion: 1,
    printableArea: { x: 0.2, y: 0.2, width: 0.6, height: 0.62 },
    ownerPlacement: {
      contractVersion: "owner-artwork-placement-v1",
      templateId: "front-template",
      templateVersion: 1,
      uniformScale: 0.92,
      offsetX: 0,
      offsetY: 0.12,
      aspectRatioPolicy: "LOCKED_UNIFORM_CONTAIN",
    },
    outputMapping: "GENERATED_GARMENT_RELATIVE_V3",
    orientedFrontPrintPlane: DEFAULT_ORIENTED_FRONT_PRINT_PLANE_POLICY,
  };
  const parsed = imageGenerationInputSnapshotV2Schema.parse(current);
  assert.equal(
    parsed.productFamilyPlacement?.orientedFrontPrintPlane?.contractVersion,
    ORIENTED_FRONT_PRINT_PLANE_VERSION,
  );
  assert.notEqual(
    fingerprintImageGenerationInput(historical),
    fingerprintImageGenerationInput(parsed),
  );

  const invalid = structuredClone(current);
  invalid.semanticPlacement!.placementPreset = "BACK_LARGE";
  assert.throws(() => imageGenerationInputSnapshotV2Schema.parse(invalid));
});

test("historical v2 compositor-v1 snapshot remains parseable without scale-lock fields", () => {
  const historical = structuredClone(snapshot());
  historical.compositing = {
    compositorVersion: "nexhq-deterministic-compositor-v1",
    sampling: "BILINEAR_SOURCE_PIXEL",
    blending: "SOURCE_OVER",
    shadingFactor: 1,
    automaticProviderRetryOnCompositeFailure: false,
  };
  const parsed = imageGenerationInputSnapshotV2Schema.parse(historical);
  assert.equal(
    parsed.compositing.compositorVersion,
    "nexhq-deterministic-compositor-v1",
  );
  assert.equal(parsed.compositing.artworkPlacementMode, undefined);
});

test("scale-lock policy is fingerprint-bound and current compositor fails closed without it", () => {
  const current = snapshot();
  const historical = structuredClone(current);
  historical.compositing = {
    compositorVersion: "nexhq-deterministic-compositor-v1",
    sampling: "BILINEAR_SOURCE_PIXEL",
    blending: "SOURCE_OVER",
    shadingFactor: 1,
    automaticProviderRetryOnCompositeFailure: false,
  };
  assert.notEqual(
    fingerprintImageGenerationInput(current),
    fingerprintImageGenerationInput(
      imageGenerationInputSnapshotV2Schema.parse(historical),
    ),
  );
  const missingPolicy = structuredClone(current) as {
    compositing: Record<string, unknown>;
  };
  delete missingPolicy.compositing.artworkPlacementMode;
  assert.throws(() => imageGenerationInputSnapshotV2Schema.parse(missingPolicy));
});

test("structured creative direction is fingerprint-bound on every production-critical axis", () => {
  const baseline = snapshot();
  for (const mutate of [
    (value: typeof baseline) => {
      value.creativeDirection!.sceneType = "PARKING_GARAGE";
    },
    (value: typeof baseline) => {
      value.creativeDirection!.lighting = "COOL_URBAN";
    },
    (value: typeof baseline) => {
      value.creativeDirection!.camera.framing = "PORTRAIT";
    },
    (value: typeof baseline) => {
      value.creativeDirection!.mood = "CINEMATIC";
    },
  ]) {
    const changed = structuredClone(baseline);
    mutate(changed);
    assert.notEqual(
      fingerprintImageGenerationInput(baseline),
      fingerprintImageGenerationInput(
        imageGenerationInputSnapshotV2Schema.parse(changed),
      ),
    );
  }
});

test("historical v2 snapshot remains parseable without creative direction", () => {
  const historical = structuredClone(snapshot()) as Record<string, unknown>;
  delete historical.creativeDirection;
  const parsed = imageGenerationInputSnapshotV2Schema.parse(historical);
  assert.equal(parsed.creativeDirection, undefined);
});

test("historical v2 Product references remain parseable without executor MIME metadata", () => {
  const historical = structuredClone(snapshot());
  const reference =
    historical.productVisualInput.referencePackage.references[0]!;
  delete reference.mimeType;
  delete reference.byteLength;
  const parsed = imageGenerationInputSnapshotV2Schema.parse(historical);
  assert.equal(
    parsed.productVisualInput.referencePackage.references[0]?.mimeType ?? null,
    null,
  );
  assert.equal(
    parsed.productVisualInput.referencePackage.references[0]?.byteLength ?? null,
    null,
  );
});

test("draft generative Artwork is explicit and cannot masquerade as deterministic", () => {
  const draft = structuredClone(snapshot());
  draft.productionMode = "DRAFT_GENERATIVE_ARTWORK";
  draft.baseGeneration.artworkStrategy = "SECONDARY_MASTER_ARTWORK_REFERENCE";
  assert.equal(
    imageGenerationInputSnapshotV2Schema.parse(draft).productionMode,
    "DRAFT_GENERATIVE_ARTWORK",
  );

  const unsafe = structuredClone(snapshot());
  unsafe.baseGeneration.artworkStrategy = "SECONDARY_MASTER_ARTWORK_REFERENCE";
  assert.throws(() => imageGenerationInputSnapshotV2Schema.parse(unsafe));
});

test("historical v1 input remains parseable alongside v2", () => {
  const v2 = snapshot();
  assert.equal(
    anyImageGenerationInputSnapshotSchema.parse(v2).version,
    "image-generation-input-v2",
  );
  const legacy = {
    version: "image-generation-input-v1",
    workspaceId: v2.workspaceId,
    brandModel: v2.brandModel,
    masterArtwork: v2.masterArtwork,
    product: {
      version: "product-production-context-v1",
      productId: v2.product.shopifyProductId,
      variantId: v2.product.variantId,
      productName: v2.product.productName,
      productType: v2.product.productType,
      color: v2.product.color,
      size: v2.product.size,
      material: v2.product.material,
      fit: v2.product.fit,
      collection: v2.product.collection,
      availability: v2.product.availability,
      active: v2.product.active,
      authority: "SHOPIFY_LIVE",
      authoritative: true,
      provenance: {
        ...v2.product.provenance,
        sourceRecordId: v2.product.variantId,
      },
    },
    production: {
      projectId: v2.production.projectId,
      projectVersion: v2.production.projectVersion,
      reportRecordId: v2.production.reportRecordId,
      reportId: v2.production.reportId,
      projectName: "Historical project",
      assetId: v2.shot.assetId,
      assetType: v2.shot.assetType,
      shotTitle: v2.shot.title,
      prompt: "Historical dual-reference prompt",
      scene: v2.shot.scene,
      lighting: v2.shot.lighting,
      poseDirection: v2.shot.poseDirection,
      provider: "openai",
      model: "gpt-image-1",
      dimensions: "1024x1536",
      quality: "low",
      identityStrategy: "openai_master_identity_and_artwork_edit_high_fidelity",
      artworkStrategy: "openai_secondary_master_artwork_reference",
    },
  };
  assert.equal(
    anyImageGenerationInputSnapshotSchema.parse(legacy).version,
    "image-generation-input-v1",
  );
});

test("surface, artwork, and exact variant each bind the fingerprint", () => {
  const original = snapshot();
  const surfaceChanged = structuredClone(original);
  assert.ok(surfaceChanged.printSurface.quad);
  surfaceChanged.printSurface.quad[0].x = 0.31;
  const artworkChanged = structuredClone(original);
  artworkChanged.masterArtwork.checksum = "b".repeat(64);
  const productChanged = structuredClone(original);
  productChanged.product.variantId = "gid://shopify/ProductVariant/2";
  productChanged.productVisualInput.variantId =
    "gid://shopify/ProductVariant/2";
  assert.notEqual(
    fingerprintImageGenerationInput(original),
    fingerprintImageGenerationInput(surfaceChanged),
  );
  assert.notEqual(
    fingerprintImageGenerationInput(original),
    fingerprintImageGenerationInput(artworkChanged),
  );
  assert.notEqual(
    fingerprintImageGenerationInput(original),
    fingerprintImageGenerationInput(productChanged),
  );
});

test("semantic side and placement preset each bind the v2 fingerprint", () => {
  const original = snapshot();
  const sideChanged = structuredClone(original);
  sideChanged.semanticPlacement!.printSide = "BACK";
  sideChanged.semanticPlacement!.placementPreset = "BACK_LARGE";
  sideChanged.semanticPlacement!.displayLabel = "Großer Backprint";
  sideChanged.semanticPlacement!.resolvedRegion = "back_center";
  const placementChanged = structuredClone(original);
  placementChanged.semanticPlacement!.placementPreset = "FRONT_CENTER_CHEST";
  placementChanged.semanticPlacement!.displayLabel = "Brust mittig";
  assert.notEqual(
    fingerprintImageGenerationInput(original),
    fingerprintImageGenerationInput(sideChanged),
  );
  assert.notEqual(
    fingerprintImageGenerationInput(original),
    fingerprintImageGenerationInput(placementChanged),
  );
});

test("historical v2 input without semantic placement remains parseable", () => {
  const historical = structuredClone(snapshot()) as Record<string, unknown>;
  delete historical.semanticPlacement;
  const parsed = imageGenerationInputSnapshotV2Schema.parse(historical);
  assert.equal(parsed.semanticPlacement, undefined);
});

test("job-only fine tuning binds the fingerprint without mutating canonical Product geometry", () => {
  const original = snapshot();
  const tuned = structuredClone(original);
  tuned.printSurfaceOverride = {
    contractVersion: "print-surface-production-override-v1",
    basePrintSurfaceId: original.printSurface.printSurfaceId,
    basePrintSurfaceVersion: original.printSurface.version,
    quad: [
      { x: 0.28, y: 0.31 },
      { x: 0.72, y: 0.31 },
      { x: 0.7, y: 0.73 },
      { x: 0.3, y: 0.73 },
    ],
    provenance: "OWNER_JOB_FINE_TUNING",
  };
  const parsed = imageGenerationInputSnapshotV2Schema.parse(tuned);
  assert.deepEqual(parsed.printSurface.quad, original.printSurface.quad);
  assert.deepEqual(
    effectivePrintSurfaceForSnapshot(parsed).quad,
    tuned.printSurfaceOverride.quad,
  );
  assert.notEqual(
    fingerprintImageGenerationInput(original),
    fingerprintImageGenerationInput(parsed),
  );
});

test("historical v2 input without a production override remains parseable", () => {
  const historical = structuredClone(snapshot()) as Record<string, unknown>;
  delete historical.printSurfaceOverride;
  const parsed = imageGenerationInputSnapshotV2Schema.parse(historical);
  assert.equal(parsed.printSurfaceOverride, undefined);
  assert.deepEqual(
    effectivePrintSurfaceForSnapshot(parsed),
    parsed.printSurface,
  );
});

test("new front-large tuning freezes a rectangular effective surface and changes fingerprint", () => {
  const original = snapshot();
  const tuned = structuredClone(original);
  tuned.printSurfaceOverride = {
    contractVersion: "print-surface-production-override-v1",
    basePrintSurfaceId: original.printSurface.printSurfaceId,
    basePrintSurfaceVersion: original.printSurface.version,
    quad: [
      { x: 0.36, y: 0.25 },
      { x: 0.65, y: 0.25 },
      { x: 0.65, y: 0.57 },
      { x: 0.36, y: 0.57 },
    ],
    provenance: "NEXHQ_FRONT_LARGE_TUNING_V1",
  };
  const parsed = imageGenerationInputSnapshotV2Schema.parse(tuned);
  const effective = effectivePrintSurfaceForSnapshot(parsed);
  assert.equal(effective.warpMode, "NONE");
  assert.equal(effective.boundingBox?.x, 0.36);
  assert.equal(effective.boundingBox?.y, 0.25);
  assert.ok(Math.abs((effective.boundingBox?.width ?? 0) - 0.29) < 1e-12);
  assert.ok(Math.abs((effective.boundingBox?.height ?? 0) - 0.32) < 1e-12);
  assert.notEqual(
    fingerprintImageGenerationInput(original),
    fingerprintImageGenerationInput(parsed),
  );
});

test("deterministic Stage A sends Persona and Product references, never Master Artwork", () => {
  const providerRequest = buildDeterministicBaseProviderRequest({
    snapshot: snapshot(),
    identity: {
      trace: {} as never,
      masterReference: {
        assetId: "identity",
        checksum: "id",
        mimeType: "image/png",
        bytes: Buffer.from("identity"),
      },
      supportingReferences: [],
      constraints: {
        displayName: "Approved model",
        canonicalIdentityDescription: "same person",
        immutableFeatures: "identity locked",
        approvedAgeRange: "",
        approvedHairVariations: "",
        approvedExpressionRange: "",
        approvedBodyProportions: "",
        prohibitedChanges: "",
        defaultStyling: "",
      },
    },
    productReferences: [
      {
        referenceId: "image-1",
        role: "FEATURED",
        mimeType: "image/png",
        bytes: Buffer.from("product"),
      },
    ],
  });
  assert.equal(providerRequest.artwork, undefined);
  assert.match(providerRequest.prompt, /STAGE A BLANK-GARMENT CONTRACT/);
  assert.match(providerRequest.prompt, /legacy artwork, logos, brand text/i);
  assert.match(providerRequest.prompt, /completely blank and unprinted/i);
  assert.equal(providerRequest.production?.productReferences?.length, 1);
  assert.equal(providerRequest.identity?.masterReference.assetId, "identity");
  assert.equal(
    providerRequest.production?.creativeDirection?.sceneType,
    "URBAN_STREET",
  );
});

test("AI output cannot be auto-approved without a human actor", () => {
  assert.throws(() =>
    mockupHumanReviewSchema.parse({
      contractVersion: "mockup-human-review-v1",
      overallStatus: "APPROVED",
      identity: "PASS",
      productFidelity: "PASS",
      artworkFidelityExact: "PASS",
      placement: "PASS",
      perspective: "PASS",
      lightingIntegration: "PASS",
      reviewedBy: null,
      reviewedAt: null,
      note: null,
    }),
  );
});

export { snapshot as makeImageGenerationV2Fixture };
