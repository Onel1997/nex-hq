import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import type { ApprovedMasterArtworkView } from "@/lib/design/master-artwork-authority/types";
import type { ImageBrandModelSelection } from "@/lib/image/brand-model-production-context";
import type { ImageStudioHandoff } from "@/lib/image/image-handoff-store";
import {
  enrichHandoffDesignAuthority,
  productionProjectMatchesBrandModel,
  resolveBrandModelTraceForPrepare,
  resolveDurableMasterArtworkReference,
  resolvePaidJobStaleReason,
  resolvePaidPrepareIdentityBlocker,
} from "./image-studio-prepare-identity";
import type { ImageGenerationInputSnapshot } from "@/lib/image/paid-generation/types";
import {
  traceBrandModelContract,
  type BrandModelContract,
  type BrandModelTrace,
} from "@/lib/persona/domain/brand-model-contract";

const checksum = "a".repeat(64);
const ACTOR = randomUUID();

const trace: BrandModelTrace = {
  contractVersion: "brand-model-v1",
  brandModelId: "brand-model-test",
  personaId: "persona-test",
  identityLockSnapshotId: randomUUID(),
  identityLockVersion: 3,
  identityFingerprint: "identity-fingerprint-v3",
  referencePackageVersion: "package-v3",
  referencePackageFingerprint: "package-fingerprint-v3",
};

function contract(): BrandModelContract {
  const ref = {
    assetId: "master-asset",
    checksum: "master-checksum",
    mimeType: "image/png",
    width: 1024,
    height: 1024,
    status: "approved" as const,
    sourceType: "user_upload" as const,
    rightsConfirmed: true,
  };
  return {
    contractVersion: "brand-model-v1",
    issuedAt: "2026-08-17T00:00:00Z",
    workspaceId: randomUUID(),
    personaId: trace.personaId,
    brandModelId: trace.brandModelId,
    displayName: "North African Street Premium",
    role: "primary",
    sourceUpdatedAt: "2026-08-17T00:00:00Z",
    identity: {
      locked: true,
      identityLockSnapshotId: trace.identityLockSnapshotId,
      lockVersion: 3,
      lockedAt: "2026-08-17T00:00:00Z",
      fingerprint: trace.identityFingerprint,
      policyVersion: "v1",
      identityReview: {
        id: randomUUID(),
        reviewedAt: "2026-08-17T00:00:00Z",
        reviewedBy: ACTOR,
      },
      provenance: { sourceCandidateId: null, sourceCreationProjectId: null },
      referencePackage: {
        version: trace.referencePackageVersion,
        fingerprint: trace.referencePackageFingerprint,
      },
      masterIdentityReference: ref,
      approvedReferencePackage: [],
      constraints: {
        canonicalIdentityDescription: "same person",
        immutableFeatures: "face",
        flexibleFeatures: "clothes",
        prohibitedChanges: "identity",
        approvedHairVariations: "short",
        approvedExpressionRange: "neutral",
        approvedBodyProportions: "lean",
        approvedAgeRange: "22-25",
        defaultStyling: "streetwear",
      },
    },
    approvals: {
      brandCastApproved: true,
      brandCastApprovedAt: "2026-08-17T00:00:00Z",
      brandCastApprovedBy: ACTOR,
      imageUseApproved: true,
      imageUseApprovedAt: "2026-08-17T00:00:00Z",
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
      videoBlockingReasons: ["Video use is not approved"],
      lockVersion: 3,
      identityFingerprint: trace.identityFingerprint,
    },
  };
}

function durableArtwork(
  overrides: Partial<ApprovedMasterArtworkView> = {},
): ApprovedMasterArtworkView {
  return {
    contractVersion: "design-master-artwork-v1",
    id: "11111111-1111-4111-8111-111111111111",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    designId: "design-owner-upload",
    version: "V2",
    checksum,
    mimeType: "image/png",
    byteLength: 1024,
    sourceType: "uploaded",
    status: "APPROVED",
    placement: "center chest",
    printMethod: "screen print",
    sourceReportId: "design-report",
    sourceHandoffAt: "2026-08-17T00:00:00.000Z",
    provenance: {
      authority: "DESIGN_STUDIO",
      humanApproved: true,
      source: "design studio approval",
    },
    approvedBy: "owner",
    approvedAt: "2026-08-17T00:00:00.000Z",
    createdAt: "2026-08-17T00:00:00.000Z",
    ...overrides,
  };
}

function handoff(
  overrides: Partial<ImageStudioHandoff> = {},
): ImageStudioHandoff {
  return {
    brief: "Approved hero artwork brief",
    handoffAt: "2026-08-17T00:00:00.000Z",
    masterArtworkApproved: true,
    durableMasterArtwork: durableArtwork(),
    designId: "design-owner-upload",
    reportId: "design-report",
    ...overrides,
  };
}

function brandModelSelection(): ImageBrandModelSelection {
  const modelContract = contract();
  return {
    productionContext: {
      contract: modelContract,
      trace: traceBrandModelContract(modelContract),
    },
    transientAssetAccess: [],
  };
}

describe("Image Studio paid prepare identity", () => {
  it("accepts approved durable artwork with resolvable Brand Model trace", () => {
    const selection = brandModelSelection();
    assert.equal(
      resolvePaidPrepareIdentityBlocker({
        handoff: handoff(),
        brandModelSelection: selection,
      }),
      null,
    );
    assert.deepEqual(resolveDurableMasterArtworkReference(handoff()), {
      id: durableArtwork().id,
      designId: "design-owner-upload",
      version: "V2",
      checksum,
    });
    assert.equal(
      resolveBrandModelTraceForPrepare({
        brandModelSelection: selection,
        projectBrandModelTrace: null,
      })?.identityLockVersion,
      3,
    );
  });

  it("blocks when durable artwork ID is missing", () => {
    assert.match(
      resolvePaidPrepareIdentityBlocker({
        handoff: handoff({
          durableMasterArtwork: durableArtwork({ id: "" }),
        }),
        brandModelSelection: brandModelSelection(),
      }) ?? "",
      /dauerhafte Artwork-ID/i,
    );
  });

  it("blocks when design ID is missing", () => {
    assert.match(
      resolvePaidPrepareIdentityBlocker({
        handoff: handoff({
          designId: undefined,
          reportId: undefined,
          durableMasterArtwork: durableArtwork({ designId: "" }),
        }),
        brandModelSelection: brandModelSelection(),
      }) ?? "",
      /Design-ID/i,
    );
  });

  it("blocks checksum mismatch shape before paid prep", () => {
    assert.match(
      resolvePaidPrepareIdentityBlocker({
        handoff: handoff({
          durableMasterArtwork: durableArtwork({ checksum: "invalid" }),
        }),
        brandModelSelection: brandModelSelection(),
      }) ?? "",
      /Prüfsumme|checksum/i,
    );
  });

  it("blocks unapproved durable artwork", () => {
    assert.match(
      resolvePaidPrepareIdentityBlocker({
        handoff: handoff({
          masterArtworkApproved: false,
          durableMasterArtwork: undefined,
        }),
        brandModelSelection: brandModelSelection(),
      }) ?? "",
      /freigegebenes Master Artwork/i,
    );
  });

  it("requires Brand Model selection separately from durable artwork", () => {
    assert.match(
      resolvePaidPrepareIdentityBlocker({
        handoff: handoff(),
        brandModelSelection: null,
      }) ?? "",
      /Markenmodel/i,
    );
  });

  it("detects when staged production project is stale for selected Brand Model", () => {
    const selection = brandModelSelection();
    const staleTrace = {
      ...selection.productionContext.trace,
      identityLockVersion: 1,
    };
    assert.equal(
      productionProjectMatchesBrandModel({
        projectBrandModelTrace: staleTrace,
        selectedTrace: selection.productionContext.trace,
      }),
      false,
    );
    assert.match(
      resolvePaidPrepareIdentityBlocker({
        handoff: handoff(),
        brandModelSelection: selection,
        projectBrandModelTrace: staleTrace,
      }) ?? "",
      /neu vorbereitet/i,
    );
  });

  it("recovers design authority fields after reload-style handoff normalization", () => {
    const enriched = enrichHandoffDesignAuthority(
      handoff({
        designId: undefined,
        masterArtworkApproved: undefined,
        masterArtworkVersion: undefined,
      }),
    );
    assert.equal(enriched.designId, "design-owner-upload");
    assert.equal(enriched.masterArtworkApproved, true);
    assert.equal(enriched.masterArtworkVersion, "V2");
  });

  it("flags stale paid jobs when queue selection or artwork authority changes", () => {
    const snapshot: ImageGenerationInputSnapshot = {
      version: "image-generation-input-v1",
      workspaceId: randomUUID(),
      brandModel: {
        ...trace,
        displayName: "North African Street Premium",
        masterIdentityAssetId: "master-asset",
      },
      masterArtwork: {
        artworkId: durableArtwork().id,
        designId: durableArtwork().designId,
        version: durableArtwork().version,
        checksum: durableArtwork().checksum,
        mimeType: "image/png",
        byteLength: 1024,
        sourceType: "uploaded",
        approvalStatus: "APPROVED",
        sourceReportId: "design-report",
        sourceHandoffAt: "2026-08-17T00:00:00.000Z",
        placement: "center chest",
        printMethod: "screen print",
        provenance: "DESIGN_STUDIO_DURABLE",
      },
      product: {
        version: "product-production-context-v1",
        productId: "gid://shopify/Product/1",
        variantId: "gid://shopify/ProductVariant/2",
        productName: "CRUISING - Heavy Oversized Tee",
        productType: "tee",
        color: "Black",
        size: "L",
        material: null,
        fit: null,
        collection: "Core",
        availability: "AVAILABLE",
        active: true,
        authority: "SHOPIFY_LIVE",
        authoritative: true,
        provenance: {
          source: "Shopify Admin GraphQL live read",
          sourceRecordId: "gid://shopify/ProductVariant/2",
          capturedAt: "2026-08-17T00:00:00.000Z",
          sourceVersion: "2026-08-17T00:00:00.000Z",
        },
      },
      production: {
        projectId: randomUUID(),
        projectVersion: 1,
        reportRecordId: randomUUID(),
        reportId: randomUUID(),
        projectName: "Campaign",
        assetId: "hero",
        assetType: "hero_image",
        shotTitle: "Hero",
        prompt: "Hero prompt",
        scene: "Studio",
        lighting: "Soft",
        poseDirection: "Editorial",
        provider: "openai",
        model: "gpt-image-1",
        dimensions: "1024x1536",
        quality: "low",
        identityStrategy: "openai_master_identity_and_artwork_edit_high_fidelity",
        artworkStrategy: "openai_secondary_master_artwork_reference",
      },
    };
    const base = {
      paidJob: { status: "confirmed", inputSnapshot: snapshot },
      selectedAssetId: "hero" as string | null,
      handoff: handoff(),
      brandModelSelection: brandModelSelection(),
      productProductionContext: snapshot.product,
    };

    assert.equal(resolvePaidJobStaleReason(base), null);
    assert.match(
      resolvePaidJobStaleReason({
        ...base,
        selectedAssetId: "lifestyle-1",
      }) ?? "",
      /Aufnahme hat sich/i,
    );
    assert.match(
      resolvePaidJobStaleReason({
        ...base,
        handoff: handoff({
          durableMasterArtwork: durableArtwork({ checksum: "b".repeat(64) }),
        }),
      }) ?? "",
      /Artwork hat sich/i,
    );
    assert.equal(
      resolvePaidJobStaleReason({
        ...base,
        paidJob: { status: "succeeded", inputSnapshot: snapshot },
        selectedAssetId: "lifestyle-1",
      }),
      null,
    );
  });
});
