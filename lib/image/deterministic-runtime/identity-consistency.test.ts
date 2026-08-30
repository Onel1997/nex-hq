import assert from "node:assert/strict";
import test from "node:test";

import { assessBrandModelIdentityConsistency } from "@/lib/image/deterministic-runtime/identity-consistency";
import type { FaceExtractionResult } from "@/lib/persona/face-novelty-memory/local-face-embedding-evaluator";

function extraction(
  embedding: number[] | null,
  status: FaceExtractionResult["status"] = "performed",
): FaceExtractionResult {
  return {
    status,
    ...(embedding ? { embedding } : {}),
    detectionConfidence: status === "performed" ? 0.96 : 0,
    faceCount: status === "performed" ? 1 : 0,
    embeddingVersion: "local-vladmandic-1.7.x-v1",
    embeddingModel: "faceRecognitionNet",
    embeddingDimension: 128,
    similarityThresholdVersion: "v1.0.0",
  };
}

function embeddingWithFirstCoordinate(value: number): number[] {
  return Array.from({ length: 128 }, (_, index) => (index === 0 ? value : 0));
}

test("local identity gate accepts the locked person and persists no biometric vectors", async () => {
  const vectors = [
    extraction([0, 0, 0, 0]),
    extraction([0.2, 0.1, 0.1, 0.1]),
  ];
  const result = await assessBrandModelIdentityConsistency({
    masterIdentityBytes: Buffer.from("master"),
    generatedBaseBytes: Buffer.from("base"),
    identityLockSnapshotId: "lock-1",
    masterIdentityAssetId: "master-1",
    extractFace: async () => vectors.shift()!,
  });
  assert.equal(result.status, "PASS");
  assert.equal(result.reason, "IDENTITY_CONFIRMED");
  assert.equal(result.identityLockActive, true);
  assert.equal(result.identityFallbackPrevented, true);
  assert.equal("embedding" in result, false);
  assert.ok((result.euclideanDistance ?? 1) < 0.55);
});

test("local identity gate fails closed for a different or generic person", async () => {
  const vectors = [
    extraction([0, 0, 0, 0]),
    extraction([0.5, 0.5, 0.5, 0.5]),
  ];
  const result = await assessBrandModelIdentityConsistency({
    masterIdentityBytes: Buffer.from("master"),
    generatedBaseBytes: Buffer.from("base"),
    identityLockSnapshotId: "lock-1",
    masterIdentityAssetId: "master-1",
    extractFace: async () => vectors.shift()!,
  });
  assert.equal(result.status, "FAIL");
  assert.equal(result.reason, "IDENTITY_DISTANCE_TOO_HIGH");
  assert.ok((result.euclideanDistance ?? 0) > 0.55);
});

test("local identity gate fails closed when the generated face is unavailable", async () => {
  const vectors = [extraction([0, 0]), extraction(null, "no_face")];
  const result = await assessBrandModelIdentityConsistency({
    masterIdentityBytes: Buffer.from("master"),
    generatedBaseBytes: Buffer.from("base"),
    identityLockSnapshotId: "lock-1",
    masterIdentityAssetId: "master-1",
    extractFace: async () => vectors.shift()!,
  });
  assert.equal(result.status, "FAIL");
  assert.equal(result.reason, "GENERATED_FACE_UNAVAILABLE");
});

test("identity gate persists explicit raw-distance and reporting-similarity semantics", async () => {
  const vectors = [
    extraction(embeddingWithFirstCoordinate(0)),
    extraction(embeddingWithFirstCoordinate(0.5561596219414926)),
  ];
  const result = await assessBrandModelIdentityConsistency({
    masterIdentityBytes: Buffer.from("master"),
    generatedBaseBytes: Buffer.from("base"),
    identityLockSnapshotId: "lock-v3",
    masterIdentityAssetId: "master-v3",
    identityLockVersion: 3,
    referencePackageVersion: "reference-package-reconciler-v1.0.0",
    supportingReferenceCount: 5,
    extractFace: async () => vectors.shift()!,
  });

  assert.equal(result.status, "FAIL");
  assert.equal(result.reason, "IDENTITY_DISTANCE_TOO_HIGH");
  assert.equal(result.gateMetric, "EUCLIDEAN_DISTANCE");
  assert.equal(
    result.distanceMetric,
    "EUCLIDEAN_DISTANCE_L2_NORMALIZED_128D",
  );
  assert.equal(result.gateComparison, "DISTANCE_LESS_THAN_OR_EQUAL_MAXIMUM");
  assert.equal(result.maximumEuclideanDistance, 0.55);
  assert.equal(result.euclideanDistance, 0.5561596219414926);
  assert.equal(result.similarity, 1 - 0.5561596219414926 / 2);
  assert.equal(result.minimumDerivedSimilarityEquivalent, 0.725);
  assert.equal(result.similarityFormula, "1 - euclideanDistance / 2");
  assert.equal(
    result.similarityFormulaVersion,
    "nexhq-euclidean-distance-reporting-similarity-v1",
  );
  assert.equal(result.referenceComparisonMode, "PERSONA_MASTER_IDENTITY_ONLY");
  assert.equal(result.identityLockVersion, 3);
  assert.equal(result.supportingReferenceCount, 5);
  assert.equal("embedding" in result, false);
});

test("identity distance threshold is inclusive and is never inverted", async () => {
  for (const [distance, expected] of [
    [0.55, "PASS"],
    [0.550001, "FAIL"],
  ] as const) {
    const vectors = [
      extraction(embeddingWithFirstCoordinate(0)),
      extraction(embeddingWithFirstCoordinate(distance)),
    ];
    const result = await assessBrandModelIdentityConsistency({
      masterIdentityBytes: Buffer.from("master"),
      generatedBaseBytes: Buffer.from("base"),
      identityLockSnapshotId: "lock-1",
      masterIdentityAssetId: "master-1",
      extractFace: async () => vectors.shift()!,
    });
    assert.equal(result.status, expected);
  }
});

test("identity comparison remains bound to the exact supplied master reference", async () => {
  const evaluate = async (masterValue: number) => {
    const vectors = [
      extraction(embeddingWithFirstCoordinate(masterValue)),
      extraction(embeddingWithFirstCoordinate(0.2)),
    ];
    return assessBrandModelIdentityConsistency({
      masterIdentityBytes: Buffer.from(`master-${masterValue}`),
      generatedBaseBytes: Buffer.from("same-base"),
      identityLockSnapshotId: "lock-3",
      masterIdentityAssetId: `master-${masterValue}`,
      extractFace: async () => vectors.shift()!,
    });
  };
  assert.equal((await evaluate(0)).status, "PASS");
  assert.equal((await evaluate(1)).status, "FAIL");
});
