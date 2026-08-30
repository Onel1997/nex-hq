import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { createCanvas } from "canvas";

import { FalMidasNormalProvider, type FalMidasClient } from "@/lib/image/normal-estimation/fal-midas-adapter";
import { analyzeGarmentNormalOrientation, combineNormalAndSilhouette } from "@/lib/image/normal-estimation/analysis";
import { normalEstimationIdempotencyKey, validateNormalEstimation } from "@/lib/image/normal-estimation/validation";
import {
  NormalEstimationProviderOutcomeUnknownError,
  type NormalEstimationPolicy,
  type NormalOrientationEvidence,
} from "@/lib/image/normal-estimation/types";

const policy: NormalEstimationPolicy = {
  contractVersion: "nexhq-normal-estimation-policy-v1",
  provider: "fal",
  model: "fal-ai/image-preprocessors/midas",
  adapterVersion: "nexhq-fal-midas-v1",
  required: true,
  maximumCostUsd: 0.01,
  minimumUsableSamples: 80,
  minimumFieldConsistency: 0.5,
};

function normalMap(width = 96, height = 96, angleDegrees = 3) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  const image = context.createImageData(width, height);
  const angle = angleDegrees * Math.PI / 180;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    // Coherent field whose smallest-change direction follows the requested
    // image-plane torso fall. This is deterministic test evidence, not MiDaS.
    const across = x * Math.cos(angle) - y * Math.sin(angle);
    const nx = Math.max(-0.3, Math.min(0.3, (across / width - 0.5) * 0.38));
    const ny = Math.sin(across / 13) * 0.025;
    const nz = Math.sqrt(Math.max(0.1, 1 - nx * nx - ny * ny));
    const offset = (y * width + x) * 4;
    image.data[offset] = Math.round((nx + 1) * 127.5);
    image.data[offset + 1] = Math.round((1 - ny) * 127.5);
    image.data[offset + 2] = Math.round((nz + 1) * 127.5);
    image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return canvas.toBuffer("image/png");
}

function mask(width = 96, height = 96) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.fillStyle = "black";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "white";
  context.fillRect(12, 8, width - 24, height - 16);
  return canvas.toBuffer("image/png");
}

test("official fal MiDaS adapter sends only the exact Base and normalizes normal_map", async () => {
  const normal = normalMap();
  let captured: Parameters<FalMidasClient["subscribe"]>[1] | null = null;
  const client: FalMidasClient = {
    async subscribe(_model, options) {
      captured = options;
      return {
        requestId: "req-midas-1",
        data: {
          depth_map: { url: "data:image/png;base64," + normal.toString("base64") },
          normal_map: { url: "data:image/png;base64," + normal.toString("base64"), width: 96, height: 96 },
        },
      };
    },
  };
  const provider = new FalMidasNormalProvider({ apiKey: "server-only", model: "fal-ai/image-preprocessors/midas", maximumCostUsd: 0.01 }, client);
  const base = normalMap(48, 48);
  const result = await provider.estimateNormals({ jobId: "11111111-1111-4111-8111-111111111111", baseImage: { bytes: base, checksumSha256: createHash("sha256").update(base).digest("hex"), mimeType: "image/png" }, idempotencyKey: "stable-key" });
  assert.equal(result.providerRequestId, "req-midas-1");
  assert.ok(captured);
  const capturedOptions = captured as Parameters<FalMidasClient["subscribe"]>[1];
  assert.equal(capturedOptions.input.image_url, `data:image/png;base64,${base.toString("base64")}`);
  assert.equal(Object.keys(capturedOptions.input).join(","), "image_url");
  assert.equal(JSON.stringify(capturedOptions).includes("artwork"), false);
  assert.equal(capturedOptions.headers["Idempotency-Key"], "stable-key");
});

test("ambiguous fal submit/poll failure is an unknown paid outcome and is not retried by the adapter", async () => {
  let calls = 0;
  const client: FalMidasClient = {
    async subscribe() {
      calls += 1;
      throw new Error("fetch failed after queue submission");
    },
  };
  const provider = new FalMidasNormalProvider(
    {
      apiKey: "server-only",
      model: "fal-ai/image-preprocessors/midas",
      maximumCostUsd: 0.01,
    },
    client,
  );
  const base = normalMap(48, 48);
  await assert.rejects(
    () =>
      provider.estimateNormals({
        jobId: "11111111-1111-4111-8111-111111111111",
        baseImage: {
          bytes: base,
          checksumSha256: createHash("sha256").update(base).digest("hex"),
          mimeType: "image/png",
        },
        idempotencyKey: "stable-key",
      }),
    (error: unknown) =>
      error instanceof NormalEstimationProviderOutcomeUnknownError,
  );
  assert.equal(calls, 1);
});

test("normal validation is Base-bound, garment-masked and rejects a constant map", async () => {
  const baseChecksum = "a".repeat(64);
  const idempotencyKey = normalEstimationIdempotencyKey({ jobId: "11111111-1111-4111-8111-111111111111", sourceBaseChecksumSha256: baseChecksum, provider: "fal", model: policy.model, adapterVersion: policy.adapterVersion });
  const bytes = normalMap();
  const validated = await validateNormalEstimation({ policy, result: { provider: "fal", model: policy.model, adapterVersion: policy.adapterVersion, providerRequestId: "req", jobId: "11111111-1111-4111-8111-111111111111", sourceBaseChecksumSha256: baseChecksum, normalMapBytes: bytes, outputWidth: 96, outputHeight: 96, outputMimeType: "image/png", depthOutputIncluded: true }, jobId: "11111111-1111-4111-8111-111111111111", sourceBaseChecksumSha256: baseChecksum, sourceWidth: 96, sourceHeight: 96, garmentMaskBytes: mask(), idempotencyKey });
  assert.equal(validated.provenance.status, "VALIDATED");
  assert.equal(validated.provenance.artworkInputIncluded, false);
  await assert.rejects(() => validateNormalEstimation({ policy, result: { provider: "fal", model: policy.model, adapterVersion: policy.adapterVersion, providerRequestId: "req", jobId: "11111111-1111-4111-8111-111111111111", sourceBaseChecksumSha256: "b".repeat(64), normalMapBytes: bytes, outputWidth: 96, outputHeight: 96, outputMimeType: "image/png", depthOutputIncluded: true }, jobId: "11111111-1111-4111-8111-111111111111", sourceBaseChecksumSha256: baseChecksum, sourceWidth: 96, sourceHeight: 96, garmentMaskBytes: mask(), idempotencyKey }), /SOURCE_BINDING_MISMATCH/);
  const flatCanvas = createCanvas(96, 96); const flat = flatCanvas.getContext("2d"); flat.fillStyle = "rgb(128,128,255)"; flat.fillRect(0, 0, 96, 96);
  await assert.rejects(() => validateNormalEstimation({ policy, result: { provider: "fal", model: policy.model, adapterVersion: policy.adapterVersion, providerRequestId: "req", jobId: "11111111-1111-4111-8111-111111111111", sourceBaseChecksumSha256: baseChecksum, normalMapBytes: flatCanvas.toBuffer("image/png"), outputWidth: 96, outputHeight: 96, outputMimeType: "image/png", depthOutputIncluded: true }, jobId: "11111111-1111-4111-8111-111111111111", sourceBaseChecksumSha256: baseChecksum, sourceWidth: 96, sourceHeight: 96, garmentMaskBytes: mask(), idempotencyKey }), /NORMAL_FIELD_UNSTABLE/);
});

test("garment-only normal analysis excludes background and confidence-dependent blend rescues weak silhouette", async () => {
  const normal = await analyzeGarmentNormalOrientation({ normalMapBytes: normalMap(192, 192, 4), imageWidth: 192, imageHeight: 192, contains: (x, y) => x > 0.2 && x < 0.8 && y > 0.2 && y < 0.9 });
  const opposite = await analyzeGarmentNormalOrientation({ normalMapBytes: normalMap(192, 192, -4), imageWidth: 192, imageHeight: 192, contains: (x, y) => x > 0.2 && x < 0.8 && y > 0.2 && y < 0.9 });
  assert.equal(normal.status, "READY");
  assert.equal(opposite.status, "READY");
  assert.ok(normal.orientationDegrees * opposite.orientationDegrees < 0);
  assert.equal(normal.backgroundEvidenceExcluded, true);
  const rescued = combineNormalAndSilhouette({ silhouetteDegrees: -5, silhouetteConfidence: 0.3, normal });
  assert.equal(rescued.relationship, "NORMAL_RESCUES_SILHOUETTE");
  assert.equal(rescued.finalDegrees, normal.orientationDegrees);
  const contradictoryNormal: NormalOrientationEvidence = { ...normal, orientationDegrees: 8, confidence: 0.9 };
  const contradiction = combineNormalAndSilhouette({ silhouetteDegrees: -4, silhouetteConfidence: 0.9, normal: contradictoryNormal });
  assert.equal(contradiction.relationship, "CONTRADICTORY");
});

test("MiDaS idempotency is exact-Base and adapter-version bound", () => {
  const first = normalEstimationIdempotencyKey({ jobId: "11111111-1111-4111-8111-111111111111", sourceBaseChecksumSha256: "a".repeat(64), provider: "fal", model: policy.model, adapterVersion: policy.adapterVersion });
  const same = normalEstimationIdempotencyKey({ jobId: "11111111-1111-4111-8111-111111111111", sourceBaseChecksumSha256: "a".repeat(64), provider: "fal", model: policy.model, adapterVersion: policy.adapterVersion });
  const changed = normalEstimationIdempotencyKey({ jobId: "11111111-1111-4111-8111-111111111111", sourceBaseChecksumSha256: "b".repeat(64), provider: "fal", model: policy.model, adapterVersion: policy.adapterVersion });
  assert.equal(first, same);
  assert.notEqual(first, changed);
});
