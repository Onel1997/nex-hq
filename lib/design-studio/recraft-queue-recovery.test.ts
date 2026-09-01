import assert from "node:assert/strict";
import test from "node:test";

import {
  DESIGN_STUDIO_CONTRACT_VERSION,
  designGenerationSetupSchema,
  type DesignGenerationSetup,
} from "./contracts";
import { recoverDesignJob } from "./generation-service";
import { DESIGN_ENDPOINTS, resolveDesignEndpoint, type DesignEndpoint } from "./model-config";
import { normalizeDesignProviderError } from "./provider-errors";
import type { DesignProviderQueueHandle } from "./provider";
import {
  assertFalDesignQueueUrl,
  buildFalDesignQueueObservationUrl,
  createFalDesignQueueObserver,
  extractFalDesignQueueHandle,
  extractFalDesignQueueRequestId,
  FalDesignProvider,
  type FalDesignTransport,
} from "./providers/fal-design";
import { DESIGN_JOB_VERSION, designJobManifestSchema, type DesignJobManifest } from "./server-contracts";

function recraftSetup(patch: Partial<DesignGenerationSetup> = {}): DesignGenerationSetup {
  return designGenerationSetupSchema.parse({
    contractVersion: DESIGN_STUDIO_CONTRACT_VERSION,
    prompt: "Standalone editorial artwork",
    stylePreset: "EDITORIAL",
    model: "RECRAFT_4",
    outputMode: "RASTER",
    aspectRatio: "1:1",
    quality: "STANDARD",
    resolution: "2K",
    count: 1,
    reference: null,
    ...patch,
  });
}

const reference = { name: "reference.png", mimeType: "image/png" as const, byteLength: 8 };
const routeClasses = [
  { setup: recraftSetup(), endpoint: DESIGN_ENDPOINTS.RECRAFT_RASTER },
  { setup: recraftSetup({ outputMode: "VECTOR" }), endpoint: DESIGN_ENDPOINTS.RECRAFT_VECTOR },
  { setup: recraftSetup({ reference }), endpoint: DESIGN_ENDPOINTS.RECRAFT_REFERENCE_RASTER },
  { setup: recraftSetup({ reference, outputMode: "VECTOR" }), endpoint: DESIGN_ENDPOINTS.RECRAFT_REFERENCE_VECTOR },
] as const;

function queueHandle(endpoint: DesignEndpoint, suffix = endpoint.replaceAll("/", "-")): DesignProviderQueueHandle {
  return {
    requestId: "accepted-request",
    endpoint,
    statusUrl: `https://queue.fal.run/authoritative/${suffix}/status?logs=0`,
    responseUrl: `https://queue.fal.run/authoritative/${suffix}/response`,
    cancelUrl: `https://queue.fal.run/authoritative/${suffix}/cancel`,
  };
}

test("all four Recraft route classes retain a conservative legacy URL without probing alternatives", () => {
  for (const route of routeClasses) {
    assert.equal(resolveDesignEndpoint(route.setup), route.endpoint);
    assert.equal(
      buildFalDesignQueueObservationUrl(route.endpoint, "accepted-request", "status"),
      `https://queue.fal.run/${route.endpoint}/requests/accepted-request/status?logs=0`,
    );
    assert.equal(
      buildFalDesignQueueObservationUrl(route.endpoint, "accepted-request", "result"),
      `https://queue.fal.run/${route.endpoint}/requests/accepted-request`,
    );
  }
});

test("authoritative Recraft observer uses provider-returned status and response URLs verbatim", async () => {
  const calls: Array<{ url: string; authorization: string | null }> = [];
  const endpoint = DESIGN_ENDPOINTS.RECRAFT_REFERENCE_VECTOR;
  const handle = queueHandle(endpoint, "provider-issued-handle");
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({ url, authorization: headers.get("authorization") });
    const value = url === handle.statusUrl
      ? { status: "COMPLETED", request_id: "accepted-request" }
      : { image: { url: "https://result.example/design.svg" } };
    return new Response(JSON.stringify(value), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const observer = createFalDesignQueueObserver("server-secret", fetcher);
  assert.equal(await observer.status(endpoint, "accepted-request", handle), "COMPLETED");
  assert.deepEqual(await observer.result(endpoint, "accepted-request", handle), {
    image: { url: "https://result.example/design.svg" },
  });
  assert.deepEqual(calls.map((call) => call.url), [handle.statusUrl, handle.responseUrl]);
  assert.deepEqual(calls.map((call) => call.authorization), ["Key server-secret", "Key server-secret"]);
});

test("fal acceptance parser captures installed queue URLs and compatible request-id shapes", () => {
  const endpoint = DESIGN_ENDPOINTS.RECRAFT_VECTOR;
  const installed = {
    status: "IN_QUEUE",
    request_id: "installed-id",
    status_url: "https://queue.fal.run/provider/status-resource",
    response_url: "https://queue.fal.run/provider/response-resource",
    cancel_url: "https://queue.fal.run/provider/cancel-resource",
  };
  assert.equal(extractFalDesignQueueRequestId({ request_id: "installed-id" }), "installed-id");
  assert.equal(extractFalDesignQueueRequestId({ requestId: "camel-id" }), "camel-id");
  assert.equal(extractFalDesignQueueRequestId({ queue: { response: { request_id: "wrapped-id" } } }), "wrapped-id");
  assert.equal(extractFalDesignQueueRequestId("transport-id"), "transport-id");
  assert.equal(extractFalDesignQueueRequestId({ status: "IN_QUEUE" }), null);
  assert.deepEqual(extractFalDesignQueueHandle(installed, endpoint), {
    requestId: "installed-id",
    endpoint,
    statusUrl: installed.status_url,
    responseUrl: installed.response_url,
    cancelUrl: installed.cancel_url,
  });
});

test("all four Recraft submissions carry one immutable authoritative handle through wait and result", async () => {
  for (const route of routeClasses) {
    const handle = queueHandle(route.endpoint);
    const calls: Array<{ stage: string; endpoint: DesignEndpoint; queueHandle?: DesignProviderQueueHandle | null }> = [];
    const transport: FalDesignTransport = {
      async upload() { return "https://temporary.example/reference"; },
      async submit(endpoint) { calls.push({ stage: "submit", endpoint }); return { requestId: handle.requestId, queueHandle: handle }; },
      async wait(endpoint, _requestId, acceptedHandle) { calls.push({ stage: "status", endpoint, queueHandle: acceptedHandle }); },
      async result(endpoint, _requestId, acceptedHandle) {
        calls.push({ stage: "result", endpoint, queueHandle: acceptedHandle });
        return route.setup.outputMode === "VECTOR"
          ? { image: { url: "https://result.example/design.svg" } }
          : { images: [{ url: "https://result.example/design.png", content_type: "image/png" }] };
      },
    };
    const provider = new FalDesignProvider(undefined, transport);
    const response = await provider.generate({
      jobId: "00000000-0000-4000-8000-000000000071",
      setup: route.setup,
      reference: route.setup.reference
        ? { name: "reference.png", mimeType: "image/png", bytes: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) }
        : null,
    });
    assert.equal(response.providerModel, route.endpoint);
    assert.deepEqual(calls, [
      { stage: "submit", endpoint: route.endpoint },
      { stage: "status", endpoint: route.endpoint, queueHandle: handle },
      { stage: "result", endpoint: route.endpoint, queueHandle: handle },
    ]);
  }
});

test("accepted reference-vector manifest recovers by polling only and never resubmits", async () => {
  const setup = recraftSetup({ reference, outputMode: "VECTOR" });
  const endpoint = DESIGN_ENDPOINTS.RECRAFT_REFERENCE_VECTOR;
  let manifest: DesignJobManifest = designJobManifestSchema.parse({
    version: DESIGN_JOB_VERSION,
    jobId: "00000000-0000-4000-8000-000000000072",
    workspaceId: "workspace",
    actorId: "actor",
    requestFingerprint: "a".repeat(64),
    createdAt: "2026-08-31T19:29:00.000Z",
    updatedAt: "2026-08-31T19:29:01.000Z",
    status: "UNKNOWN_OUTCOME",
    setup,
    originalPrompt: setup.prompt,
    providerPrompt: null,
    providerModel: endpoint,
    providerRequestId: "accepted-request",
    providerQueueHandle: queueHandle(endpoint),
    estimatedCostUsdMicros: 80_000,
    referenceChecksumSha256: "b".repeat(64),
    referenceStoragePath: "private/reference.png",
    results: [],
    message: "Der Anbieterstatus wird sicher geprüft.",
    failureCode: null,
    technicalError: "FAL_DESIGN_QUEUE_HTTP_422",
  });
  let generated = 0;
  const observed: Array<{ endpoint: DesignEndpoint; requestId: string; queueHandle?: DesignProviderQueueHandle | null }> = [];
  const store = {
    async readManifest() { return manifest; },
    async writeManifest(value: DesignJobManifest) { manifest = value; },
  };
  const provider = {
    isConfigured: () => true,
    async generate() { generated += 1; throw new Error("must not submit"); },
    async recover(input: { providerModel: DesignEndpoint; providerRequestId: string; providerQueueHandle?: DesignProviderQueueHandle | null }) {
      observed.push({ endpoint: input.providerModel, requestId: input.providerRequestId, queueHandle: input.providerQueueHandle });
      return null;
    },
  };
  const run = await recoverDesignJob({
    scope: { workspaceId: "workspace", actorId: "actor" },
    jobId: manifest.jobId,
  }, { store: store as never, provider });
  assert.equal(run.status, "UNKNOWN_OUTCOME");
  assert.equal("providerQueueHandle" in run, false);
  assert.equal(generated, 0);
  assert.deepEqual(observed, [{ endpoint, requestId: "accepted-request", queueHandle: queueHandle(endpoint) }]);
});

test("legacy accepted manifests remain recoverable without URL probing or resubmission", async () => {
  const setup = recraftSetup({ outputMode: "VECTOR" });
  const endpoint = DESIGN_ENDPOINTS.RECRAFT_VECTOR;
  let manifest = designJobManifestSchema.parse({
    version: DESIGN_JOB_VERSION,
    jobId: "00000000-0000-4000-8000-000000000073",
    workspaceId: "workspace",
    actorId: "actor",
    requestFingerprint: "c".repeat(64),
    createdAt: "2026-08-31T19:29:00.000Z",
    updatedAt: "2026-08-31T19:29:01.000Z",
    status: "UNKNOWN_OUTCOME",
    setup,
    originalPrompt: setup.prompt,
    providerPrompt: null,
    providerModel: endpoint,
    providerRequestId: "legacy-accepted-request",
    estimatedCostUsdMicros: 80_000,
    referenceChecksumSha256: null,
    referenceStoragePath: null,
    results: [],
    message: "Der Anbieterstatus wird sicher geprüft.",
    failureCode: null,
    technicalError: "FAL_DESIGN_QUEUE_HTTP_405",
  });
  let submitted = 0;
  let recoveredHandle: DesignProviderQueueHandle | null | undefined = undefined;
  const provider = {
    isConfigured: () => true,
    async generate() { submitted += 1; throw new Error("must not submit"); },
    async recover(input: { providerQueueHandle?: DesignProviderQueueHandle | null }) {
      recoveredHandle = input.providerQueueHandle;
      return null;
    },
  };
  const store = {
    async readManifest() { return manifest; },
    async writeManifest(value: DesignJobManifest) { manifest = value; },
  };
  const run = await recoverDesignJob({
    scope: { workspaceId: "workspace", actorId: "actor" },
    jobId: manifest.jobId,
  }, { store: store as never, provider });
  assert.equal(manifest.providerQueueHandle, null);
  assert.equal(recoveredHandle, null);
  assert.equal(run.status, "UNKNOWN_OUTCOME");
  assert.equal(submitted, 0);
});

test("generic Recraft queue 405/422 responses are recovery-contract failures, not capacity", () => {
  for (const status of [405, 422]) {
    assert.equal(normalizeDesignProviderError({
      status,
      body: { detail: "Request does not belong to this recovery resource" },
    }, "RECRAFT_4"), null);
  }
});

test("persisted queue URLs are HTTPS and restricted to the exact fal queue host", async () => {
  assert.equal(
    assertFalDesignQueueUrl("https://queue.fal.run/provider/status?logs=0"),
    "https://queue.fal.run/provider/status?logs=0",
  );
  for (const unsafe of [
    "http://queue.fal.run/provider/status",
    "https://evil.example/provider/status",
    "https://queue.fal.run.evil.example/provider/status",
    "https://queue.fal.run:8443/provider/status",
  ]) {
    assert.throws(() => assertFalDesignQueueUrl(unsafe), /FAL_DESIGN_QUEUE_URL_UNTRUSTED/);
  }
  let fetched = false;
  const observer = createFalDesignQueueObserver("server-secret", async () => {
    fetched = true;
    return new Response();
  });
  await assert.rejects(
    observer.status(DESIGN_ENDPOINTS.RECRAFT_VECTOR, "accepted-request", {
      ...queueHandle(DESIGN_ENDPOINTS.RECRAFT_VECTOR),
      statusUrl: "https://attacker.example/status",
    }),
    /FAL_DESIGN_QUEUE_URL_UNTRUSTED/,
  );
  assert.equal(fetched, false);
});

test("Recraft recovery diagnostics omit credentials, request IDs and provider bodies", async () => {
  const diagnostics: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => { diagnostics.push(args); };
  try {
    const observer = createFalDesignQueueObserver("never-log-this-key", async () => new Response(
      JSON.stringify({ detail: "sensitive-provider-body" }),
      { status: 422, headers: { "content-type": "application/json" } },
    ));
    await assert.rejects(
      observer.status(
        DESIGN_ENDPOINTS.RECRAFT_REFERENCE_VECTOR,
        "never-log-this-request-id",
        {
          ...queueHandle(DESIGN_ENDPOINTS.RECRAFT_REFERENCE_VECTOR),
          requestId: "never-log-this-request-id",
        },
      ),
      /FAL_DESIGN_QUEUE_HTTP_422/,
    );
  } finally {
    console.warn = originalWarn;
  }
  const serialized = JSON.stringify(diagnostics);
  assert.match(serialized, /recraft_poll_failed/);
  assert.match(serialized, /"requestIdPresent":true/);
  assert.match(serialized, /"providerUrlSource":"authoritative"/);
  assert.doesNotMatch(serialized, /never-log-this-key|never-log-this-request-id|sensitive-provider-body/);
});
