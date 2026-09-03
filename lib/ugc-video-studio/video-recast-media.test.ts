import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_UGC_VIDEO_ADVANCED_SETTINGS,
  DEFAULT_UGC_VIDEO_KLING_MOTION_SETTINGS,
  DEFAULT_UGC_VIDEO_RECAST_SETTINGS,
  UGC_VIDEO_STUDIO_CONTRACT_VERSION,
  ugcVideoGenerationSetupSchema,
} from "@/lib/ugc-video-studio/contracts";
import type { UgcVideoProviderReference } from "@/lib/ugc-video-studio/provider";
import type {
  UgcVideoEditMediaProcessor,
  UgcVideoInspection,
} from "@/lib/ugc-video-studio/video-edit-media";
import { prepareUgcVideoRecastMedia } from "@/lib/ugc-video-studio/video-recast-media";

function fixture(keepAudio = false) {
  const setup = ugcVideoGenerationSetupSchema.parse({
    contractVersion: UGC_VIDEO_STUDIO_CONTRACT_VERSION,
    mode: "VIDEO_RECAST",
    prompt: "Neue Fashion-Produktion in einer modernen U-Bahn-Station.",
    modelId: "kling-o3-pro-video-recast",
    duration: "7",
    aspectRatio: "AUTO",
    quality: "720p",
    bitrate: "STANDARD",
    videoType: "UGC",
    references: [
      { id: "source", name: "source.mov", mimeType: "video/quicktime", mediaType: "VIDEO", byteLength: 6, durationSeconds: 6.25, role: "MOTION", order: 0 },
      { id: "outfit", name: "outfit.png", mimeType: "image/png", mediaType: "IMAGE", byteLength: 4, durationSeconds: null, role: "OUTFIT", order: 1 },
    ],
    advanced: DEFAULT_UGC_VIDEO_ADVANCED_SETTINGS,
    klingMotion: DEFAULT_UGC_VIDEO_KLING_MOTION_SETTINGS,
    videoRecast: {
      ...DEFAULT_UGC_VIDEO_RECAST_SETTINGS,
      sourceVideoReferenceId: "source",
      characterOutfitReferenceId: "outfit",
      sourceDurationSeconds: 6.25,
      keepAudio,
    },
  });
  const references: UgcVideoProviderReference[] = setup.references.map((metadata) => ({
    metadata,
    bytes: Buffer.from(metadata.id === "source" ? "source" : "image"),
    providerUrl: `https://private.example/${metadata.id}`,
  }));
  return { setup, references };
}

function inspection(overrides: Partial<UgcVideoInspection> = {}): UgcVideoInspection {
  return {
    width: 576,
    height: 1024,
    fps: 30,
    durationSeconds: 6.25,
    byteLength: 64,
    mimeType: "video/mp4",
    hasAudio: true,
    ...overrides,
  };
}

test("VIDEO_RECAST prepares the full source after inspection without crop or selected-duration trim", async () => {
  const active = fixture(true);
  const calls: string[] = [];
  let trimDuration: number | null = null;
  let normalized: { width: number; height: number; fps: number | null; keepAudio: boolean } | null = null;
  let inspections = 0;
  const processor: UgcVideoEditMediaProcessor = {
    async inspect() {
      inspections += 1;
      calls.push("inspect");
      return inspections === 1
        ? inspection()
        : inspections === 2
          ? inspection()
          : inspection({ width: 720, height: 1280 });
    },
    async trim(input) {
      calls.push("trim");
      trimDuration = input.durationSeconds;
      assert.equal(input.keepAudio, true);
      return Buffer.from("0000ftyp-remuxed");
    },
    async normalize(input) {
      calls.push("normalize");
      normalized = { width: input.width, height: input.height, fps: input.fps, keepAudio: input.keepAudio };
      return Buffer.from("0000ftyp-normalized");
    },
  };
  const prepared = await prepareUgcVideoRecastMedia({
    ...active,
    trustedSourceDurationSeconds: 6.25,
    processor,
  });
  assert.deepEqual(calls, ["inspect", "trim", "inspect", "normalize", "inspect"]);
  assert.equal(trimDuration, 6.25);
  assert.deepEqual(normalized, { width: 720, height: 1280, fps: null, keepAudio: true });
  assert.equal(prepared.setup.videoRecast?.sourceDurationSeconds, 6.25);
  assert.equal(prepared.references[0]?.metadata.mimeType, "video/mp4");
  assert.equal(prepared.references[1]?.metadata.id, "outfit");
});

test("VIDEO_RECAST removes audio and avoids a resize when O3 input is already compatible", async () => {
  const active = fixture(false);
  let normalizeCalls = 0;
  const processor: UgcVideoEditMediaProcessor = {
    async inspect() { return inspection({ width: 1080, height: 1920, hasAudio: false }); },
    async trim(input) {
      assert.equal(input.keepAudio, false);
      return Buffer.from("0000ftyp-remuxed");
    },
    async normalize() { normalizeCalls += 1; throw new Error("must not normalize"); },
  };
  await prepareUgcVideoRecastMedia({ ...active, trustedSourceDurationSeconds: 6.25, processor });
  assert.equal(normalizeCalls, 0);
});

test("invalid or unsupported source duration fails before media/provider work", async () => {
  const active = fixture();
  let inspected = 0;
  await assert.rejects(
    prepareUgcVideoRecastMedia({
      ...active,
      trustedSourceDurationSeconds: 20,
      processor: {
        async inspect() { inspected += 1; return inspection(); },
        async trim() { throw new Error("unused"); },
        async normalize() { throw new Error("unused"); },
      },
    }),
    /zwischen 3 und 15 Sekunden/,
  );
  assert.equal(inspected, 0);
});
