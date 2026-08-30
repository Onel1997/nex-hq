import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { createCanvas } from "canvas";

import {
  FalDepthAnythingV2Provider,
  type FalDepthClient,
} from "@/lib/image/depth-estimation/fal-depth-anything-v2-adapter";
import {
  FAL_DEPTH_ANYTHING_V2_ADAPTER_VERSION,
  FAL_DEPTH_ANYTHING_V2_MODEL,
  type DepthEstimationPolicy,
} from "@/lib/image/depth-estimation/types";
import {
  depthEstimationIdempotencyKey,
  validateDepthEstimation,
} from "@/lib/image/depth-estimation/validation";
import { includeDepthEstimationCost } from "@/lib/image/depth-estimation/pricing";

function png(width: number, height: number, flat = false): Buffer {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, flat ? "rgb(100 100 100)" : "rgb(20 20 20)");
  gradient.addColorStop(1, flat ? "rgb(100 100 100)" : "rgb(230 230 230)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  return canvas.toBuffer("image/png");
}

const policy: DepthEstimationPolicy = {
  contractVersion: "nexhq-depth-estimation-policy-v1",
  provider: "fal",
  model: FAL_DEPTH_ANYTHING_V2_MODEL,
  adapterVersion: FAL_DEPTH_ANYTHING_V2_ADAPTER_VERSION,
  requiredInProduction: true,
  localFallbackAllowed: false,
  maximumCostUsd: 0.01,
  minimumDynamicRange: 0.04,
  maximumDiscontinuityFraction: 0.08,
};

test("official fal Depth Anything request sends the exact Base only", async () => {
  const output = png(96, 72);
  let captured: Parameters<FalDepthClient["subscribe"]>[1] | null = null;
  const client: FalDepthClient = {
    async subscribe(_model, options) {
      captured = options;
      return {
        requestId: "fal-depth-request-1",
        data: {
          image: {
            url: `data:image/png;base64,${output.toString("base64")}`,
            width: 96,
            height: 72,
            content_type: "image/png",
          },
        },
      };
    },
  };
  const provider = new FalDepthAnythingV2Provider(
    { apiKey: "server-only-test", model: FAL_DEPTH_ANYTHING_V2_MODEL, maximumCostUsd: 0.01 },
    client,
  );
  const base = png(96, 72);
  const checksum = createHash("sha256").update(base).digest("hex");
  const result = await provider.estimateDepth({
    jobId: "11111111-1111-4111-8111-111111111111",
    baseImage: { bytes: base, checksumSha256: checksum, mimeType: "image/png" },
    idempotencyKey: "depth-test-key",
  });
  assert.equal(result.model, FAL_DEPTH_ANYTHING_V2_MODEL);
  assert.equal(result.sourceBaseChecksumSha256, checksum);
  assert.deepEqual(Object.keys(captured!.input), ["image_url"]);
  assert.match(captured!.input.image_url, /^data:image\/png;base64,/);
  assert.equal(JSON.stringify(captured).toLowerCase().includes("artwork"), false);
  assert.equal(captured!.headers["Idempotency-Key"], "depth-test-key");
});

test("depth validation binds, normalizes, and rejects degenerate maps", async () => {
  const base = png(100, 80);
  const checksum = createHash("sha256").update(base).digest("hex");
  const jobId = "22222222-2222-4222-8222-222222222222";
  const idempotencyKey = depthEstimationIdempotencyKey({
    jobId,
    sourceBaseChecksumSha256: checksum,
    provider: "fal",
    model: policy.model,
    adapterVersion: policy.adapterVersion,
  });
  const validated = await validateDepthEstimation({
    policy,
    result: {
      provider: "fal",
      model: policy.model,
      adapterVersion: policy.adapterVersion,
      providerRequestId: "depth-2",
      jobId,
      sourceBaseChecksumSha256: checksum,
      depthMapBytes: png(50, 40),
      outputWidth: 50,
      outputHeight: 40,
      outputMimeType: "image/png",
    },
    jobId,
    sourceBaseChecksumSha256: checksum,
    sourceWidth: 100,
    sourceHeight: 80,
    printableRegion: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
    idempotencyKey,
  });
  assert.equal(validated.provenance.status, "VALIDATED");
  assert.deepEqual(validated.provenance.normalizedDimensions, { width: 100, height: 80 });
  assert.equal(validated.provenance.artworkInputIncluded, false);
  assert.equal(
    createHash("sha256").update(validated.normalizedDepthMapPngBytes).digest("hex"),
    validated.provenance.depthMapChecksumSha256,
  );

  await assert.rejects(
    validateDepthEstimation({
      policy,
      result: {
        provider: "fal",
        model: policy.model,
        adapterVersion: policy.adapterVersion,
        providerRequestId: "depth-flat",
        jobId,
        sourceBaseChecksumSha256: checksum,
        depthMapBytes: png(50, 40, true),
        outputWidth: 50,
        outputHeight: 40,
        outputMimeType: "image/png",
      },
      jobId,
      sourceBaseChecksumSha256: checksum,
      sourceWidth: 100,
      sourceHeight: 80,
      printableRegion: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
      idempotencyKey,
    }),
    /DEPTH_DYNAMIC_RANGE_WEAK/,
  );
});

test("idempotency binding changes for a different Base and is stable for replay", () => {
  const first = depthEstimationIdempotencyKey({
    jobId: "33333333-3333-4333-8333-333333333333",
    sourceBaseChecksumSha256: "a".repeat(64),
    provider: "fal",
    model: policy.model,
    adapterVersion: policy.adapterVersion,
  });
  const replay = depthEstimationIdempotencyKey({
    jobId: "33333333-3333-4333-8333-333333333333",
    sourceBaseChecksumSha256: "a".repeat(64),
    provider: "fal",
    model: policy.model,
    adapterVersion: policy.adapterVersion,
  });
  const other = depthEstimationIdempotencyKey({
    jobId: "33333333-3333-4333-8333-333333333333",
    sourceBaseChecksumSha256: "b".repeat(64),
    provider: "fal",
    model: policy.model,
    adapterVersion: policy.adapterVersion,
  });
  assert.equal(first, replay);
  assert.notEqual(first, other);
});

test("configured Depth maximum is included once in the combined estimate", () => {
  const estimate = includeDepthEstimationCost(
    {
      minimum: 0.12,
      maximum: 0.2,
      currency: "USD",
      isMaximumOperatorConfigured: true,
      pricingVersion: "openai-test",
      basis: "Stage A",
    },
    policy,
  );
  assert.equal(estimate.maximum, 0.21);
  assert.match(estimate.pricingVersion, /depth-anything-v2/);
});
