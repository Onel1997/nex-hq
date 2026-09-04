import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canUseNativeMediaShare,
  mediaFileName,
  saveMediaFile,
  type MediaSaveDependencies,
} from "@/lib/xeriano/media-save";

class TestFile extends Blob {
  readonly name: string;
  readonly lastModified = 0;
  readonly webkitRelativePath = "";

  constructor(bits: BlobPart[], name: string, options?: FilePropertyBag) {
    super(bits, options);
    this.name = name;
  }
}

function appleNavigator(overrides: Record<string, unknown> = {}) {
  return {
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    platform: "iPhone",
    maxTouchPoints: 5,
    ...overrides,
  } as unknown as NonNullable<MediaSaveDependencies["navigator"]>;
}

function downloadDocument(clicks: Array<{ href: string; download: string }>) {
  return {
    body: { appendChild() {} },
    createElement(name: string) {
      assert.equal(name, "a");
      return {
        href: "",
        download: "",
        rel: "",
        style: { display: "" },
        click() { clicks.push({ href: this.href, download: this.download }); },
        remove() {},
      };
    },
  } as unknown as Document;
}

const FileAuthority = TestFile as unknown as typeof File;

test("iPhone file-share sends the fetched video with the correct MIME type and name", async () => {
  const shared: File[] = [];
  const result = await saveMediaFile({
    url: "/api/ugc-video-studio/assets/job/result?download=1",
    fileName: "Fashion Clip.mov",
    mimeType: "video/mp4",
  }, {
    navigator: appleNavigator({
      canShare: ({ files }: ShareData) => Boolean(files?.length),
      async share({ files }: ShareData) { shared.push(...(files ?? [])); },
    }),
    File: FileAuthority,
    document: null,
    fetcher: async () => new Response(new Blob(["video"], { type: "video/mp4" })),
  });

  assert.equal(result, "SHARED");
  assert.equal(shared.length, 1);
  assert.equal(shared[0]?.name, "Fashion Clip.mp4");
  assert.equal(shared[0]?.type, "video/mp4");
});

test("image and video filenames follow their actual media MIME types", () => {
  assert.equal(mediaFileName("Look.jpeg", "image/png"), "Look.png");
  assert.equal(mediaFileName("Campaign", "image/jpeg"), "Campaign.jpg");
  assert.equal(mediaFileName("Motion", "video/mp4"), "Motion.mp4");
});

test("unsupported file sharing falls back to the existing normal download", async () => {
  const clicks: Array<{ href: string; download: string }> = [];
  const result = await saveMediaFile({
    url: "/private/image",
    fileName: "Xeriamo Bild",
    mimeType: "image/png",
  }, {
    navigator: appleNavigator({ canShare: () => false, async share() {} }),
    File: FileAuthority,
    document: downloadDocument(clicks),
    fetcher: async () => new Response(new Blob(["image"], { type: "image/png" })),
    URL: { createObjectURL: () => "blob:xeriamo", revokeObjectURL() {} },
  });

  assert.equal(result, "DOWNLOADED");
  assert.deepEqual(clicks, [{ href: "blob:xeriamo", download: "Xeriamo Bild.png" }]);
});

test("a cancelled native share dialog is silent and does not force a download", async () => {
  const clicks: Array<{ href: string; download: string }> = [];
  const result = await saveMediaFile({
    url: "/private/video",
    fileName: "Video",
    mimeType: "video/mp4",
  }, {
    navigator: appleNavigator({
      canShare: () => true,
      async share() { throw { name: "AbortError" }; },
    }),
    File: FileAuthority,
    document: downloadDocument(clicks),
    fetcher: async () => new Response(new Blob(["video"], { type: "video/mp4" })),
    URL: { createObjectURL: () => "blob:must-not-download", revokeObjectURL() {} },
  });

  assert.equal(result, "CANCELLED");
  assert.deepEqual(clicks, []);
});

test("share errors other than cancellation preserve the browser download fallback", async () => {
  const clicks: Array<{ href: string; download: string }> = [];
  const result = await saveMediaFile({
    url: "/private/video",
    fileName: "Video",
    mimeType: "video/mp4",
  }, {
    navigator: appleNavigator({
      canShare: () => true,
      async share() { throw new Error("share_failed"); },
    }),
    File: FileAuthority,
    document: downloadDocument(clicks),
    fetcher: async () => new Response(new Blob(["video"], { type: "video/mp4" })),
    URL: { createObjectURL: () => "blob:fallback", revokeObjectURL() {} },
  });

  assert.equal(result, "DOWNLOADED");
  assert.deepEqual(clicks, [{ href: "blob:fallback", download: "Video.mp4" }]);
});

test("native share availability requires Apple mobile and canShare(files)", () => {
  assert.equal(canUseNativeMediaShare(appleNavigator({
    canShare: () => true,
    async share() {},
  }), FileAuthority), true);
  assert.equal(canUseNativeMediaShare({
    userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
    platform: "Linux",
    maxTouchPoints: 0,
    canShare: () => true,
    async share() {},
  }, FileAuthority), false);
});

test("all Xeriamo product result and Library downloads use the shared media-save action", () => {
  const files = [
    "components/ugc-video-studio/ugc-video-studio-workspace.tsx",
    "components/creative-studio/creative-studio-workspace.tsx",
    "components/xeriano/customer-design-studio.tsx",
    "components/xeriano/library-grid.tsx",
    "components/xeriano/creation-detail.tsx",
  ].map((file) => readFileSync(file, "utf8"));
  for (const source of files) assert.match(source, /XerianoMediaSaveLink/);
  assert.doesNotMatch(files.join("\n"), /<a[^>]+(?:downloadUrl|download=1)[^>]*>\s*<Download/);
});
