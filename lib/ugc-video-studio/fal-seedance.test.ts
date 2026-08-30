import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "@fal-ai/client";

import {
  DEFAULT_UGC_VIDEO_ADVANCED_SETTINGS,
  UGC_VIDEO_STUDIO_CONTRACT_VERSION,
  ugcVideoGenerationSetupSchema,
  type UgcVideoGenerationSetup,
} from "@/lib/ugc-video-studio/contracts";
import {
  generateUgcVideoJob,
  observeUgcVideoJob,
  UgcVideoGenerationError,
} from "@/lib/ugc-video-studio/generation-service";
import type {
  UgcVideoProvider,
  UgcVideoProviderReference,
  UgcVideoProviderStatus,
} from "@/lib/ugc-video-studio/provider";
import {
  buildSeedanceInput,
  FalSeedanceProvider,
  FalSeedanceSubmitUnknownOutcomeError,
  type FalSeedanceInput,
  type FalSeedanceTransport,
} from "@/lib/ugc-video-studio/providers/fal-seedance";
import {
  sanitizeFalProviderError,
  UGC_VIDEO_PROVIDER_BODY_MAX_BYTES,
} from "@/lib/ugc-video-studio/provider-diagnostics";
import {
  assertSeedanceCostAllowed,
  estimateSeedanceMaximumCostUsd,
  SEEDANCE_25_REFERENCE_MODEL_ID,
  UgcVideoCostCapError,
} from "@/lib/ugc-video-studio/seedance-config";
import type { UgcVideoJobManifest } from "@/lib/ugc-video-studio/server-contracts";
import {
  UGC_VIDEO_RESULT_MAX_BYTES,
  UgcVideoStorageSetupError,
  type UgcVideoJobScope,
  type UgcVideoJobStore,
  type UgcVideoStorageReadiness,
  type UgcVideoStorageRequirement,
} from "@/lib/ugc-video-studio/server-storage";

function setup(
  overrides: Partial<UgcVideoGenerationSetup> = {},
): UgcVideoGenerationSetup {
  return ugcVideoGenerationSetupSchema.parse({
    contractVersion: UGC_VIDEO_STUDIO_CONTRACT_VERSION,
    prompt: "Realistisches iPhone-UGC-Video. Zeige den Fit natürlich.",
    modelId: "seedance-2.5",
    duration: "5",
    aspectRatio: "9:16",
    quality: "720p",
    bitrate: "STANDARD",
    videoType: "UGC",
    references: [],
    advanced: DEFAULT_UGC_VIDEO_ADVANCED_SETTINGS,
    ...overrides,
  });
}

function references(active: UgcVideoGenerationSetup): UgcVideoProviderReference[] {
  return active.references.map((metadata) => ({
    metadata,
    bytes: Buffer.alloc(metadata.byteLength, metadata.order + 1),
  }));
}

function mp4Buffer(byteLength = 24): Buffer {
  const bytes = Buffer.alloc(byteLength);
  bytes.write("ftyp", 4, "ascii");
  return bytes;
}

function responseFor(bytes: Buffer): typeof fetch {
  return (async () =>
    ({
      ok: true,
      url: "https://fal.media/result.mp4",
      headers: new Headers({
        "content-type": "video/mp4",
        "content-length": String(bytes.byteLength),
      }),
      arrayBuffer: async () =>
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    }) as Response) as typeof fetch;
}

function providerStatus(
  status: UgcVideoProviderStatus["status"],
  input: Partial<Omit<UgcVideoProviderStatus, "status">> = {},
): UgcVideoProviderStatus {
  return {
    status,
    queuePosition: null,
    error: null,
    logs: [],
    inferenceTimeSeconds: null,
    metrics: null,
    truncated: false,
    ...input,
  };
}

class MemoryUgcVideoStore implements UgcVideoJobStore {
  claims = new Map<string, string>();
  manifests = new Map<string, UgcVideoJobManifest>();
  assets = new Map<string, Buffer>();
  events: string[] = [];
  storageRequirements: UgcVideoStorageRequirement[] = [];
  manifestWrites = 0;

  private key(scope: UgcVideoJobScope, jobId: string) {
    return `${scope.workspaceId}:${scope.actorId}:${jobId}`;
  }

  async ensureReady(
    requirement: UgcVideoStorageRequirement = {
      requiredResultBytes: UGC_VIDEO_RESULT_MAX_BYTES,
    },
  ): Promise<UgcVideoStorageReadiness> {
    this.events.push("storage-ready");
    this.storageRequirements.push(requirement);
    return {
      bucketId: "ugc-video-studio-assets",
      bucketFileSizeLimitBytes: UGC_VIDEO_RESULT_MAX_BYTES,
      resultMaxBytes: UGC_VIDEO_RESULT_MAX_BYTES,
      private: true,
      videoMp4Allowed: true,
    };
  }

  async claim(input: {
    scope: UgcVideoJobScope;
    jobId: string;
    requestFingerprint: string;
  }) {
    this.events.push("claim");
    const key = this.key(input.scope, input.jobId);
    if (this.claims.has(key)) return "EXISTS" as const;
    this.claims.set(key, input.requestFingerprint);
    return "CREATED" as const;
  }

  async readManifest(scope: UgcVideoJobScope, jobId: string) {
    return this.manifests.get(this.key(scope, jobId)) ?? null;
  }

  async writeManifest(manifest: UgcVideoJobManifest) {
    this.manifestWrites += 1;
    this.manifests.set(
      this.key(
        { workspaceId: manifest.workspaceId, actorId: manifest.actorId },
        manifest.jobId,
      ),
      structuredClone(manifest),
    );
  }

  async persistResult(input: {
    scope: UgcVideoJobScope;
    jobId: string;
    resultId: string;
    bytes: Buffer;
  }) {
    this.events.push("persist-result");
    const path = `${this.key(input.scope, input.jobId)}:${input.resultId}`;
    this.assets.set(path, input.bytes);
    return path;
  }

  async readResult() {
    return null;
  }
}

function asyncProvider(input?: {
  statuses?: UgcVideoProviderStatus[];
  submitError?: Error;
}) {
  const calls = { submit: 0, status: 0, result: 0 };
  const statuses = [...(input?.statuses ?? [])];
  const provider: UgcVideoProvider = {
    providerId: "fal",
    isConfigured: () => true,
    async submit(request) {
      calls.submit += 1;
      if (input?.submitError) throw input.submitError;
      return {
        provider: "fal",
        providerModel: SEEDANCE_25_REFERENCE_MODEL_ID,
        providerRequestId: "fal-paid-once",
        providerPrompt: request.setup.prompt,
        referenceOrder: request.references.map((item) => item.metadata.id),
        providerStatus: "IN_QUEUE",
        statusUrl: "https://queue.fal.run/status/fal-paid-once",
        responseUrl: "https://queue.fal.run/result/fal-paid-once",
        cancelUrl: "https://queue.fal.run/cancel/fal-paid-once",
        queuePosition: 2,
      };
    },
    async getStatus() {
      calls.status += 1;
      return (
        statuses.shift() ?? {
          ...providerStatus("IN_PROGRESS"),
        }
      );
    },
    async getResult({ providerRequestId, setup: active, providerPrompt, referenceOrder }) {
      calls.result += 1;
      return {
        provider: "fal",
        providerModel: SEEDANCE_25_REFERENCE_MODEL_ID,
        providerRequestId,
        providerPrompt,
        referenceOrder,
        result: {
          id: `${providerRequestId}-remote`,
          url: "https://fal.media/result.mp4",
          downloadUrl: "https://fal.media/result.mp4",
          mimeType: "video/mp4",
          width: null,
          height: null,
          durationSeconds: Number(active.duration),
          byteLength: 24,
          favorite: false,
          provider: "fal",
          providerModel: SEEDANCE_25_REFERENCE_MODEL_ID,
          providerRequestId,
        },
        actualCostUsd: null,
      };
    },
  };
  return { provider, calls };
}

const scope = { workspaceId: "nexhq", actorId: "owner" };

test("Seedance adapter submits once, preserves reference order and exposes queue authority", async () => {
  const active = setup({
    references: [
      {
        id: "ref-model",
        name: "model.png",
        mimeType: "image/png",
        mediaType: "IMAGE",
        byteLength: 12,
        durationSeconds: null,
        role: "MODEL",
        order: 0,
      },
      {
        id: "ref-motion",
        name: "motion.mp4",
        mimeType: "video/mp4",
        mediaType: "VIDEO",
        byteLength: 16,
        durationSeconds: 4,
        role: "MOTION",
        order: 1,
      },
    ],
    duration: "8",
    aspectRatio: "16:9",
    quality: "1080p",
    bitrate: "HIGH",
  });
  const uploaded: string[] = [];
  const captured: {
    current: { endpoint: string; input: FalSeedanceInput } | null;
  } = { current: null };
  const transport: FalSeedanceTransport = {
    async uploadReference(reference) {
      uploaded.push(reference.metadata.id);
      return `https://fal.media/${reference.metadata.id}`;
    },
    async submit(endpoint, input) {
      captured.current = { endpoint, input };
      return {
        requestId: "fal-request-1",
        statusUrl: "https://fal/status",
        responseUrl: "https://fal/result",
        cancelUrl: "https://fal/cancel",
        queuePosition: 3,
      };
    },
    async status() {
      return providerStatus("IN_QUEUE", { queuePosition: 3 });
    },
    async result() {
      return {
        requestId: "fal-request-1",
        data: {
          video: { url: "https://fal.media/result.mp4", content_type: "video/mp4" },
          seed: 42,
        },
      };
    },
  };
  const provider = new FalSeedanceProvider(undefined, transport);
  const submission = await provider.submit({
    clientRequestId: "11111111-1111-4111-8111-111111111111",
    endUserId: "owner",
    setup: active,
    references: references(active).reverse(),
  });
  assert.deepEqual(uploaded, ["ref-model", "ref-motion"]);
  assert.equal(captured.current?.endpoint, SEEDANCE_25_REFERENCE_MODEL_ID);
  assert.deepEqual(captured.current?.input.image_urls, ["https://fal.media/ref-model"]);
  assert.deepEqual(captured.current?.input.video_urls, ["https://fal.media/ref-motion"]);
  assert.equal(captured.current?.input.duration, "8");
  assert.equal(captured.current?.input.aspect_ratio, "16:9");
  assert.equal(captured.current?.input.resolution, "1080p");
  assert.equal(captured.current?.input.bitrate_mode, "high");
  assert.equal(submission.providerRequestId, "fal-request-1");
  assert.equal(submission.statusUrl, "https://fal/status");
  assert.deepEqual(submission.referenceOrder, ["ref-model", "ref-motion"]);
});

test("input mapping and server-side cost cap remain provider-truthful", () => {
  const mapped = buildSeedanceInput({
    setup: setup({ aspectRatio: "AUTO", quality: "480p", duration: "30" }),
    providerPrompt: "Prompt",
    references: {
      imageUrls: [],
      videoUrls: [],
      audioUrls: [],
      promptReferenceById: new Map(),
    },
    endUserId: "owner",
  });
  assert.equal(mapped.aspect_ratio, "auto");
  assert.equal(mapped.resolution, "480p");
  assert.equal(mapped.duration, "30");
  const estimate = estimateSeedanceMaximumCostUsd({
    quality: "720p",
    aspectRatio: "9:16",
    duration: "5",
    hasVideoReference: false,
  });
  assert.equal(
    assertSeedanceCostAllowed({ setup: setup(), configuredCostCapUsd: estimate }),
    estimate,
  );
  assert.throws(
    () => assertSeedanceCostAllowed({ setup: setup(), configuredCostCapUsd: null }),
    UgcVideoCostCapError,
  );
});

test("initial POST service returns RUNNING immediately after provider acceptance", async () => {
  const store = new MemoryUgcVideoStore();
  const { provider, calls } = asyncProvider();
  const run = await generateUgcVideoJob(
    { scope, jobId: "22222222-2222-4222-8222-222222222222", setup: setup(), references: [] },
    { store, provider, configuredCostCapUsd: 100 },
  );
  assert.equal(run.status, "RUNNING");
  assert.equal(run.providerRequestId, "fal-paid-once");
  assert.deepEqual(calls, { submit: 1, status: 0, result: 0 });
  assert.deepEqual(store.storageRequirements[0], { requiredResultBytes: 52_428_800 });
});

test("queued and processing statuses remain RUNNING even well beyond ten seconds", async () => {
  const store = new MemoryUgcVideoStore();
  const { provider, calls } = asyncProvider({
    statuses: [
      providerStatus("IN_QUEUE", { queuePosition: 7 }),
      providerStatus("IN_PROGRESS"),
    ],
  });
  const jobId = "33333333-3333-4333-8333-333333333333";
  await generateUgcVideoJob(
    { scope, jobId, setup: setup(), references: [] },
    { store, provider, configuredCostCapUsd: 100, now: () => "2026-08-27T20:00:00.000Z" },
  );
  const queued = await observeUgcVideoJob(
    { scope, jobId },
    { store, provider, now: () => "2026-08-27T20:01:00.000Z" },
  );
  const processing = await observeUgcVideoJob(
    { scope, jobId },
    { store, provider, now: () => "2026-08-27T20:05:00.000Z" },
  );
  assert.equal(queued.status, "RUNNING");
  assert.equal(processing.status, "RUNNING");
  assert.equal(calls.submit, 1);
  assert.equal(calls.status, 2);
  assert.equal(calls.result, 0);
});

test("unchanged RUNNING observations do not rewrite the durable manifest", async () => {
  const store = new MemoryUgcVideoStore();
  const queued = asyncProvider({
    statuses: [
      providerStatus("IN_PROGRESS"),
      providerStatus("IN_PROGRESS"),
    ],
  });
  const jobId = "34343434-3434-4434-8434-343434343434";
  await generateUgcVideoJob(
    { scope, jobId, setup: setup(), references: [] },
    {
      store,
      provider: queued.provider,
      configuredCostCapUsd: 100,
      now: () => "2026-08-28T20:00:00.000Z",
    },
  );
  const afterSubmission = store.manifestWrites;
  await observeUgcVideoJob(
    { scope, jobId },
    {
      store,
      provider: queued.provider,
      now: () => "2026-08-28T20:00:03.000Z",
    },
  );
  const afterMeaningfulChange = store.manifestWrites;
  assert.ok(afterMeaningfulChange > afterSubmission);
  const run = await observeUgcVideoJob(
    { scope, jobId },
    {
      store,
      provider: queued.provider,
      now: () => "2026-08-28T20:00:06.000Z",
    },
  );
  assert.equal(run.status, "RUNNING");
  assert.equal(store.manifestWrites, afterMeaningfulChange);
});

test("historical UNKNOWN with a persisted request ID is recoverable by status only", async () => {
  const store = new MemoryUgcVideoStore();
  const { provider, calls } = asyncProvider({
    statuses: [providerStatus("IN_PROGRESS")],
  });
  const jobId = "39393939-3939-4939-8939-393939393939";
  await generateUgcVideoJob(
    { scope, jobId, setup: setup(), references: [] },
    { store, provider, configuredCostCapUsd: 100 },
  );
  const persisted = await store.readManifest(scope, jobId);
  assert.ok(persisted);
  await store.writeManifest({
    ...persisted,
    status: "UNKNOWN_OUTCOME",
    providerPrompt: null,
    providerStatus: null,
    message: "old_unknown_message",
  });
  const recovered = await observeUgcVideoJob(
    { scope, jobId },
    { store, provider },
  );
  assert.equal(recovered.status, "RUNNING");
  assert.equal(recovered.providerRequestId, "fal-paid-once");
  assert.deepEqual(calls, { submit: 1, status: 1, result: 0 });
});

test("provider completion finalizes the MP4 exactly once", async () => {
  const store = new MemoryUgcVideoStore();
  const { provider, calls } = asyncProvider({
    statuses: [providerStatus("COMPLETED")],
  });
  const jobId = "44444444-4444-4444-8444-444444444444";
  await generateUgcVideoJob(
    { scope, jobId, setup: setup(), references: [] },
    { store, provider, configuredCostCapUsd: 100 },
  );
  const completed = await observeUgcVideoJob(
    { scope, jobId },
    { store, provider, fetcher: responseFor(mp4Buffer()) },
  );
  const replay = await observeUgcVideoJob(
    { scope, jobId },
    { store, provider, fetcher: responseFor(mp4Buffer()) },
  );
  assert.equal(completed.status, "SUCCEEDED");
  assert.equal(completed.message, "Dein Video wurde erfolgreich erstellt.");
  assert.equal(replay.status, "SUCCEEDED");
  assert.equal(store.assets.size, 1);
  assert.deepEqual(calls, { submit: 1, status: 1, result: 1 });
});

test("provider failure becomes FAILED, while transient observation remains RUNNING", async () => {
  const store = new MemoryUgcVideoStore();
  const failedProvider = asyncProvider({
    statuses: [providerStatus("FAILED", { error: "provider_rejected" })],
  });
  const failedJob = "55555555-5555-4555-8555-555555555555";
  await generateUgcVideoJob(
    { scope, jobId: failedJob, setup: setup(), references: [] },
    { store, provider: failedProvider.provider, configuredCostCapUsd: 100 },
  );
  const failed = await observeUgcVideoJob(
    { scope, jobId: failedJob },
    { store, provider: failedProvider.provider },
  );
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.message, "Das Video konnte nicht erstellt werden.");

  const transient = asyncProvider();
  transient.provider.getStatus = async () => {
    transient.calls.status += 1;
    throw new Error("temporary_queue_network_error");
  };
  const runningJob = "56565656-5656-4656-8656-565656565656";
  await generateUgcVideoJob(
    { scope, jobId: runningJob, setup: setup(), references: [] },
    { store, provider: transient.provider, configuredCostCapUsd: 100 },
  );
  const running = await observeUgcVideoJob(
    { scope, jobId: runningJob },
    { store, provider: transient.provider },
  );
  assert.equal(running.status, "RUNNING");
  assert.equal(running.providerRequestId, "fal-paid-once");
});

test("ambiguous submission without a request ID is the only UNKNOWN outcome and is never retried", async () => {
  const store = new MemoryUgcVideoStore();
  const { provider, calls } = asyncProvider({
    submitError: new FalSeedanceSubmitUnknownOutcomeError(
      sanitizeFalProviderError({
        error: new Error("network_lost_during_submit"),
        phase: "SUBMIT",
        endpoint: SEEDANCE_25_REFERENCE_MODEL_ID,
        requestId: null,
      }),
    ),
  });
  const args = {
    scope,
    jobId: "66666666-6666-4666-8666-666666666666",
    setup: setup(),
    references: [],
  };
  const first = await generateUgcVideoJob(args, {
    store,
    provider,
    configuredCostCapUsd: 100,
  });
  const second = await generateUgcVideoJob(args, {
    store,
    provider,
    configuredCostCapUsd: 100,
  });
  assert.equal(first.status, "UNKNOWN_OUTCOME");
  assert.equal(first.providerRequestId, null);
  assert.equal(second.status, "UNKNOWN_OUTCOME");
  assert.equal(calls.submit, 1);
});

test("same accepted job is idempotent and never resubmits", async () => {
  const store = new MemoryUgcVideoStore();
  const { provider, calls } = asyncProvider();
  const args = {
    scope,
    jobId: "77777777-7777-4777-8777-777777777777",
    setup: setup(),
    references: [],
  };
  const first = await generateUgcVideoJob(args, { store, provider, configuredCostCapUsd: 100 });
  const second = await generateUgcVideoJob(args, { store, provider, configuredCostCapUsd: 100 });
  assert.equal(first.status, "RUNNING");
  assert.equal(second.status, "RUNNING");
  assert.equal(calls.submit, 1);
});

test("storage readiness still blocks before provider submission", async () => {
  const store = new MemoryUgcVideoStore();
  store.ensureReady = async () => {
    throw new UgcVideoStorageSetupError("synthetic_preflight_failure");
  };
  const { provider, calls } = asyncProvider();
  await assert.rejects(
    generateUgcVideoJob(
      { scope, jobId: "88888888-8888-4888-8888-888888888888", setup: setup(), references: [] },
      { store, provider, configuredCostCapUsd: 100 },
    ),
    (error) =>
      error instanceof UgcVideoGenerationError &&
      error.code === "UGC_VIDEO_STORAGE_SETUP_FAILED",
  );
  assert.equal(calls.submit, 0);
});

test("fal RESULT ApiError body is sanitized, structured and persisted as FAILED", async () => {
  const store = new MemoryUgcVideoStore();
  const transport: FalSeedanceTransport = {
    async uploadReference() {
      throw new Error("no references expected");
    },
    async submit() {
      return {
        requestId: "fal-result-422",
        statusUrl: "https://fal.example/status",
        responseUrl: "https://fal.example/result",
        cancelUrl: null,
        queuePosition: 1,
      };
    },
    async status() {
      return providerStatus("COMPLETED", {
        logs: [{ level: "INFO", message: "inference complete", timestamp: "2026-08-27T21:26:44Z" }],
        inferenceTimeSeconds: 3.75,
        metrics: '{"inference_time":3.75}',
      });
    },
    async result() {
      throw new ApiError({
        status: 422,
        message: "Unprocessable Entity",
        requestId: "fal-result-422",
        body: {
          code: "REFERENCE_DECODE_FAILED",
          message: "Reference image could not be decoded",
          detail: [{ loc: ["body", "image_urls", 0], msg: "invalid image" }],
          authorization: "Bearer fal-secret-value",
          image_url: "https://signed.example/private-reference.png?token=secret",
        },
      });
    },
  };
  const provider = new FalSeedanceProvider(undefined, transport);
  const jobId = "89898989-8989-4989-8989-898989898989";
  await generateUgcVideoJob(
    { scope, jobId, setup: setup(), references: [] },
    { store, provider, configuredCostCapUsd: 100 },
  );
  const run = await observeUgcVideoJob({ scope, jobId }, { store, provider });
  assert.equal(run.status, "FAILED");
  assert.equal(run.providerError?.phase, "RESULT");
  assert.equal(run.providerError?.httpStatus, 422);
  assert.equal(run.providerError?.providerCode, "REFERENCE_DECODE_FAILED");
  assert.equal(run.providerError?.providerMessage, "Reference image could not be decoded");
  assert.equal(run.providerError?.requestId, "fal-result-422");
  assert.doesNotMatch(run.providerError?.providerBody ?? "", /fal-secret-value|signed\.example/);
  assert.match(run.providerError?.providerBody ?? "", /REFERENCE_DECODE_FAILED/);
  assert.equal(run.queueObservations?.at(-1)?.status, "COMPLETED");
  assert.equal(run.queueObservations?.at(-1)?.inferenceTimeSeconds, 3.75);
});

test("provider diagnostics redact secrets and truthfully truncate oversized bodies", () => {
  const diagnostic = sanitizeFalProviderError({
    error: new ApiError({
      status: 422,
      message: "Unprocessable Entity",
      requestId: "fal-bounded",
      body: {
        code: "VALIDATION_ERROR",
        authorization: "Bearer do-not-store",
        detail: "x".repeat(UGC_VIDEO_PROVIDER_BODY_MAX_BYTES * 2),
      },
    }),
    phase: "RESULT",
    endpoint: SEEDANCE_25_REFERENCE_MODEL_ID,
    requestId: "fal-bounded",
  });
  assert.equal(diagnostic.truncated, true);
  assert.ok(Buffer.byteLength(diagnostic.providerBody ?? "") <= UGC_VIDEO_PROVIDER_BODY_MAX_BYTES);
  assert.doesNotMatch(diagnostic.providerBody ?? "", /do-not-store/);
});

test("queue observations retain only bounded latest evidence", async () => {
  const store = new MemoryUgcVideoStore();
  const status = providerStatus("IN_PROGRESS", {
    logs: Array.from({ length: 20 }, (_, index) => ({
      level: "INFO" as const,
      message: `log-${index}`,
      timestamp: `2026-08-27T21:26:${String(index).padStart(2, "0")}Z`,
    })),
    metrics: '{"queue":"observed"}',
    truncated: true,
  });
  const queued = asyncProvider({ statuses: Array.from({ length: 10 }, () => status) });
  const jobId = "90909090-9090-4090-8090-909090909090";
  let clock = Date.now();
  const checkpointNow = () => {
    clock += 61_000;
    return new Date(clock).toISOString();
  };
  await generateUgcVideoJob(
    { scope, jobId, setup: setup(), references: [] },
    { store, provider: queued.provider, configuredCostCapUsd: 100, now: checkpointNow },
  );
  for (let index = 0; index < 10; index += 1) {
    await observeUgcVideoJob({ scope, jobId }, { store, provider: queued.provider, now: checkpointNow });
  }
  const manifest = await store.readManifest(scope, jobId);
  assert.equal(manifest?.queueObservations.length, 8);
  assert.equal(manifest?.queueObservations[0]?.logs.length, 20);
  assert.equal(manifest?.queueObservations[0]?.truncated, true);
});

test("legacy 422 evidence remains limited and is not falsely reconstructed", async () => {
  const store = new MemoryUgcVideoStore();
  const queued = asyncProvider();
  const jobId = "91919191-9191-4191-8191-919191919191";
  await generateUgcVideoJob(
    { scope, jobId, setup: setup(), references: [] },
    { store, provider: queued.provider, configuredCostCapUsd: 100 },
  );
  const manifest = await store.readManifest(scope, jobId);
  assert.ok(manifest);
  await store.writeManifest({
    ...manifest,
    status: "FAILED",
    providerStatus: "FAILED",
    providerError: null,
    technicalError: "fal_result_422:Unprocessable Entity",
  });
  const recovered = await observeUgcVideoJob(
    { scope, jobId },
    { store, provider: queued.provider },
  );
  assert.equal(recovered.providerError?.phase, "RESULT");
  assert.equal(recovered.providerError?.httpStatus, 422);
  assert.equal(recovered.providerError?.providerMessage, "Unprocessable Entity");
  assert.equal(recovered.providerError?.providerBody, null);
});

test("status endpoint and client polling are UGC-owned and reload resumes persisted RUNNING jobs", async () => {
  const fs = await import("node:fs/promises");
  const route = await fs.readFile(
    "app/api/ugc-video-studio/jobs/[jobId]/route.ts",
    "utf8",
  );
  const client = await fs.readFile("lib/ugc-video-studio/client.ts", "utf8");
  const workspace = await fs.readFile(
    "components/ugc-video-studio/ugc-video-studio-workspace.tsx",
    "utf8",
  );
  const library = await fs.readFile(
    "components/ugc-video-studio/ugc-video-studio-library.tsx",
    "utf8",
  );
  assert.match(route, /observeUgcVideoJob/);
  assert.match(client, /\/api\/ugc-video-studio\/jobs\/\$\{/);
  assert.match(workspace, /find\(\(run\) => run\.status === "RUNNING"\)/);
  assert.match(workspace, /setInterval\(poll, 3_000\)/);
  assert.match(workspace, /activeRun\?\.status === "RUNNING"/);
  assert.match(workspace, /Es wurde kein neuer Auftrag gestartet/);
  assert.match(library, /<summary>Details<\/summary>/);
  assert.match(library, /Provider-Meldung/);
  assert.match(library, /Request ID/);
  assert.match(workspace, /<UgcProviderDetails run=\{activeRun\}/);
  assert.doesNotMatch(route + client + workspace, /deterministic-runtime|agents\/image/);
});
