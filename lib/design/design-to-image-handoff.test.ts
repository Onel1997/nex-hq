import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DesignMissionState } from "@/lib/design/design-mission-store";
import type { ArtworkValidationResult } from "@/lib/design/artwork-validation";
import type { ApprovedMasterArtworkView } from "@/lib/design/master-artwork-authority/types";
import {
  assertCanContinueToImageStudio,
  assertExactDurableArtworkIdentity,
  buildApproveMasterArtworkRequest,
  buildDesignStudioHandoffInput,
  DESIGN_TO_IMAGE_HANDOFF_ROUTE,
  DesignToImageHandoffError,
  parseDurableMasterArtworkResponse,
  resolveDurableHandoffMimeType,
  resolveHandoffVersion,
} from "./design-to-image-handoff";
import { sendDesignHandoffToImageStudio } from "@/lib/image/image-handoff-store";

function missionStub(): DesignMissionState {
  return {
    reportId: "report-1",
    reportTitle: "Quiet Ascent",
    collectionName: "Quiet Ascent",
    handoffAt: "2026-08-17T00:00:00.000Z",
    pipelineStage: "design",
    timelineStage: "design",
    versionHistory: [],
    compareMode: null,
    promptOverrides: {},
    brief: {
      designId: "design-owner-upload",
      title: "Quiet Ascent Hero",
      product: "Zip Hoodie",
      color: "Black",
      imagePrompt: "Approved hero artwork for production.",
      placement: "center chest",
      productionMethod: "screen print",
    },
    assets: {},
    designWorkspaces: {
      "design-owner-upload": {
        designId: "design-owner-upload",
        assets: {},
        promptOverrides: {},
        iterations: [
          {
            id: "iter-1",
            version: 2,
            label: "V2",
            brief: {
              designId: "design-owner-upload",
              title: "Quiet Ascent Hero",
              product: "Zip Hoodie",
              color: "Black",
              imagePrompt: "Approved hero artwork for production.",
              placement: "center chest",
              productionMethod: "screen print",
            },
            assets: {},
            promptOverrides: {},
            timestamp: "2026-08-17T00:00:00.000Z",
          },
        ],
        activeIterationId: "iter-1",
        production: [],
        health: {} as DesignMissionState["assets"],
        chat: [],
        approvalStatus: "pending",
      },
    },
  } as unknown as DesignMissionState;
}

function validValidation(): ArtworkValidationResult {
  return {
    status: "valid",
    metadata: {
      fileName: "hero.png",
      fileKind: "png",
      mimeType: "image/png",
      fileSize: 1280,
      dimensionsLabel: "2048 × 2048",
      uploadedAt: "2026-08-17T00:00:00.000Z",
      previewSupported: true,
      aspectRatioLabel: "1:1",
    },
    issues: [],
    canApprove: true,
  };
}

function durableArtwork(): ApprovedMasterArtworkView {
  return {
    contractVersion: "design-master-artwork-v1",
    id: "11111111-1111-4111-8111-111111111111",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    designId: "design-owner-upload",
    version: "V2",
    checksum: "a".repeat(64),
    mimeType: "image/png",
    byteLength: 1280,
    sourceType: "uploaded",
    status: "APPROVED",
    placement: "center chest",
    printMethod: "screen print",
    sourceReportId: "report-1",
    sourceHandoffAt: "2026-08-17T00:00:00.000Z",
    provenance: {
      authority: "DESIGN_STUDIO",
      humanApproved: true,
      source: "test",
    },
    approvedBy: "owner",
    approvedAt: "2026-08-17T00:00:00.000Z",
    createdAt: "2026-08-17T00:00:00.000Z",
  };
}

describe("Design Studio approved artwork → Image Studio handoff", () => {
  it("blocks handoff before approval", () => {
    assert.throws(
      () =>
        assertCanContinueToImageStudio({
          isApproved: false,
          hasLocalUpload: true,
          validation: validValidation(),
          mission: missionStub(),
        }),
      (error: unknown) =>
        error instanceof DesignToImageHandoffError &&
        /approve master artwork/i.test(error.message),
    );
  });

  it("blocks handoff without a local upload", () => {
    assert.throws(
      () =>
        assertCanContinueToImageStudio({
          isApproved: true,
          hasLocalUpload: false,
          validation: validValidation(),
          mission: missionStub(),
        }),
      (error: unknown) => error instanceof DesignToImageHandoffError,
    );
  });

  it("builds durable approval payload with exact design/version metadata", () => {
    const request = buildApproveMasterArtworkRequest({
      designId: "design-owner-upload",
      version: "V2",
      reportId: "report-1",
      mimeType: "image/png",
      contentBase64: Buffer.from("approved-artwork").toString("base64"),
      placement: "center chest",
      printMethod: "screen print",
    });
    assert.equal(request.designId, "design-owner-upload");
    assert.equal(request.version, "V2");
    assert.equal(request.mimeType, "image/png");
    assert.equal(request.approvalAttestation, true);
  });

  it("preserves exact durable artwork identity in the browser handoff payload", () => {
    const artwork = durableArtwork();
    const handoffInput = buildDesignStudioHandoffInput({
      mission: missionStub(),
      durableArtwork: artwork,
    });
    assert.equal(handoffInput.durableMasterArtwork?.id, artwork.id);
    assert.equal(handoffInput.durableMasterArtwork?.version, "V2");
    assert.equal(handoffInput.durableMasterArtwork?.checksum, artwork.checksum);
    assert.equal(handoffInput.designId, artwork.designId);
    assertExactDurableArtworkIdentity(artwork, artwork);
  });

  it("marks browser handoff as approved when durable authority is present", () => {
    const previousWindow = globalThis.window;
    const storage = new Map<string, string>();
    globalThis.window = {
      localStorage: {
        setItem: (key: string, value: string) => storage.set(key, value),
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
      sessionStorage: {
        setItem: (key: string, value: string) => storage.set(key, value),
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => storage.delete(key),
      },
      name: "",
    } as unknown as Window & typeof globalThis;

    try {
      const artwork = durableArtwork();
      const result = sendDesignHandoffToImageStudio(
        buildDesignStudioHandoffInput({
          mission: missionStub(),
          durableArtwork: artwork,
        }),
      );
      assert.equal(result.saved, true);
      const raw =
        storage.get("nexhq-image-studio-handoff-v2") ??
        storage.get("nexhq-image-studio-handoff") ??
        (globalThis.window.name.startsWith("nexhq-image-handoff:")
          ? globalThis.window.name.slice("nexhq-image-handoff:".length)
          : null);
      assert.ok(raw);
      const parsed = JSON.parse(raw!) as {
        durableMasterArtwork?: ApprovedMasterArtworkView;
        masterArtworkApproved?: boolean;
        masterArtworkVersion?: string;
      };
      assert.equal(parsed.masterArtworkApproved, true);
      assert.equal(parsed.durableMasterArtwork?.checksum, artwork.checksum);
      assert.equal(parsed.masterArtworkVersion, artwork.version);
    } finally {
      globalThis.window = previousWindow;
    }
  });

  it("parses durable approval API responses and surfaces failures", () => {
    const artwork = durableArtwork();
    assert.equal(parseDurableMasterArtworkResponse({ artwork }).id, artwork.id);
    assert.throws(
      () => parseDurableMasterArtworkResponse({ error: "approval failed" }),
      /approval failed/i,
    );
  });

  it("uses the canonical Image Studio route", () => {
    assert.equal(DESIGN_TO_IMAGE_HANDOFF_ROUTE, "/agents/image");
  });

  it("resolves raster handoff mime types from upload metadata", () => {
    assert.equal(resolveDurableHandoffMimeType("png", "image/png"), "image/png");
    assert.equal(resolveDurableHandoffMimeType("svg", "image/svg+xml"), "image/png");
    assert.equal(resolveDurableHandoffMimeType("pdf", "application/pdf"), null);
  });

  it("derives the mission iteration version for durable approval", () => {
    assert.equal(resolveHandoffVersion(missionStub()), "V2");
  });
});
