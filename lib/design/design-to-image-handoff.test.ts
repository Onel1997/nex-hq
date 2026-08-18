import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DesignMissionState } from "@/lib/design/design-mission-store";
import type { ArtworkValidationResult } from "@/lib/design/artwork-validation";
import type { ApprovedMasterArtworkView } from "@/lib/design/master-artwork-authority/types";
import {
  assertCanContinueToImageStudio,
  assertExactDurableArtworkIdentity,
  assertHandoffSafeForBrowserPersistence,
  buildApproveMasterArtworkRequest,
  buildDesignStudioHandoffInput,
  DESIGN_IMAGE_HANDOFF_MAX_SERIALIZED_BYTES,
  DESIGN_TO_IMAGE_HANDOFF_ROUTE,
  DesignToImageHandoffError,
  measureHandoffSerializedBytes,
  parseDurableMasterArtworkResponse,
  resolveDurableHandoffMimeType,
  resolveHandoffVersion,
  stripHandoffTransportPayload,
} from "./design-to-image-handoff";
import {
  buildImageStudioHandoff,
  loadImageStudioHandoffWithDebug,
  normalizeImageStudioHandoff,
  sendDesignHandoffToImageStudio,
} from "@/lib/image/image-handoff-store";

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
    byteLength: 7_500_000,
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

function largePngDataUrl(byteLength = 7_500_000): string {
  const base64 = Buffer.alloc(byteLength, 0x41).toString("base64");
  return `data:image/png;base64,${base64}`;
}

function installBrowserStorageStub() {
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

  return {
    storage,
    restore() {
      globalThis.window = previousWindow;
    },
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
        /Master Artwork frei/i.test(error.message),
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
    const browser = installBrowserStorageStub();
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
        browser.storage.get("nexhq-image-studio-handoff-v2") ??
        browser.storage.get("nexhq-image-studio-handoff") ??
        (globalThis.window.name.startsWith("nexhq-image-handoff:")
          ? globalThis.window.name.slice("nexhq-image-handoff:".length)
          : null);
      assert.ok(raw);
      const parsed = JSON.parse(raw!) as {
        durableMasterArtwork?: ApprovedMasterArtworkView;
        masterArtworkApproved?: boolean;
        masterArtworkVersion?: string;
        masterArtworkApprovedArtworkUrl?: string;
      };
      assert.equal(parsed.masterArtworkApproved, true);
      assert.equal(parsed.durableMasterArtwork?.checksum, artwork.checksum);
      assert.equal(parsed.masterArtworkVersion, artwork.version);
      assert.equal(parsed.masterArtworkApprovedArtworkUrl, undefined);
      assert.doesNotMatch(raw!, /data:image\/[a-zA-Z0-9.+-]+;base64,/i);
      assert.ok(raw!.length < DESIGN_IMAGE_HANDOFF_MAX_SERIALIZED_BYTES);
      const loaded = loadImageStudioHandoffWithDebug();
      assert.equal(loaded.debug.parsed, true);
      assert.equal(loaded.handoff?.durableMasterArtwork?.id, artwork.id);
    } finally {
      browser.restore();
    }
  });

  it("does not serialize large PNG data URLs into durable browser handoff payloads", () => {
    const artwork = durableArtwork();
    const oversizedUrl = largePngDataUrl();
    const mission = missionStub();

    const corruptedHandoff = buildImageStudioHandoff({
      brief: mission.brief.imagePrompt,
      sourceTitle: mission.brief.title,
      designId: mission.brief.designId,
      reportId: mission.reportId,
      assets: mission.assets,
      collectionName: mission.collectionName,
      productName: mission.brief.product,
      colorName: mission.brief.color,
    });

    corruptedHandoff.masterArtworkApprovedArtworkUrl = oversizedUrl;
    corruptedHandoff.masterArtworkArtworkUrl = oversizedUrl;
    corruptedHandoff.masterArtworkProductionPngUrl = oversizedUrl;

    assert.ok(measureHandoffSerializedBytes(corruptedHandoff) > 8_000_000);

    const slim = stripHandoffTransportPayload({
      ...corruptedHandoff,
      durableMasterArtwork: artwork,
      masterArtworkApproved: true,
    });
    assertHandoffSafeForBrowserPersistence(slim);
    assert.ok(measureHandoffSerializedBytes(slim) < DESIGN_IMAGE_HANDOFF_MAX_SERIALIZED_BYTES);
    assert.equal(slim.durableMasterArtwork?.checksum, artwork.checksum);
    assert.equal(slim.masterArtworkApprovedArtworkUrl, undefined);
    assert.equal(slim.masterArtworkArtworkUrl, undefined);
    JSON.parse(JSON.stringify(slim));
  });

  it("preserves small non-durable handoff URLs when no durable artwork authority exists", () => {
    const mission = missionStub();
    const handoff = buildImageStudioHandoff({
      brief: mission.brief.imagePrompt,
      sourceTitle: mission.brief.title,
      designId: mission.brief.designId,
      reportId: mission.reportId,
      assets: {
        masterArtwork: {
          status: "approved",
          version: "V1",
          sourceType: "ai-designer-artwork",
          approvedArtworkUrl: "https://cdn.example.com/hero.png",
        },
      },
      collectionName: mission.collectionName,
      productName: mission.brief.product,
      colorName: mission.brief.color,
    });

    const slim = stripHandoffTransportPayload(handoff);
    assert.equal(slim.masterArtworkApprovedArtworkUrl, "https://cdn.example.com/hero.png");
    assertHandoffSafeForBrowserPersistence(slim);
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

  it("restores design identity from durable artwork after reload normalization", () => {
    const artwork = durableArtwork();
    const normalized = normalizeImageStudioHandoff({
      brief: "Approved hero artwork brief",
      handoffAt: "2026-08-17T00:00:00.000Z",
      durableMasterArtwork: artwork,
    });
    assert.ok(normalized);
    assert.equal(normalized?.designId, artwork.designId);
    assert.equal(normalized?.masterArtworkApproved, true);
    assert.equal(normalized?.durableMasterArtwork?.id, artwork.id);
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
