import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DEFAULT_UGC_VIDEO_ADVANCED_SETTINGS,
  DEFAULT_UGC_VIDEO_KLING_MOTION_SETTINGS,
  DEFAULT_UGC_VIDEO_RECAST_SETTINGS,
  UGC_VIDEO_STUDIO_CONTRACT_VERSION,
  ugcVideoGenerationSetupSchema,
  type UgcVideoGenerationSetup,
} from "@/lib/ugc-video-studio/contracts";
import {
  generateUgcVideoJob,
  observeUgcVideoJob,
  UgcVideoGenerationError,
} from "@/lib/ugc-video-studio/generation-service";
import {
  ugcVideoModelById,
  videoRecastModelDefinitions,
} from "@/lib/ugc-video-studio/model-registry";
import type {
  UgcVideoProvider,
  UgcVideoProviderReference,
} from "@/lib/ugc-video-studio/provider";
import { UgcVideoProviderDiagnosticError } from "@/lib/ugc-video-studio/provider";
import {
  buildFalVideoRecastInput,
  buildVideoRecastPrompt,
  FalVideoRecastProvider,
  type FalVideoRecastTransport,
} from "@/lib/ugc-video-studio/providers/fal-video-recast";
import type { UgcVideoJobManifest } from "@/lib/ugc-video-studio/server-contracts";
import {
  UGC_VIDEO_RESULT_MAX_BYTES,
  type UgcVideoJobStore,
} from "@/lib/ugc-video-studio/server-storage";
import {
  assertUgcVideoRecastSetup,
  assertUgcVideoRecastUserPrompt,
  estimateUgcVideoRecastCostUsd,
  KLING_O3_PRO_VIDEO_RECAST_ENDPOINT,
  KLING_O3_PRO_VIDEO_RECAST_MODEL_ID,
  UgcVideoRecastInputError,
} from "@/lib/ugc-video-studio/video-recast-config";

function setup(options: {
  face?: boolean;
  scene?: boolean;
  prompt?: string;
} = {}): UgcVideoGenerationSetup {
  const references = [
    { id: "source", name: "source.mp4", mimeType: "video/mp4", mediaType: "VIDEO" as const, byteLength: 12, durationSeconds: 6.25, role: "MOTION" as const, order: 0 },
    { id: "outfit", name: "outfit.png", mimeType: "image/png", mediaType: "IMAGE" as const, byteLength: 12, durationSeconds: null, role: "OUTFIT" as const, order: 1 },
    ...(options.face ? [{ id: "face", name: "face.jpg", mimeType: "image/jpeg", mediaType: "IMAGE" as const, byteLength: 12, durationSeconds: null, role: "FACE" as const, order: 2 }] : []),
    ...(options.scene ? [{ id: "scene", name: "scene.webp", mimeType: "image/webp", mediaType: "IMAGE" as const, byteLength: 12, durationSeconds: null, role: "SCENE" as const, order: options.face ? 3 : 2 }] : []),
  ];
  return ugcVideoGenerationSetupSchema.parse({
    contractVersion: UGC_VIDEO_STUDIO_CONTRACT_VERSION,
    mode: "VIDEO_RECAST",
    prompt: options.prompt ?? "Inszeniere die Performance in einer neuen futuristischen U-Bahn-Station.",
    modelId: KLING_O3_PRO_VIDEO_RECAST_MODEL_ID,
    duration: "7",
    aspectRatio: "AUTO",
    quality: "720p",
    bitrate: "STANDARD",
    videoType: "UGC",
    references,
    advanced: DEFAULT_UGC_VIDEO_ADVANCED_SETTINGS,
    klingMotion: DEFAULT_UGC_VIDEO_KLING_MOTION_SETTINGS,
    videoRecast: {
      ...DEFAULT_UGC_VIDEO_RECAST_SETTINGS,
      sourceVideoReferenceId: "source",
      characterOutfitReferenceId: "outfit",
      faceReferenceId: options.face ? "face" : null,
      sceneStyleReferenceId: options.scene ? "scene" : null,
      sourceDurationSeconds: 6.25,
    },
  });
}

function references(active: UgcVideoGenerationSetup): UgcVideoProviderReference[] {
  return active.references.map((metadata) => ({
    metadata,
    bytes: Buffer.alloc(metadata.byteLength, metadata.order + 1),
    providerUrl: `https://storage.example/${metadata.id}`,
  }));
}

function durableStore() {
  let manifest: UgcVideoJobManifest | null = null;
  let claimed = false;
  const store: UgcVideoJobStore = {
    async ensureReady() {
      return { bucketId: "ugc-video-studio-assets", bucketFileSizeLimitBytes: UGC_VIDEO_RESULT_MAX_BYTES, resultMaxBytes: UGC_VIDEO_RESULT_MAX_BYTES, private: true, videoMp4Allowed: true };
    },
    async claim() {
      if (claimed) return "EXISTS";
      claimed = true;
      return "CREATED";
    },
    async readManifest() { return manifest; },
    async writeManifest(next) { manifest = structuredClone(next); },
    async persistResult() { return "unused"; },
    async readResult() { return null; },
  };
  return { store, read: () => manifest };
}

test("VIDEO_RECAST is a separate owner pilot model on the exact O3 endpoint", () => {
  const model = ugcVideoModelById(KLING_O3_PRO_VIDEO_RECAST_MODEL_ID);
  assert.equal(model?.providerModelId, KLING_O3_PRO_VIDEO_RECAST_ENDPOINT);
  assert.equal(model?.settingsKind, "VIDEO_RECAST");
  assert.deepEqual(model?.modeCompatibility, ["VIDEO_RECAST"]);
  assert.deepEqual(videoRecastModelDefinitions().map((entry) => entry.id), [
    KLING_O3_PRO_VIDEO_RECAST_MODEL_ID,
  ]);
  assert.equal(estimateUgcVideoRecastCostUsd(6.25), 1.05);
});

test("O3 recast payload maps each explicit role without changing the existing Video Edit builder", () => {
  const active = setup({ face: true, scene: true });
  const payload = buildFalVideoRecastInput({
    setup: active,
    sourceVideoUrl: "https://storage.example/source",
    characterOutfitUrl: "https://storage.example/outfit",
    faceUrl: "https://storage.example/face",
    sceneStyleUrl: "https://storage.example/scene",
  });
  assert.equal(payload.video_url, "https://storage.example/source");
  assert.deepEqual(payload.elements, [{
    frontal_image_url: "https://storage.example/outfit",
    reference_image_urls: ["https://storage.example/face"],
  }]);
  assert.deepEqual(payload.image_urls, ["https://storage.example/scene"]);
  assert.equal(payload.keep_audio, false);
  assert.equal(payload.shot_type, "customize");
  assert.match(payload.prompt, /@Video1/);
  assert.match(payload.prompt, /@Element1/);
  assert.match(payload.prompt, /@Image1/);
  assert.match(payload.prompt, /normal playback speed/);
  assert.match(payload.prompt, /Do not invent gestures/);
  assert.doesNotMatch(payload.prompt, /@Image2|@Element2|@Video2/);
});

test("recast without optional images uses the outfit fallback and emits no scene token", () => {
  const active = setup();
  const payload = buildFalVideoRecastInput({
    setup: active,
    sourceVideoUrl: "source-url",
    characterOutfitUrl: "outfit-url",
    faceUrl: null,
    sceneStyleUrl: null,
  });
  assert.deepEqual(payload.elements, [{
    frontal_image_url: "outfit-url",
    reference_image_urls: ["outfit-url"],
  }]);
  assert.equal("image_urls" in payload, false);
  assert.doesNotMatch(payload.prompt, /@Image1/);
});

test("all raw provider tokens fail before references, durable jobs, costs, or submit", async () => {
  for (const token of ["@Image1", "@video2", "@ELEMENT3"]) {
    assert.throws(
      () => assertUgcVideoRecastUserPrompt(`Neue Szene ${token}`),
      (error) => error instanceof UgcVideoRecastInputError && error.code === "PROVIDER_REFERENCE_TOKEN_UNSUPPORTED",
    );
  }
  const active = setup({ prompt: "Neue Szene mit @Image1" });
  let submits = 0;
  const holder = durableStore();
  const provider: UgcVideoProvider = {
    providerId: "fal",
    isConfigured: () => true,
    async submit() { submits += 1; throw new Error("must not submit"); },
    async getStatus() { throw new Error("unused"); },
    async getResult() { throw new Error("unused"); },
  };
  await assert.rejects(
    generateUgcVideoJob(
      { scope: { workspaceId: "owner", actorId: "owner" }, jobId: "11111111-1111-4111-8111-111111111111", setup: active, references: references(active) },
      { provider, store: holder.store, costLimitPolicy: "OWNER_ESTIMATE_ONLY" },
    ),
    (error) => error instanceof UgcVideoGenerationError && error.code === "REFERENCE_INVALID",
  );
  assert.equal(holder.read(), null);
  assert.equal(submits, 0);
});

test("explicit role, MIME, required-field and reference-order validation fails closed", () => {
  assert.doesNotThrow(() => assertUgcVideoRecastSetup(setup({ face: true, scene: true })));
  const missingOutfit = setup();
  missingOutfit.videoRecast!.characterOutfitReferenceId = null;
  assert.throws(() => assertUgcVideoRecastSetup(missingOutfit), (error) => error instanceof UgcVideoRecastInputError && error.code === "CHARACTER_OUTFIT_REQUIRED");

  const wrongMime = setup();
  wrongMime.references[1] = { ...wrongMime.references[1]!, mimeType: "image/gif" };
  assert.throws(() => assertUgcVideoRecastSetup(wrongMime), (error) => error instanceof UgcVideoRecastInputError && error.code === "UNSUPPORTED_IMAGE");

  const wrongRole = setup({ face: true });
  wrongRole.references[2] = { ...wrongRole.references[2]!, role: "STYLE" };
  assert.throws(() => assertUgcVideoRecastSetup(wrongRole), (error) => error instanceof UgcVideoRecastInputError && error.code === "REFERENCE_INVALID");
});

test("provider captures authoritative queue handles and recovery never resubmits", async () => {
  const active = setup({ face: true, scene: true });
  let submits = 0;
  const observed: unknown[] = [];
  const transport: FalVideoRecastTransport = {
    async uploadReference() { throw new Error("provider URLs already exist"); },
    async submit(endpoint, input) {
      submits += 1;
      assert.equal(endpoint, KLING_O3_PRO_VIDEO_RECAST_ENDPOINT);
      assert.equal(input.video_url, "https://storage.example/source");
      return {
        requestId: "accepted-recast",
        statusUrl: "https://queue.fal.run/recast/status",
        responseUrl: "https://queue.fal.run/recast/response",
        cancelUrl: "https://queue.fal.run/recast/cancel",
        queuePosition: 1,
      };
    },
    async status(endpoint, requestId, handle) {
      assert.equal(endpoint, KLING_O3_PRO_VIDEO_RECAST_ENDPOINT);
      assert.equal(requestId, "accepted-recast");
      observed.push(handle);
      return { status: "COMPLETED", queuePosition: null, error: null, logs: [], inferenceTimeSeconds: null, metrics: null, truncated: false };
    },
    async result(endpoint, requestId, handle) {
      assert.equal(endpoint, KLING_O3_PRO_VIDEO_RECAST_ENDPOINT);
      assert.equal(requestId, "accepted-recast");
      observed.push(handle);
      return { requestId, data: { video: { url: "https://result.example/recast.mp4", content_type: "video/mp4" } } };
    },
  };
  const provider = new FalVideoRecastProvider(undefined, transport);
  const submission = await provider.submit({ clientRequestId: "job", endUserId: "owner", setup: active, references: references(active) });
  const handle = {
    endpoint: KLING_O3_PRO_VIDEO_RECAST_ENDPOINT,
    statusUrl: submission.statusUrl,
    responseUrl: submission.responseUrl,
    cancelUrl: submission.cancelUrl,
  };
  await provider.getStatus(submission.providerRequestId, handle);
  await provider.getResult({ providerRequestId: submission.providerRequestId, setup: active, providerPrompt: submission.providerPrompt, referenceOrder: submission.referenceOrder, queueHandle: handle });
  assert.equal(submits, 1);
  assert.deepEqual(observed, [handle, handle]);
});

test("durable manifest precedes submit and owner execution remains estimate-only", async () => {
  const active = setup();
  const holder = durableStore();
  let submits = 0;
  const provider: UgcVideoProvider = {
    providerId: "fal",
    isConfigured: () => true,
    async submit(request) {
      submits += 1;
      assert.equal(holder.read()?.setup.mode, "VIDEO_RECAST");
      assert.equal(holder.read()?.setup.videoRecast?.profile, "KLING_O3_CHARACTER_SCENE_RECAST");
      return { provider: "fal", providerModel: KLING_O3_PRO_VIDEO_RECAST_ENDPOINT, providerRequestId: "accepted", providerPrompt: buildVideoRecastPrompt({ userInstruction: request.setup.prompt, hasSceneStyle: false }), referenceOrder: request.references.map((reference) => reference.metadata.id), providerStatus: "IN_QUEUE", statusUrl: "https://queue.fal.run/recast/status", responseUrl: "https://queue.fal.run/recast/response", cancelUrl: null, queuePosition: 0 };
    },
    async getStatus() { return { status: "IN_PROGRESS", queuePosition: null, error: null, logs: [], inferenceTimeSeconds: null, metrics: null, truncated: false }; },
    async getResult() { throw new Error("unused"); },
  };
  const input = { scope: { workspaceId: "owner", actorId: "owner" }, jobId: "22222222-2222-4222-8222-222222222222", setup: active, references: references(active) };
  const run = await generateUgcVideoJob(input, { provider, store: holder.store, costLimitPolicy: "OWNER_ESTIMATE_ONLY" });
  const replay = await generateUgcVideoJob(input, { provider, store: holder.store, costLimitPolicy: "OWNER_ESTIMATE_ONLY" });
  const observed = await observeUgcVideoJob({ scope: input.scope, jobId: input.jobId }, { provider, store: holder.store });
  assert.equal(run.estimatedMaximumCostUsd, 1.05);
  assert.equal(replay.providerRequestId, "accepted");
  assert.equal(observed.status, "RUNNING");
  assert.equal(submits, 1);
  assert.equal(holder.read()?.providerStatusUrl, "https://queue.fal.run/recast/status");
});

test("accepted recast recovery failure stays UNKNOWN_OUTCOME and never resubmits", async () => {
  const active = setup();
  const holder = durableStore();
  let submits = 0;
  const provider: UgcVideoProvider = {
    providerId: "fal",
    isConfigured: () => true,
    async submit(request) {
      submits += 1;
      return { provider: "fal", providerModel: KLING_O3_PRO_VIDEO_RECAST_ENDPOINT, providerRequestId: "accepted", providerPrompt: request.setup.prompt, referenceOrder: request.references.map((reference) => reference.metadata.id), providerStatus: "IN_QUEUE", statusUrl: "https://queue.fal.run/recast/status", responseUrl: "https://queue.fal.run/recast/response", cancelUrl: null, queuePosition: 0 };
    },
    async getStatus() {
      throw new UgcVideoProviderDiagnosticError({
        phase: "STATUS",
        httpStatus: 422,
        providerCode: "input_value_error",
        providerMessage: "Safe validation failure",
        providerBody: null,
        requestId: "accepted",
        endpoint: KLING_O3_PRO_VIDEO_RECAST_ENDPOINT,
        occurredAt: "2026-09-03T18:00:00.000Z",
        truncated: false,
      }, false);
    },
    async getResult() { throw new Error("unused"); },
  };
  const input = { scope: { workspaceId: "owner", actorId: "owner" }, jobId: "44444444-4444-4444-8444-444444444444", setup: active, references: references(active) };
  await generateUgcVideoJob(input, { provider, store: holder.store, costLimitPolicy: "OWNER_ESTIMATE_ONLY" });
  const first = await observeUgcVideoJob({ scope: input.scope, jobId: input.jobId }, { provider, store: holder.store });
  const second = await observeUgcVideoJob({ scope: input.scope, jobId: input.jobId }, { provider, store: holder.store });
  assert.equal(first.status, "UNKNOWN_OUTCOME");
  assert.equal(second.status, "UNKNOWN_OUTCOME");
  assert.equal(submits, 1);
});

test("non-owner service policy and direct Customer/Admin routes fail before any work", async () => {
  const active = setup();
  let submits = 0;
  const provider: UgcVideoProvider = {
    providerId: "fal",
    isConfigured: () => true,
    async submit() { submits += 1; throw new Error("must not submit"); },
    async getStatus() { throw new Error("unused"); },
    async getResult() { throw new Error("unused"); },
  };
  await assert.rejects(
    generateUgcVideoJob(
      { scope: { workspaceId: "customer", actorId: "customer" }, jobId: "33333333-3333-4333-8333-333333333333", setup: active, references: references(active) },
      { provider, store: durableStore().store },
    ),
    (error) => error instanceof UgcVideoGenerationError && error.code === "VIDEO_RECAST_OWNER_ONLY",
  );
  assert.equal(submits, 0);

  const route = readFileSync("app/api/ugc-video-studio/generate/route.ts", "utf8");
  const guardAt = route.indexOf('if (setup.mode === "VIDEO_RECAST")');
  assert.ok(guardAt > route.indexOf("const parsed = ugcGenerateRequestSchema.parse"));
  assert.ok(guardAt < route.indexOf("await resolveTempReferences"));
  assert.ok(guardAt < route.indexOf("customerAuthority = await reserveCustomerGeneration"));
  assert.ok(guardAt < route.indexOf("const run = await generateUgcVideoJob"));
});

test("shared workspace exposes recast only under exact owner capability and leaves customer page untouched", () => {
  const controls = readFileSync("components/ugc-video-studio/ugc-video-studio-controls.tsx", "utf8");
  const workspace = readFileSync("components/ugc-video-studio/ugc-video-studio-workspace.tsx", "utf8");
  const owner = readFileSync("app/(dashboard)/hq/ugc-video-studio/page.tsx", "utf8");
  const customer = readFileSync("app/(customer)/app/ugc-video-studio/page.tsx", "utf8");
  assert.match(controls, /props\.videoRecastEnabled \?/);
  assert.match(controls, /Video neu inszenieren/);
  assert.match(workspace, /videoRecastOwnerPilot/);
  assert.match(owner, /hasXerianoOwnerAuthority\(access\.context\)/);
  assert.match(owner, /videoRecastOwnerPilot=/);
  assert.doesNotMatch(customer, /videoRecastOwnerPilot|VIDEO_RECAST/);
  for (const label of ["Quellvideo", "Model / Outfit", "Gesicht", "Umgebung / Stil"]) {
    assert.match(controls, new RegExp(label.replace("/", "\\/")));
  }
  const css = readFileSync("app/ugc-video-studio.css", "utf8");
  assert.match(css, /@media\s*\(max-width:\s*640px\)/);
  assert.match(css, /\.uv-edit-upload-grid\s*\{\s*grid-template-columns:1fr/);
});
