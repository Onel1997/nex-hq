import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

import { createCanvas } from "canvas";

import {
  garmentSegmentationIdempotencyKey,
  Sam3HttpGarmentSegmentationProvider,
} from "@/lib/image/garment-segmentation/sam3-http-adapter";
import type {
  GarmentSegmentationProvider,
  GarmentSegmentationProviderResult,
} from "@/lib/image/garment-segmentation/types";
import {
  garmentSegmentationPrompt,
  validateGarmentSegmentation,
} from "@/lib/image/garment-segmentation/validation";

const JOB_ID = randomUUID();
const POLICY = {
  contractVersion: "garment-segmentation-policy-v1" as const,
  required: true as const,
  provider: "SAM3" as const,
  adapterVersion: "nexhq-sam3-http-v1" as const,
  model: "facebook/sam3",
  maximumCostUsd: 0,
};

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function baseImage(
  garment: { x: number; y: number; width: number; height: number },
) {
  const canvas = createCanvas(120, 160);
  const context = canvas.getContext("2d");
  context.fillStyle = "#d6d8dc";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#95664f";
  context.fillRect(50, 8, 20, 25);
  context.fillStyle = "#4c82b8";
  context.fillRect(garment.x, garment.y, garment.width, garment.height);
  return canvas.toBuffer("image/png");
}

function maskImage(
  rectangles: Array<{ x: number; y: number; width: number; height: number }>,
  width = 120,
  height = 160,
) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#fff";
  for (const rectangle of rectangles) {
    context.fillRect(
      rectangle.x,
      rectangle.y,
      rectangle.width,
      rectangle.height,
    );
  }
  return canvas.toBuffer("image/png");
}

function providerResult(input: {
  base: Buffer;
  candidates: Array<{ id: string; mask: Buffer; confidence?: number }>;
}): GarmentSegmentationProviderResult {
  return {
    provider: "SAM3",
    model: POLICY.model,
    providerVersion: "sam3-test-v1",
    providerRequestId: "sam-request-test",
    sourceBaseChecksumSha256: sha256(input.base),
    jobId: JOB_ID,
    candidates: input.candidates.map((candidate) => ({
      candidateId: candidate.id,
      maskPngBytes: candidate.mask,
      maskWidth: 120,
      maskHeight: 160,
      bounds: null,
      confidence: candidate.confidence ?? 0.9,
    })),
  };
}

async function validate(input: {
  garmentType: string;
  base: Buffer;
  candidates: Array<{ id: string; mask: Buffer; confidence?: number }>;
  hint?: { x: number; y: number; width: number; height: number } | null;
  face?: { x: number; y: number; width: number; height: number } | null;
}) {
  const idempotencyKey = garmentSegmentationIdempotencyKey({
    jobId: JOB_ID,
    sourceBaseChecksumSha256: sha256(input.base),
    provider: POLICY.provider,
    model: POLICY.model,
    adapterVersion: POLICY.adapterVersion,
  });
  return validateGarmentSegmentation({
    providerResult: providerResult({
      base: input.base,
      candidates: input.candidates,
    }),
    policy: POLICY,
    baseImageBytes: input.base,
    sourceBaseChecksumSha256: sha256(input.base),
    jobId: JOB_ID,
    garmentType: input.garmentType,
    side: "FRONT",
    prompt: garmentSegmentationPrompt(input.garmentType),
    idempotencyKey,
    registrationHint: input.hint ?? null,
    faceBounds: input.face ?? { x: 50 / 120, y: 8 / 160, width: 20 / 120, height: 25 / 160 },
  });
}

test("provider-neutral contract accepts a deterministic mock without any network call", async () => {
  let calls = 0;
  const provider: GarmentSegmentationProvider = {
    isConfigured: () => true,
    describe: () => ({
      provider: "SAM3",
      adapterVersion: "nexhq-sam3-http-v1",
      model: POLICY.model,
      maximumCostUsd: 0,
    }),
    segmentGarment: async (input) => {
      calls += 1;
      return providerResult({
        base: input.baseImage.bytes,
        candidates: [
          {
            id: "shirt",
            mask: maskImage([{ x: 27, y: 43, width: 66, height: 104 }]),
          },
        ],
      });
    },
  };
  provider.describe();
  assert.equal(calls, 0, "planning/description must never call SAM");
});

test("segmentation idempotency is stable for one exact Base and changes with Base truth", () => {
  const input = {
    jobId: JOB_ID,
    sourceBaseChecksumSha256: "a".repeat(64),
    provider: POLICY.provider,
    model: POLICY.model,
    adapterVersion: POLICY.adapterVersion,
  };
  const first = garmentSegmentationIdempotencyKey(input);
  assert.equal(garmentSegmentationIdempotencyKey(input), first);
  assert.notEqual(
    garmentSegmentationIdempotencyKey({
      ...input,
      sourceBaseChecksumSha256: "b".repeat(64),
    }),
    first,
  );
});

for (const [garmentType, rectangle] of [
  ["Vacancy T-Shirt", { x: 27, y: 43, width: 66, height: 104 }],
  ["Oversized Hoodie", { x: 24, y: 39, width: 72, height: 110 }],
  ["Zip Hoodie", { x: 24, y: 39, width: 72, height: 110 }],
] as const) {
  test(`${garmentType} mask is exact, Base-bound, and locally validated`, async () => {
    const base = baseImage(rectangle);
    const result = await validate({
      garmentType,
      base,
      candidates: [{ id: "garment", mask: maskImage([rectangle]) }],
      hint: { x: 0.3, y: 0.32, width: 0.4, height: 0.5 },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.segmentation.provenance.mask.width, 120);
    assert.equal(result.segmentation.provenance.mask.height, 160);
    assert.equal(
      result.segmentation.provenance.sourceBaseChecksumSha256,
      sha256(base),
    );
    assert.equal(
      result.segmentation.provenance.mask.checksumSha256,
      sha256(result.segmentation.normalizedMaskPngBytes),
    );
  });
}

test("Jogger candidate is validated as pants evidence, not a printable whole-mask rule", async () => {
  const base = baseImage({ x: 32, y: 68, width: 56, height: 88 });
  const result = await validate({
    garmentType: "Jogger",
    base,
    candidates: [
      {
        id: "jogger",
        mask: maskImage([
          { x: 32, y: 68, width: 25, height: 88 },
          { x: 63, y: 68, width: 25, height: 88 },
          { x: 32, y: 68, width: 56, height: 14 },
        ]),
      },
    ],
    hint: { x: 0.25, y: 0.45, width: 0.5, height: 0.45 },
    face: null,
  });
  assert.equal(result.ok, true);
  assert.equal(
    garmentSegmentationPrompt("Jogger"),
    "the jogger pants worn by the person",
  );
});

test("multiple candidates use hint overlap and plausibility rather than largest-area selection", async () => {
  const garment = { x: 30, y: 45, width: 60, height: 100 };
  const base = baseImage(garment);
  const result = await validate({
    garmentType: "T-Shirt",
    base,
    candidates: [
      {
        id: "large-background",
        mask: maskImage([{ x: 1, y: 1, width: 118, height: 158 }]),
        confidence: 0.99,
      },
      {
        id: "wrong-coat",
        mask: maskImage([{ x: 2, y: 48, width: 30, height: 95 }]),
      },
      { id: "shirt", mask: maskImage([garment]), confidence: 0.82 },
    ],
    hint: { x: 0.28, y: 0.36, width: 0.44, height: 0.5 },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.segmentation.provenance.selectedCandidateId, "shirt");
    assert.equal(result.segmentation.provenance.candidateCount, 3);
  }
});

for (const [name, mask, expected] of [
  ["tiny", maskImage([{ x: 55, y: 80, width: 3, height: 3 }]), "TINY_MASK"],
  [
    "background-sized",
    maskImage([{ x: 0, y: 0, width: 120, height: 160 }]),
    "BACKGROUND_SIZED_MASK",
  ],
  ["skin/body", maskImage([{ x: 48, y: 5, width: 24, height: 38 }]), "SKIN_OR_BODY_MASK"],
] as const) {
  test(`${name} candidate fails closed`, async () => {
    const base = baseImage({ x: 30, y: 45, width: 60, height: 100 });
    const result = await validate({
      garmentType: "T-Shirt",
      base,
      candidates: [{ id: name, mask }],
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.provenance.validationReason, expected);
  });
}

test("mask dimensions must exactly equal the Stage-A Base", async () => {
  const base = baseImage({ x: 30, y: 45, width: 60, height: 100 });
  const result = await validate({
    garmentType: "T-Shirt",
    base,
    candidates: [
      {
        id: "wrong-size",
        mask: maskImage([{ x: 20, y: 30, width: 40, height: 60 }], 100, 120),
      },
    ],
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.provenance.validationReason, "MASK_DIMENSIONS_MISMATCH");
  }
});

test("SAM 3 HTTP adapter sends private bytes server-side with a stable idempotency key", async () => {
  let calls = 0;
  const base = baseImage({ x: 30, y: 45, width: 60, height: 100 });
  const mask = maskImage([{ x: 30, y: 45, width: 60, height: 100 }]);
  const request: typeof fetch = async (_url, init) => {
    calls += 1;
    assert.equal(init?.method, "POST");
    assert.equal(
      (init?.headers as Record<string, string>)["Idempotency-Key"],
      "idempotency-key",
    );
    const form = init?.body as FormData;
    assert.equal(
      form.get("textPrompt"),
      "the oversized t-shirt worn by the person",
    );
    assert.equal(form.has("artwork"), false);
    assert.ok(form.get("image") instanceof Blob);
    return new Response(
      JSON.stringify({
        provider: "SAM3",
        model: POLICY.model,
        providerVersion: "sam3-test-v1",
        providerRequestId: "sam-request-test",
        sourceBaseChecksumSha256: sha256(base),
        jobId: JOB_ID,
        candidates: [
          {
            candidateId: "shirt",
            maskPngBase64: mask.toString("base64"),
            maskWidth: 120,
            maskHeight: 160,
            bounds: null,
            confidence: 0.9,
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const adapter = new Sam3HttpGarmentSegmentationProvider(request, {
    endpoint: "http://127.0.0.1:9876/segment",
    apiKey: "test-only",
    model: POLICY.model,
    maximumCostUsd: 0,
  });
  const result = await adapter.segmentGarment({
    baseImage: {
      bytes: base,
      checksumSha256: sha256(base),
      mimeType: "image/png",
    },
    jobId: JOB_ID,
    garmentType: "T-Shirt",
    side: "FRONT",
    textPrompt: "the oversized t-shirt worn by the person",
    optionalRegistrationHint: null,
    idempotencyKey: "idempotency-key",
  });
  assert.equal(calls, 1);
  assert.equal(result.candidates.length, 1);
  assert.deepEqual(result.candidates[0]!.maskPngBytes, mask);
});
