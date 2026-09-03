import assert from "node:assert/strict";
import test from "node:test";

import {
  CREATIVE_STUDIO_CONTRACT_VERSION,
  DEFAULT_CREATIVE_ADVANCED_SETTINGS,
  type CreativeReferenceImage,
} from "@/lib/creative-studio/contracts";
import { buildCreativeGenerationRequestPayload } from "@/lib/creative-studio/client";
import { buildCreativeReferenceSnapshot } from "@/lib/creative-studio/reference-recovery";
import { canonicalizeCreativeReferenceOrder } from "@/lib/creative-studio/reference-order";

const JOB_ID = "11111111-1111-4111-8111-111111111111";

function reference(id: string, order: number): CreativeReferenceImage {
  const file = new File([id], `${id}.png`, { type: "image/png" });
  return {
    id,
    name: file.name,
    mimeType: file.type,
    byteLength: file.size,
    role: "NONE",
    order,
    previewUrl: `blob:${id}`,
    file,
    tempReferenceId: `${id}-temp`,
    uploadState: "READY",
    source: { kind: "LOCAL_FILE_REFERENCE" },
  };
}

function setup(references: CreativeReferenceImage[]) {
  return {
    contractVersion: CREATIVE_STUDIO_CONTRACT_VERSION,
    prompt: "Erstelle ein Fashion-Motiv.",
    modelId: "nano-banana-pro",
    aspectRatio: "4:5" as const,
    quality: "2K" as const,
    batchSize: 1 as const,
    outputType: "CAMPAIGN" as const,
    references: references.map(({ id, name, mimeType, byteLength, role, order }) => ({
      id,
      name,
      mimeType,
      byteLength,
      role,
      order,
    })),
    advanced: DEFAULT_CREATIVE_ADVANCED_SETTINGS,
  };
}

test("legacy orders 3,4,5 become a stable contiguous 0,1,2 sequence", () => {
  const canonical = canonicalizeCreativeReferenceOrder([
    reference("first", 3),
    reference("second", 4),
    reference("third", 5),
  ]);
  assert.deepEqual(canonical.map((item) => item.id), ["first", "second", "third"]);
  assert.deepEqual(canonical.map((item) => item.order), [0, 1, 2]);
});

test("removing the middle reference closes the order gap", () => {
  const canonical = canonicalizeCreativeReferenceOrder([
    reference("first", 0),
    reference("third", 2),
  ]);
  assert.deepEqual(canonical.map((item) => [item.id, item.order]), [
    ["first", 0],
    ["third", 1],
  ]);
});

test("removing and re-adding a reference always produces contiguous order", () => {
  const afterRemoval = canonicalizeCreativeReferenceOrder([
    reference("second", 1),
    reference("third", 2),
  ]);
  const afterReAdd = canonicalizeCreativeReferenceOrder([
    ...afterRemoval,
    reference("first", afterRemoval.length),
  ]);
  assert.deepEqual(afterReAdd.map((item) => [item.id, item.order]), [
    ["second", 0],
    ["third", 1],
    ["first", 2],
  ]);
});

test("setup, snapshot, and temp references share one canonical id/order mapping", () => {
  const legacy = [
    reference("first", 3),
    reference("second", 4),
    reference("third", 5),
  ];
  const snapshot = buildCreativeReferenceSnapshot({
    jobId: JOB_ID,
    references: legacy,
  });
  const payload = buildCreativeGenerationRequestPayload({
    jobId: JOB_ID,
    setup: setup(legacy),
    references: legacy,
    referenceSnapshot: snapshot,
  });
  const setupMapping = payload.setup.references.map((item) => [item.id, item.order]);
  const snapshotMapping = payload.referenceSnapshot?.references.map((item) => [
    item.referenceId,
    item.order,
  ]);
  const tempMapping = payload.tempReferences.map((item, order) => [
    item.referenceId,
    order,
  ]);
  assert.deepEqual(setupMapping, [
    ["first", 0],
    ["second", 1],
    ["third", 2],
  ]);
  assert.deepEqual(snapshotMapping, setupMapping);
  assert.deepEqual(tempMapping, setupMapping);
});
