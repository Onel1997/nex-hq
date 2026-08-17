import assert from "node:assert/strict";
import test from "node:test";

import { runDeterministicAttempt, type SuccessfulBaseStage } from "@/lib/image/deterministic-production/two-stage-attempt";

const jobId = "11111111-1111-4111-8111-111111111111";

const base: SuccessfulBaseStage = {
  stageOutputId: "22222222-2222-4222-8222-222222222222",
  jobId,
  stage: "BASE_GENERATION",
  stageAttempt: 1,
  status: "SUCCEEDED",
  assetId: "base-asset",
  storagePath: "workspace/base.png",
  checksumSha256: "a".repeat(64),
  providerRequestId: "provider-1",
  provenance: { provider: "fake" },
  failureCode: null,
  failureMessage: null,
  createdAt: "2026-08-17T12:00:00.000Z",
};

const snapshot = {
  productionMode: "DETERMINISTIC_COMPOSITE",
  baseGeneration: { assetCount: 1 },
} as never;

test("base success plus composite failure never recalls provider", async () => {
  let providerCalls = 0;
  const persisted: unknown[] = [];
  const result = await runDeterministicAttempt({
    jobId,
    snapshot,
    dependencies: {
      async generateBase() { providerCalls += 1; return base; },
      async composite() { throw new Error("surface mismatch"); },
      async persistStage(stage) { persisted.push(stage); },
      id: () => "33333333-3333-4333-8333-333333333333",
      now: () => "2026-08-17T12:01:00.000Z",
    },
  });
  assert.equal(providerCalls, 1);
  assert.equal(result.status, "COMPOSITE_FAILED");
  assert.equal(persisted.length, 2);
});

test("composite retry reuses stored base without a provider call", async () => {
  let providerCalls = 0;
  const result = await runDeterministicAttempt({
    jobId,
    snapshot,
    existingBase: base,
    compositeAttempt: 2,
    dependencies: {
      async generateBase() { providerCalls += 1; return base; },
      async composite() {
        return {
          assetId: "final-asset",
          storagePath: "workspace/final.png",
          checksumSha256: "b".repeat(64),
          provenance: {
            contractVersion: "compositing-provenance-v1",
            compositorVersion: "nexhq-deterministic-compositor-v1",
            masterArtworkId: "22222222-2222-4222-8222-222222222222",
            masterArtworkVersion: "V1",
            masterArtworkChecksumSha256: "c".repeat(64),
            baseImageId: "base-asset",
            baseImageChecksumSha256: "a".repeat(64),
            printSurfaceId: "surface-1",
            targetPrintRegion: "front_center",
            transformMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
            blendingStrategy: "SOURCE_OVER",
            shadingFactor: 1,
            samplingStrategy: "BILINEAR_SOURCE_PIXEL",
            sourceWidth: 400,
            sourceHeight: 480,
            outputWidth: 2048,
            outputHeight: 2048,
            printRegionWidth: 800,
            printRegionHeight: 960,
            outputChecksumSha256: "b".repeat(64),
            createdAt: "2026-08-17T12:01:00.000Z",
          },
        };
      },
      async persistStage() {},
      id: () => "33333333-3333-4333-8333-333333333333",
      now: () => "2026-08-17T12:01:00.000Z",
    },
  });
  assert.equal(providerCalls, 0);
  assert.equal(result.status, "SUCCEEDED");
});
