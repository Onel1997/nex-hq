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
import {
  UgcVideoProviderDiagnosticError,
  type UgcVideoProvider,
  type UgcVideoProviderQueueHandle,
  type UgcVideoProviderReference,
} from "@/lib/ugc-video-studio/provider";
import {
  extractFalProviderValidationDetail,
} from "@/lib/ugc-video-studio/provider-diagnostics";
import {
  assertUgcFalQueueUrl,
  buildCharacterReplacePrompt,
  buildFalVideoEditInput,
  createFalVideoEditTransport,
  extractFalVideoEditQueueSubmission,
  FalVideoEditProvider,
  type FalVideoEditEndpoint,
  type FalVideoEditTransport,
} from "@/lib/ugc-video-studio/providers/fal-video-edit";
import {
  assertUgcVideoEditImageDimensions,
  assertUgcVideoEditSetup,
  assertUgcVideoEditUserPromptTokens,
  estimateUgcVideoEditCostUsd,
  UgcVideoEditInputError,
} from "@/lib/ugc-video-studio/video-edit-config";
import { quoteUgcCustomerGeneration } from "@/lib/xeriano/customer-generation";
import {
  generateUgcVideoJob,
  observeUgcVideoJob,
  UgcVideoGenerationError,
} from "@/lib/ugc-video-studio/generation-service";
import type { UgcVideoJobManifest } from "@/lib/ugc-video-studio/server-contracts";
import {
  UGC_VIDEO_RESULT_MAX_BYTES,
  UgcVideoJobStateError,
  type UgcVideoJobStore,
} from "@/lib/ugc-video-studio/server-storage";

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

function durableStoreFixture(input: {
  failWrite?: (manifest: UgcVideoJobManifest, writeNumber: number) => boolean;
  readError?: Error | null;
} = {}) {
  const holder: { manifest: UgcVideoJobManifest | null } = { manifest: null };
  let claimed = false;
  let writes = 0;
  const store: UgcVideoJobStore = {
    async ensureReady() {
      return {
        bucketId: "ugc-video-studio-assets",
        bucketFileSizeLimitBytes: UGC_VIDEO_RESULT_MAX_BYTES,
        resultMaxBytes: UGC_VIDEO_RESULT_MAX_BYTES,
        private: true,
        videoMp4Allowed: true,
      };
    },
    async claim() {
      if (claimed) return "EXISTS";
      claimed = true;
      return "CREATED";
    },
    async readManifest() {
      if (input.readError) throw input.readError;
      return holder.manifest;
    },
    async writeManifest(manifest) {
      writes += 1;
      if (input.failWrite?.(manifest, writes)) {
        throw new Error("synthetic_manifest_write_failure");
      }
      holder.manifest = structuredClone(manifest);
    },
    async persistResult() {
      return "unused";
    },
    async readResult() {
      return null;
    },
  };
  return { store, holder, writes: () => writes };
}

function acceptedProvider(input: {
  endpoint?: FalVideoEditEndpoint;
  onSubmit?: () => void;
} = {}): { provider: UgcVideoProvider; submits: () => number } {
  let submitCount = 0;
  const endpoint = input.endpoint ?? KLING_O3_PRO_EDIT_ENDPOINT;
  return {
    submits: () => submitCount,
    provider: {
      providerId: "fal",
      isConfigured: () => true,
      async submit(request) {
        submitCount += 1;
        input.onSubmit?.();
        return {
          provider: "fal",
          providerModel: endpoint,
          providerRequestId: "accepted-once",
          providerPrompt: request.setup.prompt,
          referenceOrder: request.references.map((item) => item.metadata.id),
          providerStatus: "IN_QUEUE",
          statusUrl: "https://queue.fal.run/job/status",
          responseUrl: "https://queue.fal.run/job/response",
          cancelUrl: "https://queue.fal.run/job/cancel",
          queuePosition: 0,
        };
      },
      async getStatus() {
        return {
          status: "IN_PROGRESS",
          queuePosition: null,
          error: null,
          logs: [],
          inferenceTimeSeconds: null,
          metrics: null,
          truncated: false,
        };
      },
      async getResult() {
        throw new Error("result_not_expected");
      },
    },
  };
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

test("Kling O3/O1 map one Character Master to the runtime-required image Element fields", () => {
  for (const modelId of [KLING_O3_PRO_EDIT_MODEL_ID, KLING_O1_STANDARD_EDIT_MODEL_ID] as const) {
    const input = buildFalVideoEditInput({ modelId, setup: setup(modelId), sourceVideoUrl: "https://storage.example/source", characterMasterUrl: "https://storage.example/character", endUserId: "actor" });
    assert.equal("video_url" in input && input.video_url, "https://storage.example/source");
    assert.deepEqual("elements" in input && input.elements, [{
      frontal_image_url: "https://storage.example/character",
      reference_image_urls: ["https://storage.example/character"],
    }]);
    assert.equal("elements" in input && input.elements[0]?.reference_image_urls === null, false);
    assert.equal("image_url" in input, false);
    assert.equal("keep_original_sound" in input, false);
    assert.equal("character_orientation" in input, false);
    assert.match(input.prompt, /@Video1/);
    assert.match(input.prompt, /@Element1/);
  }
});

test("Kling O3 user instructions cannot inject Seedance-style image/video aliases", () => {
  for (const token of ["@Image1", "@Video1", "@image12", "@video2"]) {
    const active = { ...setup(), prompt: `Keep the scene natural. ${token}` };
    assert.throws(
      () => assertUgcVideoEditSetup(active),
      (error) =>
        error instanceof UgcVideoEditInputError &&
        error.code === "PROVIDER_REFERENCE_TOKEN_UNSUPPORTED" &&
        /Upload-Felder/.test(error.message),
    );
    assert.throws(
      () =>
        buildFalVideoEditInput({
          modelId: KLING_O3_PRO_EDIT_MODEL_ID,
          setup: active,
          sourceVideoUrl: "https://storage.example/source",
          characterMasterUrl: "https://storage.example/character",
          endUserId: "actor",
        }),
      (error) =>
        error instanceof UgcVideoEditInputError &&
        error.code === "PROVIDER_REFERENCE_TOKEN_UNSUPPORTED",
    );
  }
});

test("invalid Kling aliases fail before durable/provider work and Customer reservation", async () => {
  const active = {
    ...setup(),
    prompt: "Preserve the motion from @Video1 and appearance from @Image1.",
  };
  const provider = acceptedProvider();
  const durable = durableStoreFixture();
  await assert.rejects(
    generateUgcVideoJob(
      {
        scope: { workspaceId: "workspace", actorId: "actor" },
        jobId: "b1111111-1111-4111-8111-111111111111",
        setup: active,
        references: references(active),
      },
      {
        provider: provider.provider,
        store: durable.store,
        costLimitPolicy: "OWNER_ESTIMATE_ONLY",
      },
    ),
    (error) =>
      error instanceof UgcVideoGenerationError &&
      error.code === "REFERENCE_INVALID" &&
      error.technicalDetails === "PROVIDER_REFERENCE_TOKEN_UNSUPPORTED",
  );
  assert.equal(provider.submits(), 0);
  assert.equal(durable.writes(), 0);

  const route = readFileSync(
    "app/api/ugc-video-studio/generate/route.ts",
    "utf8",
  );
  const guardAt = route.indexOf("assertUgcVideoEditUserPromptTokens({");
  const tempReadAt = route.indexOf("await resolveTempReferences({");
  const reserveAt = route.indexOf("await reserveCustomerGeneration({");
  const providerAt = route.indexOf("await generateUgcVideoJob(");
  assert.ok(guardAt >= 0 && guardAt < tempReadAt);
  assert.ok(guardAt < reserveAt && reserveAt < providerAt);
});

test("Seedance retains its explicit @Image1/@Video1 reference syntax", () => {
  assert.doesNotThrow(() =>
    assertUgcVideoEditUserPromptTokens({
      modelId: SEEDANCE_2_FAST_EDIT_MODEL_ID,
      prompt: "Keep @Video1 framing and use @Image1 appearance.",
    }),
  );
  const active = {
    ...setup(SEEDANCE_2_FAST_EDIT_MODEL_ID),
    prompt: "Keep @Video1 framing and use @Image1 appearance.",
  };
  const input = buildFalVideoEditInput({
    modelId: SEEDANCE_2_FAST_EDIT_MODEL_ID,
    setup: active,
    sourceVideoUrl: "https://storage.example/source",
    characterMasterUrl: "https://storage.example/character",
    endUserId: "actor",
  });
  assert.deepEqual("image_urls" in input && input.image_urls, [
    "https://storage.example/character",
  ]);
  assert.deepEqual("video_urls" in input && input.video_urls, [
    "https://storage.example/source",
  ]);
});

test("safe fal validation extraction keeps type/path/message and ignores provider input", () => {
  const detail = extractFalProviderValidationDetail({
    status: 422,
    body: {
      detail: [{
        type: "value_error",
        loc: ["body", "elements", 0, "reference_image_urls"],
        msg: "Field must contain at least one reference for request_id secret-request-id",
        input: "https://storage.example/private?token=secret-request-id",
        ctx: { signed_url: "https://storage.example/private?token=secret" },
      }],
    },
  });
  assert.deepEqual(detail, {
    providerErrorType: "value_error",
    providerValidationPath: "body.elements.0.reference_image_urls",
    providerMessage: "Field must contain at least one reference for request [REDACTED]",
  });
  assert.doesNotMatch(JSON.stringify(detail), /storage\.example|token|secret-request-id/);
});

test("Seedance maps source/character URLs, source-preserving aspect and silent 720p output", () => {
  const input = buildFalVideoEditInput({ modelId: SEEDANCE_2_FAST_EDIT_MODEL_ID, setup: setup(SEEDANCE_2_FAST_EDIT_MODEL_ID), sourceVideoUrl: "https://storage.example/source", characterMasterUrl: "https://storage.example/character", endUserId: "actor" });
  assert.deepEqual("video_urls" in input && input.video_urls, ["https://storage.example/source"]);
  assert.deepEqual("image_urls" in input && input.image_urls, ["https://storage.example/character"]);
  assert.equal("resolution" in input && input.resolution, "720p");
  assert.equal("aspect_ratio" in input && input.aspect_ratio, "auto");
  assert.equal("generate_audio" in input && input.generate_audio, false);
  assert.equal("elements" in input, false);
  assert.equal(JSON.stringify(input).includes("frontal_image_url"), false);
  assert.equal(JSON.stringify(input).includes("reference_image_urls"), false);
  assert.match(input.prompt, /@Image1/);
  assert.match(input.prompt, /@Video1/);
});

test("Setup laden restores configuration only and cannot submit or retry provider work", () => {
  const library = readFileSync("components/ugc-video-studio/ugc-video-studio-library.tsx", "utf8");
  const workspace = readFileSync("components/ugc-video-studio/ugc-video-studio-workspace.tsx", "utf8");
  const loadSetup = workspace.slice(
    workspace.indexOf("const loadSetup = useCallback"),
    workspace.indexOf("const openSave =", workspace.indexOf("const loadSetup = useCallback")),
  );

  assert.match(library, /onClick=\{\(\) => props\.onLoadSetup\(run\.setup\)\}>Setup laden<\/button>/);
  assert.doesNotMatch(library, /\/api\/ugc-video-studio\/generate/);
  assert.match(loadSetup, /setPrompt\(setup\.prompt\)/);
  assert.match(loadSetup, /setView\("CREATE"\)/);
  assert.doesNotMatch(loadSetup, /fetch\(|generateUgcVideoJob|handleGenerate|provider\.submit/);
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

test("fal submit response normalization retains authoritative queue URLs", () => {
  const expected = {
    requestId: "accepted-request",
    statusUrl: "https://queue.fal.run/fal-ai/kling-video/o3/pro/video-to-video/edit/requests/accepted-request/status",
    responseUrl: "https://queue.fal.run/fal-ai/kling-video/o3/pro/video-to-video/edit/requests/accepted-request",
    cancelUrl: "https://queue.fal.run/fal-ai/kling-video/o3/pro/video-to-video/edit/requests/accepted-request/cancel",
    queuePosition: 3,
  };
  assert.deepEqual(extractFalVideoEditQueueSubmission({
    request_id: expected.requestId,
    status_url: expected.statusUrl,
    response_url: expected.responseUrl,
    cancel_url: expected.cancelUrl,
    queue_position: expected.queuePosition,
  }), expected);
  assert.deepEqual(extractFalVideoEditQueueSubmission({ queue: {
    requestId: expected.requestId,
    statusUrl: expected.statusUrl,
    responseUrl: expected.responseUrl,
    cancelUrl: expected.cancelUrl,
    queuePosition: expected.queuePosition,
  } }), expected);
});

test("all Video Edit models use authoritative status/result URLs verbatim with GET", async () => {
  for (const [, endpoint] of MODELS) {
    const statusUrl = `https://queue.fal.run/${endpoint}/requests/accepted/status`;
    const responseUrl = `https://queue.fal.run/${endpoint}/requests/accepted`;
    const requests: Array<{ url: string; method: string | undefined }> = [];
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input);
      requests.push({ url, method: init?.method });
      return new Response(JSON.stringify(
        url === statusUrl
          ? { status: "COMPLETED" }
          : { video: { url: "https://result.example/video.mp4", content_type: "video/mp4" } },
      ), { status: 200, headers: { "content-type": "application/json" } });
    };
    const transport = createFalVideoEditTransport("test-credential", fetcher);
    const handle = { endpoint, statusUrl, responseUrl, cancelUrl: null };
    assert.equal((await transport.status(endpoint, "accepted", handle)).status, "COMPLETED");
    assert.equal((await transport.result(endpoint, "accepted", handle)).data.video.url, "https://result.example/video.mp4");
    assert.deepEqual(requests, [
      { url: statusUrl, method: "GET" },
      { url: responseUrl, method: "GET" },
    ]);
    assert.equal(requests.some((request) => request.url.includes("?")), false);
  }
});

test("accepted Video Edit HTTP 422 becomes UNKNOWN and remains recoverable without resubmit", async () => {
  const holder: { manifest: UgcVideoJobManifest | null } = { manifest: null };
  let claimed = false;
  let submits = 0;
  let polls = 0;
  let recoveryAvailable = false;
  const store: UgcVideoJobStore = {
    async ensureReady() { return { bucketId: "ugc-video-studio-assets", bucketFileSizeLimitBytes: UGC_VIDEO_RESULT_MAX_BYTES, resultMaxBytes: UGC_VIDEO_RESULT_MAX_BYTES, private: true, videoMp4Allowed: true }; },
    async claim() { if (claimed) return "EXISTS"; claimed = true; return "CREATED"; },
    async readManifest() { return holder.manifest; },
    async writeManifest(value) { holder.manifest = structuredClone(value); },
    async persistResult() { throw new Error("result must not persist"); },
    async readResult() { return null; },
  };
  const provider: UgcVideoProvider = {
    providerId: "fal",
    isConfigured: () => true,
    async submit(request) {
      submits += 1;
      return {
        provider: "fal",
        providerModel: KLING_O3_PRO_EDIT_ENDPOINT,
        providerRequestId: "accepted-once",
        providerPrompt: request.setup.prompt,
        referenceOrder: request.references.map((item) => item.metadata.id),
        providerStatus: "IN_QUEUE",
        statusUrl: "https://queue.fal.run/job/status",
        responseUrl: "https://queue.fal.run/job/response",
        cancelUrl: null,
        queuePosition: 0,
      };
    },
    async getStatus() {
      polls += 1;
      if (recoveryAvailable) {
        return {
          status: "IN_PROGRESS",
          queuePosition: null,
          error: null,
          logs: [],
          inferenceTimeSeconds: null,
          metrics: null,
          truncated: false,
        } as const;
      }
      throw new UgcVideoProviderDiagnosticError({
        phase: "STATUS",
        httpStatus: 422,
        providerCode: null,
        providerMessage: "FAL_VIDEO_EDIT_QUEUE_HTTP_422",
        providerBody: null,
        requestId: "accepted-once",
        endpoint: KLING_O3_PRO_EDIT_ENDPOINT,
        occurredAt: "2026-09-01T20:00:00.000Z",
        truncated: false,
      }, false);
    },
    async getResult() { throw new Error("result must not be requested"); },
  };
  const input = {
    scope: { workspaceId: "account", actorId: "owner" },
    jobId: "22222222-2222-4222-8222-222222222222",
    setup: setup(),
    references: references(setup()),
  };
  await generateUgcVideoJob(input, {
    store,
    provider,
    costLimitPolicy: "OWNER_ESTIMATE_ONLY",
  });
  const first = await observeUgcVideoJob(
    { scope: input.scope, jobId: input.jobId },
    { store, provider, now: () => "2026-09-01T20:01:00.000Z" },
  );
  recoveryAvailable = true;
  const replay = await observeUgcVideoJob(
    { scope: input.scope, jobId: input.jobId },
    { store, provider, now: () => "2026-09-01T20:02:00.000Z" },
  );
  assert.equal(first.status, "UNKNOWN_OUTCOME");
  assert.equal(first.message, "Der Anbieterstatus konnte nicht sicher abgerufen werden.");
  assert.equal(replay.status, "RUNNING");
  assert.equal(submits, 1);
  assert.equal(polls, 2);
  assert.equal(holder.manifest?.providerStatusUrl, "https://queue.fal.run/job/status");
  assert.equal(holder.manifest?.providerResponseUrl, "https://queue.fal.run/job/response");
  assert.equal(JSON.stringify(first).includes("queue.fal.run"), false);
});

test("HTTP 422 diagnostics identify authoritative recovery without leaking URL or request ID", async () => {
  const messages: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...items: unknown[]) => { messages.push(items); };
  try {
    const transport = createFalVideoEditTransport("test-credential", async () =>
      new Response(JSON.stringify({ detail: [{
        type: "value_error",
        loc: ["body", "elements", 0, "reference_image_urls"],
        msg: "Reference contract invalid",
        input: "https://private.example/image?token=must-not-log",
      }] }), {
        status: 422,
        headers: { "content-type": "application/json" },
      }));
    await assert.rejects(
      transport.status(KLING_O3_PRO_EDIT_ENDPOINT, "secret-request-id", {
        endpoint: KLING_O3_PRO_EDIT_ENDPOINT,
        statusUrl: "https://queue.fal.run/private/status",
        responseUrl: "https://queue.fal.run/private/response",
        cancelUrl: null,
      }),
      (error) =>
        error instanceof UgcVideoProviderDiagnosticError &&
        error.diagnostic.httpStatus === 422 &&
        error.terminal === false,
    );
  } finally {
    console.warn = originalWarn;
  }
  const serialized = JSON.stringify(messages);
  assert.match(serialized, /authoritative/);
  assert.match(serialized, /422/);
  assert.match(serialized, /kling-o3-pro-video-edit/);
  assert.match(serialized, /value_error/);
  assert.match(serialized, /body\.elements\.0\.reference_image_urls/);
  assert.match(serialized, /Reference contract invalid/);
  assert.doesNotMatch(serialized, /secret-request-id|queue\.fal\.run|private\.example|must-not-log/);
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

test("durable manifest is readable before reference binding and provider submission", async () => {
  const fixture = durableStoreFixture();
  const active = setup();
  const events: string[] = [];
  const accepted = acceptedProvider({
    onSubmit: () => {
      events.push("submit");
      assert.equal(fixture.holder.manifest?.providerStatus, "SUBMITTING");
    },
  });
  const run = await generateUgcVideoJob(
    {
      scope: { workspaceId: "account", actorId: "owner" },
      jobId: "56565656-5656-4656-8656-565656565656",
      setup: active,
      references: references(active),
    },
    {
      store: fixture.store,
      provider: accepted.provider,
      costLimitPolicy: "OWNER_ESTIMATE_ONLY",
      onDurableJobReady: async (manifest) => {
        events.push("bind");
        assert.equal(fixture.holder.manifest?.jobId, manifest.jobId);
        assert.equal(fixture.holder.manifest?.requestFingerprint, manifest.requestFingerprint);
      },
    },
  );
  assert.deepEqual(events, ["bind", "submit"]);
  assert.equal(run.status, "RUNNING");
  assert.equal(fixture.holder.manifest?.providerRequestId, "accepted-once");
});

test("O3, O1 and Seedance share the same durable-before-submit service invariant", async () => {
  let index = 0;
  for (const [modelId, endpoint] of MODELS) {
    index += 1;
    const fixture = durableStoreFixture();
    const active = setup(modelId);
    const accepted = acceptedProvider({
      endpoint,
      onSubmit: () => {
        assert.equal(fixture.holder.manifest?.providerStatus, "SUBMITTING");
      },
    });
    const jobId = `64646464-6464-4464-8${String(index).padStart(3, "0")}-646464646464`;
    const run = await generateUgcVideoJob(
      {
        scope: { workspaceId: "account", actorId: "owner" },
        jobId,
        setup: active,
        references: references(active),
      },
      {
        store: fixture.store,
        provider: accepted.provider,
        costLimitPolicy: "OWNER_ESTIMATE_ONLY",
      },
    );
    assert.equal(run.status, "RUNNING");
    assert.equal(fixture.holder.manifest?.providerModel, endpoint);
    assert.equal(accepted.submits(), 1);
  }
});

test("durable creation failure prevents binding and provider submission", async () => {
  const fixture = durableStoreFixture({ failWrite: () => true });
  const active = setup();
  let bindings = 0;
  const accepted = acceptedProvider();
  await assert.rejects(
    generateUgcVideoJob(
      {
        scope: { workspaceId: "account", actorId: "owner" },
        jobId: "57575757-5757-4757-8757-575757575757",
        setup: active,
        references: references(active),
      },
      {
        store: fixture.store,
        provider: accepted.provider,
        costLimitPolicy: "OWNER_ESTIMATE_ONLY",
        onDurableJobReady: async () => {
          bindings += 1;
        },
      },
    ),
    (error) =>
      error instanceof UgcVideoGenerationError &&
      error.code === "UGC_VIDEO_STORAGE_SETUP_FAILED" &&
      error.providerSubmissionPossible === false,
  );
  assert.equal(bindings, 0);
  assert.equal(accepted.submits(), 0);
});

test("queue-handle persistence retries without another provider submission", async () => {
  const fixture = durableStoreFixture({
    failWrite: (manifest, writeNumber) =>
      writeNumber === 2 && Boolean(manifest.providerRequestId),
  });
  const active = setup();
  const accepted = acceptedProvider();
  const run = await generateUgcVideoJob(
    {
      scope: { workspaceId: "account", actorId: "owner" },
      jobId: "58585858-5858-4858-8858-585858585858",
      setup: active,
      references: references(active),
    },
    {
      store: fixture.store,
      provider: accepted.provider,
      costLimitPolicy: "OWNER_ESTIMATE_ONLY",
    },
  );
  assert.equal(run.status, "RUNNING");
  assert.equal(run.providerRequestId, "accepted-once");
  assert.equal(accepted.submits(), 1);
  assert.ok(fixture.writes() >= 3);
});

test("accepted queue-handle persistence ambiguity is durable UNKNOWN, never 404 or resubmit", async () => {
  const fixture = durableStoreFixture({
    failWrite: (manifest) =>
      manifest.status === "RUNNING" && Boolean(manifest.providerRequestId),
  });
  const active = setup();
  const accepted = acceptedProvider();
  const input = {
    scope: { workspaceId: "account", actorId: "owner" },
    jobId: "59595959-5959-4959-8959-595959595959",
    setup: active,
    references: references(active),
  };
  const run = await generateUgcVideoJob(input, {
    store: fixture.store,
    provider: accepted.provider,
    costLimitPolicy: "OWNER_ESTIMATE_ONLY",
  });
  const replay = await generateUgcVideoJob(input, {
    store: fixture.store,
    provider: accepted.provider,
    costLimitPolicy: "OWNER_ESTIMATE_ONLY",
  });
  assert.equal(run.status, "UNKNOWN_OUTCOME");
  assert.equal(replay.status, "UNKNOWN_OUTCOME");
  assert.equal(fixture.holder.manifest?.providerRequestId, "accepted-once");
  assert.equal(accepted.submits(), 1);
});

test("job reads distinguish true absence from inconsistent durable state", async () => {
  const missing = durableStoreFixture();
  await assert.rejects(
    observeUgcVideoJob(
      {
        scope: { workspaceId: "account", actorId: "owner" },
        jobId: "60606060-6060-4060-8060-606060606060",
      },
      { store: missing.store, provider: acceptedProvider().provider },
    ),
    (error) =>
      error instanceof UgcVideoGenerationError &&
      error.code === "JOB_NOT_FOUND" &&
      error.status === 404,
  );

  const inconsistent = durableStoreFixture({
    readError: new UgcVideoJobStateError("manifest_invalid:ZodError"),
  });
  await assert.rejects(
    observeUgcVideoJob(
      {
        scope: { workspaceId: "account", actorId: "owner" },
        jobId: "61616161-6161-4161-8161-616161616161",
      },
      { store: inconsistent.store, provider: acceptedProvider().provider },
    ),
    (error) =>
      error instanceof UgcVideoGenerationError &&
      error.code === "JOB_STATE_INCONSISTENT" &&
      error.status === 503,
  );
});

test("an idempotency claim without a manifest is inconsistent and never resubmitted", async () => {
  const fixture = durableStoreFixture();
  fixture.store.claim = async () => "EXISTS";
  const active = setup();
  const accepted = acceptedProvider();
  await assert.rejects(
    generateUgcVideoJob(
      {
        scope: { workspaceId: "account", actorId: "owner" },
        jobId: "63636363-6363-4363-8363-636363636363",
        setup: active,
        references: references(active),
      },
      {
        store: fixture.store,
        provider: accepted.provider,
        costLimitPolicy: "OWNER_ESTIMATE_ONLY",
      },
    ),
    (error) =>
      error instanceof UgcVideoGenerationError &&
      error.code === "JOB_STATE_INCONSISTENT" &&
      error.status === 503,
  );
  assert.equal(accepted.submits(), 0);
});

test("stale durable SUBMITTING job becomes UNKNOWN without provider submission", async () => {
  const fixture = durableStoreFixture();
  const active = setup();
  const accepted = acceptedProvider();
  const input = {
    scope: { workspaceId: "account", actorId: "owner" },
    jobId: "62626262-6262-4262-8262-626262626262",
    setup: active,
    references: references(active),
  };
  await generateUgcVideoJob(input, {
    store: fixture.store,
    provider: accepted.provider,
    costLimitPolicy: "OWNER_ESTIMATE_ONLY",
    now: () => "2026-09-02T08:00:00.000Z",
  });
  assert.ok(fixture.holder.manifest);
  fixture.holder.manifest = {
    ...fixture.holder.manifest,
    status: "RUNNING",
    providerRequestId: null,
    providerStatus: "SUBMITTING",
    updatedAt: "2026-09-02T08:00:00.000Z",
  };
  const run = await observeUgcVideoJob(
    { scope: input.scope, jobId: input.jobId },
    {
      store: fixture.store,
      provider: accepted.provider,
      now: () => "2026-09-02T08:03:00.000Z",
    },
  );
  assert.equal(run.status, "UNKNOWN_OUTCOME");
  assert.equal(accepted.submits(), 1);
});

test("UGC route binds temp references only through the durable-job callback", () => {
  const route = readFileSync(
    "app/api/ugc-video-studio/generate/route.ts",
    "utf8",
  );
  const generateAt = route.indexOf("const run = await generateUgcVideoJob");
  const callbackAt = route.indexOf("onDurableJobReady:", generateAt);
  const bindingAt = route.indexOf("await bindTempReferences", callbackAt);
  assert.ok(generateAt >= 0);
  assert.ok(callbackAt > generateAt);
  assert.ok(bindingAt > callbackAt);
  assert.equal(route.slice(0, generateAt).includes("await bindTempReferences"), false);
  assert.match(route, /error\.providerSubmissionPossible/);
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
