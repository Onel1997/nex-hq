import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import type { BrainReportContent } from "@/brain/domains/reports";
import type { BrandModelContract, BrandModelTrace } from "@/lib/persona/domain/brand-model-contract";
import { MemoryImageGenerationJobRepository } from "./memory-repository";
import { prepareImageGenerationJob, confirmImageGenerationJob, executeImageGenerationJob } from "./service";
import { checksumImageArtwork, fingerprintImageGenerationInput } from "./fingerprint";
import type { ImageGenerationInputSnapshot, PrepareImageGenerationJobRequest } from "./types";
import { ImagePaidGenerationSafetyError } from "@/lib/image/image-paid-generation-guard";
import { decodeAndValidateMasterArtwork } from "./artwork-storage";
import { generateOpenAiImage } from "@/agents/image/providers/openai-images-provider";
import { ImageProviderNotConfiguredError } from "@/agents/image/generate";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import { MemoryImageProductionProjectRepository } from "@/lib/image/production-project/memory-repository";
import { resolveProductProductionContext } from "@/lib/image/product-production-context";
import type { ApprovedMasterArtwork } from "@/lib/design/master-artwork-authority/types";

const WS = randomUUID();
const ACTOR = randomUUID();
const REPORT_RECORD = randomUUID();
const REPORT = randomUUID();
const ARTWORK_ID = randomUUID();
const artworkBytesByChecksum = new Map<string, Buffer>();
const trace: BrandModelTrace = {
  contractVersion: "brand-model-v1", brandModelId: "brand-model-test", personaId: "persona-test",
  identityLockSnapshotId: randomUUID(), identityLockVersion: 3,
  identityFingerprint: "identity-fingerprint-v3", referencePackageVersion: "package-v3",
  referencePackageFingerprint: "package-fingerprint-v3",
};

function contract(): BrandModelContract {
  const ref = { assetId: "master-asset", checksum: "master-checksum", mimeType: "image/png", width: 1024, height: 1024, status: "approved" as const, sourceType: "user_upload" as const, rightsConfirmed: true };
  return {
    contractVersion: "brand-model-v1", issuedAt: "2026-08-17T00:00:00Z", workspaceId: WS,
    personaId: trace.personaId, brandModelId: trace.brandModelId, displayName: "North African Street Premium", role: "primary", sourceUpdatedAt: "2026-08-17T00:00:00Z",
    identity: {
      locked: true, identityLockSnapshotId: trace.identityLockSnapshotId, lockVersion: 3,
      lockedAt: "2026-08-17T00:00:00Z", fingerprint: trace.identityFingerprint, policyVersion: "v1",
      identityReview: { id: randomUUID(), reviewedAt: "2026-08-17T00:00:00Z", reviewedBy: ACTOR },
      provenance: { sourceCandidateId: null, sourceCreationProjectId: null },
      referencePackage: { version: trace.referencePackageVersion, fingerprint: trace.referencePackageFingerprint },
      masterIdentityReference: ref,
      approvedReferencePackage: ["front", "three_quarter_left", "three_quarter_right", "left_profile", "right_profile"].map((slot) => ({ ...ref, assetId: `support-${slot}`, slot: slot as "front", provenance: "machine_match" as const, identitySourceConfidence: "machine_match" as const })),
      constraints: { canonicalIdentityDescription: "same person", immutableFeatures: "face", flexibleFeatures: "clothes", prohibitedChanges: "identity", approvedHairVariations: "short", approvedExpressionRange: "neutral", approvedBodyProportions: "lean", approvedAgeRange: "22-25", defaultStyling: "streetwear" },
    },
    approvals: { brandCastApproved: true, brandCastApprovedAt: "2026-08-17T00:00:00Z", brandCastApprovedBy: ACTOR, imageUseApproved: true, imageUseApprovedAt: "2026-08-17T00:00:00Z", imageUseApprovedBy: ACTOR, videoUseApproved: false, videoUseApprovedAt: null, videoUseApprovedBy: null },
    eligibility: {
      identityLocked: true, validIdentityLock: true, identityReviewPassed: true,
      referenceRightsConfirmed: true, brandCastApproved: true, imageUseApproved: true,
      videoUseApproved: false, imageIdentityReady: true, videoIdentityReady: false,
      imageEligible: true, videoEligible: false, imageBlockingReasons: [],
      videoBlockingReasons: ["Video use is not approved"], lockVersion: 3,
      identityFingerprint: trace.identityFingerprint,
    },
  };
}

const prompt = "Create a premium editorial campaign image using the exact approved garment artwork while preserving the approved person and controlled lighting.";
function report(): { id: string; workspaceId: string; content: BrainReportContent } {
  return { id: REPORT_RECORD, workspaceId: WS, content: ({
    kind: "reports", reportId: REPORT, generatedAt: "2026-08-17T00:00:00Z", reportType: "image-project",
    imageSections: {
      schemaVersion: "3.0", projectName: "Paid input test", brandModelContract: contract(),
      productionAssets: [{ id: "hero", assetType: "hero_image", outputCategory: "editorial_campaign", productName: "Zip Hoodie", collection: "Milaene", color: "Black", material: "Cotton", location: "Berlin street", lighting: "Soft controlled daylight", photographyStyle: "Full-body editorial pose", cameraStyle: "50mm", prompt: { openai: prompt, flux: prompt, midjourney: prompt }, priority: "hero", status: "pending", title: "Hero", dimensions: "1024x1536", brandModelTrace: trace }],
    } as never,
  } as unknown as BrainReportContent) };
}

function request(artwork = "approved-artwork-v1"): PrepareImageGenerationJobRequest {
  const bytes = Buffer.from(artwork);
  const checksum = checksumImageArtwork(bytes);
  artworkBytesByChecksum.set(checksum, bytes);
  return {
    reportRecordId: REPORT_RECORD, reportId: REPORT, assetId: "hero", provider: "openai", brandModelTrace: trace,
    masterArtwork: { reference: { id: ARTWORK_ID, designId: "design-1", version: "V1", checksum } },
    product: { authority: "DESIGN_HANDOFF_LOCAL", productId: null, variantId: null, productName: "Zip Hoodie", productType: "zip_hoodie", color: "Black", size: null, material: "Cotton", fit: "oversized", collection: "Milaene", availability: "UNKNOWN", active: null, provenance: "design handoff", sourceVersion: "V1", capturedAt: "2026-08-17T00:00:00.000Z" },
  };
}

const projectRepos = new WeakMap<MemoryImageGenerationJobRepository, MemoryImageProductionProjectRepository>();

function approvedArtwork(bytes: Buffer, checksum: string): ApprovedMasterArtwork {
  return {
    contractVersion: "design-master-artwork-v1", id: ARTWORK_ID, workspaceId: WS,
    designId: "design-1", version: "V1", checksum, mimeType: "image/png",
    byteLength: bytes.length, sourceType: "uploaded", storagePath: `workspace/${WS}/designs/design-1/${checksum}.png`,
    status: "APPROVED", placement: "center chest", printMethod: "screen print",
    sourceReportId: "design-report-1", sourceHandoffAt: "2026-08-17T00:00:00.000Z",
    provenance: { authority: "DESIGN_STUDIO", humanApproved: true, source: "test human approval" },
    approvedBy: ACTOR, approvedAt: "2026-08-17T00:00:00.000Z", createdAt: "2026-08-17T00:00:00.000Z",
  };
}

function baseDeps(repo: MemoryImageGenerationJobRepository) {
  let projectRepository = projectRepos.get(repo);
  if (!projectRepository) {
    projectRepository = new MemoryImageProductionProjectRepository();
    projectRepos.set(repo, projectRepository);
  }
  return {
    repository: repo, loadReport: async () => report(),
    validateBrandModel: async () => ({ masterIdentityAssetId: "master-asset", displayName: "North African Street Premium" }),
    resolveArtworkAuthority: async (_scope: unknown, reference: { checksum: string }) => {
      const bytes = artworkBytesByChecksum.get(reference.checksum) ?? Buffer.from("approved-artwork-v1");
      return { artwork: approvedArtwork(bytes, reference.checksum), bytes };
    },
    resolveProductContext: resolveProductProductionContext,
    projectRepository,
    persistProductionAsset: async () => ({}) as never,
    freezeArtwork: async ({ checksum }: { checksum: string }) => `${WS}/master-artwork/${checksum}.png`,
    inputCostMaximumUsd: "0.20", now: () => "2026-08-17T01:00:00Z", id: randomUUID,
  };
}

describe("durable paid Image generation jobs", () => {
  it("freezes exact WHO + WHAT + PRODUCT + HOW input and deterministic fingerprint", async () => {
    const repo = new MemoryImageGenerationJobRepository();
    const one = await prepareImageGenerationJob({ workspaceId: WS, actorId: ACTOR }, request(), baseDeps(repo));
    const two = await prepareImageGenerationJob({ workspaceId: WS, actorId: ACTOR }, request(), baseDeps(repo));
    assert.equal(one.id, two.id);
    assert.equal(one.inputFingerprint, fingerprintImageGenerationInput(one.inputSnapshot));
    assert.equal(one.inputSnapshot.brandModel.identityLockVersion, 3);
    assert.equal(one.inputSnapshot.masterArtwork.designId, "design-1");
    assert.equal(one.inputSnapshot.product.authority, "DESIGN_HANDOFF_LOCAL");
    assert.equal(one.inputSnapshot.production.assetId, "hero");
    assert.doesNotMatch(JSON.stringify(one.inputSnapshot), /storagePath|contentBase64|https?:/i);
  });

  it("changes fingerprint for artwork, lock, product, shot/prompt, provider/model settings", async () => {
    const repo = new MemoryImageGenerationJobRepository();
    const original = await prepareImageGenerationJob({ workspaceId: WS, actorId: ACTOR }, request(), baseDeps(repo));
    const snapshots: ImageGenerationInputSnapshot[] = [
      { ...original.inputSnapshot, masterArtwork: { ...original.inputSnapshot.masterArtwork, checksum: "a".repeat(64) } },
      { ...original.inputSnapshot, brandModel: { ...original.inputSnapshot.brandModel, identityLockVersion: 4 } },
      { ...original.inputSnapshot, product: { ...original.inputSnapshot.product, variantId: "variant-2" } },
      { ...original.inputSnapshot, production: { ...original.inputSnapshot.production, prompt: `${prompt} changed` } },
      { ...original.inputSnapshot, production: { ...original.inputSnapshot.production, model: "gpt-image-next" } },
    ];
    for (const changed of snapshots) assert.notEqual(fingerprintImageGenerationInput(changed), original.inputFingerprint);
  });

  it("requires durable confirmation and environment capability", async () => {
    const repo = new MemoryImageGenerationJobRepository();
    const job = await prepareImageGenerationJob({ workspaceId: WS, actorId: ACTOR }, request(), baseDeps(repo));
    await assert.rejects(() => executeImageGenerationJob({ workspaceId: WS, actorId: ACTOR }, job.id, job.inputFingerprint, false, { ...baseDeps(repo), assertPaidEnabled: () => { throw new ImagePaidGenerationSafetyError(); } }), ImagePaidGenerationSafetyError);
    await assert.rejects(() => executeImageGenerationJob({ workspaceId: WS, actorId: ACTOR }, job.id, job.inputFingerprint, false, { ...baseDeps(repo), assertPaidEnabled: () => {} }), /confirmation/i);
  });

  it("recovers awaiting/confirmed job state after a simulated page reload", async () => {
    const repo = new MemoryImageGenerationJobRepository();
    const prepared = await prepareImageGenerationJob(
      { workspaceId: WS, actorId: ACTOR },
      request(),
      baseDeps(repo),
    );
    assert.equal(
      (await repo.list({ workspaceId: WS }, { productionProjectId: prepared.productionProjectId }))[0].status,
      "awaiting_confirmation",
    );
    await confirmImageGenerationJob(
      { workspaceId: WS, actorId: ACTOR },
      prepared.id,
      prepared.inputFingerprint,
      baseDeps(repo),
    );
    const reopened = await repo.list(
      { workspaceId: WS },
      { productionProjectId: prepared.productionProjectId },
    );
    assert.equal(reopened[0].id, prepared.id);
    assert.equal(reopened[0].status, "confirmed");
    assert.equal((await repo.list({ workspaceId: randomUUID() })).length, 0);
  });

  it("does not confirm or claim an expired authorization", async () => {
    const repo = new MemoryImageGenerationJobRepository();
    const prepared = await prepareImageGenerationJob(
      { workspaceId: WS, actorId: ACTOR },
      request(),
      baseDeps(repo),
    );
    await assert.rejects(
      () =>
        confirmImageGenerationJob(
          { workspaceId: WS, actorId: ACTOR },
          prepared.id,
          prepared.inputFingerprint,
          { ...baseDeps(repo), now: () => "2099-01-01T00:00:00.000Z" },
        ),
      /expired/i,
    );
  });

  it("binds confirmation and permits at most one execution under duplicate requests", async () => {
    const repo = new MemoryImageGenerationJobRepository();
    const job = await prepareImageGenerationJob({ workspaceId: WS, actorId: ACTOR }, request(), baseDeps(repo));
    await confirmImageGenerationJob({ workspaceId: WS, actorId: ACTOR }, job.id, job.inputFingerprint, baseDeps(repo));
    let calls = 0;
    const executionDeps = {
      ...baseDeps(repo), assertPaidEnabled: () => {},
      resolveIdentity: async () => ({ trace: { brandModel: trace, referencePackageVersion: trace.referencePackageVersion, masterIdentityAssetId: "master-asset", masterIdentityChecksum: "master-checksum", supportingReferences: [] }, masterReference: { assetId: "master-asset", checksum: "master-checksum", mimeType: "image/png", bytes: Buffer.from("master") }, supportingReferences: [], constraints: {} }) as never,
      resolveArtwork: async () => ({ bytes: Buffer.from("approved-artwork-v1"), mimeType: "image/png", checksum: job.inputSnapshot.masterArtwork.checksum }),
      generate: async () => { calls += 1; await new Promise((r) => setTimeout(r, 5)); return { asset: { id: "hero", title: "Hero", type: "hero_image", dimensions: "1024x1536", provider: "openai" as const, status: "completed" as const, generationProvenance: { providerRequestId: "provider-1" } as never }, providerConfigured: true }; },
    };
    const [a, b] = await Promise.all([
      executeImageGenerationJob({ workspaceId: WS, actorId: ACTOR }, job.id, job.inputFingerprint, false, executionDeps as never),
      executeImageGenerationJob({ workspaceId: WS, actorId: ACTOR }, job.id, job.inputFingerprint, false, executionDeps as never),
    ]);
    assert.equal(calls, 1);
    assert.ok([a.job.status, b.job.status].includes("succeeded"));
  });

  it("keeps a server-resolved Shopify product authoritative when the Design plan label differs", async () => {
    const repo = new MemoryImageGenerationJobRepository();
    const liveProduct = {
      version: "product-production-context-v1" as const,
      productId: "gid://shopify/Product/1",
      variantId: "gid://shopify/ProductVariant/2",
      productName: "Milaene Oversized Zipper in Black",
      productType: "Zipper",
      color: "Black",
      size: "M",
      material: null,
      fit: null,
      collection: "Zippers",
      availability: "AVAILABLE" as const,
      active: true,
      authority: "SHOPIFY_LIVE" as const,
      authoritative: true,
      provenance: {
        source: "Shopify Admin GraphQL live read",
        sourceRecordId: "gid://shopify/ProductVariant/2",
        capturedAt: "2026-08-17T01:00:00.000Z",
        sourceVersion: "2026-08-17T00:00:00.000Z",
      },
    };
    const liveRequest = {
      ...request(),
      product: {
        authority: "SHOPIFY_LIVE" as const,
        productId: liveProduct.productId,
        variantId: liveProduct.variantId,
      },
    };
    const liveDeps = {
      ...baseDeps(repo),
      resolveProductContext: async () => liveProduct,
    };
    const job = await prepareImageGenerationJob(
      { workspaceId: WS, actorId: ACTOR },
      liveRequest,
      liveDeps,
    );
    assert.equal(job.inputSnapshot.product.productName, liveProduct.productName);
    await confirmImageGenerationJob(
      { workspaceId: WS, actorId: ACTOR },
      job.id,
      job.inputFingerprint,
      liveDeps,
    );
    const result = await executeImageGenerationJob(
      { workspaceId: WS, actorId: ACTOR },
      job.id,
      job.inputFingerprint,
      false,
      {
        ...liveDeps,
        assertPaidEnabled: () => {},
        resolveIdentity: async () => ({
          masterReference: {
            assetId: "master-asset",
            checksum: "master-checksum",
            mimeType: "image/png",
            bytes: Buffer.from("master"),
          },
        }) as never,
        resolveArtwork: async () => ({
          bytes: Buffer.from("approved-artwork-v1"),
          mimeType: "image/png",
          checksum: job.inputSnapshot.masterArtwork.checksum,
        }),
        generate: async () => ({
          asset: {
            id: "hero",
            title: "Hero",
            type: "hero_image",
            dimensions: "1024x1536",
            provider: "openai" as const,
            status: "completed" as const,
          },
          providerConfigured: true,
        }),
      } as never,
    );
    assert.equal(result.job.status, "succeeded");
  });

  it("records unknown provider outcome and never blindly retries", async () => {
    const repo = new MemoryImageGenerationJobRepository();
    const job = await prepareImageGenerationJob({ workspaceId: WS, actorId: ACTOR }, request(), baseDeps(repo));
    await confirmImageGenerationJob({ workspaceId: WS, actorId: ACTOR }, job.id, job.inputFingerprint, baseDeps(repo));
    const executionDeps = {
      ...baseDeps(repo), assertPaidEnabled: () => {},
      resolveIdentity: async () => ({ masterReference: { assetId: "master-asset" } }) as never,
      resolveArtwork: async () => ({ bytes: Buffer.from("approved-artwork-v1"), mimeType: "image/png", checksum: job.inputSnapshot.masterArtwork.checksum }),
      generate: async (input: { paidExecution?: { onProviderInvocation?: () => void } }) => {
        input.paidExecution?.onProviderInvocation?.();
        throw new Error("connection lost after provider acceptance");
      },
    };
    const first = await executeImageGenerationJob({ workspaceId: WS, actorId: ACTOR }, job.id, job.inputFingerprint, false, executionDeps as never);
    assert.equal(first.job.status, "unknown_outcome");
    assert.equal(first.job.reconciliationState, "required");
    await assert.rejects(() => executeImageGenerationJob({ workspaceId: WS, actorId: ACTOR }, job.id, job.inputFingerprint, true, executionDeps as never), /unknown/i);
    await assert.rejects(
      () => prepareImageGenerationJob({ workspaceId: WS, actorId: ACTOR }, request("changed-after-unknown"), baseDeps(repo)),
      /unknown/i,
    );
  });

  it("blocks stale Persona/plan truth before the atomic paid claim", async () => {
    const repo = new MemoryImageGenerationJobRepository();
    const job = await prepareImageGenerationJob({ workspaceId: WS, actorId: ACTOR }, request(), baseDeps(repo));
    await confirmImageGenerationJob({ workspaceId: WS, actorId: ACTOR }, job.id, job.inputFingerprint, baseDeps(repo));
    await assert.rejects(
      () => executeImageGenerationJob({ workspaceId: WS, actorId: ACTOR }, job.id, job.inputFingerprint, false, {
        ...baseDeps(repo), assertPaidEnabled: () => {},
        loadReport: async () => {
          const changed = report();
          const asset = changed.content.imageSections?.productionAssets?.[0] as { prompt: { openai: string } };
          asset.prompt.openai = "changed shot prompt after confirmation";
          return changed;
        },
      }),
      /changed after confirmation/i,
    );
    assert.equal((await repo.get({ workspaceId: WS }, job.id))?.status, "confirmed");

    await assert.rejects(
      () => executeImageGenerationJob({ workspaceId: WS, actorId: ACTOR }, job.id, job.inputFingerprint, false, {
        ...baseDeps(repo), assertPaidEnabled: () => {},
        resolveIdentity: async () => { throw new PersonaDomainError("stale lock", "BRAND_MODEL_VERSION_MISMATCH"); },
        resolveArtwork: async () => ({ bytes: Buffer.from("approved-artwork-v1"), mimeType: "image/png", checksum: job.inputSnapshot.masterArtwork.checksum }),
      }),
      /stale lock/i,
    );
    assert.equal((await repo.get({ workspaceId: WS }, job.id))?.attemptCount, 0);
  });

  it("allows explicit retry only for a known pre-provider failure", async () => {
    const repo = new MemoryImageGenerationJobRepository();
    const job = await prepareImageGenerationJob({ workspaceId: WS, actorId: ACTOR }, request(), baseDeps(repo));
    await confirmImageGenerationJob({ workspaceId: WS, actorId: ACTOR }, job.id, job.inputFingerprint, baseDeps(repo));
    let configured = false;
    const executionDeps = {
      ...baseDeps(repo), assertPaidEnabled: () => {},
      resolveIdentity: async () => ({ masterReference: { assetId: "master-asset" } }) as never,
      resolveArtwork: async () => ({ bytes: Buffer.from("approved-artwork-v1"), mimeType: "image/png", checksum: job.inputSnapshot.masterArtwork.checksum }),
      generate: async () => {
        if (!configured) throw new ImageProviderNotConfiguredError("openai");
        return { asset: { id: "hero", title: "Hero", type: "hero_image", dimensions: "1024x1536", provider: "openai" as const, status: "completed" as const }, providerConfigured: true };
      },
    };
    const failed = await executeImageGenerationJob({ workspaceId: WS, actorId: ACTOR }, job.id, job.inputFingerprint, false, executionDeps as never);
    assert.equal(failed.job.status, "failed");
    assert.equal(failed.job.safeRetryAllowed, true);
    configured = true;
    const succeeded = await executeImageGenerationJob({ workspaceId: WS, actorId: ACTOR }, job.id, job.inputFingerprint, true, executionDeps as never);
    assert.equal(succeeded.job.status, "succeeded");
    assert.equal(succeeded.job.attemptCount, 2);
  });

  it("fails closed across workspace and does not couple Image to Video approval", async () => {
    const repo = new MemoryImageGenerationJobRepository();
    const job = await prepareImageGenerationJob({ workspaceId: WS, actorId: ACTOR }, request(), baseDeps(repo));
    assert.equal(contract().approvals.videoUseApproved, false);
    assert.equal(job.status, "awaiting_confirmation");
    await assert.rejects(() => confirmImageGenerationJob({ workspaceId: randomUUID(), actorId: ACTOR }, job.id, job.inputFingerprint, baseDeps(repo)), /not found/i);
  });

  it("rejects browser paths/URLs and sends Persona Master first, artwork second", async () => {
    for (const injected of ["https://evil.test/signed.png", "/private/storage/master.png", "../other-workspace.png", "data:image/png;base64,AAAA"]) {
      assert.throws(() => decodeAndValidateMasterArtwork(injected, "image/png"), /URLs and storage paths/i);
    }
    let received: unknown;
    const result = await generateOpenAiImage({
      prompt, dimensions: "1024x1536", assetType: "hero_image",
      identity: {
        trace: { brandModel: trace, referencePackageVersion: trace.referencePackageVersion, masterIdentityAssetId: "master-asset", masterIdentityChecksum: "master-checksum", supportingReferences: [] },
        masterReference: { assetId: "master-asset", checksum: "master-checksum", mimeType: "image/png", bytes: Buffer.from("persona-master") },
        supportingReferences: [],
        constraints: { displayName: "North African Street Premium", canonicalIdentityDescription: "same person", immutableFeatures: "face", prohibitedChanges: "identity", approvedHairVariations: "short", approvedExpressionRange: "neutral", approvedBodyProportions: "lean", approvedAgeRange: "22-25", defaultStyling: "streetwear" },
      },
      artwork: { artworkId: "artwork-1", designId: "design-1", version: "V1", checksum: "a".repeat(64), mimeType: "image/png", bytes: Buffer.from("master-artwork"), placement: "center chest" },
      production: {
        product: {
          version: "product-production-context-v1",
          productId: null,
          variantId: null,
          productName: "Zip Hoodie",
          productType: "heavy zip hoodie",
          color: "Black",
          size: null,
          material: "heavyweight cotton",
          fit: "oversized",
          collection: "Core",
          availability: "UNKNOWN",
          active: null,
          authority: "DESIGN_HANDOFF_LOCAL",
          authoritative: false,
          provenance: { source: "test", sourceRecordId: null, capturedAt: "2026-08-17T00:00:00.000Z", sourceVersion: "V1" },
        },
        shot: { shotTitle: "Berlin hero", scene: "Berlin street", lighting: "soft daylight", poseDirection: "full body" },
      },
    }, {
      editFromMaster: async (value) => {
        received = value;
        return { prompt: value.prompt, status: "completed", providerId: "openai", imageBytes: Buffer.from("result"), providerRequestId: "request-1", path: "openai.images.edit(gpt-image-1, image=[persona-master,master-artwork], input_fidelity=high)", inputFidelity: "high" };
      },
    });
    const requestToProvider = received as { referenceImageBytes: Buffer; artworkReference?: { bytes: Buffer }; prompt: string };
    assert.equal(requestToProvider.referenceImageBytes.toString(), "persona-master");
    assert.equal(requestToProvider.artworkReference?.bytes.toString(), "master-artwork");
    assert.match(requestToProvider.prompt.replace(/\n/g, " "), /Input image 1.*WHO.*Input image 2.*WHAT THEY WEAR/);
    assert.match(requestToProvider.prompt, /Do not redesign, restyle, rewrite/i);
    assert.match(requestToProvider.prompt, /garment type: heavy zip hoodie/i);
    assert.match(requestToProvider.prompt, /Garment color: Black/i);
    assert.match(requestToProvider.prompt, /material: heavyweight cotton/i);
    assert.match(requestToProvider.prompt, /fit\/silhouette: oversized/i);
    assert.match(requestToProvider.prompt, /Scene: Berlin street/i);
    assert.equal(result.identityStrategy, "openai_master_identity_and_artwork_edit_high_fidelity");
  });
});
