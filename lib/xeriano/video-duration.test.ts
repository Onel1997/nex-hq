import assert from "node:assert/strict";
import test from "node:test";

import type { UgcVideoGenerationSetup } from "@/lib/ugc-video-studio/contracts";
import { prepareKlingMotionMedia } from "@/lib/ugc-video-studio/kling-motion-media";
import { prepareUgcVideoEditMedia } from "@/lib/ugc-video-studio/video-edit-media";
import {
  clipIsoBmffFromStart,
  readIsoBmffDurationSeconds,
} from "@/lib/xeriano/video-duration";

function box(type: string, payload: Buffer) {
  const result = Buffer.alloc(8 + payload.length);
  result.writeUInt32BE(result.length, 0);
  result.write(type, 4, "ascii");
  payload.copy(result, 8);
  return result;
}

function timedHeader(type: "mvhd" | "mdhd", durationSeconds: number) {
  const payload = Buffer.alloc(20);
  payload.writeUInt8(0, 0);
  payload.writeUInt32BE(1_000, 12);
  payload.writeUInt32BE(durationSeconds * 1_000, 16);
  return box(type, payload);
}

function track(durationSeconds: number) {
  const tkhd = Buffer.alloc(24);
  tkhd.writeUInt8(0, 0);
  tkhd.writeUInt32BE(durationSeconds * 1_000, 20);
  return box(
    "trak",
    Buffer.concat([box("tkhd", tkhd), box("mdia", timedHeader("mdhd", durationSeconds))]),
  );
}

function avFixture(durationSeconds: number) {
  return box(
    "moov",
    Buffer.concat([
      timedHeader("mvhd", durationSeconds),
      track(durationSeconds),
      track(durationSeconds),
    ]),
  );
}

test("server ISO-BMFF clip bounds video and audio tracks to the selected duration", () => {
  const source = avFixture(26);
  const clipped = clipIsoBmffFromStart({
    bytes: source,
    mimeType: "video/mp4",
    durationSeconds: 10,
  });
  assert.equal(readIsoBmffDurationSeconds(source), 26, "source bytes remain immutable");
  assert.equal(readIsoBmffDurationSeconds(clipped), 10);

  const text = Buffer.from(clipped).toString("latin1");
  const mdhdOffsets = [...text.matchAll(/mdhd/g)].map((match) => match.index! - 4);
  assert.equal(mdhdOffsets.length, 2, "fixture has a video and an audio track");
  for (const boxOffset of mdhdOffsets) {
    assert.equal(Buffer.from(clipped).readUInt32BE(boxOffset + 8 + 16), 10_000);
  }
});

test("provider preparation replaces the submitted motion asset with the approved clip", () => {
  const motionBytes = avFixture(26);
  const setup = {
    contractVersion: "nexhq-ugc-video-studio-v1",
    prompt: "Test",
    modelId: "kling-v3-pro-motion-control",
    duration: "10",
    aspectRatio: "9:16",
    quality: "720p",
    bitrate: "STANDARD",
    videoType: "UGC",
    references: [
      { id: "image", name: "model.png", mimeType: "image/png", mediaType: "IMAGE", byteLength: 8, durationSeconds: null, role: "MODEL", order: 0 },
      { id: "motion", name: "motion.mp4", mimeType: "video/mp4", mediaType: "VIDEO", byteLength: motionBytes.length, durationSeconds: 26, role: "MOTION", order: 1 },
    ],
    advanced: { seed: null, negativePrompt: "", generateAudio: true },
    klingMotion: { characterOrientation: "VIDEO", keepOriginalSound: true, faceBindingEnabled: false, characterImageReferenceId: null, motionVideoReferenceId: null, identityElementReferenceId: null },
  } as UgcVideoGenerationSetup;
  const prepared = prepareKlingMotionMedia({
    setup,
    references: [
      { metadata: setup.references[0]!, bytes: Buffer.alloc(8) },
      { metadata: setup.references[1]!, bytes: motionBytes },
    ],
    trustedSourceDurationSeconds: 26,
  });
  const submittedMotion = prepared.references[1]!;
  assert.notStrictEqual(submittedMotion.bytes, motionBytes);
  assert.equal(readIsoBmffDurationSeconds(submittedMotion.bytes), 10);
  assert.equal(submittedMotion.metadata.durationSeconds, 10);
  assert.equal(prepared.setup.duration, "10");
  assert.equal(prepared.setup.klingMotion.keepOriginalSound, true);
  assert.equal(prepared.setup.klingMotion.faceBindingEnabled, false);
});

test("Video Edit prepares the source-video master before provider delivery", async () => {
  const sourceBytes = avFixture(12);
  const setup = {
    contractVersion: "nexhq-ugc-video-studio-v1",
    mode: "VIDEO_EDIT",
    prompt: "",
    modelId: "kling-o3-pro-video-edit",
    duration: "5",
    aspectRatio: "AUTO",
    quality: "720p",
    bitrate: "STANDARD",
    videoType: "UGC",
    references: [
      { id: "source", name: "source.mp4", mimeType: "video/mp4", mediaType: "VIDEO", byteLength: sourceBytes.length, durationSeconds: 12, role: "MOTION", order: 0 },
      { id: "character", name: "character.png", mimeType: "image/png", mediaType: "IMAGE", byteLength: 8, durationSeconds: null, role: "MODEL", order: 1 },
    ],
    advanced: { seed: null, negativePrompt: "", generateAudio: false },
    klingMotion: { characterOrientation: "VIDEO", keepOriginalSound: false, faceBindingEnabled: false, characterImageReferenceId: null, motionVideoReferenceId: null, identityElementReferenceId: null },
    videoEdit: { sourceVideoReferenceId: "source", characterMasterReferenceId: "character", keepOriginalSound: false },
  } as UgcVideoGenerationSetup;
  const trimmedBytes = avFixture(5);
  const normalizedBytes = Buffer.concat([
    Buffer.alloc(4),
    Buffer.from("ftyp"),
    trimmedBytes,
    Buffer.from("normalized"),
  ]);
  let inspections = 0;
  const prepared = await prepareUgcVideoEditMedia({
    setup,
    references: [
      { metadata: setup.references[0]!, bytes: sourceBytes, providerUrl: "https://storage.example/original" },
      { metadata: setup.references[1]!, bytes: Buffer.alloc(8), providerUrl: "https://storage.example/character" },
    ],
    trustedSourceDurationSeconds: 12,
    processor: {
      async inspect(bytes) {
        inspections += 1;
        if (bytes === sourceBytes) return { width: 576, height: 1024, fps: 24, durationSeconds: 12, byteLength: bytes.byteLength, mimeType: "video/mp4", hasAudio: true };
        if (bytes === trimmedBytes) return { width: 576, height: 1024, fps: 24, durationSeconds: 5, byteLength: bytes.byteLength, mimeType: "video/mp4", hasAudio: false };
        return { width: 720, height: 1280, fps: 24, durationSeconds: 5, byteLength: bytes.byteLength, mimeType: "video/mp4", hasAudio: false };
      },
      async trim(input) {
        assert.equal(input.durationSeconds, 5);
        assert.equal(input.keepAudio, false);
        return trimmedBytes;
      },
      async normalize(input) {
        assert.equal(input.width, 720);
        assert.equal(input.height, 1280);
        assert.equal(input.fps, null, "valid 24 FPS is preserved");
        return normalizedBytes;
      },
    },
  });
  assert.equal(inspections, 3);
  assert.equal(prepared.references[0]!.bytes, normalizedBytes);
  assert.equal(prepared.references[0]!.metadata.durationSeconds, 5);
  assert.equal(prepared.references[0]!.providerUrl, undefined, "the provider cannot receive the untrimmed source URL");
  assert.equal(prepared.references[1]!.providerUrl, "https://storage.example/character");
});

test("server clip rejects a selection longer than the trusted source", () => {
  assert.throws(
    () =>
      clipIsoBmffFromStart({
        bytes: avFixture(8),
        mimeType: "video/mp4",
        durationSeconds: 10,
      }),
    /CUSTOMER_VIDEO_CLIP_DURATION_INVALID/,
  );
});
