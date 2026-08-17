import assert from "node:assert/strict";
import test from "node:test";

import { buildDeterministicBaseProviderRequest } from "@/lib/image/deterministic-production/base-provider-request";
import { fingerprintImageGenerationInput } from "@/lib/image/paid-generation/fingerprint";
import {
  anyImageGenerationInputSnapshotSchema,
  imageGenerationInputSnapshotV2Schema,
  mockupHumanReviewSchema,
} from "@/lib/image/paid-generation/types-v2";

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
        references: [{
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
        }],
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
      quad: [{ x: 0.3, y: 0.3 }, { x: 0.7, y: 0.3 }, { x: 0.7, y: 0.7 }, { x: 0.3, y: 0.7 }],
      boundingBox: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 },
      orientationDegrees: 0,
      perspectiveAnchors: [],
      clippingMaskReference: null,
      safeMargin: { top: 0, right: 0, bottom: 0, left: 0 },
      artworkScale: 1,
      rotationDegrees: 0,
      warpMode: "PERSPECTIVE",
      provenance: { source: "OWNER_CALIBRATION", calibratedBy: "owner", calibratedAt: "2026-08-17T12:00:00.000Z" },
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
      compositorVersion: "nexhq-deterministic-compositor-v1",
      sampling: "BILINEAR_SOURCE_PIXEL",
      blending: "SOURCE_OVER",
      shadingFactor: 1,
      automaticProviderRetryOnCompositeFailure: false,
    },
  });
}

test("v2 freezes WHO, Product, Artwork, PrintSurface, shot and two-stage settings", () => {
  const parsed = snapshot();
  assert.equal(parsed.productionMode, "DETERMINISTIC_COMPOSITE");
  assert.equal(parsed.baseGeneration.artworkStrategy, "NO_MASTER_ARTWORK_INPUT");
  assert.equal(parsed.baseGeneration.assetCount, 1);
});

test("draft generative Artwork is explicit and cannot masquerade as deterministic", () => {
  const draft = structuredClone(snapshot());
  draft.productionMode = "DRAFT_GENERATIVE_ARTWORK";
  draft.baseGeneration.artworkStrategy = "SECONDARY_MASTER_ARTWORK_REFERENCE";
  assert.equal(imageGenerationInputSnapshotV2Schema.parse(draft).productionMode, "DRAFT_GENERATIVE_ARTWORK");

  const unsafe = structuredClone(snapshot());
  unsafe.baseGeneration.artworkStrategy = "SECONDARY_MASTER_ARTWORK_REFERENCE";
  assert.throws(() => imageGenerationInputSnapshotV2Schema.parse(unsafe));
});

test("historical v1 input remains parseable alongside v2", () => {
  const v2 = snapshot();
  assert.equal(anyImageGenerationInputSnapshotSchema.parse(v2).version, "image-generation-input-v2");
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
  assert.equal(anyImageGenerationInputSnapshotSchema.parse(legacy).version, "image-generation-input-v1");
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
  productChanged.productVisualInput.variantId = "gid://shopify/ProductVariant/2";
  assert.notEqual(fingerprintImageGenerationInput(original), fingerprintImageGenerationInput(surfaceChanged));
  assert.notEqual(fingerprintImageGenerationInput(original), fingerprintImageGenerationInput(artworkChanged));
  assert.notEqual(fingerprintImageGenerationInput(original), fingerprintImageGenerationInput(productChanged));
});

test("deterministic Stage A sends Persona and Product references, never Master Artwork", () => {
  const providerRequest = buildDeterministicBaseProviderRequest({
    snapshot: snapshot(),
    identity: {
      trace: {} as never,
      masterReference: { assetId: "identity", checksum: "id", mimeType: "image/png", bytes: Buffer.from("identity") },
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
    productReferences: [{ referenceId: "image-1", role: "FEATURED", mimeType: "image/png", bytes: Buffer.from("product") }],
  });
  assert.equal(providerRequest.artwork, undefined);
  assert.equal(providerRequest.production?.productReferences?.length, 1);
  assert.equal(providerRequest.identity?.masterReference.assetId, "identity");
});

test("AI output cannot be auto-approved without a human actor", () => {
  assert.throws(() => mockupHumanReviewSchema.parse({
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
  }));
});

export { snapshot as makeImageGenerationV2Fixture };
