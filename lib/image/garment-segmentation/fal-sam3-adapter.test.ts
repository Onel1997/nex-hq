import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createCanvas } from "canvas";

import {
  FAL_SAM3_DEFAULT_MAXIMUM_COST_USD,
  FalSam3GarmentSegmentationProvider,
  type FalSam3Client,
} from "@/lib/image/garment-segmentation/fal-sam3-adapter";
import {
  FAL_SAM3_ADAPTER_VERSION,
  FAL_SAM3_IMAGE_MODEL,
} from "@/lib/image/garment-segmentation/types";
import { includeGarmentSegmentationCost } from "@/lib/image/garment-segmentation/pricing";
import {
  garmentSegmentationPrompt,
  validateGarmentSegmentation,
} from "@/lib/image/garment-segmentation/validation";

function pngDataUri(width: number, height: number, rectangle?: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, width, height);
  if (rectangle) {
    context.fillStyle = "#fff";
    context.fillRect(
      rectangle.x,
      rectangle.y,
      rectangle.width,
      rectangle.height,
    );
  }
  const bytes = canvas.toBuffer("image/png");
  return {
    bytes,
    uri: `data:image/png;base64,${bytes.toString("base64")}`,
  };
}

function baseInput() {
  const base = pngDataUri(120, 160, {
    x: 28,
    y: 42,
    width: 64,
    height: 106,
  }).bytes;
  return {
    baseImage: {
      bytes: base,
      checksumSha256: createHash("sha256").update(base).digest("hex"),
      mimeType: "image/png" as const,
    },
    jobId: randomUUID(),
    garmentType: "Vacancy T-Shirt",
    side: "FRONT" as const,
    textPrompt: garmentSegmentationPrompt("Vacancy T-Shirt"),
    optionalRegistrationHint: {
      x: 0.28,
      y: 0.32,
      width: 0.44,
      height: 0.52,
    },
    idempotencyKey: "stable-fal-idempotency-key",
  };
}

test("official fal adapter sends exact private Base data and garment-only prompt", async () => {
  const firstMask = pngDataUri(120, 160, {
    x: 28,
    y: 42,
    width: 64,
    height: 106,
  });
  let calls = 0;
  const client: FalSam3Client = {
    subscribe: async (model, options) => {
      calls += 1;
      assert.equal(model, FAL_SAM3_IMAGE_MODEL);
      assert.equal(
        options.input.prompt,
        "the oversized t-shirt worn by the person",
      );
      assert.match(options.input.image_url, /^data:image\/png;base64,/);
      assert.equal("artwork" in options.input, false);
      assert.equal("persona" in options.input, false);
      assert.equal(options.input.apply_mask, false);
      assert.equal(options.input.return_multiple_masks, true);
      assert.equal(options.input.max_masks, 3);
      assert.equal(options.input.include_scores, true);
      assert.equal(options.input.include_boxes, true);
      assert.equal(
        options.headers["Idempotency-Key"],
        "stable-fal-idempotency-key",
      );
      return {
        requestId: "fal-request-1",
        data: {
          masks: [
            {
              url: firstMask.uri,
              content_type: "image/png",
              width: 120,
              height: 160,
            },
          ],
          scores: [0.93],
          boxes: [[0.5, 0.59375, 64 / 120, 106 / 160]],
          metadata: [],
        },
      };
    },
  };
  const provider = new FalSam3GarmentSegmentationProvider(
    {
      apiKey: "test-only-key",
      model: FAL_SAM3_IMAGE_MODEL,
      maximumCostUsd: FAL_SAM3_DEFAULT_MAXIMUM_COST_USD,
    },
    client,
  );
  const input = baseInput();
  const result = await provider.segmentGarment(input);
  assert.equal(calls, 1);
  assert.equal(result.provider, "fal");
  assert.equal(result.model, FAL_SAM3_IMAGE_MODEL);
  assert.equal(result.providerVersion, FAL_SAM3_ADAPTER_VERSION);
  assert.equal(result.providerRequestId, "fal-request-1");
  assert.equal(result.sourceBaseChecksumSha256, input.baseImage.checksumSha256);
  assert.equal(result.jobId, input.jobId);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0]?.maskWidth, 120);
  assert.equal(result.candidates[0]?.maskHeight, 160);
  assert.equal(result.candidates[0]?.confidence, 0.93);
});

test("fal multiple-mask response is normalized without accepting the first candidate", async () => {
  const wrong = pngDataUri(120, 160, {
    x: 0,
    y: 0,
    width: 120,
    height: 160,
  });
  const shirt = pngDataUri(120, 160, {
    x: 28,
    y: 42,
    width: 64,
    height: 106,
  });
  const client: FalSam3Client = {
    subscribe: async () => ({
      requestId: "fal-request-many",
      data: {
        masks: [{ url: wrong.uri }, { url: shirt.uri }],
        scores: [0.99, 0.88],
        boxes: [
          [0.5, 0.5, 1, 1],
          [0.5, 0.59375, 64 / 120, 106 / 160],
        ],
      },
    }),
  };
  const provider = new FalSam3GarmentSegmentationProvider(
    {
      apiKey: "test-only-key",
      model: FAL_SAM3_IMAGE_MODEL,
      maximumCostUsd: 0.005,
    },
    client,
  );
  const result = await provider.segmentGarment(baseInput());
  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0]?.candidateId, "fal-mask-0");
  assert.equal(result.candidates[1]?.candidateId, "fal-mask-1");
  assert.equal(result.candidates[1]?.confidence, 0.88);
  const input = baseInput();
  const validation = await validateGarmentSegmentation({
    providerResult: { ...result, jobId: input.jobId, sourceBaseChecksumSha256: input.baseImage.checksumSha256 },
    policy: {
      contractVersion: "garment-segmentation-policy-v1",
      required: true,
      provider: "fal",
      adapterVersion: FAL_SAM3_ADAPTER_VERSION,
      model: FAL_SAM3_IMAGE_MODEL,
      maximumCostUsd: 0.005,
    },
    baseImageBytes: input.baseImage.bytes,
    sourceBaseChecksumSha256: input.baseImage.checksumSha256,
    jobId: input.jobId,
    garmentType: input.garmentType,
    side: input.side,
    prompt: input.textPrompt,
    idempotencyKey: input.idempotencyKey,
    registrationHint: input.optionalRegistrationHint,
    faceBounds: null,
  });
  assert.equal(validation.ok, true);
  if (validation.ok) {
    assert.equal(
      validation.segmentation.provenance.selectedCandidateId,
      "fal-mask-1",
    );
  }
});

test("fal adapter rejects mask metadata that disagrees with downloaded bytes", async () => {
  const mask = pngDataUri(120, 160, {
    x: 28,
    y: 42,
    width: 64,
    height: 106,
  });
  const client: FalSam3Client = {
    subscribe: async () => ({
      requestId: "fal-request-invalid",
      data: {
        masks: [{ url: mask.uri, width: 512, height: 512 }],
      },
    }),
  };
  const provider = new FalSam3GarmentSegmentationProvider(
    {
      apiKey: "test-only-key",
      model: FAL_SAM3_IMAGE_MODEL,
      maximumCostUsd: 0.005,
    },
    client,
  );
  await assert.rejects(
    () => provider.segmentGarment(baseInput()),
    /metadata dimensions/i,
  );
});

test("FAL_KEY remains server-only and no client component references it", async () => {
  const [adapter, panel] = await Promise.all([
    readFile(
      "lib/image/garment-segmentation/fal-sam3-adapter.ts",
      "utf8",
    ),
    readFile("components/image/deterministic-v2-panel.tsx", "utf8"),
  ]);
  assert.match(adapter, /process\.env\.FAL_KEY/);
  assert.doesNotMatch(adapter, /NEXT_PUBLIC_FAL/);
  assert.doesNotMatch(panel, /FAL_KEY|NEXT_PUBLIC_FAL/);
});

test("fal SAM maximum cost is included in the one owner estimate", () => {
  const estimate = includeGarmentSegmentationCost(
    {
      currency: "USD",
      minimum: 0.016,
      maximum: 0.216,
      isMaximumOperatorConfigured: true,
      pricingVersion: "openai-test",
      basis: "Stage A test estimate",
    },
    {
      contractVersion: "garment-segmentation-policy-v1",
      required: true,
      provider: "fal",
      adapterVersion: FAL_SAM3_ADAPTER_VERSION,
      model: FAL_SAM3_IMAGE_MODEL,
      maximumCostUsd: 0.005,
    },
  );
  assert.equal(estimate.maximum, 0.221);
  assert.match(estimate.pricingVersion, /fal-sam3-segmentation-v1/);
});
