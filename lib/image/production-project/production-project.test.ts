import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import type { BrainImageSections } from "@/brain/domains/reports";
import { MemoryImageProductionProjectRepository } from "./memory-repository";
import {
  ensureImageProductionProject,
  listImageProductionAssets,
} from "./service";
import type { ApprovedMasterArtwork } from "@/lib/design/master-artwork-authority/types";
import type { ProductProductionContext } from "@/lib/image/product-production-context";

const WS = randomUUID();
const ACTOR = randomUUID();
const REPORT_RECORD = randomUUID();
const REPORT = randomUUID();
const ARTWORK = randomUUID();
const LOCK = randomUUID();

const brandModel = {
  contractVersion: "brand-model-v1" as const,
  brandModelId: "brand-model-1",
  personaId: "persona-1",
  identityLockSnapshotId: LOCK,
  identityLockVersion: 3,
  identityFingerprint: "identity-v3",
  referencePackageVersion: "package-v3",
  referencePackageFingerprint: "package-fingerprint-v3",
};

const artwork: ApprovedMasterArtwork = {
  contractVersion: "design-master-artwork-v1",
  id: ARTWORK,
  workspaceId: WS,
  designId: "design-1",
  version: "V1",
  checksum: "a".repeat(64),
  mimeType: "image/png",
  byteLength: 100,
  sourceType: "uploaded",
  storagePath: `workspace/${WS}/designs/design-1/${"a".repeat(64)}.png`,
  status: "APPROVED",
  placement: "center chest",
  printMethod: "screen print",
  sourceReportId: "design-report",
  sourceHandoffAt: "2026-08-17T00:00:00.000Z",
  provenance: {
    authority: "DESIGN_STUDIO",
    humanApproved: true,
    source: "owner upload",
  },
  approvedBy: ACTOR,
  approvedAt: "2026-08-17T00:00:00.000Z",
  createdAt: "2026-08-17T00:00:00.000Z",
};

function product(color = "Black"): ProductProductionContext {
  return {
    version: "product-production-context-v1",
    productId: null,
    variantId: null,
    productName: "Zip Hoodie",
    productType: "zip hoodie",
    color,
    size: null,
    material: "heavyweight cotton",
    fit: "oversized",
    collection: "Core",
    availability: "UNKNOWN",
    active: null,
    authority: "DESIGN_HANDOFF_LOCAL",
    authoritative: false,
    provenance: {
      source: "Design handoff",
      sourceRecordId: null,
      capturedAt: "2026-08-17T00:00:00.000Z",
      sourceVersion: "V1",
    },
  };
}

const sections = {
  schemaVersion: "3.0",
  projectName: "Milaene Campaign",
  collectionName: "Core",
  visualDirection: "Premium controlled Berlin editorial campaign",
  productionAssets: [
    {
      id: "hero",
      assetType: "hero_image",
      outputCategory: "editorial_campaign",
      productName: "Zip Hoodie",
      collection: "Core",
      color: "Black",
      material: "heavyweight cotton",
      location: "Berlin concrete architecture",
      lighting: "Soft daylight with controlled rim",
      photographyStyle: "Full-body editorial pose",
      cameraStyle: "50mm editorial framing",
      prompt: {
        openai: "Create the exact approved campaign shot with sufficient detailed direction for production.",
        flux: "Create the exact approved campaign shot with sufficient detailed direction for production.",
        midjourney: "Create the exact approved campaign shot with sufficient detailed direction for production.",
      },
      priority: "hero",
      status: "pending",
    },
  ],
} as unknown as BrainImageSections;

describe("durable Image production project and review", () => {
  it("reopens exact project truth and versions explicit critical-input changes", async () => {
    const repository = new MemoryImageProductionProjectRepository();
    const input = {
      reportRecordId: REPORT_RECORD,
      reportId: REPORT,
      sections,
      brandModel,
      artwork,
      productContext: product(),
    };
    const first = await ensureImageProductionProject(
      { workspaceId: WS, actorId: ACTOR },
      input,
      repository,
    );
    const replay = await ensureImageProductionProject(
      { workspaceId: WS, actorId: ACTOR },
      input,
      repository,
    );
    assert.equal(first.id, replay.id);
    assert.equal(replay.version, 1);
    assert.equal(replay.masterArtwork.checksum, artwork.checksum);
    assert.equal(replay.brandModel.identityLockVersion, 3);
    assert.equal((await repository.list({ workspaceId: WS }))[0].id, first.id);

    const changed = await ensureImageProductionProject(
      { workspaceId: WS, actorId: ACTOR },
      { ...input, productContext: product("Heather Grey") },
      repository,
    );
    assert.equal(changed.id, first.id);
    assert.equal(changed.version, 2);
    assert.equal(changed.productContext.color, "Heather Grey");
    assert.equal((await repository.list({ workspaceId: randomUUID() })).length, 0);
  });

  it("persists generated output as REVIEW_REQUIRED and only human review approves/rejects", async () => {
    const repository = new MemoryImageProductionProjectRepository();
    const project = await ensureImageProductionProject(
      { workspaceId: WS, actorId: ACTOR },
      {
        reportRecordId: REPORT_RECORD,
        reportId: REPORT,
        sections,
        brandModel,
        artwork,
        productContext: product(),
      },
      repository,
    );
    const generated = await repository.recordGeneratedAsset(
      { workspaceId: WS },
      {
        workspaceId: WS,
        productionProjectId: project.id,
        generationJobId: randomUUID(),
        shotId: "hero",
        inputFingerprint: "b".repeat(64),
        brandModel,
        masterArtwork: {
          id: artwork.id,
          designId: artwork.designId,
          version: artwork.version,
          checksum: artwork.checksum,
        },
        productContext: product(),
        provider: "openai",
        model: "gpt-image-1",
        providerRequestId: "request-1",
        storagePath: `workspace/${WS}/reports/${REPORT}/hero.png`,
        provenance: {} as never,
        reviewStatus: "REVIEW_REQUIRED",
        generatedAt: "2026-08-17T01:00:00.000Z",
      },
    );
    assert.equal(generated.reviewStatus, "REVIEW_REQUIRED");
    assert.equal(generated.reviewedBy, null);

    const approved = await repository.reviewAsset(
      { workspaceId: WS, actorId: ACTOR },
      generated.id,
      "APPROVED",
      "Owner approved exact mockup",
      "2026-08-17T01:10:00.000Z",
    );
    assert.equal(approved.reviewStatus, "APPROVED");
    assert.equal(approved.reviewedBy, ACTOR);

    const views = await listImageProductionAssets(
      { workspaceId: WS, actorId: ACTOR },
      project.id,
      {
        repository,
        createAccess: async () => {
          throw new Error("object missing or private access expired");
        },
      },
    );
    assert.equal(views[0].accessUrl, null);
    assert.equal(views[0].reviewStatus, "APPROVED");
  });
});
