import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DEFAULT_UGC_VIDEO_ADVANCED_SETTINGS,
  DEFAULT_UGC_VIDEO_EDIT_SETTINGS,
  DEFAULT_UGC_VIDEO_KLING_MOTION_SETTINGS,
  UGC_VIDEO_STUDIO_CONTRACT_VERSION,
  ugcVideoGenerationSetupSchema,
  type UgcBaseVideoResolution,
  type UgcBaseVideoVariant,
  type UgcVideoGenerationSetup,
} from "@/lib/ugc-video-studio/contracts";
import {
  HAILUO_23_FAST_I2V_ENDPOINT,
  HAILUO_23_STANDARD_T2V_ENDPOINT,
  KLING_25_TURBO_PRO_I2V_ENDPOINT,
  KLING_25_TURBO_PRO_T2V_ENDPOINT,
  PIXVERSE_C1_I2V_ENDPOINT,
  PIXVERSE_C1_T2V_ENDPOINT,
  SEEDANCE_2_FAST_I2V_ENDPOINT,
  SEEDANCE_2_FAST_T2V_ENDPOINT,
  WAN_22_A14B_I2V_ENDPOINT,
  WAN_22_A14B_T2V_ENDPOINT,
  UgcBaseVideoInputError,
  assertUgcBaseVideoSetup,
  estimateUgcBaseVideoCostUsd,
  wanBaseVideoFramePreset,
} from "@/lib/ugc-video-studio/base-video-config";
import {
  HAILUO_23_FAST_BASE_MODEL_ID,
  HAILUO_23_STANDARD_BASE_MODEL_ID,
  KLING_25_TURBO_PRO_BASE_MODEL_ID,
  PIXVERSE_C1_BASE_MODEL_ID,
  SEEDANCE_2_FAST_BASE_MODEL_ID,
  WAN_22_A14B_BASE_MODEL_ID,
} from "@/lib/ugc-video-studio/base-video-models";
import type { UgcVideoProvider } from "@/lib/ugc-video-studio/provider";
import {
  assertBaseVideoFalQueueUrl,
  buildFalBaseVideoInput,
  extractFalBaseVideoQueueSubmission,
  FalBaseVideoProvider,
  type FalBaseVideoTransport,
} from "@/lib/ugc-video-studio/providers/fal-base-video";
import {
  generateUgcVideoJob,
  UgcVideoGenerationError,
} from "@/lib/ugc-video-studio/generation-service";
import type { UgcVideoJobManifest } from "@/lib/ugc-video-studio/server-contracts";
import {
  UGC_VIDEO_RESULT_MAX_BYTES,
  type UgcVideoJobStore,
} from "@/lib/ugc-video-studio/server-storage";
import { getUgcVideoProviderPublicConfig } from "@/lib/ugc-video-studio/provider-config";

function setup(input: {
  modelId: string;
  variant: UgcBaseVideoVariant;
  duration: UgcVideoGenerationSetup["duration"];
  aspectRatio: UgcVideoGenerationSetup["aspectRatio"];
  resolution: UgcBaseVideoResolution;
  generateAudio?: boolean;
}): UgcVideoGenerationSetup {
  const image = input.variant === "IMAGE_TO_VIDEO";
  return ugcVideoGenerationSetupSchema.parse({
    contractVersion: UGC_VIDEO_STUDIO_CONTRACT_VERSION,
    mode: "BASE_VIDEO",
    prompt: "An adult fashion model walks through an original station in one continuous shot.",
    modelId: input.modelId,
    duration: input.duration,
    aspectRatio: input.aspectRatio,
    quality: "720p",
    bitrate: "STANDARD",
    videoType: "UGC",
    references: image
      ? [{ id: "start", name: "start.png", mimeType: "image/png", mediaType: "IMAGE", byteLength: 4, durationSeconds: null, role: "SCENE", order: 0 }]
      : [],
    advanced: DEFAULT_UGC_VIDEO_ADVANCED_SETTINGS,
    klingMotion: DEFAULT_UGC_VIDEO_KLING_MOTION_SETTINGS,
    videoEdit: DEFAULT_UGC_VIDEO_EDIT_SETTINGS,
    baseVideo: {
      variant: input.variant,
      startImageReferenceId: image ? "start" : null,
      resolution: input.resolution,
      generateAudio: input.generateAudio ?? false,
    },
  });
}

const CASES = [
  [HAILUO_23_STANDARD_BASE_MODEL_ID, "TEXT_TO_VIDEO", "6", "AUTO", "768p", HAILUO_23_STANDARD_T2V_ENDPOINT],
  [HAILUO_23_FAST_BASE_MODEL_ID, "IMAGE_TO_VIDEO", "6", "AUTO", "768p", HAILUO_23_FAST_I2V_ENDPOINT],
  [PIXVERSE_C1_BASE_MODEL_ID, "TEXT_TO_VIDEO", "5", "9:16", "720p", PIXVERSE_C1_T2V_ENDPOINT],
  [PIXVERSE_C1_BASE_MODEL_ID, "IMAGE_TO_VIDEO", "5", "AUTO", "720p", PIXVERSE_C1_I2V_ENDPOINT],
  [KLING_25_TURBO_PRO_BASE_MODEL_ID, "TEXT_TO_VIDEO", "5", "9:16", "AUTO", KLING_25_TURBO_PRO_T2V_ENDPOINT],
  [KLING_25_TURBO_PRO_BASE_MODEL_ID, "IMAGE_TO_VIDEO", "5", "AUTO", "AUTO", KLING_25_TURBO_PRO_I2V_ENDPOINT],
  [WAN_22_A14B_BASE_MODEL_ID, "TEXT_TO_VIDEO", "5", "9:16", "720p", WAN_22_A14B_T2V_ENDPOINT],
  [WAN_22_A14B_BASE_MODEL_ID, "IMAGE_TO_VIDEO", "5", "AUTO", "720p", WAN_22_A14B_I2V_ENDPOINT],
  [SEEDANCE_2_FAST_BASE_MODEL_ID, "TEXT_TO_VIDEO", "5", "9:16", "720p", SEEDANCE_2_FAST_T2V_ENDPOINT],
  [SEEDANCE_2_FAST_BASE_MODEL_ID, "IMAGE_TO_VIDEO", "5", "9:16", "720p", SEEDANCE_2_FAST_I2V_ENDPOINT],
] as const;

test("BASE_VIDEO selects every exact audited T2V/I2V endpoint and isolated payload", () => {
  for (const [modelId, variant, duration, aspectRatio, resolution, endpoint] of CASES) {
    const active = setup({ modelId, variant, duration, aspectRatio, resolution });
    const built = buildFalBaseVideoInput({
      setup: active,
      startImageUrl: variant === "IMAGE_TO_VIDEO" ? "https://storage.example/start" : null,
      endUserId: "actor-test",
    });
    assert.equal(built.endpoint, endpoint);
    assert.match(built.prompt, /fictional adult actors/i);
    assert.doesNotMatch(JSON.stringify(built.payload), /motion_video_url|elements|reference_image_urls/);
    if (variant === "IMAGE_TO_VIDEO") {
      assert.equal("image_url" in built.payload, true);
    } else {
      assert.equal("image_url" in built.payload, false);
    }
  }
});

test("legacy Motion Control setup parses with defaults and is never reinterpreted as BASE_VIDEO", () => {
  const legacy = ugcVideoGenerationSetupSchema.parse({
    contractVersion: UGC_VIDEO_STUDIO_CONTRACT_VERSION,
    prompt: "motion",
    modelId: "kling-v3-pro-motion-control",
    duration: "5",
    aspectRatio: "9:16",
    quality: "720p",
    bitrate: "STANDARD",
    videoType: "UGC",
    references: [],
    advanced: DEFAULT_UGC_VIDEO_ADVANCED_SETTINGS,
    klingMotion: DEFAULT_UGC_VIDEO_KLING_MOTION_SETTINGS,
    videoEdit: DEFAULT_UGC_VIDEO_EDIT_SETTINGS,
  });
  assert.equal(legacy.mode, "MOTION_CONTROL");
  assert.equal(legacy.baseVideo.variant, "TEXT_TO_VIDEO");
});

test("Wan pilot duration presets use audited deterministic frames and fps", () => {
  assert.deepEqual(wanBaseVideoFramePreset("5"), { numFrames: 81, framesPerSecond: 16 });
  assert.deepEqual(wanBaseVideoFramePreset("10"), { numFrames: 161, framesPerSecond: 16 });
  const built = buildFalBaseVideoInput({
    setup: setup({ modelId: WAN_22_A14B_BASE_MODEL_ID, variant: "TEXT_TO_VIDEO", duration: "10", aspectRatio: "9:16", resolution: "720p" }),
    startImageUrl: null,
    endUserId: "actor-test",
  });
  assert.equal("num_frames" in built.payload && built.payload.num_frames, 161);
  assert.equal("frames_per_second" in built.payload && built.payload.frames_per_second, 16);
});

test("server-authoritative OWNER estimates cover locked pilot prices", () => {
  const price = (modelId: string, variant: UgcBaseVideoVariant, duration: UgcVideoGenerationSetup["duration"], resolution: UgcBaseVideoResolution = "720p") =>
    estimateUgcBaseVideoCostUsd(setup({ modelId, variant, duration, aspectRatio: variant === "IMAGE_TO_VIDEO" ? "AUTO" : modelId.includes("hailuo") ? "AUTO" : "9:16", resolution }));
  assert.equal(price(HAILUO_23_STANDARD_BASE_MODEL_ID, "TEXT_TO_VIDEO", "6", "768p"), 0.28);
  assert.equal(price(HAILUO_23_STANDARD_BASE_MODEL_ID, "TEXT_TO_VIDEO", "10", "768p"), 0.56);
  assert.equal(price(HAILUO_23_FAST_BASE_MODEL_ID, "IMAGE_TO_VIDEO", "6", "768p"), 0.19);
  assert.equal(price(HAILUO_23_FAST_BASE_MODEL_ID, "IMAGE_TO_VIDEO", "10", "768p"), 0.32);
  assert.equal(price(PIXVERSE_C1_BASE_MODEL_ID, "TEXT_TO_VIDEO", "5"), 0.25);
  const pixverseAudio = setup({ modelId: PIXVERSE_C1_BASE_MODEL_ID, variant: "TEXT_TO_VIDEO", duration: "5", aspectRatio: "9:16", resolution: "720p", generateAudio: true });
  assert.equal(estimateUgcBaseVideoCostUsd(pixverseAudio), 0.325);
  assert.equal(price(KLING_25_TURBO_PRO_BASE_MODEL_ID, "TEXT_TO_VIDEO", "10", "AUTO"), 0.7);
  assert.equal(price(WAN_22_A14B_BASE_MODEL_ID, "TEXT_TO_VIDEO", "5"), 0.4);
  assert.equal(price(SEEDANCE_2_FAST_BASE_MODEL_ID, "TEXT_TO_VIDEO", "15"), 3.6285);
});

test("single-variant and prompt constraints fail before provider execution", () => {
  const missingHailuoImage = setup({ modelId: HAILUO_23_FAST_BASE_MODEL_ID, variant: "IMAGE_TO_VIDEO", duration: "6", aspectRatio: "AUTO", resolution: "768p" });
  const invalid = { ...missingHailuoImage, references: [], baseVideo: { ...missingHailuoImage.baseVideo, startImageReferenceId: null } };
  assert.throws(() => assertUgcBaseVideoSetup(invalid), (error: unknown) => error instanceof UgcBaseVideoInputError && error.code === "BASE_VIDEO_START_IMAGE_REQUIRED");

  const pixverse = setup({ modelId: PIXVERSE_C1_BASE_MODEL_ID, variant: "TEXT_TO_VIDEO", duration: "5", aspectRatio: "9:16", resolution: "720p" });
  assert.throws(() => assertUgcBaseVideoSetup({ ...pixverse, prompt: "ü".repeat(1_025) }), (error: unknown) => error instanceof UgcBaseVideoInputError && error.code === "BASE_VIDEO_PROMPT_TOO_LONG");

  const standardWithImage = setup({ modelId: HAILUO_23_STANDARD_BASE_MODEL_ID, variant: "IMAGE_TO_VIDEO", duration: "6", aspectRatio: "AUTO", resolution: "768p" });
  assert.throws(() => assertUgcBaseVideoSetup(standardWithImage), (error: unknown) => error instanceof UgcBaseVideoInputError && error.code === "BASE_VIDEO_START_IMAGE_UNSUPPORTED");

  const wrongDuration = { ...pixverse, duration: "6" as const };
  assert.throws(() => assertUgcBaseVideoSetup(wrongDuration), (error: unknown) => error instanceof UgcBaseVideoInputError && error.code === "BASE_VIDEO_DURATION_UNSUPPORTED");
  assert.throws(() => assertUgcBaseVideoSetup({ ...pixverse, aspectRatio: "AUTO" }), (error: unknown) => error instanceof UgcBaseVideoInputError && error.code === "BASE_VIDEO_ASPECT_UNSUPPORTED");
  assert.throws(() => assertUgcBaseVideoSetup({ ...pixverse, baseVideo: { ...pixverse.baseVideo, resolution: "480p" } }), (error: unknown) => error instanceof UgcBaseVideoInputError && error.code === "BASE_VIDEO_RESOLUTION_UNSUPPORTED");
  const kling = setup({ modelId: KLING_25_TURBO_PRO_BASE_MODEL_ID, variant: "TEXT_TO_VIDEO", duration: "5", aspectRatio: "9:16", resolution: "AUTO" });
  assert.throws(() => assertUgcBaseVideoSetup({ ...kling, baseVideo: { ...kling.baseVideo, generateAudio: true } }), (error: unknown) => error instanceof UgcBaseVideoInputError && error.code === "BASE_VIDEO_AUDIO_UNSUPPORTED");
});

test("authoritative fal queue handle is captured and host is restricted", () => {
  assert.deepEqual(extractFalBaseVideoQueueSubmission({ request_id: "request-safe", status_url: "https://queue.fal.run/a/status", response_url: "https://queue.fal.run/a/response", cancel_url: "https://queue.fal.run/a/cancel" }), {
    requestId: "request-safe",
    statusUrl: "https://queue.fal.run/a/status",
    responseUrl: "https://queue.fal.run/a/response",
    cancelUrl: "https://queue.fal.run/a/cancel",
    queuePosition: null,
  });
  assert.throws(() => assertBaseVideoFalQueueUrl("https://evil.example/status"), /UNTRUSTED/);
  assert.throws(() => assertBaseVideoFalQueueUrl("http://queue.fal.run/status"), /UNTRUSTED/);
});

test("base-video provider persists queue authority and recovery uses the exact handle", async () => {
  const active = setup({ modelId: PIXVERSE_C1_BASE_MODEL_ID, variant: "TEXT_TO_VIDEO", duration: "5", aspectRatio: "9:16", resolution: "720p" });
  const calls: string[] = [];
  const transport: FalBaseVideoTransport = {
    async uploadReference() { throw new Error("no image expected"); },
    async submit(endpoint) {
      calls.push(`submit:${endpoint}`);
      return { requestId: "accepted", statusUrl: "https://queue.fal.run/exact/status", responseUrl: "https://queue.fal.run/exact/response", cancelUrl: "https://queue.fal.run/exact/cancel", queuePosition: 0 };
    },
    async status(endpoint, requestId, queueHandle) {
      calls.push(`status:${endpoint}:${requestId}:${queueHandle?.statusUrl}`);
      return { status: "COMPLETED", queuePosition: null, error: null, logs: [], inferenceTimeSeconds: null, metrics: null, truncated: false };
    },
    async result(endpoint, requestId, queueHandle) {
      calls.push(`result:${endpoint}:${requestId}:${queueHandle?.responseUrl}`);
      return { requestId, data: { video: { url: "https://result.example/video.mp4", content_type: "video/mp4" } } };
    },
  };
  const provider = new FalBaseVideoProvider(PIXVERSE_C1_BASE_MODEL_ID, undefined, transport);
  const submission = await provider.submit({ clientRequestId: "job", setup: active, references: [], endUserId: "actor" });
  const handle = { endpoint: submission.providerModel, statusUrl: submission.statusUrl, responseUrl: submission.responseUrl, cancelUrl: submission.cancelUrl };
  await provider.getStatus(submission.providerRequestId, handle);
  await provider.getResult({ providerRequestId: submission.providerRequestId, setup: active, providerPrompt: submission.providerPrompt, referenceOrder: [], queueHandle: handle });
  assert.deepEqual(calls, [
    `submit:${PIXVERSE_C1_T2V_ENDPOINT}`,
    `status:${PIXVERSE_C1_T2V_ENDPOINT}:accepted:https://queue.fal.run/exact/status`,
    `result:${PIXVERSE_C1_T2V_ENDPOINT}:accepted:https://queue.fal.run/exact/response`,
  ]);
});

function durableStore() {
  let manifest: UgcVideoJobManifest | null = null;
  const store: UgcVideoJobStore = {
    async ensureReady() { return { bucketId: "ugc-video-studio-assets", bucketFileSizeLimitBytes: UGC_VIDEO_RESULT_MAX_BYTES, resultMaxBytes: UGC_VIDEO_RESULT_MAX_BYTES, private: true, videoMp4Allowed: true }; },
    async claim() { return "CREATED"; },
    async readManifest() { return manifest; },
    async writeManifest(next) { manifest = structuredClone(next); },
    async persistResult() { return "unused"; },
    async readResult() { return null; },
  };
  return { store, read: () => manifest };
}

test("OWNER BASE_VIDEO creates durable manifest before one provider submission and no customer authority", async () => {
  const active = setup({ modelId: PIXVERSE_C1_BASE_MODEL_ID, variant: "TEXT_TO_VIDEO", duration: "5", aspectRatio: "9:16", resolution: "720p" });
  const holder = durableStore();
  let submits = 0;
  const provider: UgcVideoProvider = {
    providerId: "fal",
    isConfigured: () => true,
    async submit() {
      assert.ok(holder.read(), "durable manifest must exist before submit");
      submits += 1;
      return { provider: "fal", providerModel: PIXVERSE_C1_T2V_ENDPOINT, providerRequestId: "request-safe", providerPrompt: "safe", referenceOrder: [], providerStatus: "IN_QUEUE", statusUrl: "https://queue.fal.run/a/status", responseUrl: "https://queue.fal.run/a/response", cancelUrl: "https://queue.fal.run/a/cancel", queuePosition: 0 };
    },
    async getStatus() { throw new Error("not called"); },
    async getResult() { throw new Error("not called"); },
  };
  const run = await generateUgcVideoJob({ scope: { workspaceId: "owner-workspace", actorId: "owner-actor" }, jobId: "11111111-1111-4111-8111-111111111111", setup: active, references: [] }, { provider, store: holder.store, costLimitPolicy: "OWNER_ESTIMATE_ONLY" });
  assert.equal(submits, 1);
  assert.equal(run.status, "RUNNING");
  assert.equal(run.estimatedMaximumCostUsd, 0.25);
  assert.equal(holder.read()?.providerStatusUrl, "https://queue.fal.run/a/status");
});

test("non-owner financial policy rejects BASE_VIDEO before submit", async () => {
  const active = setup({ modelId: PIXVERSE_C1_BASE_MODEL_ID, variant: "TEXT_TO_VIDEO", duration: "5", aspectRatio: "9:16", resolution: "720p" });
  let submits = 0;
  const provider: UgcVideoProvider = {
    providerId: "fal", isConfigured: () => true,
    async submit() { submits += 1; throw new Error("must not submit"); },
    async getStatus() { throw new Error("unused"); }, async getResult() { throw new Error("unused"); },
  };
  await assert.rejects(
    generateUgcVideoJob({ scope: { workspaceId: "customer", actorId: "customer" }, jobId: "22222222-2222-4222-8222-222222222222", setup: active, references: [] }, { provider, store: durableStore().store }),
    (error: unknown) => error instanceof UgcVideoGenerationError && error.code === "BASE_VIDEO_OWNER_ONLY",
  );
  assert.equal(submits, 0);
});

test("shared UI hides BASE_VIDEO from customer and server route rejects it before temp resolution", () => {
  const ownerPage = readFileSync("app/(dashboard)/hq/ugc-video-studio/page.tsx", "utf8");
  const customerPage = readFileSync("app/(customer)/app/ugc-video-studio/page.tsx", "utf8");
  const route = readFileSync("app/api/ugc-video-studio/generate/route.ts", "utf8");
  assert.match(ownerPage, /baseVideoOwnerPilot=\{baseVideoOwnerPilot\}/);
  assert.match(ownerPage, /hasXerianoOwnerAuthority\(access\.context\)/);
  assert.doesNotMatch(customerPage, /baseVideoOwnerPilot/);
  assert.ok(route.indexOf('setup.mode === "BASE_VIDEO"') < route.indexOf("const resolvedReferences = await resolveTempReferences"));
  assert.ok(route.indexOf('"BASE_VIDEO_OWNER_ONLY"') < route.indexOf("customerAuthority = await reserveCustomerGeneration"));
});

test("base model availability and estimates are emitted only for the exact OWNER capability", () => {
  const environment = {
    NODE_ENV: "test",
    FAL_KEY: "test",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test",
  } as NodeJS.ProcessEnv;
  const ordinary = getUgcVideoProviderPublicConfig(environment);
  assert.equal(ordinary.baseVideoOwnerPilot.enabled, false);
  assert.deepEqual(ordinary.baseVideoOwnerPilot.modelIds, []);
  assert.deepEqual(ordinary.ownerPricing.baseVideoEstimatesUsd, {});
  const owner = getUgcVideoProviderPublicConfig(environment, { includeBaseVideoOwnerPilot: true });
  assert.equal(owner.baseVideoOwnerPilot.enabled, true);
  assert.equal(owner.baseVideoOwnerPilot.ready, true);
  assert.equal(owner.baseVideoOwnerPilot.modelIds.includes(PIXVERSE_C1_BASE_MODEL_ID), true);
  assert.equal(owner.ownerPricing.baseVideoEstimatesUsd[`${PIXVERSE_C1_BASE_MODEL_ID}|TEXT_TO_VIDEO|5|720p|silent`], 0.25);
});
