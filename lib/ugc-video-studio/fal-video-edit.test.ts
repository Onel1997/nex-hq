import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isUgcModelOptionSelected } from "@/components/ugc-video-studio/ugc-video-studio-controls";
import {
  DEFAULT_UGC_VIDEO_ADVANCED_SETTINGS,
  DEFAULT_UGC_VIDEO_EDIT_SETTINGS,
  DEFAULT_UGC_VIDEO_KLING_MOTION_SETTINGS,
  UGC_VIDEO_STUDIO_CONTRACT_VERSION,
  ugcVideoGenerationSetupSchema,
  type UgcVideoGenerationSetup,
} from "@/lib/ugc-video-studio/contracts";
import {
  AUTO_RECOMMENDED_VIDEO_EDIT_MODEL_ID,
  KLING_O1_STANDARD_EDIT_ENDPOINT,
  KLING_O1_STANDARD_EDIT_MODEL_ID,
  KLING_O3_PRO_EDIT_ENDPOINT,
  KLING_O3_PRO_EDIT_MODEL_ID,
  RECOMMENDED_VIDEO_EDIT_MODEL_ID,
  SEEDANCE_2_FAST_EDIT_ENDPOINT,
  SEEDANCE_2_FAST_EDIT_MODEL_ID,
  resolveRecommendedVideoEditModelId,
  ugcVideoModelById,
} from "@/lib/ugc-video-studio/model-registry";
import type { UgcVideoProviderQueueHandle, UgcVideoProviderReference } from "@/lib/ugc-video-studio/provider";
import type { UgcVideoProvider } from "@/lib/ugc-video-studio/provider";
import {
  assertUgcFalQueueUrl,
  buildCharacterReplacePrompt,
  buildFalVideoEditInput,
  FalVideoEditProvider,
  type FalVideoEditEndpoint,
  type FalVideoEditTransport,
} from "@/lib/ugc-video-studio/providers/fal-video-edit";
import { assertUgcVideoEditImageDimensions, estimateUgcVideoEditCostUsd } from "@/lib/ugc-video-studio/video-edit-config";
import { quoteUgcCustomerGeneration } from "@/lib/xeriano/customer-generation";
import { generateUgcVideoJob } from "@/lib/ugc-video-studio/generation-service";
import type { UgcVideoJobManifest } from "@/lib/ugc-video-studio/server-contracts";
import { UGC_VIDEO_RESULT_MAX_BYTES, type UgcVideoJobStore } from "@/lib/ugc-video-studio/server-storage";

const MODELS = [
  [KLING_O3_PRO_EDIT_MODEL_ID, KLING_O3_PRO_EDIT_ENDPOINT],
  [KLING_O1_STANDARD_EDIT_MODEL_ID, KLING_O1_STANDARD_EDIT_ENDPOINT],
  [SEEDANCE_2_FAST_EDIT_MODEL_ID, SEEDANCE_2_FAST_EDIT_ENDPOINT],
] as const;

function setup(modelId: string = KLING_O3_PRO_EDIT_MODEL_ID): UgcVideoGenerationSetup {
  return ugcVideoGenerationSetupSchema.parse({
    contractVersion: UGC_VIDEO_STUDIO_CONTRACT_VERSION,
    mode: "VIDEO_EDIT",
    prompt: "Bewahre den Frontprint besonders stark.",
    modelId,
    duration: "5",
    aspectRatio: "AUTO",
    quality: "720p",
    bitrate: "STANDARD",
    videoType: "UGC",
    references: [
      { id: "source", name: "source.mp4", mimeType: "video/mp4", mediaType: "VIDEO", byteLength: 12, durationSeconds: 5, role: "MOTION", order: 0 },
      { id: "character", name: "character.png", mimeType: "image/png", mediaType: "IMAGE", byteLength: 12, durationSeconds: null, role: "MODEL", order: 1 },
    ],
    advanced: DEFAULT_UGC_VIDEO_ADVANCED_SETTINGS,
    klingMotion: DEFAULT_UGC_VIDEO_KLING_MOTION_SETTINGS,
    videoEdit: { ...DEFAULT_UGC_VIDEO_EDIT_SETTINGS, sourceVideoReferenceId: "source", characterMasterReferenceId: "character" },
  });
}

function references(active: UgcVideoGenerationSetup): UgcVideoProviderReference[] {
  return active.references.map((metadata) => ({
    metadata,
    bytes: Buffer.alloc(metadata.byteLength, 1),
    providerUrl: `https://storage.example/${metadata.id}`,
  }));
}

test("server registry keeps exact endpoints and one changeable recommended model", () => {
  for (const [modelId, endpoint] of MODELS) {
    const model = ugcVideoModelById(modelId);
    assert.equal(model?.providerModelId, endpoint);
    assert.deepEqual(model?.modeCompatibility, ["VIDEO_EDIT"]);
  }
  assert.equal(resolveRecommendedVideoEditModelId(AUTO_RECOMMENDED_VIDEO_EDIT_MODEL_ID), RECOMMENDED_VIDEO_EDIT_MODEL_ID);
});

test("recommended and explicit Video Edit selections never produce two selected options", () => {
  const selected = (optionId: string, resolvedModelId: string, recommendedSelected: boolean) =>
    isUgcModelOptionSelected({ optionId, resolvedModelId, recommendedSelected });

  assert.equal(selected(AUTO_RECOMMENDED_VIDEO_EDIT_MODEL_ID, KLING_O3_PRO_EDIT_MODEL_ID, true), true);
  assert.equal(selected(KLING_O3_PRO_EDIT_MODEL_ID, KLING_O3_PRO_EDIT_MODEL_ID, true), false);

  assert.equal(selected(AUTO_RECOMMENDED_VIDEO_EDIT_MODEL_ID, KLING_O3_PRO_EDIT_MODEL_ID, false), false);
  assert.equal(selected(KLING_O3_PRO_EDIT_MODEL_ID, KLING_O3_PRO_EDIT_MODEL_ID, false), true);
  assert.equal(selected(KLING_O1_STANDARD_EDIT_MODEL_ID, KLING_O1_STANDARD_EDIT_MODEL_ID, false), true);
  assert.equal(selected(SEEDANCE_2_FAST_EDIT_MODEL_ID, SEEDANCE_2_FAST_EDIT_MODEL_ID, false), true);

  const options = [
    AUTO_RECOMMENDED_VIDEO_EDIT_MODEL_ID,
    KLING_O3_PRO_EDIT_MODEL_ID,
    KLING_O1_STANDARD_EDIT_MODEL_ID,
    SEEDANCE_2_FAST_EDIT_MODEL_ID,
  ];
  for (const explicitModelId of options.slice(1)) {
    assert.deepEqual(
      options.filter((optionId) => selected(optionId, explicitModelId, false)),
      [explicitModelId],
    );
  }
});

test("shared model copy is product-safe and model selection suppresses the sticky CTA", () => {
  const workspace = readFileSync("components/ugc-video-studio/ugc-video-studio-workspace.tsx", "utf8");
  const registry = readFileSync("lib/ugc-video-studio/model-registry.ts", "utf8");
  assert.doesNotMatch(registry, /description:\s*["'`][^"'`]*Benchmark/i);
  assert.match(registry, /Premium Personen-Ersetzung mit starker Szenen- und Bewegungstreue\./);
  assert.match(registry, /Schnelle und günstigere Personen-Ersetzung\./);
  assert.match(registry, /Schnelle Video-Bearbeitung mit mehreren Referenzen · 720p\./);
  assert.match(workspace, /\{!modelOpen \? <div className="uv-generate-bar">/);
  assert.match(workspace, /customerMode/);
  assert.match(workspace, /ownerMode/);
});

test("Kling O3/O1 map one Character Master to one minimum Element contract", () => {
  for (const modelId of [KLING_O3_PRO_EDIT_MODEL_ID, KLING_O1_STANDARD_EDIT_MODEL_ID] as const) {
    const input = buildFalVideoEditInput({ modelId, setup: setup(modelId), sourceVideoUrl: "https://storage.example/source", characterMasterUrl: "https://storage.example/character", endUserId: "actor" });
    assert.equal("video_url" in input && input.video_url, "https://storage.example/source");
    assert.deepEqual("elements" in input && input.elements, [{ frontal_image_url: "https://storage.example/character" }]);
    assert.equal(JSON.stringify(input).includes("reference_image_urls"), false);
    assert.match(input.prompt, /@Video1/);
    assert.match(input.prompt, /@Element1/);
  }
});

test("Seedance maps source/character URLs, source-preserving aspect and silent 720p output", () => {
  const input = buildFalVideoEditInput({ modelId: SEEDANCE_2_FAST_EDIT_MODEL_ID, setup: setup(SEEDANCE_2_FAST_EDIT_MODEL_ID), sourceVideoUrl: "https://storage.example/source", characterMasterUrl: "https://storage.example/character", endUserId: "actor" });
  assert.deepEqual("video_urls" in input && input.video_urls, ["https://storage.example/source"]);
  assert.deepEqual("image_urls" in input && input.image_urls, ["https://storage.example/character"]);
  assert.equal("resolution" in input && input.resolution, "720p");
  assert.equal("aspect_ratio" in input && input.aspect_ratio, "auto");
  assert.equal("generate_audio" in input && input.generate_audio, false);
  assert.match(input.prompt, /@Image1/);
  assert.match(input.prompt, /@Video1/);
});

test("canonical intent keeps source video as scene master and rejects Character Master background authority", () => {
  const prompt = buildCharacterReplacePrompt({ modelId: KLING_O3_PRO_EDIT_MODEL_ID, userInstruction: "Keep it natural." });
  assert.match(prompt, /absolute source for scene/);
  assert.match(prompt, /Never copy the background/);
  assert.match(prompt, /garment graphic/);
  assert.match(prompt, /without overriding/);
});

test("all edit models persist and reuse authoritative fal queue handles without resubmission", async () => {
  for (const [modelId, endpoint] of MODELS) {
    let submits = 0;
    const observed: UgcVideoProviderQueueHandle[] = [];
    const handle = { endpoint, statusUrl: `https://queue.fal.run/${modelId}/status`, responseUrl: `https://queue.fal.run/${modelId}/response`, cancelUrl: `https://queue.fal.run/${modelId}/cancel` };
    const transport: FalVideoEditTransport = {
      async uploadReference() { throw new Error("trusted URL should be reused"); },
      async submit(receivedEndpoint: FalVideoEditEndpoint) { submits += 1; assert.equal(receivedEndpoint, endpoint); return { requestId: "provider-request", statusUrl: handle.statusUrl, responseUrl: handle.responseUrl, cancelUrl: handle.cancelUrl, queuePosition: 0 }; },
      async status(receivedEndpoint, requestId, queueHandle) { assert.equal(receivedEndpoint, endpoint); assert.equal(requestId, "provider-request"); observed.push(queueHandle!); return { status: "COMPLETED", queuePosition: null, error: null, logs: [], inferenceTimeSeconds: null, metrics: null, truncated: false }; },
      async result(receivedEndpoint, requestId, queueHandle) { assert.equal(receivedEndpoint, endpoint); assert.equal(requestId, "provider-request"); observed.push(queueHandle!); return { requestId, data: { video: { url: "https://result.example/video.mp4", content_type: "video/mp4" } } }; },
    };
    const provider = new FalVideoEditProvider(modelId, undefined, transport);
    const active = setup(modelId);
    const submission = await provider.submit({ clientRequestId: "job", endUserId: "actor", setup: active, references: references(active) });
    assert.equal(submission.statusUrl, handle.statusUrl);
    assert.equal(submission.responseUrl, handle.responseUrl);
    await provider.getStatus(submission.providerRequestId, handle);
    await provider.getResult({ providerRequestId: submission.providerRequestId, setup: active, providerPrompt: submission.providerPrompt, referenceOrder: submission.referenceOrder, queueHandle: handle });
    assert.equal(submits, 1);
    assert.deepEqual(observed, [handle, handle]);
  }
});

test("accepted Video Edit queue authority is persisted and an idempotent replay never resubmits", async () => {
  const holder: { manifest: UgcVideoJobManifest | null } = { manifest: null };
  let claimed = false;
  let submits = 0;
  const store: UgcVideoJobStore = {
    async ensureReady() { return { bucketId: "ugc-video-studio-assets", bucketFileSizeLimitBytes: UGC_VIDEO_RESULT_MAX_BYTES, resultMaxBytes: UGC_VIDEO_RESULT_MAX_BYTES, private: true, videoMp4Allowed: true }; },
    async claim() { if (claimed) return "EXISTS"; claimed = true; return "CREATED"; },
    async readManifest() { return holder.manifest; },
    async writeManifest(value) { holder.manifest = structuredClone(value); },
    async persistResult() { return "unused"; },
    async readResult() { return null; },
  };
  const provider: UgcVideoProvider = {
    providerId: "fal",
    isConfigured: () => true,
    async submit(request) { submits += 1; return { provider: "fal", providerModel: KLING_O3_PRO_EDIT_ENDPOINT, providerRequestId: "accepted-once", providerPrompt: request.setup.prompt, referenceOrder: request.references.map((item) => item.metadata.id), providerStatus: "IN_QUEUE", statusUrl: "https://queue.fal.run/job/status", responseUrl: "https://queue.fal.run/job/response", cancelUrl: "https://queue.fal.run/job/cancel", queuePosition: 1 }; },
    async getStatus() { throw new Error("not observed in this test"); },
    async getResult() { throw new Error("not completed in this test"); },
  };
  const input = { scope: { workspaceId: "account", actorId: "owner" }, jobId: "11111111-1111-4111-8111-111111111111", setup: setup(), references: references(setup()) };
  const first = await generateUgcVideoJob(input, { store, provider, costLimitPolicy: "OWNER_ESTIMATE_ONLY" });
  const replay = await generateUgcVideoJob(input, { store, provider, costLimitPolicy: "OWNER_ESTIMATE_ONLY" });
  assert.equal(first.status, "RUNNING");
  assert.equal(replay.providerRequestId, "accepted-once");
  assert.equal(holder.manifest?.providerStatusUrl, "https://queue.fal.run/job/status");
  assert.equal(holder.manifest?.providerResponseUrl, "https://queue.fal.run/job/response");
  assert.equal(submits, 1);
});

test("fal queue handles reject arbitrary hosts", () => {
  assert.equal(assertUgcFalQueueUrl("https://queue.fal.run/path"), "https://queue.fal.run/path");
  assert.throws(() => assertUgcFalQueueUrl("https://evil.example/path"), /UNTRUSTED/);
  assert.throws(() => assertUgcFalQueueUrl("http://queue.fal.run/path"), /UNTRUSTED/);
});

test("Kling Character Master dimensions fail closed while Seedance keeps its own image contract", () => {
  assert.doesNotThrow(() => assertUgcVideoEditImageDimensions({ modelId: KLING_O3_PRO_EDIT_MODEL_ID, width: 1200, height: 1200 }));
  assert.throws(() => assertUgcVideoEditImageDimensions({ modelId: KLING_O1_STANDARD_EDIT_MODEL_ID, width: 240, height: 240 }), /mindestens 300/);
  assert.throws(() => assertUgcVideoEditImageDimensions({ modelId: KLING_O3_PRO_EDIT_MODEL_ID, width: 2000, height: 300 }), /Seitenverhältnis/);
  assert.doesNotThrow(() => assertUgcVideoEditImageDimensions({ modelId: SEEDANCE_2_FAST_EDIT_MODEL_ID, width: 240, height: 240 }));
});

test("owner estimates and customer quotes vary by selected benchmark model", () => {
  assert.equal(estimateUgcVideoEditCostUsd({ modelId: KLING_O3_PRO_EDIT_MODEL_ID, duration: "5" }), 0.84);
  assert.equal(estimateUgcVideoEditCostUsd({ modelId: KLING_O1_STANDARD_EDIT_MODEL_ID, duration: "5" }), 0.63);
  assert.equal(estimateUgcVideoEditCostUsd({ modelId: SEEDANCE_2_FAST_EDIT_MODEL_ID, duration: "5" }), 0.72575);
  assert.equal(quoteUgcCustomerGeneration(setup(KLING_O3_PRO_EDIT_MODEL_ID), 5).credits, 125);
  assert.equal(quoteUgcCustomerGeneration(setup(KLING_O1_STANDARD_EDIT_MODEL_ID), 5).credits, 100);
  assert.equal(quoteUgcCustomerGeneration(setup(SEEDANCE_2_FAST_EDIT_MODEL_ID), 5).credits, 125);
});

test("shared Customer/Owner workspace exposes Video Edit without binary generation payloads", () => {
  const workspace = readFileSync("components/ugc-video-studio/ugc-video-studio-workspace.tsx", "utf8");
  const controls = readFileSync("components/ugc-video-studio/ugc-video-studio-controls.tsx", "utf8");
  const client = readFileSync("lib/ugc-video-studio/client.ts", "utf8");
  assert.match(controls, /Video bearbeiten/);
  assert.match(workspace, /UgcVideoEditUploader/);
  assert.match(workspace, /customerMode/);
  assert.match(workspace, /ownerMode/);
  assert.match(client, /tempReferences/);
  assert.doesNotMatch(client, /FormData|arrayBuffer\(|\.file/);
});
