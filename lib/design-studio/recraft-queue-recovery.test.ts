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
import {
  buildFalDesignQueueObservationUrl,
  createFalDesignQueueObserver,
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

test("all four Recraft route classes retain the full accepted endpoint in status and result URLs", () => {
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

test("exact-path Recraft observer uses the same reference-vector route for status and result", async () => {
  const calls: Array<{ url: string; authorization: string | null }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({ url, authorization: headers.get("authorization") });
    const value = url.endsWith("/status?logs=0")
      ? { status: "COMPLETED", request_id: "accepted-request" }
      : { image: { url: "https://result.example/design.svg" } };
    return new Response(JSON.stringify(value), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const observer = createFalDesignQueueObserver("server-secret", fetcher);
  const endpoint = DESIGN_ENDPOINTS.RECRAFT_REFERENCE_VECTOR;
  assert.equal(await observer.status(endpoint, "accepted-request"), "COMPLETED");
  assert.deepEqual(await observer.result(endpoint, "accepted-request"), {
    image: { url: "https://result.example/design.svg" },
  });
  assert.deepEqual(calls.map((call) => call.url), [
    `https://queue.fal.run/${endpoint}/requests/accepted-request/status?logs=0`,
    `https://queue.fal.run/${endpoint}/requests/accepted-request`,
  ]);
  assert.deepEqual(calls.map((call) => call.authorization), ["Key server-secret", "Key server-secret"]);
});

test("fal acceptance parser supports installed, compatible and wrapped request-id shapes", () => {
  assert.equal(extractFalDesignQueueRequestId({ request_id: "installed-id" }), "installed-id");
  assert.equal(extractFalDesignQueueRequestId({ requestId: "camel-id" }), "camel-id");
  assert.equal(extractFalDesignQueueRequestId({ queue: { response: { request_id: "wrapped-id" } } }), "wrapped-id");
  assert.equal(extractFalDesignQueueRequestId("transport-id"), "transport-id");
  assert.equal(extractFalDesignQueueRequestId({ status: "IN_QUEUE" }), null);
});

test("Recraft generation submission, wait and result keep one immutable route", async () => {
  for (const route of routeClasses) {
    const calls: Array<{ stage: string; endpoint: DesignEndpoint }> = [];
    const transport: FalDesignTransport = {
      async upload() { return "https://temporary.example/reference"; },
      async submit(endpoint) { calls.push({ stage: "submit", endpoint }); return "accepted-request"; },
      async wait(endpoint) { calls.push({ stage: "status", endpoint }); },
      async result(endpoint) {
        calls.push({ stage: "result", endpoint });
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
      { stage: "status", endpoint: route.endpoint },
      { stage: "result", endpoint: route.endpoint },
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
    estimatedCostUsdMicros: 80_000,
    referenceChecksumSha256: "b".repeat(64),
    referenceStoragePath: "private/reference.png",
    results: [],
    message: "Der Anbieterstatus wird sicher geprüft.",
    failureCode: null,
    technicalError: "FAL_DESIGN_QUEUE_HTTP_422",
  });
  let generated = 0;
  const observed: Array<{ endpoint: DesignEndpoint; requestId: string }> = [];
  const store = {
    async readManifest() { return manifest; },
    async writeManifest(value: DesignJobManifest) { manifest = value; },
  };
  const provider = {
    isConfigured: () => true,
    async generate() { generated += 1; throw new Error("must not submit"); },
    async recover(input: { providerModel: DesignEndpoint; providerRequestId: string }) {
      observed.push({ endpoint: input.providerModel, requestId: input.providerRequestId });
      return null;
    },
  };
  const run = await recoverDesignJob({
    scope: { workspaceId: "workspace", actorId: "actor" },
    jobId: manifest.jobId,
  }, { store: store as never, provider });
  assert.equal(run.status, "UNKNOWN_OUTCOME");
  assert.equal(generated, 0);
  assert.deepEqual(observed, [{ endpoint, requestId: "accepted-request" }]);
});

test("a generic Recraft queue 422 is a recovery-contract failure, not capacity", () => {
  assert.equal(normalizeDesignProviderError({
    status: 422,
    body: { detail: "Request does not belong to this endpoint" },
  }, "RECRAFT_4"), null);
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
      observer.status(DESIGN_ENDPOINTS.RECRAFT_REFERENCE_VECTOR, "never-log-this-request-id"),
      /FAL_DESIGN_QUEUE_HTTP_422/,
    );
  } finally {
    console.warn = originalWarn;
  }
  const serialized = JSON.stringify(diagnostics);
  assert.match(serialized, /recraft_poll_failed/);
  assert.match(serialized, /"requestIdPresent":true/);
  assert.doesNotMatch(serialized, /never-log-this-key|never-log-this-request-id|sensitive-provider-body/);
});
