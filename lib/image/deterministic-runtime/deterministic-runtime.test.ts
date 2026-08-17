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
  getDeterministicRecovery,
  prepareDeterministicImageJob,
  retryDeterministicComposite,
  reviewDeterministicAsset,
  type DeterministicRuntimeDependencies,
} from "@/lib/image/deterministic-runtime/service";
import { compositeApprovedArtwork } from "@/lib/image/artwork-compositing/compositor";
import { fingerprintImageGenerationInput } from "@/lib/image/paid-generation/fingerprint";

const WS = randomUUID();
const ACTOR = randomUUID();
const REPORT_RECORD = randomUUID();
const REPORT = randomUUID();
const ARTWORK_ID = randomUUID();
const PRODUCT_ID = "gid://shopify/Product/100";
const VARIANT_ID = "gid://shopify/ProductVariant/101";
const PROFILE = `shopify:${PRODUCT_ID}`;
const NOW = "2026-08-17T14:00:00.000Z";
const REF_BYTES = Buffer.from("synthetic-product-reference");
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
    contractVersion: "design-master-artwork-v1", id: ARTWORK_ID, workspaceId: WS,
    designId: "design-runtime", version: "V1", checksum: createHash("sha256").update(bytes).digest("hex"),
    mimeType: "image/png", byteLength: bytes.length, sourceType: "uploaded",
    storagePath: `workspace/${WS}/designs/runtime.png`, status: "APPROVED",
    placement: null, printMethod: null, sourceReportId: null, sourceHandoffAt: NOW,
    provenance: { authority: "DESIGN_STUDIO", humanApproved: true, source: "test owner approval" },
    approvedBy: ACTOR, approvedAt: NOW, createdAt: NOW,
  };
}

function report(): { id: string; workspaceId: string; content: BrainReportContent } {
  const master = { assetId: "master-persona", checksum: "persona-checksum", mimeType: "image/png", width: 1024, height: 1024, status: "approved" as const, sourceType: "user_upload" as const, rightsConfirmed: true };
  const contract = {
    contractVersion: "brand-model-v1", issuedAt: NOW, workspaceId: WS, personaId: trace.personaId,
    brandModelId: trace.brandModelId, displayName: "Approved fixture model", role: "primary",
    sourceUpdatedAt: NOW,
    identity: {
      locked: true, identityLockSnapshotId: trace.identityLockSnapshotId, lockVersion: 3, lockedAt: NOW,
      fingerprint: trace.identityFingerprint, policyVersion: "v1",
      identityReview: { id: randomUUID(), reviewedAt: NOW, reviewedBy: ACTOR },
      provenance: { sourceCandidateId: null, sourceCreationProjectId: null },
      referencePackage: { version: trace.referencePackageVersion, fingerprint: trace.referencePackageFingerprint },
      masterIdentityReference: master,
      approvedReferencePackage: [],
      constraints: { canonicalIdentityDescription: "same fixture person", immutableFeatures: "identity", flexibleFeatures: "pose", prohibitedChanges: "identity", approvedHairVariations: "same", approvedExpressionRange: "neutral", approvedBodyProportions: "same", approvedAgeRange: "adult", defaultStyling: "neutral" },
    },
    approvals: { brandCastApproved: true, brandCastApprovedAt: NOW, brandCastApprovedBy: ACTOR, imageUseApproved: true, imageUseApprovedAt: NOW, imageUseApprovedBy: ACTOR, videoUseApproved: false, videoUseApprovedAt: null, videoUseApprovedBy: null },
    eligibility: { identityLocked: true, validIdentityLock: true, identityReviewPassed: true, referenceRightsConfirmed: true, brandCastApproved: true, imageUseApproved: true, videoUseApproved: false, imageIdentityReady: true, videoIdentityReady: false, imageEligible: true, videoEligible: false, imageBlockingReasons: [], videoBlockingReasons: ["not approved"], lockVersion: 3, identityFingerprint: trace.identityFingerprint },
  };
  return { id: REPORT_RECORD, workspaceId: WS, content: { kind: "reports", reportId: REPORT, reportType: "image-project", generatedAt: NOW, imageSections: { schemaVersion: "3.0", projectName: "Synthetic v2 runtime", visualDirection: "clean studio", brandModelContract: contract, productionAssets: [{ id: "hero", assetType: "hero_image", outputCategory: "editorial_campaign", productName: "Zip Hoodie", collection: "Core", color: "Black", material: "Cotton", location: "Neutral studio", lighting: "Soft controlled light", photographyStyle: "Front-facing", cameraStyle: "50mm", prompt: { openai: "Legacy prompt not used for artwork.", flux: "fixture", midjourney: "fixture" }, priority: "hero", status: "pending", title: "Hero front", dimensions: "1024x1536", brandModelTrace: trace }] } as never } as unknown as BrainReportContent };
}

async function harness(options: { failCompositeOnce?: boolean } = {}) {
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
  await products.createVersion({ workspaceId: WS, actorId: ACTOR }, productProfileSchema.parse({
    schemaVersion: "product-profile-v1", productProfileId: PROFILE, workspaceId: WS,
    name: "Zip Hoodie", productType: "zip_hoodie", authority: "SHOPIFY_LIVE", shopifyProductId: PRODUCT_ID,
    variants: [{ variantId: VARIANT_ID, shopifyVariantId: VARIANT_ID, title: "Black / L", color: "Black", size: "L", available: true, active: true, updatedAt: NOW }],
    colorways: ["Black"], sizes: ["L"], collections: ["Core"], active: true, available: true,
    construction: { material: "Cotton", gsm: 420, fit: "Oversized", construction: "zip hoodie", collar: "hood", sleeves: "long", zipper: "full", pockets: ["kangaroo"], seams: [] },
    references: [{ referenceId: "product-ref", source: "SHOPIFY_MEDIA", role: "FEATURED", sourceImageId: "shopify-image-1", sourceUrl: "https://cdn.shopify.com/s/files/fixture.png", privateStoragePath: `${WS}/product-references/${REF_CHECKSUM}.png`, contentChecksumSha256: REF_CHECKSUM, width: 1000, height: 1200, altText: null, variantIds: [] }],
    printSurfaces: [{ contractVersion: "print-surface-v1", printSurfaceId: "front-center", version: 1, productProfileId: PROFILE, variantId: VARIANT_ID, region: "front_center", geometryStatus: "HUMAN_DEFINED", quad: [{ x: .35, y: .4 }, { x: .65, y: .4 }, { x: .64, y: .65 }, { x: .36, y: .65 }], boundingBox: null, orientationDegrees: 0, perspectiveAnchors: [], clippingMaskReference: null, safeMargin: { top: 0, right: 0, bottom: 0, left: 0 }, artworkScale: 1, rotationDegrees: 0, warpMode: "PERSPECTIVE", provenance: { source: "OWNER_CALIBRATION", calibratedBy: ACTOR, calibratedAt: NOW } }],
    embroideryRegions: [], provenance: { source: "Shopify read + owner calibration", capturedAt: NOW, sourceVersion: NOW }, version: 1, createdBy: ACTOR, createdAt: NOW, updatedAt: NOW,
  }));
  let projectCounter = 0;
  const deps: Partial<DeterministicRuntimeDependencies> = {
    jobs, stages, assets, products, projects, baseProvider,
    loadReport: async () => report(),
    validateBrandModel: async () => ({ displayName: "Approved fixture model", masterIdentityAssetId: "master-persona" }),
    resolveArtwork: async () => ({ artwork: artworkAuthority, bytes: artwork }),
    resolveProductContext: async () => ({ version: "product-production-context-v1", productId: PRODUCT_ID, variantId: VARIANT_ID, productName: "Zip Hoodie", productType: "zip_hoodie", color: "Black", size: "L", material: "Cotton", fit: "Oversized", collection: "Core", availability: "AVAILABLE", active: true, authority: "SHOPIFY_LIVE", authoritative: true, provenance: { source: "Shopify fixture read", sourceRecordId: VARIANT_ID, capturedAt: NOW, sourceVersion: NOW } }),
    ensureProject: async (scope, input) => {
      projectCounter += 1;
      return projects.upsertFromPreparation({ ...scope, actorId: scope.actorId! }, { contractVersion: "image-production-project-v1", workspaceId: scope.workspaceId, reportRecordId: input.reportRecordId, reportId: input.reportId, projectName: "Synthetic v2 runtime", campaignDirection: { visualDirection: "clean studio", collectionName: "Core" }, brandModel: input.brandModel, masterArtwork: { ...input.artwork, storagePath: undefined } as never, productContext: await (deps.resolveProductContext as NonNullable<typeof deps.resolveProductContext>)({ authority: "SHOPIFY_LIVE", productId: PRODUCT_ID, variantId: VARIANT_ID }), shotPlan: [{ id: "hero", assetType: "hero_image", title: "Hero front", prompt: "fixture", scene: "Neutral studio", lighting: "Soft controlled light", poseDirection: "Front-facing", dimensions: "1024x1536" }], createdBy: ACTOR });
    },
    freezeArtwork: async ({ checksum, bytes }) => { const path = `${WS}/master-artwork/${checksum}.png`; frozenArtwork.set(path, Buffer.from(bytes)); return path; },
    loadArtwork: (async ({ storagePath, expectedChecksum, mimeType }) => { const bytes = frozenArtwork.get(storagePath)!; assert.equal(createHash("sha256").update(bytes).digest("hex"), expectedChecksum); return { bytes, checksum: expectedChecksum, mimeType }; }) as DeterministicRuntimeDependencies["loadArtwork"],
    verifyProductReference: async ({ expectedChecksum }) => { assert.equal(expectedChecksum, REF_CHECKSUM); return REF_BYTES; },
    persistImageObject: async ({ path, bytes, expectedChecksum }) => { assert.equal(createHash("sha256").update(bytes).digest("hex"), expectedChecksum); const previous = objects.get(path); if (previous) assert.deepEqual(previous, bytes); else objects.set(path, Buffer.from(bytes)); },
    loadImageObject: async ({ path, expectedChecksum }) => { const bytes = objects.get(path)!; assert.equal(createHash("sha256").update(bytes).digest("hex"), expectedChecksum); return Buffer.from(bytes); },
    composite: async (...args) => { compositeCalls += 1; if (options.failCompositeOnce && compositeCalls === 1) throw new Error("synthetic composite fault"); return compositeApprovedArtwork(...args); },
    allowFakeExecution: () => true,
    inputCostMaximumUsd: "0.20",
    now: () => NOW,
    id: randomUUID,
  };
  const request = { reportRecordId: REPORT_RECORD, reportId: REPORT, assetId: "hero", brandModelTrace: trace, masterArtwork: { reference: { id: ARTWORK_ID, designId: "design-runtime", version: "V1", checksum: artworkAuthority.checksum } }, productProfile: { profileKey: PROFILE, version: 1, variantId: VARIANT_ID }, printSurface: { printSurfaceId: "front-center", version: 1 } };
  return { deps, request, jobs, stages, assets, baseProvider, objects, artwork, get compositeCalls() { return compositeCalls; }, get projectCounter() { return projectCounter; } };
}

describe("deterministic v2 no-provider runtime", () => {
  it("runs Prepare → Estimate → Confirm → fake Base → Composite → reload → human review", async () => {
    const h = await harness();
    const scope = { workspaceId: WS, actorId: ACTOR };
    const prepared = await prepareDeterministicImageJob(scope, h.request, h.deps);
    assert.equal(prepared.inputSnapshot.productionMode, "DETERMINISTIC_COMPOSITE");
    assert.equal(prepared.inputSnapshot.baseGeneration.artworkStrategy, "NO_MASTER_ARTWORK_INPUT");
    assert.equal(prepared.inputSnapshot.baseGeneration.assetCount, 1);
    assert.match(prepared.estimate.basis, /Stage A only/i);
    assert.equal(prepared.inputFingerprint, fingerprintImageGenerationInput(prepared.inputSnapshot));
    assert.equal(prepared.inputSnapshot.productVisualInput.referencePackage.references[0]!.contentChecksumSha256, REF_CHECKSUM);
    await confirmDeterministicImageJob(scope, prepared.id, prepared.inputFingerprint, h.deps);
    const executed = await executeFakeDeterministicJob(scope, prepared.id, prepared.inputFingerprint, h.deps);
    assert.equal(executed.state, "REVIEW_REQUIRED");
    assert.equal(h.baseProvider.calls, 1);
    assert.equal(executed.stages.filter((stage) => (stage as { stage?: string }).stage === "BASE_GENERATION").length, 1);
    assert.equal(executed.stages.filter((stage) => (stage as { stage?: string }).stage === "DETERMINISTIC_COMPOSITE").length, 1);
    assert.equal(executed.asset?.reviewStatus, "REVIEW_REQUIRED");
    assert.equal(executed.asset?.generationJobId, prepared.id);
    const recovered = await getDeterministicRecovery({ workspaceId: WS }, prepared.id, h.deps);
    assert.equal(recovered.state, "REVIEW_REQUIRED");
    assert.equal(recovered.asset?.mockupReview.artworkFidelityExact, "NEEDS_REVIEW");
    const approvedAsset = await reviewDeterministicAsset(scope, recovered.asset!.id, { decision: "APPROVED", checklist: { identity: "PASS", productFidelity: "PASS", artworkFidelityExact: "PASS", placement: "PASS", perspective: "PASS", lightingIntegration: "PASS" }, note: "Synthetic workflow accepted." }, h.deps);
    assert.equal(approvedAsset.reviewStatus, "APPROVED");
    assert.equal((await getDeterministicRecovery(scope, prepared.id, h.deps)).state, "APPROVED");
  });

  it("reuses the stored base when composite retry follows a Stage B failure", async () => {
    const h = await harness({ failCompositeOnce: true });
    const scope = { workspaceId: WS, actorId: ACTOR };
    const prepared = await prepareDeterministicImageJob(scope, h.request, h.deps);
    await confirmDeterministicImageJob(scope, prepared.id, prepared.inputFingerprint, h.deps);
    const failed = await executeFakeDeterministicJob(scope, prepared.id, prepared.inputFingerprint, h.deps);
    assert.equal(failed.state, "COMPOSITE_FAILED");
    assert.equal(h.baseProvider.calls, 1);
    const retried = await retryDeterministicComposite(scope, prepared.id, prepared.inputFingerprint, h.deps);
    assert.equal(retried.state, "REVIEW_REQUIRED");
    assert.equal(h.baseProvider.calls, 1, "Stage A must not be repaid or repeated");
    assert.equal(retried.stages.filter((stage) => (stage as { stage?: string }).stage === "BASE_GENERATION").length, 1);
    assert.equal(retried.stages.filter((stage) => (stage as { stage?: string }).stage === "DETERMINISTIC_COMPOSITE").length, 2);
  });

  it("fails closed for uncalibrated geometry and fingerprint changes for every critical domain", async () => {
    const h = await harness();
    const profile = await (h.deps.products as MemoryProductProfileRepository).getVersion({ workspaceId: WS }, PROFILE, 1);
    profile!.printSurfaces[0] = { ...profile!.printSurfaces[0]!, version: 2, geometryStatus: "REQUIRES_CALIBRATION", quad: null };
    await (h.deps.products as MemoryProductProfileRepository).createVersion({ workspaceId: WS, actorId: ACTOR }, { ...profile!, version: 2 });
    await assert.rejects(() => prepareDeterministicImageJob({ workspaceId: WS, actorId: ACTOR }, { ...h.request, productProfile: { ...h.request.productProfile, version: 2 }, printSurface: { ...h.request.printSurface, version: 2 } }, h.deps), /calibration/i);

    const prepared = await prepareDeterministicImageJob({ workspaceId: WS, actorId: ACTOR }, h.request, h.deps);
    const changes = [
      { ...prepared.inputSnapshot, printSurface: { ...prepared.inputSnapshot.printSurface, version: 2 } },
      { ...prepared.inputSnapshot, product: { ...prepared.inputSnapshot.product, variantId: "variant-changed" } },
      { ...prepared.inputSnapshot, productVisualInput: { ...prepared.inputSnapshot.productVisualInput, referencePackage: { ...prepared.inputSnapshot.productVisualInput.referencePackage, packageId: "changed" } } },
      { ...prepared.inputSnapshot, masterArtwork: { ...prepared.inputSnapshot.masterArtwork, checksum: "a".repeat(64) } },
      { ...prepared.inputSnapshot, brandModel: { ...prepared.inputSnapshot.brandModel, identityFingerprint: "changed" } },
    ];
    for (const changed of changes) assert.notEqual(fingerprintImageGenerationInput(changed), prepared.inputFingerprint);
  });

  it("requires explicit human checklist approval and isolates workspaces", async () => {
    const h = await harness();
    const scope = { workspaceId: WS, actorId: ACTOR };
    const prepared = await prepareDeterministicImageJob(scope, h.request, h.deps);
    assert.equal((await h.jobs.list({ workspaceId: randomUUID() })).length, 0);
    await confirmDeterministicImageJob(scope, prepared.id, prepared.inputFingerprint, h.deps);
    const recovery = await executeFakeDeterministicJob(scope, prepared.id, prepared.inputFingerprint, h.deps);
    await assert.rejects(() => reviewDeterministicAsset(scope, recovery.asset!.id, { decision: "APPROVED", checklist: { identity: "PASS", productFidelity: "PASS", artworkFidelityExact: "NEEDS_REVIEW", placement: "PASS", perspective: "PASS", lightingIntegration: "PASS" }, note: null }, h.deps), /must pass/i);
    await assert.rejects(() => getDeterministicRecovery({ workspaceId: randomUUID() }, prepared.id, h.deps), /not found/i);
  });
});
