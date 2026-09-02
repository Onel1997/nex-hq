import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import ffmpegPath from "ffmpeg-static";

import {
  DEFAULT_UGC_VIDEO_ADVANCED_SETTINGS,
  DEFAULT_UGC_VIDEO_EDIT_SETTINGS,
  DEFAULT_UGC_VIDEO_KLING_MOTION_SETTINGS,
  UGC_VIDEO_STUDIO_CONTRACT_VERSION,
  ugcVideoGenerationSetupSchema,
  type UgcVideoGenerationSetup,
} from "@/lib/ugc-video-studio/contracts";
import {
  KLING_O1_STANDARD_EDIT_MEDIA_PROFILE,
  KLING_O1_STANDARD_EDIT_MODEL_ID,
  KLING_O3_PRO_EDIT_MEDIA_PROFILE,
  KLING_O3_PRO_EDIT_MODEL_ID,
  SEEDANCE_2_FAST_EDIT_MEDIA_PROFILE,
  SEEDANCE_2_FAST_EDIT_MODEL_ID,
} from "@/lib/ugc-video-studio/model-registry";
import type { UgcVideoProviderReference } from "@/lib/ugc-video-studio/provider";
import {
  planUgcVideoEditNormalization,
  prepareUgcVideoEditMedia,
  ffmpegVideoEditMediaProcessor,
  type UgcVideoEditMediaProcessor,
  type UgcVideoInspection,
} from "@/lib/ugc-video-studio/video-edit-media";
import { UgcVideoEditInputError } from "@/lib/ugc-video-studio/video-edit-config";

function setup(
  modelId: string,
  options: { keepAudio?: boolean; duration?: "5" | "10" } = {},
): UgcVideoGenerationSetup {
  return ugcVideoGenerationSetupSchema.parse({
    contractVersion: UGC_VIDEO_STUDIO_CONTRACT_VERSION,
    mode: "VIDEO_EDIT",
    prompt: "",
    modelId,
    duration: options.duration ?? "5",
    aspectRatio: "AUTO",
    quality: "720p",
    bitrate: "STANDARD",
    videoType: "UGC",
    references: [
      { id: "source", name: "source.mov", mimeType: "video/quicktime", mediaType: "VIDEO", byteLength: 6, durationSeconds: 10, role: "MOTION", order: 0 },
      { id: "character", name: "character.png", mimeType: "image/png", mediaType: "IMAGE", byteLength: 4, durationSeconds: null, role: "MODEL", order: 1 },
    ],
    advanced: DEFAULT_UGC_VIDEO_ADVANCED_SETTINGS,
    klingMotion: DEFAULT_UGC_VIDEO_KLING_MOTION_SETTINGS,
    videoEdit: {
      ...DEFAULT_UGC_VIDEO_EDIT_SETTINGS,
      sourceVideoReferenceId: "source",
      characterMasterReferenceId: "character",
      keepOriginalSound: options.keepAudio ?? false,
    },
  });
}

function refs(active: UgcVideoGenerationSetup): UgcVideoProviderReference[] {
  return active.references.map((metadata) => ({
    metadata,
    bytes: metadata.id === "source" ? Buffer.from("source") : Buffer.from("face"),
    providerUrl: `https://private.example/${metadata.id}`,
  }));
}

function inspection(overrides: Partial<UgcVideoInspection> = {}): UgcVideoInspection {
  return {
    width: 576,
    height: 1024,
    fps: 24,
    durationSeconds: 5,
    byteLength: 64,
    mimeType: "video/mp4",
    hasAudio: false,
    ...overrides,
  };
}

function fakeMp4(label: string) {
  return Buffer.concat([Buffer.alloc(4), Buffer.from("ftyp"), Buffer.from(label)]);
}

test("server registry owns distinct current O3, O1 and Seedance media profiles", () => {
  assert.deepEqual(KLING_O3_PRO_EDIT_MEDIA_PROFILE, {
    dimensionPolicy: "AXIS_BOUNDS",
    minWidth: 720,
    minHeight: 720,
    maxWidth: 3840,
    maxHeight: 3840,
    minDurationSeconds: 3,
    maxDurationSeconds: 15.05,
    minFps: 24,
    maxFps: 60,
    normalizedFps: 30,
    maxBytes: 200 * 1024 * 1024,
    allowedMimeTypes: ["video/mp4", "video/quicktime"],
  });
  assert.equal(KLING_O1_STANDARD_EDIT_MEDIA_PROFILE.maxWidth, 2160);
  assert.equal(KLING_O1_STANDARD_EDIT_MEDIA_PROFILE.maxHeight, 2160);
  assert.equal(KLING_O1_STANDARD_EDIT_MEDIA_PROFILE.maxDurationSeconds, 10.05);
  assert.equal(SEEDANCE_2_FAST_EDIT_MEDIA_PROFILE.dimensionPolicy, "PIXEL_AREA_BOUNDS");
  assert.equal(SEEDANCE_2_FAST_EDIT_MEDIA_PROFILE.maxLongEdge, 1112);
  assert.equal(SEEDANCE_2_FAST_EDIT_MEDIA_PROFILE.minFps, null);
  assert.equal(SEEDANCE_2_FAST_EDIT_MEDIA_PROFILE.maxBytes, 50 * 1024 * 1024);
});

test("Kling portrait and landscape sources upscale only enough to satisfy both axes", () => {
  assert.deepEqual(
    planUgcVideoEditNormalization({ width: 576, height: 1024, fps: 24, profile: KLING_O3_PRO_EDIT_MEDIA_PROFILE }),
    { width: 720, height: 1280, fps: 24, resizeRequired: true, fpsConversionRequired: false },
  );
  assert.deepEqual(
    planUgcVideoEditNormalization({ width: 1024, height: 576, fps: 30, profile: KLING_O1_STANDARD_EDIT_MEDIA_PROFILE }),
    { width: 1280, height: 720, fps: 30, resizeRequired: true, fpsConversionRequired: false },
  );
});

test("valid Kling media is not upscaled, max bounds are proportional, and dimensions stay even", () => {
  const valid = planUgcVideoEditNormalization({ width: 1080, height: 1920, fps: 25, profile: KLING_O1_STANDARD_EDIT_MEDIA_PROFILE });
  assert.deepEqual(valid, { width: 1080, height: 1920, fps: 25, resizeRequired: false, fpsConversionRequired: false });

  const bounded = planUgcVideoEditNormalization({ width: 2000, height: 4000, fps: 30, profile: KLING_O1_STANDARD_EDIT_MEDIA_PROFILE });
  assert.equal(bounded.height, 2160);
  assert.equal(bounded.width, 1080);
  assert.equal(bounded.width % 2, 0);
  assert.equal(bounded.height % 2, 0);
  assert.ok(Math.abs(bounded.width / bounded.height - 0.5) < 0.001);
});

test("Kling FPS normalizes only outside 24–60 while Seedance preserves its own FPS", () => {
  assert.equal(planUgcVideoEditNormalization({ width: 1080, height: 1920, fps: 23, profile: KLING_O3_PRO_EDIT_MEDIA_PROFILE }).fps, 30);
  assert.equal(planUgcVideoEditNormalization({ width: 1080, height: 1920, fps: 61, profile: KLING_O3_PRO_EDIT_MEDIA_PROFILE }).fps, 30);
  assert.equal(planUgcVideoEditNormalization({ width: 1080, height: 1920, fps: 60, profile: KLING_O3_PRO_EDIT_MEDIA_PROFILE }).fpsConversionRequired, false);
  assert.equal(planUgcVideoEditNormalization({ width: 576, height: 1024, fps: 18, profile: SEEDANCE_2_FAST_EDIT_MEDIA_PROFILE }).fps, 18);
});

test("Seedance keeps an in-band portrait source and applies its own approximate resolution band", () => {
  const inBand = planUgcVideoEditNormalization({ width: 576, height: 1024, fps: 24, profile: SEEDANCE_2_FAST_EDIT_MEDIA_PROFILE });
  assert.equal(inBand.resizeRequired, false);
  const oversized = planUgcVideoEditNormalization({ width: 1080, height: 1920, fps: 24, profile: SEEDANCE_2_FAST_EDIT_MEDIA_PROFILE });
  assert.equal(oversized.resizeRequired, true);
  assert.ok(oversized.width * oversized.height <= SEEDANCE_2_FAST_EDIT_MEDIA_PROFILE.maxPixelArea);
  assert.ok(Math.max(oversized.width, oversized.height) <= SEEDANCE_2_FAST_EDIT_MEDIA_PROFILE.maxLongEdge);
  assert.ok(Math.abs(oversized.width / oversized.height - 1080 / 1920) < 0.002);
});

test("preparation orders inspect, real trim, normalize and post-inspection before provider delivery", async () => {
  const active = setup(KLING_O3_PRO_EDIT_MODEL_ID, { keepAudio: true });
  const source = Buffer.from("source");
  const trimmed = fakeMp4("trimmed");
  const normalized = fakeMp4("normalized");
  const calls: string[] = [];
  let inspectIndex = 0;
  const inspections = [
    inspection({ durationSeconds: 10, hasAudio: true }),
    inspection({ durationSeconds: 5, hasAudio: true }),
    inspection({ width: 720, height: 1280, durationSeconds: 5, hasAudio: true }),
  ];
  const processor: UgcVideoEditMediaProcessor = {
    async inspect() { calls.push(`inspect:${inspectIndex}`); return inspections[inspectIndex++]!; },
    async trim(input) { calls.push("trim"); assert.equal(input.keepAudio, true); return trimmed; },
    async normalize(input) {
      calls.push("normalize");
      assert.equal(input.width, 720);
      assert.equal(input.height, 1280);
      assert.equal(input.fps, null);
      assert.equal(input.keepAudio, true);
      return normalized;
    },
  };
  const references = refs(active);
  references[0] = { ...references[0]!, bytes: source };
  const result = await prepareUgcVideoEditMedia({ setup: active, references, trustedSourceDurationSeconds: 10, processor });
  assert.deepEqual(calls, ["inspect:0", "trim", "inspect:1", "normalize", "inspect:2"]);
  assert.equal(result.references[0]!.bytes, normalized);
  assert.equal(result.references[0]!.metadata.mimeType, "video/mp4");
  assert.equal(result.references[0]!.metadata.name, "source.mp4");
  assert.equal(result.references[0]!.providerUrl, undefined);
  assert.equal(result.references[1]!.providerUrl, "https://private.example/character");
});

test("valid media avoids an unnecessary normalization pass and removes audio when disabled", async () => {
  const active = setup(KLING_O1_STANDARD_EDIT_MODEL_ID, { keepAudio: false });
  const trimmed = fakeMp4("ready");
  let normalized = false;
  let inspectionIndex = 0;
  const processor: UgcVideoEditMediaProcessor = {
    async inspect() {
      inspectionIndex += 1;
      return inspection({ width: 1080, height: 1920, fps: 30, durationSeconds: inspectionIndex === 1 ? 10 : 5, hasAudio: inspectionIndex === 1 });
    },
    async trim(input) { assert.equal(input.keepAudio, false); return trimmed; },
    async normalize() { normalized = true; return fakeMp4("unexpected"); },
  };
  const result = await prepareUgcVideoEditMedia({ setup: active, references: refs(active), trustedSourceDurationSeconds: 10, processor });
  assert.equal(normalized, false);
  assert.equal(result.references[0]!.bytes, trimmed);
});

test("failed post-normalization preflight returns VIDEO_INPUT_UNSUPPORTED", async () => {
  const active = setup(KLING_O3_PRO_EDIT_MODEL_ID);
  let inspectionIndex = 0;
  const processor: UgcVideoEditMediaProcessor = {
    async inspect() {
      inspectionIndex += 1;
      return inspection({
        durationSeconds: inspectionIndex === 1 ? 10 : 5,
        width: 576,
        height: 1024,
      });
    },
    async trim() { return fakeMp4("trimmed"); },
    async normalize() { return fakeMp4("still-invalid"); },
  };
  await assert.rejects(
    prepareUgcVideoEditMedia({ setup: active, references: refs(active), trustedSourceDurationSeconds: 10, processor }),
    (error) => error instanceof UgcVideoEditInputError && error.code === "VIDEO_INPUT_UNSUPPORTED",
  );
});

test("Video Edit preflight remains before Customer reservation and provider submission", () => {
  const route = readFileSync("app/api/ugc-video-studio/generate/route.ts", "utf8");
  const prepareAt = route.indexOf("await prepareUgcVideoEditMedia");
  const reserveAt = route.indexOf("await reserveCustomerGeneration");
  const providerAt = route.indexOf("await generateUgcVideoJob");
  assert.ok(prepareAt >= 0 && prepareAt < reserveAt);
  assert.ok(reserveAt < providerAt);
  assert.match(route, /VIDEO_INPUT_UNSUPPORTED/);

  const motion = readFileSync("lib/ugc-video-studio/kling-motion-media.ts", "utf8");
  assert.doesNotMatch(motion, /ffmpeg|videoEditMediaProfile/);

  const nextConfig = readFileSync("next.config.ts", "utf8");
  assert.match(nextConfig, /serverExternalPackages:\s*\["ffmpeg-static"\]/);
  assert.match(nextConfig, /"\/api\/ugc-video-studio\/generate":\s*\["\.\/node_modules\/ffmpeg-static\/ffmpeg"\]/);
});

test("model switching prepares from the original private source under each selected profile", async () => {
  for (const modelId of [KLING_O3_PRO_EDIT_MODEL_ID, KLING_O1_STANDARD_EDIT_MODEL_ID, SEEDANCE_2_FAST_EDIT_MODEL_ID]) {
    const active = setup(modelId);
    const references = refs(active);
    const original = references[0]!.bytes;
    let trimInput: Buffer | null = null;
    let inspectionIndex = 0;
    const processor: UgcVideoEditMediaProcessor = {
      async inspect() {
        inspectionIndex += 1;
        const isKling = modelId !== SEEDANCE_2_FAST_EDIT_MODEL_ID;
        return inspection({
          durationSeconds: inspectionIndex === 1 ? 10 : 5,
          width: isKling && inspectionIndex === 3 ? 720 : 576,
          height: isKling && inspectionIndex === 3 ? 1280 : 1024,
        });
      },
      async trim(input) { trimInput = input.bytes; return fakeMp4("trimmed"); },
      async normalize() { return fakeMp4("normalized"); },
    };
    await prepareUgcVideoEditMedia({ setup: active, references, trustedSourceDurationSeconds: 10, processor });
    assert.equal(trimInput, original);
  }
});

test("FFmpeg authority scales without crop/stretch, normalizes FPS and honors audio policy", async () => {
  assert.ok(ffmpegPath, "the production FFmpeg binary is installed");
  const directory = mkdtempSync(path.join(tmpdir(), "xeriamo-video-edit-test-"));
  try {
    const sourcePath = path.join(directory, "source.mp4");
    const fixture = spawnSync(ffmpegPath!, [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "color=c=blue:s=576x1024:r=15:d=1.2",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=1.2",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", sourcePath,
    ]);
    assert.equal(fixture.status, 0, fixture.stderr.toString("utf8"));
    const sourceBytes = readFileSync(sourcePath);
    const trimmedWithAudio = await ffmpegVideoEditMediaProcessor.trim({
      bytes: sourceBytes,
      mimeType: "video/mp4",
      durationSeconds: 1,
      keepAudio: true,
    });
    const normalized = await ffmpegVideoEditMediaProcessor.normalize({
      bytes: trimmedWithAudio,
      width: 720,
      height: 1280,
      fps: 30,
      durationSeconds: 1,
      keepAudio: true,
    });
    const normalizedInspection = await ffmpegVideoEditMediaProcessor.inspect(normalized, "video/mp4");
    assert.equal(normalizedInspection.width, 720);
    assert.equal(normalizedInspection.height, 1280);
    assert.equal(normalizedInspection.fps, 30);
    assert.equal(normalizedInspection.hasAudio, true);
    assert.ok(Math.abs(normalizedInspection.width / normalizedInspection.height - 576 / 1024) < 0.001);

    const trimmedWithoutAudio = await ffmpegVideoEditMediaProcessor.trim({
      bytes: sourceBytes,
      mimeType: "video/mp4",
      durationSeconds: 1,
      keepAudio: false,
    });
    assert.equal(
      (await ffmpegVideoEditMediaProcessor.inspect(trimmedWithoutAudio, "video/mp4")).hasAudio,
      false,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
