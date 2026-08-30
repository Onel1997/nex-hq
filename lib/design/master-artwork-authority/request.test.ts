import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseApproveMasterArtworkBody } from "./request";
import {
  DESIGN_MASTER_ARTWORK_BINARY_META_HEADER,
  masterArtworkHandoffRequestSchema,
} from "./types";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function integrityMeta(bytes: Buffer) {
  return {
    expectedByteLength: bytes.length,
    expectedChecksumSha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

describe("Design Master Artwork approval request parsing", () => {
  it("parses production-sized raw binary uploads without FormData parsing", async () => {
    const bytes = Buffer.alloc(5_949_321, 0x89);
    const meta = {
      designId: "design-owner-upload",
      version: "V2",
      sourceType: "uploaded",
      sourceReportId: "report-1",
      sourceHandoffAt: "2026-08-17T10:00:00.000Z",
      placement: "center chest",
      printMethod: "screen print",
      mimeType: "image/png",
      approvalAttestation: true,
      provenance: "Design Studio v2 upload",
      displayName: "Timeless Kopie",
      originalFileName: "timeless.png",
      ...integrityMeta(bytes),
    };
    const parsed = await parseApproveMasterArtworkBody(
      new Request("http://localhost/api/design/master-artworks", {
        method: "POST",
        headers: {
          "Content-Type": "image/png",
          [DESIGN_MASTER_ARTWORK_BINARY_META_HEADER]: encodeURIComponent(
            JSON.stringify(meta),
          ),
        },
        body: bytes,
      }),
    );

    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.bytes.length, bytes.length);
    assert.equal(parsed.meta.designId, meta.designId);
    assert.equal(parsed.meta.version, meta.version);
    assert.equal(parsed.meta.originalFileName, meta.originalFileName);
  });

  it("rejects a body truncated to 10 MiB before approval", async () => {
    const complete = Buffer.alloc(13_800_000, 0x89);
    const received = complete.subarray(0, 10_485_760);
    const meta = {
      designId: "design-owner-upload",
      version: "V3",
      sourceType: "uploaded",
      sourceReportId: null,
      sourceHandoffAt: "2026-08-23T14:00:00.000Z",
      placement: null,
      printMethod: null,
      mimeType: "image/png",
      approvalAttestation: true,
      provenance: "Truncation boundary test",
      ...integrityMeta(complete),
    };
    const parsed = await parseApproveMasterArtworkBody(
      new Request("http://localhost/api/design/master-artworks", {
        method: "POST",
        headers: {
          "Content-Type": "image/png",
          [DESIGN_MASTER_ARTWORK_BINARY_META_HEADER]: encodeURIComponent(
            JSON.stringify(meta),
          ),
        },
        body: received,
      }),
    );
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.equal(parsed.code, "ARTWORK_UPLOAD_INCOMPLETE");
    assert.equal(parsed.status, 409);
    assert.deepEqual(parsed.details, {
      expectedByteLength: complete.length,
      receivedByteLength: received.length,
    });
  });

  it("configures Next above the 20 MiB raw Artwork authority limit", () => {
    const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    assert.match(config, /middlewareClientMaxBodySize:\s*21\s*\*\s*1024\s*\*\s*1024/);
  });

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
    form.append("expectedByteLength", "128");
    form.append(
      "expectedChecksumSha256",
      createHash("sha256").update(Buffer.alloc(128, 0x89)).digest("hex"),
    );

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
    const jsonBytes = Buffer.from("approved-artwork");
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
          contentBase64: jsonBytes.toString("base64"),
          approvalAttestation: true,
          provenance: "JSON fallback",
          ...integrityMeta(jsonBytes),
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

  it("accepts only a durable Artwork ID for the JSON handoff boundary", () => {
    const artworkId = "11111111-1111-4111-8111-111111111111";
    assert.deepEqual(masterArtworkHandoffRequestSchema.parse({ artworkId }), {
      artworkId,
    });
    assert.equal(
      masterArtworkHandoffRequestSchema.safeParse({
        artworkId,
        storagePath: "workspace/untrusted/path.png",
      }).success,
      false,
    );
    assert.equal(
      masterArtworkHandoffRequestSchema.safeParse({ artworkId: "not-an-id" }).success,
      false,
    );
  });
});
