import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCanvas } from "canvas";
import {
  buildDesignUtilityProviderInput, DESIGN_UTILITY_CONFIG,
} from "./utility-config";
import { FalDesignUtilityProvider, type FalUtilityTransport } from "./providers/fal-utility";
import { quoteDesignUtilityGeneration } from "../xeriano/customer-generation";
import { ownerEstimatedCostLabel } from "./owner-cost";
import { executeDesignUtility } from "./utility-service";
import type { DesignUtilityManifest } from "./utility-contracts";

test("background removal and ESRGAN inputs are exact server allowlists", () => {
  assert.deepEqual(buildDesignUtilityProviderInput({ operation: "BACKGROUND_REMOVE", imageUrl: "https://safe.example/source.png" }), {
    endpoint: "fal-ai/ideogram/remove-background", payload: { image_url: "https://safe.example/source.png" },
  });
  assert.deepEqual(buildDesignUtilityProviderInput({ operation: "UPSCALE", imageUrl: "https://safe.example/source.png" }), {
    endpoint: "fal-ai/esrgan",
    payload: { image_url: "https://safe.example/source.png", model: "RealESRGAN_x2plus", scale: 2, face: false, output_format: "png", tile: 0 },
  });
});

test("utility pricing is centralized, target-safe and owner money is formatted server-side", () => {
  for (const operation of ["BACKGROUND_REMOVE", "UPSCALE"] as const) {
    const quote = quoteDesignUtilityGeneration(operation);
    assert.ok(quote.credits > 0);
    assert.equal(quote.studio, "DESIGN_STUDIO");
    assert.equal(quote.operation, "IMAGE");
    assert.match(ownerEstimatedCostLabel(quote) ?? "", /^ca\. \d+,\d{2}\s€/);
    const economics = quote.pricingSnapshot.economics as { safetyStatus?: string };
    assert.ok(["SAFE_BELOW_TARGET", "TARGET_OR_BETTER"].includes(economics.safetyStatus ?? ""));
  }
  assert.equal(DESIGN_UTILITY_CONFIG.BACKGROUND_REMOVE.providerCostUsdMicros, 10_000);
  assert.equal(DESIGN_UTILITY_CONFIG.UPSCALE.providerCostUsdMicros, DESIGN_UTILITY_CONFIG.UPSCALE.providerUnitCostUsdMicros * DESIGN_UTILITY_CONFIG.UPSCALE.estimatedComputeSeconds);
});

test("utility provider records acceptance and returns only normalized result URL", async () => {
  const calls: unknown[] = [];
  const transport: FalUtilityTransport = {
    async upload() { calls.push("upload"); return "https://temporary.example/source.png"; },
    async submit(endpoint, payload) { calls.push({ endpoint, payload }); return "request-private"; },
    async wait() { calls.push("wait"); },
    async result() { return { image: { url: "https://result.example/result.png" } }; },
  };
  const provider = new FalDesignUtilityProvider(undefined, transport);
  let accepted = "";
  const response = await provider.generate({
    operation: "UPSCALE", sourceBytes: Buffer.from("source"), sourceMimeType: "image/png",
    onAccepted(requestId) { accepted = requestId; },
  });
  assert.equal(accepted, "request-private");
  assert.equal(response.url, "https://result.example/result.png");
  assert.deepEqual(calls[1], {
    endpoint: "fal-ai/esrgan",
    payload: { image_url: "https://temporary.example/source.png", model: "RealESRGAN_x2plus", scale: 2, face: false, output_format: "png", tile: 0 },
  });
});

test("utility job claim prevents a second provider submission for the same identity", async () => {
  const canvas = createCanvas(32, 32); const png = canvas.toBuffer("image/png");
  let manifest: DesignUtilityManifest | null = null;
  let claimed = false; let providerCalls = 0;
  const store = {
    async claim() { if (claimed) return "EXISTS" as const; claimed = true; return "CREATED" as const; },
    async write(value: DesignUtilityManifest) { manifest = value; },
    async read() { return manifest; },
  };
  const provider = {
    isConfigured: () => true,
    async generate(input: { onAccepted?: (requestId: string, endpoint: string) => Promise<void> | void }) {
      providerCalls += 1; await input.onAccepted?.("request-private", "fal-ai/ideogram/remove-background");
      return { requestId: "request-private", endpoint: "fal-ai/ideogram/remove-background", url: "https://result.example/transparent.png" };
    },
  };
  const context = {
    userId: "00000000-0000-4000-8000-000000000010", email: null, role: "CUSTOMER" as const,
    accountId: "00000000-0000-4000-8000-000000000020", accountName: "Test", workspaceKey: "workspace",
    brainWorkspaceId: null, source: "XERIANO_MEMBERSHIP" as const,
  };
  const input = {
    context, scope: { workspaceId: "workspace", actorId: context.userId },
    jobId: "00000000-0000-4000-8000-000000000030", sourceAssetId: "00000000-0000-4000-8000-000000000040",
    operation: "BACKGROUND_REMOVE" as const, source: { bytes: png, mimeType: "image/png", dimensions: { width: 32, height: 32 } },
  };
  const dependencies = {
    store: store as never, provider: provider as never,
    fetcher: async () => new Response(Uint8Array.from(png), { status: 200, headers: { "content-type": "image/png" } }),
    now: () => "2026-08-31T00:00:00.000Z",
  };
  const first = await executeDesignUtility(input, dependencies);
  const replay = await executeDesignUtility(input, dependencies);
  assert.ok(first.bytes);
  assert.equal(replay.bytes, null);
  assert.equal(providerCalls, 1);
  assert.equal(Buffer.compare(input.source.bytes, png), 0);
});

test("utility route preserves account isolation, reserve-before-provider and generic client output", async () => {
  const route = await readFile(new URL("../../app/api/design-studio/utility/route.ts", import.meta.url), "utf8");
  const service = await readFile(new URL("./utility-service.ts", import.meta.url), "utf8");
  const quoteRoute = await readFile(new URL("../../app/api/design-studio/utility/quote/route.ts", import.meta.url), "utf8");
  assert.ok(route.indexOf("if (customer) authority = await reserveCustomerGeneration") < route.indexOf("const execution = await executeDesignUtility"));
  assert.match(route, /reconcileCustomerGenerationFromRun/);
  assert.match(route, /quarantineCustomerGeneration/);
  assert.match(service, /\.eq\("id", assetId\)\.eq\("account_id", context\.accountId\)/);
  assert.doesNotMatch(quoteRoute, /pricingSnapshot|providerCostMicros|providerModel/);
});

test("mobile Library chip strips are swipeable without page overflow", async () => {
  const css = await readFile(new URL("../../app/xeriano.css", import.meta.url), "utf8");
  assert.match(css, /\.xeriano-filter-row\{[^}]*overflow-x:auto[^}]*overflow-y:hidden[^}]*-webkit-overflow-scrolling:touch/);
  assert.match(css, /\.xeriano-filter-row button\{[^}]*flex:0 0 auto[^}]*min-height:44px/);
  const ui = await readFile(new URL("../../components/xeriano/customer-design-studio.tsx", import.meta.url), "utf8");
  for (const label of ["Auflösung", "2K", "4K", "Vektor", "frei skalierbar", "Hintergrund entfernen", "Auf 4K upscalen", "Geschätzte Kosten"]) {
    assert.match(ui, new RegExp(label));
  }
  assert.match(ui, /UTILITY_JOB_KEY_PREFIX/);
  assert.match(ui, /utilityBusyRef/);
});
