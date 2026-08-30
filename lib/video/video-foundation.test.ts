import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  videoBrandModelEligibilitySchema,
  videoGenerationInputV1Schema,
  videoJobSchema,
  videoProjectSchema,
  approvedImageVideoSourceSchema,
} from "./types";
import { fingerprintVideoInput } from "./fingerprint";
import { MemoryVideoRepository } from "./memory-repository";
import { DeterministicFakeVideoProvider } from "./fake-provider";
import {
  cancelVideoJob,
  confirmVideoJob,
  executeFakeVideoJob,
  prepareVideoJob,
  recoverVideoJob,
  reviewVideoAsset,
} from "./service";
import {
  MemoryApprovedImageSourceRepository,
  assertApprovedImageLineage,
} from "./approved-image-source";
import { VIDEO_PROVIDER_CAPABILITY_MATRIX } from "./provider";
import { productProfileSchema } from "@/lib/product-library/types";
import { approvedMasterArtworkSchema } from "@/lib/design/master-artwork-authority/types";
const WS = "11111111-1111-4111-8111-111111111111",
  OTHER = "22222222-2222-4222-8222-222222222222",
  ACTOR = "owner",
  NOW = "2026-08-18T00:00:00.000Z";
const ids = {
  project: randomUUID(),
  job: randomUUID(),
  source: randomUUID(),
  imageProject: randomUUID(),
  imageJob: randomUUID(),
  art: randomUUID(),
  persona: randomUUID(),
  lock: randomUUID(),
};
const trace = {
  contractVersion: "brand-model-v1" as const,
  brandModelId: "brand-1",
  personaId: ids.persona,
  identityLockSnapshotId: ids.lock,
  identityLockVersion: 3,
  identityFingerprint: "identity-fp",
  referencePackageVersion: "v1",
  referencePackageFingerprint: "refs-fp",
};
function snapshot() {
  return videoGenerationInputV1Schema.parse({
    version: "video-generation-input-v1",
    workspaceId: WS,
    productionMode: "IMAGE_TO_VIDEO_APPROVED_ASSET",
    persona: {
      trace,
      displayName: "Model",
      eligibility: {
        personaId: ids.persona,
        brandModelId: "brand-1",
        lockVersion: 3,
        identityFingerprint: "identity-fp",
        identityLocked: true,
        videoIdentityReady: true,
        videoUseApproved: true,
        referenceRightsConfirmed: true,
        eligible: true,
        blockers: [],
      },
    },
    product: {
      version: "product-production-binding-v2",
      productProfileId: "manual:p1",
      profileVersion: 2,
      authority: "MANUAL_PROFILE",
      shopifyProductId: null,
      variantId: "manual:v1",
      productName: "Heavy Jogger",
      productType: "Jogger",
      color: "Schwarz",
      size: "M",
      material: "Cotton",
      fit: "Baggy",
      collection: null,
      availability: "UNKNOWN",
      active: null,
      provenance: { source: "fixture", capturedAt: NOW, sourceVersion: "v2" },
    },
    productVisualInput: {
      contractVersion: "product-visual-input-v1",
      productProfileId: "manual:p1",
      authority: "MANUAL_PROFILE",
      shopifyProductId: null,
      variantId: "manual:v1",
      color: "Schwarz",
      material: "Cotton",
      fit: "Baggy",
      construction: { gsm: 420, pockets: ["side"] },
      referencePackage: {
        schemaVersion: "product-reference-package-v1",
        packageId: "pkg",
        authority: "MANUAL_PROFILE",
        productProfileId: "manual:p1",
        shopifyProductId: null,
        productVersion: "v2",
        references: [
          {
            referenceId: "ref",
            source: "MANUAL_UPLOAD",
            role: "FRONT",
            sourceImageId: null,
            sourceUrl: null,
            privateStoragePath: `workspace/${WS}/product/ref.png`,
            contentChecksumSha256: "a".repeat(64),
            width: 100,
            height: 100,
            altText: null,
            variantIds: [],
          },
        ],
        capturedAt: NOW,
        provenance: "fixture",
      },
    },
    artwork: {
      artworkId: ids.art,
      designId: "design",
      version: "V1",
      checksum: "b".repeat(64),
      mimeType: "image/png",
      byteLength: 100,
      sourceType: "uploaded",
      approvalStatus: "APPROVED",
      sourceReportId: null,
      sourceHandoffAt: NOW,
      placement: null,
      printMethod: null,
      provenance: "DESIGN_STUDIO_DURABLE",
    },
    sourceVisual: {
      sourceAssetId: ids.source,
      workspaceId: WS,
      imageProductionProjectId: ids.imageProject,
      imageGenerationJobId: ids.imageJob,
      inputFingerprint: "c".repeat(64),
      checksum: "d".repeat(64),
      storagePath: `workspace/${WS}/image.png`,
      reviewStatus: "APPROVED",
      brandModel: trace,
      artwork: {
        artworkId: ids.art,
        designId: "design",
        version: "V1",
        checksum: "b".repeat(64),
      },
      product: {
        productProfileId: "manual:p1",
        profileVersion: 2,
        authority: "MANUAL_PROFILE",
        variantId: "manual:v1",
      },
      shotId: "hero",
      approvedBy: ACTOR,
      approvedAt: NOW,
      generatedAt: NOW,
    },
    direction: {
      videoType: "SOCIAL",
      movement: "SLOW_WALK",
      customMovement: null,
      camera: "TRACKING",
      customCamera: null,
      scene: "Street",
      lighting: "Soft",
      durationSeconds: 5,
      aspectRatio: "9:16",
      resolution: "adapter",
      fps: null,
      garmentVisibility: "HIGH",
      artworkVisibilityPriority: "CRITICAL",
      pacing: "DYNAMIC",
      startPose: null,
      endPose: null,
      loopPreference: false,
      platformIntent: "REELS",
      audioIntent: "NONE",
    },
    production: {
      projectId: ids.project,
      projectVersion: 1,
      shotId: "one-shot",
    },
    provider: {
      provider: "nexhq-synthetic-video-v1",
      model: "metadata-fixture-v1",
      executionMode: "FAKE",
      assetCount: 1,
      sourceStrategy: "APPROVED_IMAGE_TO_VIDEO",
      identityStrategy: "APPROVED_IMAGE_PLUS_PERSONA_TRACE",
      productStrategy: "FROZEN_PRODUCT_REFERENCES",
      artworkStrategy: "SOURCE_IMAGE_ONLY_NO_REDRAW_GUARANTEE",
    },
  });
}
function job() {
  const s = snapshot(),
    f = fingerprintVideoInput(s);
  return videoJobSchema.parse({
    id: ids.job,
    workspaceId: WS,
    projectId: ids.project,
    createdBy: ACTOR,
    inputSnapshot: s,
    inputFingerprint: f,
    estimate: {
      minimum: 0,
      maximum: 0,
      currency: "USD",
      basis: "fake",
      providerCallCount: 1,
    },
    status: "awaiting_confirmation",
    confirmationExpiresAt: "2026-08-18T00:30:00.000Z",
    confirmedBy: null,
    confirmedAt: null,
    attemptCount: 0,
    providerRequestId: null,
    resultAssetId: null,
    failureCode: null,
    failureMessage: null,
    safeRetryAllowed: false,
    unknownOutcomeReason: null,
    createdAt: NOW,
    updatedAt: NOW,
  });
}
async function seedProject(
  repo: MemoryVideoRepository,
  scope: { workspaceId: string; actorId: string },
) {
  await repo.createProject(
    scope,
    videoProjectSchema.parse({
      id: ids.project,
      workspaceId: WS,
      version: 1,
      name: "Fixture Video",
      status: "READY",
      currentSnapshot: null,
      createdBy: ACTOR,
      createdAt: NOW,
      updatedAt: NOW,
    }),
  );
}
test("Image approval never implies Video eligibility", () => {
  assert.throws(() =>
    videoBrandModelEligibilitySchema.parse({
      personaId: ids.persona,
      brandModelId: "b",
      lockVersion: 1,
      identityFingerprint: "x",
      identityLocked: true,
      videoIdentityReady: false,
      videoUseApproved: false,
      referenceRightsConfirmed: true,
      eligible: true,
      blockers: [],
    }),
  );
});
test("rejected and wrong-workspace approved sources fail closed", async () => {
  assert.equal(
    approvedImageVideoSourceSchema.safeParse({
      ...snapshot().sourceVisual,
      reviewStatus: "REJECTED",
    }).success,
    false,
  );
  const repo = new MemoryApprovedImageSourceRepository([
    snapshot().sourceVisual,
  ]);
  assert.equal(
    await repo.getApproved({ workspaceId: OTHER }, ids.source),
    null,
  );
  assert.throws(() =>
    assertApprovedImageLineage(snapshot().sourceVisual, {
      workspaceId: OTHER,
      brandModelId: "brand-1",
      identityFingerprint: "identity-fp",
      artworkId: ids.art,
      artworkChecksum: "b".repeat(64),
      productProfileId: "manual:p1",
      profileVersion: 2,
      variantId: "manual:v1",
    }),
  );
});
test("every critical authority and Video direction field changes fingerprint", () => {
  const s = snapshot(),
    base = fingerprintVideoInput(s);
  for (const patch of [
    { durationSeconds: 8 },
    { aspectRatio: "16:9" as const },
    { movement: "FULL_TURN" as const },
    { camera: "ORBIT" as const },
  ])
    assert.notEqual(
      fingerprintVideoInput(
        videoGenerationInputV1Schema.parse({
          ...s,
          direction: { ...s.direction, ...patch },
        }),
      ),
      base,
    );
  assert.notEqual(
    fingerprintVideoInput(
      videoGenerationInputV1Schema.parse({
        ...s,
        sourceVisual: { ...s.sourceVisual, sourceAssetId: randomUUID() },
      }),
    ),
    base,
  );
  assert.notEqual(
    fingerprintVideoInput(
      videoGenerationInputV1Schema.parse({
        ...s,
        product: { ...s.product, profileVersion: 3 },
        sourceVisual: {
          ...s.sourceVisual,
          product: { ...s.sourceVisual.product, profileVersion: 3 },
        },
      }),
    ),
    base,
  );
  assert.notEqual(
    fingerprintVideoInput(
      videoGenerationInputV1Schema.parse({
        ...s,
        artwork: { ...s.artwork, version: "V2" },
        sourceVisual: {
          ...s.sourceVisual,
          artwork: { ...s.sourceVisual.artwork, version: "V2" },
        },
      }),
    ),
    base,
  );
  assert.notEqual(
    fingerprintVideoInput(
      videoGenerationInputV1Schema.parse({
        ...s,
        persona: {
          ...s.persona,
          trace: { ...s.persona.trace, identityLockVersion: 4 },
        },
        sourceVisual: {
          ...s.sourceVisual,
          brandModel: { ...s.sourceVisual.brandModel, identityLockVersion: 4 },
        },
      }),
    ),
    base,
  );
});

test("provider capability matrix asserts only the repository fake", () => {
  assert.deepEqual(
    VIDEO_PROVIDER_CAPABILITY_MATRIX.map((x) => x.provider),
    ["nexhq-synthetic-video-v1"],
  );
  assert.equal(VIDEO_PROVIDER_CAPABILITY_MATRIX[0]!.verifiedFrom, "REPOSITORY");
});

test("critical input changes can cancel an unexecuted confirmation without a provider attempt", async () => {
  const repository = new MemoryVideoRepository();
  const scope = { workspaceId: WS, actorId: ACTOR };
  await seedProject(repository, scope);
  await repository.createJob(scope, job());
  const cancelled = await cancelVideoJob(scope, ids.job, {
    repository,
    now: () => "2026-08-18T00:05:00.000Z",
  });
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.attemptCount, 0);
  assert.equal(
    await repository.claim(scope, ids.job, cancelled.inputFingerprint, "2026-08-18T00:06:00.000Z"),
    null,
  );
});
test("Prepare freezes canonical Persona, Product, Artwork, source image, and one shot", async () => {
  const repository = new MemoryVideoRepository();
  const provider = new DeterministicFakeVideoProvider();
  const scope = { workspaceId: WS, actorId: ACTOR };
  const artwork = approvedMasterArtworkSchema.parse({
    contractVersion: "design-master-artwork-v1",
    id: ids.art,
    workspaceId: WS,
    designId: "design",
    version: "V1",
    checksum: "b".repeat(64),
    mimeType: "image/png",
    byteLength: 100,
    sourceType: "uploaded",
    storagePath: `workspace/${WS}/artwork.png`,
    status: "APPROVED",
    placement: null,
    printMethod: null,
    sourceReportId: null,
    sourceHandoffAt: NOW,
    provenance: {
      authority: "DESIGN_STUDIO",
      humanApproved: true,
      source: "fixture",
    },
    displayName: "Cruising Through Time",
    originalFileName: "Monkey.png",
    approvedBy: ACTOR,
    approvedAt: NOW,
    createdAt: NOW,
  });
  const profile = productProfileSchema.parse({
    schemaVersion: "product-profile-v1",
    productProfileId: "manual:p1",
    workspaceId: WS,
    version: 2,
    authority: "MANUAL_PROFILE",
    status: "SAMPLE",
    name: "Heavy Jogger",
    productType: "Jogger",
    variants: [
      {
        variantId: "manual:v1",
        title: "Schwarz / M",
        color: "Schwarz",
        size: "M",
      },
    ],
    construction: {
      primaryMaterial: "Cotton",
      gsm: 420,
      fit: "Baggy",
      pockets: ["side"],
    },
    references: [snapshot().productVisualInput.referencePackage.references[0]],
    provenance: {
      source: "fixture",
      capturedAt: NOW,
      sourceVersion: "v2",
    },
    createdBy: ACTOR,
    createdAt: NOW,
    updatedAt: NOW,
  });
  const prepared = await prepareVideoJob(
    scope,
    {
      projectName: "Fixture Video",
      brandModelTrace: trace,
      artworkId: ids.art,
      productProfileId: profile.productProfileId,
      productProfileVersion: profile.version,
      variantId: "manual:v1",
      sourceImageAssetId: ids.source,
      productionMode: "IMAGE_TO_VIDEO_APPROVED_ASSET",
      direction: snapshot().direction,
    },
    {
      repository,
      artworks: {
        get: async () => artwork,
      } as never,
      products: {
        getVersion: async () => profile,
      } as never,
      sources: new MemoryApprovedImageSourceRepository([
        snapshot().sourceVisual,
      ]),
      resolvePersona: (async () => ({
        contract: {
          contractVersion: "brand-model-v1",
          personaId: ids.persona,
          brandModelId: "brand-1",
          displayName: "Model",
          identity: {
            identityLockSnapshotId: ids.lock,
            lockVersion: 3,
            fingerprint: "identity-fp",
            referencePackage: {
              version: "v1",
              fingerprint: "refs-fp",
            },
          },
          eligibility: {
            identityLocked: true,
            videoIdentityReady: true,
            videoUseApproved: true,
            referenceRightsConfirmed: true,
            videoEligible: true,
            videoBlockingReasons: [],
          },
        },
      })) as never,
      provider,
      persist: async () => {},
      now: () => NOW,
      id: randomUUID,
    },
  );
  assert.equal(prepared.status, "awaiting_confirmation");
  assert.equal(prepared.inputSnapshot.provider.assetCount, 1);
  assert.equal(prepared.inputSnapshot.product.profileVersion, 2);
  assert.equal(prepared.inputSnapshot.artwork.checksum, "b".repeat(64));
  assert.equal(prepared.inputSnapshot.artwork.artworkId, ids.art);
  assert.equal(prepared.inputSnapshot.artwork.version, "V1");
  assert.equal(
    "displayName" in prepared.inputSnapshot.artwork,
    false,
    "historical video provenance must not bind to display name",
  );
  assert.equal(prepared.inputSnapshot.sourceVisual.sourceAssetId, ids.source);
  assert.equal(provider.calls, 0);
  assert.equal(
    (await repository.getProject(scope, prepared.projectId))?.currentSnapshot
      ?.version,
    "video-generation-input-v1",
  );
});
test("one confirmed job produces one fake Video asset, recovers, and requires human review", async () => {
  const repo = new MemoryVideoRepository(),
    scope = { workspaceId: WS, actorId: ACTOR };
  await seedProject(repo, scope);
  const j = await repo.createJob(scope, job());
  assert.equal(
    (await repo.getProject(scope, ids.project))?.currentSnapshot?.version,
    "video-generation-input-v1",
  );
  await confirmVideoJob(scope, j.id, j.inputFingerprint, {
    repository: repo,
    now: () => "2026-08-18T00:01:00.000Z",
  });
  const provider = new DeterministicFakeVideoProvider();
  const out = await executeFakeVideoJob(scope, j.id, j.inputFingerprint, {
    repository: repo,
    provider,
    persist: async () => {},
    now: () => "2026-08-18T00:02:00.000Z",
    id: randomUUID,
  });
  assert.equal(provider.calls, 1);
  assert.equal(out.asset.reviewStatus, "REVIEW_REQUIRED");
  await assert.rejects(() =>
    executeFakeVideoJob(scope, j.id, j.inputFingerprint, {
      repository: repo,
      provider,
      persist: async () => {},
      now: () => "2026-08-18T00:03:00.000Z",
      id: randomUUID,
    }),
  );
  assert.equal(provider.calls, 1);
  const recovery = await recoverVideoJob(scope, j.id, repo);
  assert.equal(recovery.asset?.id, out.asset.id);
  assert.equal((await repo.listJobs({ workspaceId: OTHER })).length, 0);
  const checks = {
    identity: true,
    product: true,
    artwork: true,
    naturalMovement: true,
    camera: true,
    productVisible: true,
    artworkVisible: true,
    noArtifacts: true,
    overallQuality: true,
  };
  const reviewed = await reviewVideoAsset(
    scope,
    out.asset.id,
    { decision: "APPROVED", checklist: checks, note: null },
    repo,
    () => "2026-08-18T00:04:00.000Z",
  );
  assert.equal(reviewed.reviewStatus, "APPROVED");
});
test("UNKNOWN_OUTCOME blocks blind retry", async () => {
  const repo = new MemoryVideoRepository(),
    scope = { workspaceId: WS, actorId: ACTOR };
  await seedProject(repo, scope);
  const j = await repo.createJob(scope, { ...job(), id: randomUUID() });
  await repo.confirm(
    scope,
    j.id,
    j.inputFingerprint,
    "2026-08-18T00:01:00.000Z",
  );
  await repo.claim(scope, j.id, j.inputFingerprint, "2026-08-18T00:02:00.000Z");
  await repo.markUnknown(scope, j.id, "ambiguous", "2026-08-18T00:03:00.000Z");
  assert.equal(
    await repo.claim(
      scope,
      j.id,
      j.inputFingerprint,
      "2026-08-18T00:04:00.000Z",
    ),
    null,
  );
});
