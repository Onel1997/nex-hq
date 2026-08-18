import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseApproveMasterArtworkBody } from "./request";

describe("Design Master Artwork approval request parsing", () => {
  it("parses multipart uploads without JSON/base64 transport overhead", async () => {
    const form = new FormData();
    form.append("file", new Blob([Buffer.alloc(128, 0x89)], { type: "image/png" }), "hero.png");
    form.append("designId", "design-owner-upload");
    form.append("version", "V2");
    form.append("sourceType", "uploaded");
    form.append("sourceReportId", "report-1");
    form.append("sourceHandoffAt", "2026-08-17T10:00:00.000Z");
    form.append("placement", "center chest");
    form.append("printMethod", "screen print");
    form.append("mimeType", "image/png");
    form.append("approvalAttestation", "true");
    form.append("provenance", "Design Studio v2 upload");
    form.append("displayName", "Cruising Through Time");

    const parsed = await parseApproveMasterArtworkBody(
      new Request("http://localhost/api/design/master-artworks", {
        method: "POST",
        body: form,
      }),
    );

    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.bytes.length, 128);
    assert.equal(parsed.meta.designId, "design-owner-upload");
    assert.equal(parsed.meta.version, "V2");
    assert.equal(parsed.meta.approvalAttestation, true);
    assert.equal(parsed.meta.originalFileName, "hero.png");
    assert.equal(parsed.meta.displayName, "Cruising Through Time");
  });

  it("still accepts compact JSON payloads for small artwork", async () => {
    const parsed = await parseApproveMasterArtworkBody(
      new Request("http://localhost/api/design/master-artworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          designId: "design-owner-upload",
          version: "V1",
          sourceType: "uploaded",
          sourceReportId: "report-1",
          sourceHandoffAt: "2026-08-17T10:00:00.000Z",
          placement: "center chest",
          printMethod: "screen print",
          mimeType: "image/png",
          contentBase64: Buffer.from("approved-artwork").toString("base64"),
          approvalAttestation: true,
          provenance: "JSON fallback",
        }),
      }),
    );

    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.bytes.toString(), "approved-artwork");
  });

  it("returns typed validation errors for missing multipart files", async () => {
    const form = new FormData();
    form.append("designId", "design-owner-upload");
    form.append("version", "V2");
    form.append("sourceType", "uploaded");
    form.append("sourceHandoffAt", "2026-08-17T10:00:00.000Z");
    form.append("mimeType", "image/png");
    form.append("approvalAttestation", "true");
    form.append("provenance", "missing file");

    const parsed = await parseApproveMasterArtworkBody(
      new Request("http://localhost/api/design/master-artworks", {
        method: "POST",
        body: form,
      }),
    );

    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.equal(parsed.stage, "request_validation");
    assert.equal(parsed.status, 400);
  });
});
