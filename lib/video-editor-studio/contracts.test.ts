import assert from "node:assert/strict";
import test from "node:test";

import {
  VIDEO_EDITOR_CONTRACT_VERSION,
  VIDEO_EDITOR_MAX_CLIP_BYTES,
  VIDEO_EDITOR_MAX_CONCURRENT_ANALYSES,
  VIDEO_EDITOR_MAX_MUSIC_BYTES,
  VIDEO_EDITOR_MAX_OUTPUT_BYTES,
  VIDEO_EDITOR_MAX_SOURCE_DURATION_SECONDS,
  VIDEO_EDITOR_MAX_TOTAL_INPUT_BYTES,
  VIDEO_EDITOR_MAX_TOTAL_SOURCE_DURATION_SECONDS,
  videoEditorRenderRequestSchema,
} from "./contracts";

function setup() {
  return {
    contractVersion: VIDEO_EDITOR_CONTRACT_VERSION,
    jobId: "00000000-0000-4000-8000-000000000001",
    projectId: "00000000-0000-4000-8000-000000000002",
    title: "Fashion Reel",
    clips: [0, 1].map((order) => ({
      id: `00000000-0000-4000-8000-00000000000${order + 3}`,
      source: { kind: "TEMP_REFERENCE", id: `10000000-0000-4000-8000-00000000000${order + 3}` },
      title: `Clip ${order + 1}`,
      order,
      enabled: true,
      trimStartSeconds: 0,
      trimEndSeconds: 5,
      sourceDurationSeconds: 5,
    })),
    targetDurationSeconds: 15,
    aspectRatio: "9:16",
    resolution: "720x1280",
    fps: 30,
    tempo: "DYNAMIC",
    preset: "STREETWEAR_PRODUCT_REEL",
    keepOriginalAudio: false,
    music: null,
  };
}

test("render contract accepts 2-12 private video identities and defaults to silent 9:16 output", () => {
  const parsed = videoEditorRenderRequestSchema.parse(setup());
  assert.equal(parsed.clips.length, 2);
  assert.equal(parsed.keepOriginalAudio, false);
  assert.equal(parsed.aspectRatio, "9:16");
  assert.equal(parsed.resolution, "720x1280");
  assert.equal(parsed.fps, 30);
});

test("invalid trim and duplicate orders fail before a render job can start", () => {
  const invalid = setup();
  invalid.clips[1]!.order = 0;
  invalid.clips[0]!.trimEndSeconds = 8;
  assert.equal(videoEditorRenderRequestSchema.safeParse(invalid).success, false);
});

test("pilot resource limits are one shared contract authority", () => {
  assert.equal(VIDEO_EDITOR_MAX_CLIP_BYTES, 100 * 1024 * 1024);
  assert.equal(VIDEO_EDITOR_MAX_MUSIC_BYTES, 15 * 1024 * 1024);
  assert.equal(VIDEO_EDITOR_MAX_TOTAL_INPUT_BYTES, 240 * 1024 * 1024);
  assert.equal(VIDEO_EDITOR_MAX_SOURCE_DURATION_SECONDS, 60);
  assert.equal(VIDEO_EDITOR_MAX_TOTAL_SOURCE_DURATION_SECONDS, 180);
  assert.equal(VIDEO_EDITOR_MAX_OUTPUT_BYTES, 50 * 1024 * 1024);
  assert.equal(VIDEO_EDITOR_MAX_CONCURRENT_ANALYSES, 2);
});

test("browser-declared source duration over 60 seconds is rejected before service work", () => {
  const invalid = setup();
  invalid.clips[0]!.sourceDurationSeconds = 60.1;
  invalid.clips[0]!.trimEndSeconds = 5;
  assert.equal(videoEditorRenderRequestSchema.safeParse(invalid).success, false);
});
