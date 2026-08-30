import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ApprovedMasterArtworkView } from "@/lib/design/master-artwork-authority/types";
import type { ImageStudioHandoff } from "@/lib/image/image-handoff-store";
import {
  IMAGE_STUDIO_HANDOFF_KEY,
  IMAGE_STUDIO_HANDOFF_KEY_V2,
  normalizeImageStudioHandoff,
} from "@/lib/image/image-handoff-store";
import {
  bootstrapImageStudioHandoff,
  buildResolvedArtworkHandoff,
  extractProjectContextHandoff,
  hasRequestedArtworkPointer,
  isLegacyResearchArtworkHandoff,
  isResearchDerivedDesignId,
  resolveArtworkAuthorityHandoff,
  resolveRequestedArtworkId,
} from "@/lib/image/image-studio-handoff-bootstrap";

function durableArtwork(
  overrides: Partial<ApprovedMasterArtworkView> = {},
): ApprovedMasterArtworkView {
  return {
    contractVersion: "design-master-artwork-v1",
    id: "11111111-1111-4111-8111-111111111111",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    designId: "design-owner-upload",
    version: "V2",
    checksum: "a".repeat(64),
    mimeType: "image/png",
    byteLength: 1024,
    sourceType: "uploaded",
    status: "APPROVED",
    placement: "center chest",
    printMethod: "screen print",
    sourceReportId: "report-1",
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

function researchHandoff(): ImageStudioHandoff {
  return normalizeImageStudioHandoff({
    brief: "Premium emotional streetwear hero direction from research.",
    sourceTitle: "Design Research Report: Premium Emotional Streetwear",
    designId: "design-research-report-premium-emotional-streetwear-from-report",
    reportId: "report-research-1",
    handoffAt: "2026-01-01T00:00:00.000Z",
    mission: {
      title: "Design Research Report: Premium Emotional Streetwear",
      collection: "Premium Emotional Streetwear",
      garment: "Oversized Tee",
      colorway: "Black",
      version: "V1",
    },
    durableMasterArtwork: durableArtwork({
      designId: "design-research-report-premium-emotional-streetwear-from-report",
      version: "V1",
    }),
    masterArtworkApproved: true,
  })!;
}

function explicitDesignHandoff(): ImageStudioHandoff {
  return normalizeImageStudioHandoff({
    brief: "Approved hero artwork brief",
    sourceTitle: "Quiet Ascent Chest Graphic",
    artworkFileName: "quiet-ascent.png",
    designId: "design-owner-upload",
    handoffAt: "2026-08-18T12:00:00.000Z",
    explicitArtworkHandoff: true,
    durableMasterArtwork: durableArtwork(),
    masterArtworkApproved: true,
  })!;
}

function installBrowserStorageStub(initial?: Record<string, string>) {
  const previousWindow = globalThis.window;
  const local = new Map<string, string>(Object.entries(initial ?? {}));
  const session = new Map<string, string>();

  globalThis.window = {
    localStorage: {
      setItem: (key: string, value: string) => local.set(key, value),
      getItem: (key: string) => local.get(key) ?? null,
      removeItem: (key: string) => {
        local.delete(key);
      },
    },
    sessionStorage: {
      setItem: (key: string, value: string) => session.set(key, value),
      getItem: (key: string) => session.get(key) ?? null,
      removeItem: (key: string) => {
        session.delete(key);
      },
    },
    name: "",
  } as unknown as Window & typeof globalThis;

  return {
    local,
    session,
    restore() {
      globalThis.window = previousWindow;
    },
  };
}

describe("Image Studio handoff bootstrap artwork authority", () => {
  it("parses only an exact durable Artwork ID from the navigation URL", () => {
    const id = durableArtwork().id;
    assert.equal(resolveRequestedArtworkId(`?artworkId=${id}`), id);
    assert.equal(resolveRequestedArtworkId("?artworkId=not-an-id"), null);
    assert.equal(resolveRequestedArtworkId(""), null);
    assert.equal(hasRequestedArtworkPointer("?artworkId=not-an-id"), true);
    assert.equal(hasRequestedArtworkPointer(""), false);
  });

  it("rebuilds the exact approved Artwork handoff after a refresh", () => {
    const selected = durableArtwork();
    const refreshed = buildResolvedArtworkHandoff({
      artwork: selected,
      handoffAt: "2026-08-23T12:00:00.000Z",
    });
    assert.equal(refreshed.durableMasterArtwork?.id, selected.id);
    assert.equal(refreshed.durableMasterArtwork?.version, selected.version);
    assert.equal(refreshed.durableMasterArtwork?.checksum, selected.checksum);
    assert.equal(refreshed.explicitArtworkHandoff, true);
    assert.equal(refreshed.masterArtworkApproved, true);
  });

  it("detects research-derived design IDs", () => {
    assert.equal(
      isResearchDerivedDesignId(
        "design-research-report-premium-emotional-streetwear-from-report",
      ),
      true,
    );
    assert.equal(isResearchDerivedDesignId("design-owner-upload"), false);
  });

  it("does not preselect artwork from stale legacy Research handoff payloads", () => {
    const stale = researchHandoff();
    assert.equal(isLegacyResearchArtworkHandoff(stale), true);
    assert.equal(resolveArtworkAuthorityHandoff(stale), null);

    const bootstrapped = bootstrapImageStudioHandoff(stale);
    assert.equal(bootstrapped.artworkHandoff, null);
    assert.ok(bootstrapped.projectContextHandoff);
    assert.match(bootstrapped.artworkRejectReason ?? "", /Legacy Research|explicit/i);
    assert.equal(bootstrapped.shouldClearStorage, true);
  });

  it("loads generic Image Studio with no explicit artwork selection", () => {
    const bootstrapped = bootstrapImageStudioHandoff(null);
    assert.equal(bootstrapped.artworkHandoff, null);
    assert.equal(bootstrapped.projectContextHandoff, null);
  });

  it("selects exact artwork from an explicit current Design Studio handoff", () => {
    const explicit = explicitDesignHandoff();
    const bootstrapped = bootstrapImageStudioHandoff(explicit);
    assert.equal(
      bootstrapped.artworkHandoff?.durableMasterArtwork?.id,
      durableArtwork().id,
    );
    assert.equal(bootstrapped.artworkHandoff?.durableMasterArtwork?.version, "V2");
    assert.equal(
      bootstrapped.artworkHandoff?.durableMasterArtwork?.checksum,
      durableArtwork().checksum,
    );
    assert.equal(bootstrapped.artworkHandoff?.artworkFileName, "quiet-ascent.png");
    assert.equal(bootstrapped.artworkRejectReason, undefined);
  });

  it("removes legacy optional mission placeholders without affecting Artwork authority", () => {
    const normalized = normalizeImageStudioHandoff({
      ...explicitDesignHandoff(),
      mission: {
        title: "Quiet Ascent",
        collection: "—",
        garment: "—",
        colorway: "—",
        version: "V1",
      },
    });
    assert.ok(normalized);
    assert.equal(normalized?.mission?.collection, "");
    assert.equal(normalized?.mission?.garment, "");
    assert.equal(normalized?.mission?.colorway, "");
    assert.equal(
      resolveArtworkAuthorityHandoff(normalized)?.durableMasterArtwork?.id,
      durableArtwork().id,
    );
  });

  it("keeps Research provenance available but non-authoritative", () => {
    const stale = researchHandoff();
    const context = extractProjectContextHandoff(stale);
    assert.ok(context);
    assert.equal(context?.durableMasterArtwork, undefined);
    assert.equal(context?.masterArtworkApproved, undefined);
    assert.equal(context?.reportId, "report-research-1");
    assert.match(context?.sourceTitle ?? "", /Research Report/i);
  });

  it("prefers explicit sessionStorage artwork handoff over stale localStorage research payload", () => {
    const browser = installBrowserStorageStub({
      [IMAGE_STUDIO_HANDOFF_KEY]: JSON.stringify(researchHandoff()),
    });
    browser.session.set(
      IMAGE_STUDIO_HANDOFF_KEY_V2,
      JSON.stringify(explicitDesignHandoff()),
    );

    try {
      const bootstrapped = bootstrapImageStudioHandoff(null);
      assert.equal(
        bootstrapped.artworkHandoff?.durableMasterArtwork?.designId,
        "design-owner-upload",
      );
      assert.equal(bootstrapped.artworkSource, "sessionStorage");
    } finally {
      browser.restore();
    }
  });

  it("does not treat localStorage-only legacy durable artwork as current authority", () => {
    const browser = installBrowserStorageStub({
      [IMAGE_STUDIO_HANDOFF_KEY_V2]: JSON.stringify(researchHandoff()),
    });

    try {
      const bootstrapped = bootstrapImageStudioHandoff(null);
      assert.equal(bootstrapped.artworkHandoff, null);
      assert.ok(bootstrapped.projectContextHandoff);
    } finally {
      browser.restore();
    }
  });

  it("allows explicit Design Studio handoff for research-origin design IDs", () => {
    const explicit = explicitDesignHandoff();
    explicit.durableMasterArtwork = durableArtwork({
      designId: "design-research-report-premium-emotional-streetwear-from-report",
      version: "V1",
    });
    explicit.designId = explicit.durableMasterArtwork.designId;
    assert.equal(resolveArtworkAuthorityHandoff(explicit)?.durableMasterArtwork?.designId, explicit.designId);
  });
});
