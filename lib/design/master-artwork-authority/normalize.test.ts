import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapApprovedMasterArtworkRow } from "./normalize";

describe("Design Master Artwork row normalization", () => {
  it("maps PostgREST timestamptz offsets into approved artwork records", () => {
    const artwork = mapApprovedMasterArtworkRow({
      id: "11111111-1111-4111-8111-111111111111",
      workspace_id: "22222222-2222-4222-8222-222222222222",
      design_id: "design-owner-upload",
      version: "V2",
      checksum: "a".repeat(64),
      mime_type: "image/png",
      byte_length: 7_500_000,
      source_type: "uploaded",
      storage_path: "workspace/222/designs/design-owner-upload/abc.png",
      status: "APPROVED",
      placement: "center chest",
      print_method: "screen print",
      source_report_id: "report-1",
      source_handoff_at: "2026-08-17T10:00:00+00:00",
      provenance: {
        authority: "DESIGN_STUDIO",
        humanApproved: true,
        source: "test",
      },
      approved_by: "persona-local-development",
      approved_at: "2026-08-17T10:00:01+00:00",
      created_at: "2026-08-17T10:00:01+00:00",
    });

    assert.equal(artwork.byteLength, 7_500_000);
    assert.equal(artwork.sourceHandoffAt, "2026-08-17T10:00:00.000Z");
    assert.equal(artwork.approvedAt, "2026-08-17T10:00:01.000Z");
    assert.equal(artwork.createdAt, "2026-08-17T10:00:01.000Z");
  });
});
