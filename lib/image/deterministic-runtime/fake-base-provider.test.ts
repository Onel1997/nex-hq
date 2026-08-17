import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { loadImage } from "canvas";

import {
  DeterministicSyntheticBaseProvider,
  SYNTHETIC_BASE_MIN_LONG_EDGE,
  resolveSyntheticBaseDimensions,
} from "@/lib/image/deterministic-runtime/fake-base-provider";

test("synthetic Stage A never uses a sub-2048 long edge", () => {
  assert.deepEqual(resolveSyntheticBaseDimensions("768x1024"), { width: 1536, height: 2048 });
  assert.deepEqual(resolveSyntheticBaseDimensions("1024x1536"), { width: 1365, height: 2048 });
  assert.deepEqual(resolveSyntheticBaseDimensions("2048x2048"), { width: 2048, height: 2048 });
  const fallback = resolveSyntheticBaseDimensions();
  assert.deepEqual(fallback, { width: 2048, height: 2731 });
  assert.ok(Math.max(fallback.width, fallback.height) >= SYNTHETIC_BASE_MIN_LONG_EDGE);
});

test("fake base provider emits a high-resolution deterministic PNG with no network", async () => {
  const provider = new DeterministicSyntheticBaseProvider();
  const snapshot = {
    product: { color: "Black" },
    printSurface: { quad: [{ x: 0.3, y: 0.35 }, { x: 0.7, y: 0.35 }, { x: 0.68, y: 0.7 }, { x: 0.32, y: 0.7 }] },
    production: { projectId: randomUUID() },
    shot: { assetId: "hero" },
    baseGeneration: { dimensions: "1024x1536" },
  } as never;
  const first = await provider.generate(snapshot);
  const second = await provider.generate(snapshot);
  const image = await loadImage(first.bytes);
  assert.equal(image.width, 1365);
  assert.equal(image.height, 2048);
  assert.equal(first.checksumSha256, second.checksumSha256);
  assert.equal(first.provenance.networkCalls, 0);
  assert.equal(provider.calls, 2);
});
