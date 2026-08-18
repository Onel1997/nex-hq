import assert from "node:assert/strict";
import test from "node:test";

import { toArtworkLibraryEntry } from "@/lib/design/artwork-library/types";

const approvedArtwork = {
  id: "11111111-1111-4111-8111-111111111111",
  workspaceId: "22222222-2222-4222-8222-222222222222",
  designId: "design-one",
  contractVersion: "design-master-artwork-v1" as const,
  version: "V1",
  checksum: "a".repeat(64),
  mimeType: "image/png" as const,
  byteLength: 42,
  sourceType: "uploaded" as const,
  storagePath: "workspace/design/v1/artwork.png",
  status: "APPROVED" as const,
  placement: "front_center",
  printMethod: "screen print / DTG",
  sourceReportId: null,
  sourceHandoffAt: "2026-08-17T12:00:00.000Z",
  provenance: {
    authority: "DESIGN_STUDIO" as const,
    humanApproved: true as const,
    source: "owner upload",
  },
  approvedBy: "33333333-3333-4333-8333-333333333333",
  createdAt: "2026-08-17T12:00:00.000Z",
  approvedAt: "2026-08-17T12:00:00.000Z",
  displayName: "Cruising Through Time",
  originalFileName: "Monkey.png",
};

test("approved artwork becomes reusable library truth without a Product", () => {
  const entry = toArtworkLibraryEntry(approvedArtwork, {
    width: 100,
    height: 80,
    transparency: "HAS_ALPHA",
  });

  assert.equal(entry.artworkId, approvedArtwork.id);
  assert.equal(entry.displayName, "Cruising Through Time");
  assert.equal(entry.originalFileName, "Monkey.png");
  assert.equal("product" in entry, false);
  assert.equal("shopifyProductId" in entry, false);
  assert.deepEqual(entry.representations[0]?.width, 100);
});

test("one artwork identity can be selected independently for multiple products", () => {
  const entry = toArtworkLibraryEntry(approvedArtwork);
  const selections = [
    { artworkId: entry.artworkId, productProfileId: "product-a" },
    { artworkId: entry.artworkId, productProfileId: "product-b" },
  ];

  assert.equal(selections[0]?.artworkId, selections[1]?.artworkId);
  assert.notEqual(selections[0]?.productProfileId, selections[1]?.productProfileId);
});
