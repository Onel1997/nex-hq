import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CREATIVE_STUDIO_CONTRACT_VERSION,
  DEFAULT_CREATIVE_ADVANCED_SETTINGS,
  creativeGenerationSetupSchema,
  type CreativeGenerationSetup,
} from "@/lib/creative-studio/contracts";
import { generateCreativeJob } from "@/lib/creative-studio/generation-service";
import {
  assertNanoBananaCostAllowed,
  CreativeCostCapError,
  estimateNanoBananaMaximumCostUsd,
  getCreativeProviderPublicConfig,
  NANO_BANANA_PRO_EDIT_MODEL_ID,
  NANO_BANANA_PRO_TEXT_MODEL_ID,
} from "@/lib/creative-studio/nano-banana-config";
import {
  FalNanoBananaProvider,
  FalNanoBananaUnknownOutcomeError,
  type FalNanoBananaTransport,
  type NanoBananaProviderInput,
} from "@/lib/creative-studio/providers/fal-nano-banana";
import type { CreativeImageProvider } from "@/lib/creative-studio/provider";
import type { CreativeJobManifest } from "@/lib/creative-studio/server-contracts";
import type {
  CreativeJobScope,
  CreativeJobStore,
} from "@/lib/creative-studio/server-storage";

function setup(
  overrides: Partial<CreativeGenerationSetup> = {},
): CreativeGenerationSetup {
  return creativeGenerationSetupSchema.parse({
    contractVersion: CREATIVE_STUDIO_CONTRACT_VERSION,
    prompt: "Nutze mein Model und das Design exakt für ein Parkhaus-Fashionbild.",
    modelId: "nano-banana-pro",
    aspectRatio: "4:5",
    quality: "2K",
    batchSize: 2,
    outputType: "CAMPAIGN",
    references: [
      {
        id: "ref-model",
        name: "model.png",
        mimeType: "image/png",
        byteLength: 12,
        role: "MODEL",
        order: 0,
      },
      {
        id: "ref-design",
        name: "design.png",
        mimeType: "image/png",
        byteLength: 13,
        role: "DESIGN",
        order: 1,
      },
    ],
    advanced: DEFAULT_CREATIVE_ADVANCED_SETTINGS,
    ...overrides,
  });
}

function references() {
  const active = setup();
  return [
    { metadata: active.references[0]!, bytes: Buffer.alloc(12, 1) },
    { metadata: active.references[1]!, bytes: Buffer.alloc(13, 2) },
  ];
}

test("Nano Banana Pro adapter preserves prompt, multi-reference order and native settings", async () => {
  const uploaded: string[] = [];
  let submitted:
    | { endpoint: string; input: NanoBananaProviderInput }
    | undefined;
  let frozenRequestId: string | null = null;
  const transport: FalNanoBananaTransport = {
    async uploadReference(reference) {
      uploaded.push(reference.metadata.id);
      return `https://fal.media/${reference.metadata.id}`;
    },
    async submit(endpoint, input) {
      submitted = { endpoint, input };
      return { requestId: "fal-request-1" };
    },
    async wait() {},
    async result() {
      return {
        requestId: "fal-request-1",
        data: {
          description: "done",
          images: [
            {
              url: "https://fal.media/result-1.png",
              content_type: "image/png",
              width: 2048,
              height: 2560,
            },
            { url: "https://fal.media/result-2.png" },
          ],
        },
      };
    },
  };
  const provider = new FalNanoBananaProvider(undefined, transport);
  const response = await provider.generate({
    clientRequestId: "11111111-1111-4111-8111-111111111111",
    setup: setup(),
    references: references().reverse(),
    onProviderRequestId(requestId) {
      frozenRequestId = requestId;
    },
  });
  assert.deepEqual(uploaded, ["ref-model", "ref-design"]);
  assert.equal(submitted?.endpoint, NANO_BANANA_PRO_EDIT_MODEL_ID);
  const payload = submitted?.input as Record<string, unknown>;
  assert.deepEqual(payload.image_urls, [
    "https://fal.media/ref-model",
    "https://fal.media/ref-design",
  ]);
  assert.equal(payload.aspect_ratio, "4:5");
  assert.equal(payload.resolution, "2K");
  assert.equal(payload.num_images, 2);
  assert.equal(payload.enable_web_search, false);
  assert.equal(payload.sync_mode, false);
  assert.match(String(payload.prompt), new RegExp(setup().prompt));
  assert.equal(response.providerPrompt.startsWith(setup().prompt), true);
  assert.deepEqual(response.referenceOrder, ["ref-model", "ref-design"]);
  assert.equal(frozenRequestId, "fal-request-1");
  assert.equal(response.results.length, 2);
});

test("Nano Banana Pro uses the text endpoint only when no reference is supplied", async () => {
  let endpoint = "";
  const transport: FalNanoBananaTransport = {
    async uploadReference() {
      throw new Error("must not upload");
    },
    async submit(nextEndpoint) {
      endpoint = nextEndpoint;
      return { requestId: "fal-text-1" };
    },
    async wait() {},
    async result() {
      return {
        requestId: "fal-text-1",
        data: {
          description: "done",
          images: [{ url: "https://fal.media/result.png" }],
        },
      };
    },
  };
  const provider = new FalNanoBananaProvider(undefined, transport);
  await provider.generate({
    clientRequestId: "22222222-2222-4222-8222-222222222222",
    setup: setup({ references: [], batchSize: 1, aspectRatio: "AUTO" }),
    references: [],
  });
  assert.equal(endpoint, NANO_BANANA_PRO_TEXT_MODEL_ID);
});

test("published quality pricing and the legacy internal cost cap remain enforced", () => {
  assert.equal(estimateNanoBananaMaximumCostUsd("1K", 4), 0.6);
  assert.equal(estimateNanoBananaMaximumCostUsd("2K", 2), 0.3);
  assert.equal(estimateNanoBananaMaximumCostUsd("4K", 4), 1.2);
  assert.equal(
    assertNanoBananaCostAllowed({
      quality: "4K",
      batchSize: 2,
      configuredCostCapUsd: 0.6,
    }),
    0.6,
  );
  assert.throws(
    () =>
      assertNanoBananaCostAllowed({
        quality: "4K",
        batchSize: 2,
        configuredCostCapUsd: 0.59,
      }),
    CreativeCostCapError,
  );
});

test("Owner readiness and monetary estimates do not depend on the legacy cap", () => {
  const config = getCreativeProviderPublicConfig({
    NODE_ENV: "test",
    FAL_KEY: "configured-for-test",
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "configured-for-test",
  } as NodeJS.ProcessEnv);
  assert.equal(config.costCapConfigured, false);
  assert.equal(config.ready, false);
  assert.equal(config.ownerReady, true);
  assert.equal(config.estimatedCostsUsd["2K"][1], 0.15);
  assert.equal(config.estimatedCostsUsd["2K"][2], 0.3);
  assert.equal(config.estimatedCostsUsd["4K"][4], 1.2);
});

class MemoryCreativeStore implements CreativeJobStore {
  claims = new Map<string, string>();
  manifests = new Map<string, CreativeJobManifest>();
  assets = new Map<string, { bytes: Buffer; mimeType: string }>();

  private key(scope: CreativeJobScope, jobId: string) {
    return `${scope.workspaceId}:${scope.actorId}:${jobId}`;
  }

  async claim(input: {
    scope: CreativeJobScope;
    jobId: string;
    requestFingerprint: string;
  }) {
    const key = this.key(input.scope, input.jobId);
    if (this.claims.has(key)) return "EXISTS" as const;
    this.claims.set(key, input.requestFingerprint);
    return "CREATED" as const;
  }

  async readManifest(scope: CreativeJobScope, jobId: string) {
    return this.manifests.get(this.key(scope, jobId)) ?? null;
  }

  async writeManifest(manifest: CreativeJobManifest) {
    this.manifests.set(
      this.key(
        { workspaceId: manifest.workspaceId, actorId: manifest.actorId },
        manifest.jobId,
      ),
      structuredClone(manifest),
    );
  }

  async persistResult(input: {
    scope: CreativeJobScope;
    jobId: string;
    resultId: string;
    bytes: Buffer;
    mimeType: string;
  }) {
    const path = `${this.key(input.scope, input.jobId)}:${input.resultId}`;
    this.assets.set(path, { bytes: input.bytes, mimeType: input.mimeType });
    return path;
  }

  async readResult() {
    return null;
  }
}

function successfulProvider(calls: { value: number }): CreativeImageProvider {
  return {
    providerId: "fal",
    isConfigured: () => true,
    async generate(request) {
      calls.value += 1;
      await request.onProviderRequestId?.("fal-paid-request-1");
      return {
        provider: "fal",
        providerModel: NANO_BANANA_PRO_EDIT_MODEL_ID,
        providerRequestId: "fal-paid-request-1",
        providerPrompt: request.setup.prompt,
        referenceOrder: request.references.map((item) => item.metadata.id),
        results: [1, 2].map((index) => ({
          id: `remote-${index}`,
          url: `https://fal.media/result-${index}.png`,
          downloadUrl: null,
          mimeType: "image/png",
          width: 2048,
          height: 2560,
          favorite: false,
        })),
      };
    },
  };
}

const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from("test-result"),
]);

test("durable job persistence normalizes results and duplicate request never pays twice", async () => {
  const store = new MemoryCreativeStore();
  const calls = { value: 0 };
  const provider = successfulProvider(calls);
  const scope = { workspaceId: "milaene", actorId: "owner-1" };
  const jobId = "33333333-3333-4333-8333-333333333333";
  const fetcher: typeof fetch = async () =>
    new Response(Uint8Array.from(PNG_BYTES), {
      status: 200,
      headers: { "content-type": "image/png" },
    });
  const first = await generateCreativeJob(
    { scope, jobId, setup: setup(), references: references() },
    { store, provider, fetcher, configuredCostCapUsd: 2 },
  );
  const second = await generateCreativeJob(
    { scope, jobId, setup: setup(), references: references() },
    { store, provider, fetcher, configuredCostCapUsd: 2 },
  );
  assert.equal(first.status, "SUCCEEDED");
  assert.equal(second.status, "SUCCEEDED");
  assert.equal(calls.value, 1);
  assert.equal(first.results.length, 2);
  assert.match(first.results[0]!.url, /^\/api\/creative-studio\/assets\//);
  const manifest = await store.readManifest(scope, jobId);
  assert.equal(manifest?.originalPrompt, setup().prompt);
  assert.equal(manifest?.providerRequestId, "fal-paid-request-1");
  assert.deepEqual(
    manifest?.referenceAuthority.map((item) => item.id),
    ["ref-model", "ref-design"],
  );
  assert.equal(manifest?.results.length, 2);
});

test("trusted Owner estimate-only policy runs without a configured legacy cap", async () => {
  const store = new MemoryCreativeStore();
  const calls = { value: 0 };
  const scope = { workspaceId: "owner-workspace", actorId: "owner-1" };
  const fetcher: typeof fetch = async () =>
    new Response(Uint8Array.from(PNG_BYTES), {
      status: 200,
      headers: { "content-type": "image/png" },
    });
  const run = await generateCreativeJob(
    {
      scope,
      jobId: "55555555-5555-4555-8555-555555555555",
      setup: setup({ quality: "4K", batchSize: 2 }),
      references: references(),
    },
    {
      store,
      provider: successfulProvider(calls),
      fetcher,
      configuredCostCapUsd: null,
      costLimitPolicy: "OWNER_ESTIMATE_ONLY",
    },
  );
  assert.equal(run.status, "SUCCEEDED");
  assert.equal(run.estimatedMaximumCostUsd, 0.6);
  assert.equal(calls.value, 1);
});

test("missing legacy cap still fails closed without trusted Owner policy", async () => {
  const calls = { value: 0 };
  await assert.rejects(
    generateCreativeJob(
      {
        scope: { workspaceId: "customer-workspace", actorId: "customer-1" },
        jobId: "66666666-6666-4666-8666-666666666666",
        setup: setup(),
        references: references(),
      },
      {
        store: new MemoryCreativeStore(),
        provider: successfulProvider(calls),
        configuredCostCapUsd: null,
      },
    ),
    CreativeCostCapError,
  );
  assert.equal(calls.value, 0);
});

test("ambiguous provider completion becomes UNKNOWN_OUTCOME and is not resubmitted", async () => {
  const store = new MemoryCreativeStore();
  let calls = 0;
  const provider: CreativeImageProvider = {
    providerId: "fal",
    isConfigured: () => true,
    async generate(request) {
      calls += 1;
      await request.onProviderRequestId?.("fal-unknown-1");
      throw new FalNanoBananaUnknownOutcomeError(
        "fal-unknown-1",
        "connection_closed",
      );
    },
  };
  const scope = { workspaceId: "milaene", actorId: "owner-1" };
  const jobId = "44444444-4444-4444-8444-444444444444";
  const first = await generateCreativeJob(
    { scope, jobId, setup: setup(), references: references() },
    { store, provider, configuredCostCapUsd: 2 },
  );
  const second = await generateCreativeJob(
    { scope, jobId, setup: setup(), references: references() },
    { store, provider, configuredCostCapUsd: 2 },
  );
  assert.equal(first.status, "UNKNOWN_OUTCOME");
  assert.equal(second.status, "UNKNOWN_OUTCOME");
  assert.equal(calls, 1);
});

test("Creative live route keeps credentials server-only and has no Image Studio dependency", () => {
  const route = readFileSync(
    "app/api/creative-studio/generate/route.ts",
    "utf8",
  );
  const workspace = readFileSync(
    "components/creative-studio/creative-studio-workspace.tsx",
    "utf8",
  );
  const adapter = readFileSync(
    "lib/creative-studio/providers/fal-nano-banana.ts",
    "utf8",
  );
  assert.match(route, /resolveXerianoAccess/);
  assert.match(route, /authorizeXerianoGeneration/);
  assert.match(route, /ownerUnlimited \? \{ costLimitPolicy: "OWNER_ESTIMATE_ONLY" \}/);
  assert.match(adapter, /process\.env\.FAL_KEY/);
  assert.doesNotMatch(workspace, /process\.env|SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(
    route + adapter,
    /deterministic-runtime|\/agents\/image|garment-registration|SAM|MiDaS|Identity Lock/i,
  );
  assert.doesNotMatch(workspace, /Content-Type.*multipart\/form-data/i);
});

test("live German UX exposes cost, loading, history and use-as-reference states", () => {
  const workspace = readFileSync(
    "components/creative-studio/creative-studio-workspace.tsx",
    "utf8",
  );
  const history = readFileSync(
    "components/creative-studio/creative-studio-library.tsx",
    "utf8",
  );
  const css = readFileSync("app/creative-studio.css", "utf8");
  assert.match(workspace, /Als Referenz/);
  assert.match(workspace, /Wird vorbereitet/);
  assert.match(workspace, /geschätzte Maximalkosten/);
  assert.match(workspace, /Geschätzte Kosten · ca\./);
  assert.doesNotMatch(workspace, /NEXHQ_CREATIVE_NANO_BANANA_COST_MAX_USD/);
  assert.match(history, /Teilweise erfolgreich/);
  assert.match(history, /Unbekannter Provider-Status/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /@media \(max-width: 390px\)/);
});
