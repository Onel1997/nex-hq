import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildUgcVideoAssetResponse,
  resolveUgcVideoByteRange,
} from "@/lib/ugc-video-studio/result-delivery";

const asset = {
  bytes: Buffer.from(Array.from({ length: 100 }, (_, index) => index)),
  mimeType: "video/mp4",
};

test("UGC playback serves Safari-compatible byte ranges without attachment semantics", async () => {
  const response = buildUgcVideoAssetResponse({
    request: new Request("https://xeriamo.test/api/ugc-video-studio/assets/job/result", {
      headers: { Range: "bytes=10-19" },
    }),
    asset,
    resultId: "result",
    download: false,
  });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("accept-ranges"), "bytes");
  assert.equal(response.headers.get("content-range"), "bytes 10-19/100");
  assert.equal(response.headers.get("content-length"), "10");
  assert.equal(response.headers.get("content-type"), "video/mp4");
  assert.match(response.headers.get("content-disposition") ?? "", /^inline;/);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), asset.bytes.subarray(10, 20));
});

test("UGC video delivery supports suffix ranges, HEAD, invalid ranges and downloads separately", async () => {
  assert.deepEqual(resolveUgcVideoByteRange("bytes=-10", 100), {
    kind: "PARTIAL", start: 90, end: 99,
  });
  assert.deepEqual(resolveUgcVideoByteRange("bytes=150-", 100), {
    kind: "UNSATISFIABLE",
  });

  const head = buildUgcVideoAssetResponse({
    request: new Request("https://xeriamo.test/video", { method: "HEAD" }),
    asset,
    resultId: "result",
    download: false,
    head: true,
  });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("content-length"), "100");
  assert.equal((await head.arrayBuffer()).byteLength, 0);

  const invalid = buildUgcVideoAssetResponse({
    request: new Request("https://xeriamo.test/video", { headers: { Range: "bytes=150-" } }),
    asset,
    resultId: "result",
    download: false,
  });
  assert.equal(invalid.status, 416);
  assert.equal(invalid.headers.get("content-range"), "bytes */100");

  const download = buildUgcVideoAssetResponse({
    request: new Request("https://xeriamo.test/video?download=1"),
    asset,
    resultId: "result",
    download: true,
  });
  assert.equal(download.status, 200);
  assert.match(download.headers.get("content-disposition") ?? "", /^attachment;/);
});

test("the authenticated private UGC asset route exposes GET and HEAD through one authority", () => {
  const route = readFileSync("app/api/ugc-video-studio/assets/[jobId]/[resultId]/route.ts", "utf8");
  assert.match(route, /export function GET/);
  assert.match(route, /export function HEAD/);
  assert.match(route, /resolveXerianoAccess/);
  assert.match(route, /SupabaseUgcVideoJobStore/);
  assert.doesNotMatch(route, /createSignedUrl|getPublicUrl/);
});
