import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCanvas } from "canvas";
import { DESIGN_STUDIO_CONTRACT_VERSION, designGenerationSetupSchema, type DesignGenerationSetup } from "./contracts";
import {
  buildDesignProviderInput, buildDesignProviderPrompt, DESIGN_ENDPOINTS,
  DESIGN_RASTER_DIMENSIONS, DESIGN_VECTOR_ARTBOARDS, extractQuotedText, resolveDesignEndpoint,
} from "./model-config";
import { normalizeFalDesignResults } from "./providers/fal-design";
import { FalDesignProvider, type FalDesignTransport } from "./providers/fal-design";
import { quoteDesignCustomerGeneration } from "../xeriano/customer-generation";
import { generateDesignJob } from "./generation-service";
import type { DesignJobManifest } from "./server-contracts";

function setup(patch: Partial<DesignGenerationSetup> = {}): DesignGenerationSetup {
  return designGenerationSetupSchema.parse({
    contractVersion: DESIGN_STUDIO_CONTRACT_VERSION,
    prompt: 'Vintage artwork with "LOVE STAYED TEACHABLE"', stylePreset: "VINTAGE",
    model: "IDEOGRAM_4", outputMode: "RASTER", aspectRatio: "1:1", quality: "STANDARD", resolution: "2K", count: 1,
    reference: null, ...patch,
  });
}

test("Design model routing uses only the six approved fal endpoints", () => {
  assert.equal(resolveDesignEndpoint(setup()), DESIGN_ENDPOINTS.IDEOGRAM_TEXT);
  assert.equal(resolveDesignEndpoint(setup({ reference: { name: "r.png", mimeType: "image/png", byteLength: 8 } })), DESIGN_ENDPOINTS.IDEOGRAM_REFERENCE);
  assert.equal(resolveDesignEndpoint(setup({ model: "RECRAFT_4" })), DESIGN_ENDPOINTS.RECRAFT_RASTER);
  assert.equal(resolveDesignEndpoint(setup({ model: "RECRAFT_4", outputMode: "VECTOR" })), DESIGN_ENDPOINTS.RECRAFT_VECTOR);
  assert.equal(resolveDesignEndpoint(setup({ model: "RECRAFT_4", reference: { name: "r.png", mimeType: "image/png", byteLength: 8 } })), DESIGN_ENDPOINTS.RECRAFT_REFERENCE_RASTER);
  assert.equal(resolveDesignEndpoint(setup({ model: "RECRAFT_4", outputMode: "VECTOR", reference: { name: "r.png", mimeType: "image/png", byteLength: 8 } })), DESIGN_ENDPOINTS.RECRAFT_REFERENCE_VECTOR);
});

test("Ideogram quality and provider-specific ratios are server mapped", () => {
  const prepared = buildDesignProviderInput({ setup: setup({ quality: "HIGH", aspectRatio: "4:5" }), providerPrompt: "p", referenceUrl: null });
  assert.equal(prepared.payload.rendering_speed, "QUALITY");
  assert.deepEqual(prepared.payload.image_size, DESIGN_RASTER_DIMENSIONS["2K"]["4:5"]);
  const recraft = buildDesignProviderInput({ setup: setup({ model: "RECRAFT_4", aspectRatio: "2:3" }), providerPrompt: "p", referenceUrl: null });
  assert.deepEqual(recraft.payload.image_size, DESIGN_RASTER_DIMENSIONS["2K"]["2:3"]);
  const vector = buildDesignProviderInput({ setup: setup({ model: "RECRAFT_4", outputMode: "VECTOR", aspectRatio: "2:3", resolution: "4K" }), providerPrompt: "p", referenceUrl: null });
  assert.deepEqual(vector.payload.image_size, DESIGN_VECTOR_ARTBOARDS["2:3"]);
});

test("2K and 4K map to exact aligned long-edge dimensions and change the fingerprint inputs", () => {
  for (const resolution of ["2K", "4K"] as const) {
    for (const ratio of ["1:1", "4:5", "3:4", "2:3"] as const) {
      const dimensions = DESIGN_RASTER_DIMENSIONS[resolution][ratio];
      assert.equal(dimensions.width % 64, 0);
      assert.equal(dimensions.height % 64, 0);
      assert.equal(Math.max(dimensions.width, dimensions.height), resolution === "2K" ? (["4:5", "2:3"].includes(ratio) ? 1920 : 2048) : (["4:5", "2:3"].includes(ratio) ? 3840 : 4096));
    }
  }
  const two = buildDesignProviderInput({ setup: setup({ resolution: "2K" }), providerPrompt: "p", referenceUrl: null });
  const four = buildDesignProviderInput({ setup: setup({ resolution: "4K" }), providerPrompt: "p", referenceUrl: null });
  assert.notDeepEqual(two.payload.image_size, four.payload.image_size);
  assert.ok(quoteDesignCustomerGeneration(setup({ resolution: "4K" })).credits > quoteDesignCustomerGeneration(setup({ resolution: "2K" })).credits);
});

test("references use real provider input fields", () => {
  const reference = { name: "r.png", mimeType: "image/png" as const, byteLength: 8 };
  const ideogram = buildDesignProviderInput({ setup: setup({ reference }), providerPrompt: "p", referenceUrl: "https://temporary.example/r" });
  assert.equal(ideogram.payload.image_url, "https://temporary.example/r");
  const recraft = buildDesignProviderInput({ setup: setup({ model: "RECRAFT_4", reference }), providerPrompt: "p", referenceUrl: "https://temporary.example/r" });
  assert.deepEqual(recraft.payload.style_image_urls, ["https://temporary.example/r"]);
});

test("quoted slogan remains byte-for-byte visible authority and artwork-only rules are present", () => {
  const prompt = buildDesignProviderPrompt(setup());
  assert.deepEqual(extractQuotedText(setup().prompt), ["LOVE STAYED TEACHABLE"]);
  assert.match(prompt, /"LOVE STAYED TEACHABLE"/);
  assert.match(prompt, /without translation, paraphrase or added words/);
  assert.match(prompt, /No garment\. No T-shirt\. No hoodie\. No mockup/);
  assert.doesNotMatch(prompt, /LOVE REMAINED/);
});

test("option allowlist rejects Ideogram vector, invalid count and arbitrary models", () => {
  assert.equal(designGenerationSetupSchema.safeParse({ ...setup(), outputMode: "VECTOR" }).success, false);
  assert.equal(designGenerationSetupSchema.safeParse({ ...setup(), count: 3 }).success, false);
  assert.equal(designGenerationSetupSchema.safeParse({ ...setup({ model: "RECRAFT_4" }), count: 2 }).success, false);
  assert.equal(designGenerationSetupSchema.safeParse({ ...setup(), model: "fal-ai/arbitrary" }).success, false);
});

test("Recraft vector response remains an original SVG result", () => {
  const results = normalizeFalDesignResults({ image: { url: "https://example.test/vector.svg" } }, true);
  assert.equal(results[0]?.mimeType, "image/svg+xml");
  assert.equal(results[0]?.url, "https://example.test/vector.svg");
});

test("fal adapter uses queue acceptance evidence and temporary reference upload", async () => {
  const calls: string[] = [];
  const transport: FalDesignTransport = {
    async upload() { calls.push("upload"); return "https://temporary.example/reference"; },
    async submit(endpoint) { calls.push(`submit:${endpoint}`); return "request-safe-test"; },
    async wait(endpoint) { calls.push(`wait:${endpoint}`); },
    async result() { return { images: [{ url: "https://result.example/design.png", content_type: "image/png" }] }; },
  };
  const provider = new FalDesignProvider(undefined, transport);
  let accepted = "";
  const response = await provider.generate({
    jobId: "00000000-0000-4000-8000-000000000001",
    setup: setup({ reference: { name: "r.png", mimeType: "image/png", byteLength: 8 } }),
    reference: { name: "r.png", mimeType: "image/png", bytes: Buffer.from([137,80,78,71,13,10,26,10]) },
    onAccepted(requestId) { accepted = requestId; },
  });
  assert.equal(accepted, "request-safe-test");
  assert.deepEqual(calls.slice(0, 3), ["upload", `submit:${DESIGN_ENDPOINTS.IDEOGRAM_REFERENCE}`, `wait:${DESIGN_ENDPOINTS.IDEOGRAM_REFERENCE}`]);
  assert.equal(response.results.length, 1);
});

test("accepted fal request recovery observes status and never submits again", async () => {
  let submitted = 0;
  let completed = false;
  const transport: FalDesignTransport = {
    async upload() { return "https://temporary.example/reference"; },
    async submit() { submitted += 1; return "request-safe-test"; },
    async wait() {},
    async status() { return completed ? "COMPLETED" : "RUNNING"; },
    async result() { return { images: [{ url: "https://result.example/design.png", content_type: "image/png" }] }; },
  };
  const provider = new FalDesignProvider(undefined, transport);
  const input = {
    setup: setup(),
    providerRequestId: "accepted-request",
    providerModel: DESIGN_ENDPOINTS.IDEOGRAM_TEXT,
    providerPrompt: "safe enhanced prompt",
  };
  assert.equal(await provider.recover(input), null);
  completed = true;
  const recovered = await provider.recover(input);
  assert.equal(recovered?.providerRequestId, "accepted-request");
  assert.equal(recovered?.results.length, 1);
  assert.equal(submitted, 0);
});

test("shared economics produces server-authoritative, dimension-sensitive safe quotes", () => {
  const fast = quoteDesignCustomerGeneration(setup({ quality: "FAST" }));
  const high = quoteDesignCustomerGeneration(setup({ quality: "HIGH" }));
  const four = quoteDesignCustomerGeneration(setup({ count: 4 }));
  const raster = quoteDesignCustomerGeneration(setup({ model: "RECRAFT_4", outputMode: "RASTER" }));
  const vector = quoteDesignCustomerGeneration(setup({ model: "RECRAFT_4", outputMode: "VECTOR" }));
  assert.ok(high.credits > fast.credits);
  assert.ok(four.credits > fast.credits);
  assert.ok(vector.credits > raster.credits);
  for (const quote of [fast, high, four, raster, vector]) {
    const economics = quote.pricingSnapshot.economics as { safetyStatus?: string };
    assert.ok(["SAFE_BELOW_TARGET", "TARGET_OR_BETTER"].includes(economics.safetyStatus ?? ""));
    assert.equal(quote.studio, "DESIGN_STUDIO");
    assert.equal(quote.operation, "IMAGE");
  }
});

test("Design generate route reserves before provider and Owner shares validation without reservation", async () => {
  const route = await readFile(new URL("../../app/api/design-studio/generate/route.ts", import.meta.url), "utf8");
  assert.ok(route.indexOf("if (customer) authority = await reserveCustomerGeneration") < route.indexOf("let run = await generateDesignJob"));
  assert.match(route, /authorization\.bypass === "OWNER_UNLIMITED"/);
  assert.match(route, /if \(customer\) authority = await reserveCustomerGeneration/);
  assert.match(route, /reconcileCustomerGenerationFromRun/);
  assert.match(route, /quarantineCustomerGeneration/);
  assert.match(route, /\["DUPLICATE_REQUEST_RUNNING", "IDEMPOTENCY_CONFLICT"\]/);
  assert.match(route, /must remain[\s\S]*status endpoint/);
  assert.match(route, /recordDesignProviderCostEvent/);
});

test("Design UI combines create, Library, history, upload and shell-aware handoff", async () => {
  const source = await readFile(new URL("../../components/xeriano/customer-design-studio.tsx", import.meta.url), "utf8");
  for (const label of ["Erstellen", "Bibliothek", "Verlauf", "Design hochladen", "Im Creative Studio verwenden", "Variation erstellen", "Owner · Unlimited"]) assert.match(source, new RegExp(label.replace("·", "\\s*·\\s*")));
  assert.match(source, /handoffHref\(assetId, "CREATIVE_STUDIO", audience\)/);
  assert.match(source, /type="file" accept="image\/png,image\/jpeg,image\/webp"/);
});

test("persistent generation stores original SVG bytes and replays one idempotent job", async () => {
  let manifest: DesignJobManifest | null = null;
  let claimed = false;
  let providerCalls = 0;
  const stored = new Map<string, Buffer>();
  const store = {
    async claim() { if (claimed) return "EXISTS" as const; claimed = true; return "CREATED" as const; },
    async writeManifest(value: DesignJobManifest) { manifest = value; },
    async readManifest() { return manifest; },
    async listManifests() { return manifest ? [manifest] : []; },
    async persistReference() { return "reference/original.png"; },
    async persistResult(input: { resultId: string; bytes: Buffer }) { stored.set(input.resultId, input.bytes); return `results/${input.resultId}.svg`; },
    async readResult() { return null; },
  };
  const vectorSetup = setup({ model: "RECRAFT_4", outputMode: "VECTOR" });
  const provider = {
    isConfigured: () => true,
    async generate(input: { onAccepted?: (requestId: string, endpoint: typeof DESIGN_ENDPOINTS.RECRAFT_VECTOR) => Promise<void> | void }) {
      providerCalls += 1;
      await input.onAccepted?.("accepted-vector", DESIGN_ENDPOINTS.RECRAFT_VECTOR);
      return { providerModel: DESIGN_ENDPOINTS.RECRAFT_VECTOR, providerRequestId: "accepted-vector", providerPrompt: "safe", results: [{ url: "https://result.example/vector.svg", mimeType: "image/svg+xml", width: null, height: null }] };
    },
  };
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10z"/></svg>');
  const options = {
    store: store as never, provider,
    fetcher: async () => new Response(Uint8Array.from(svg), { status: 200, headers: { "content-type": "image/svg+xml" } }),
    now: () => "2026-08-31T00:00:00.000Z",
  };
  const input = { scope: { workspaceId: "workspace", actorId: "actor" }, jobId: "00000000-0000-4000-8000-000000000002", setup: vectorSetup, reference: null };
  const first = await generateDesignJob(input, options);
  const replay = await generateDesignJob(input, options);
  assert.equal(first.status, "SUCCEEDED");
  assert.equal(first.results[0]?.mimeType, "image/svg+xml");
  assert.deepEqual([...stored.values()][0], svg);
  assert.equal(replay.id, first.id);
  assert.equal(providerCalls, 1);
});

test("raster result dimensions come from persisted bytes, not requested/provider metadata", async () => {
  let manifest: DesignJobManifest | null = null;
  const store = {
    async claim() { return "CREATED" as const; }, async writeManifest(value: DesignJobManifest) { manifest = value; },
    async readManifest() { return manifest; }, async listManifests() { return []; }, async persistReference() { return "reference"; },
    async persistResult() { return "results/output.png"; }, async readResult() { return null; },
  };
  const provider = {
    isConfigured: () => true,
    async generate(input: { onAccepted?: (requestId: string, endpoint: typeof DESIGN_ENDPOINTS.IDEOGRAM_TEXT) => Promise<void> | void }) {
      await input.onAccepted?.("accepted-raster", DESIGN_ENDPOINTS.IDEOGRAM_TEXT);
      return { providerModel: DESIGN_ENDPOINTS.IDEOGRAM_TEXT, providerRequestId: "accepted-raster", providerPrompt: "safe", results: [{ url: "https://result.example/output.png", mimeType: "image/png", width: 9999, height: 9999 }] };
    },
  };
  const canvas = createCanvas(96, 64); const png = canvas.toBuffer("image/png");
  const run = await generateDesignJob({
    scope: { workspaceId: "workspace", actorId: "actor" }, jobId: "00000000-0000-4000-8000-000000000009",
    setup: setup({ resolution: "2K" }), reference: null,
  }, {
    store: store as never, provider,
    fetcher: async () => new Response(Uint8Array.from(png), { status: 200, headers: { "content-type": "image/png" } }),
    now: () => "2026-08-31T00:00:00.000Z",
  });
  assert.equal(run.results[0]?.width, 96);
  assert.equal(run.results[0]?.height, 64);
  assert.equal(run.results[0]?.resolution, "2K");
});
