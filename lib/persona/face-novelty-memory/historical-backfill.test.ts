/**
 * Phase 2.0C — Historical face embedding backfill tests.
 *
 * Proves eligibility, idempotency, batch resilience, coverage, discovery gate,
 * and that no OpenAI / paid provider calls occur.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import type { WorkspaceScope } from "../domain/types";
import { MemoryNoveltyRepository } from "./novelty-repository";
import { MemoryEmbeddingRepository } from "./embedding-repository";
import {
  MemoryHistoricalBackfillRepository,
} from "./historical-backfill-repository";
import {
  isBackfillEligible,
  isForbiddenBackfillState,
  dedupeEligibleByAsset,
  buildHistoricalBackfillPreflightSummary,
} from "./historical-backfill-eligibility";
import { calculateExtendedHistoricalCoverage } from "./historical-backfill-coverage";
import {
  evaluateDiscoveryCoverageGate,
  PERSONA_FACE_HISTORICAL_COVERAGE_MIN_PERCENT_ENV,
} from "./discovery-coverage-gate";
import {
  runHistoricalFaceEmbeddingBackfillBatch,
  runHistoricalFaceEmbeddingBackfillUntilDone,
  loadHistoricalBackfillPreflight,
  loadHistoricalProtectionSnapshot,
} from "./historical-backfill-service";
import type { HistoricalBackfillEligibilityRecord } from "./historical-backfill-types";
import type { FaceNoveltyRecord, FaceNoveltyState } from "./types";
import { HISTORICAL_BACKFILL_FORBIDDEN_STATES } from "./historical-backfill-types";
import {
  assertSafeFaceNoveltyDebugDto,
  PERSONA_FACE_NOVELTY_DEBUG_ENV,
} from "./live-debug";
import type { FaceExtractionResult } from "./local-face-embedding-evaluator";
import { FACE_SIMILARITY_EVALUATOR_VERSION } from "./similarity-threshold";
import { setCreationRepositoryForTests } from "../creation/creation-factory";
import { MemoryCreationRepository } from "../creation/memory-creation-repository";

const WS = "11111111-1111-4111-8111-111111111111";
const OTHER_WS = "22222222-2222-4222-8222-222222222222";
const ARCH = "primary_male";
const PROJECT = "64ed1965-ef8c-4bf2-a375-049b090f88c1";
const scope: WorkspaceScope = { workspaceId: WS };

function makeEmbedding(seed: number): number[] {
  return Array.from({ length: 128 }, (_, i) => ((i + seed) % 17) / 17);
}

function baseExtraction(
  overrides: Partial<FaceExtractionResult> = {},
): FaceExtractionResult {
  return {
    status: "performed",
    embedding: makeEmbedding(1),
    detectionConfidence: 0.92,
    faceCount: 1,
    embeddingVersion: FACE_SIMILARITY_EVALUATOR_VERSION,
    embeddingModel: "faceRecognitionNet",
    embeddingDimension: 128,
    similarityThresholdVersion: "v1.0.0",
    ...overrides,
  };
}

function makeNovelty(
  overrides: Partial<FaceNoveltyRecord> & {
    id?: string;
    candidateId?: string;
    assetId?: string;
    state?: FaceNoveltyState;
    workspaceId?: string;
  } = {},
): FaceNoveltyRecord {
  const id = overrides.id ?? randomUUID();
  return {
    id,
    workspaceId: overrides.workspaceId ?? WS,
    archetypeId: ARCH,
    creationProjectId: PROJECT,
    candidateId: overrides.candidateId ?? randomUUID(),
    assetId: overrides.assetId ?? randomUUID(),
    state: overrides.state ?? "shown",
    identityFingerprint: `fp:${id}`,
    imageChecksum: overrides.imageChecksum,
    perceptualHash: overrides.perceptualHash,
    storageObjectKey: overrides.storageObjectKey,
    sourceProvider: "openai",
    sourceModel: "gpt-image",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function toEligibility(
  r: FaceNoveltyRecord,
  hasValidEmbedding = false,
): HistoricalBackfillEligibilityRecord {
  return {
    noveltyRecordId: r.id,
    workspaceId: r.workspaceId,
    archetypeId: r.archetypeId,
    creationProjectId: r.creationProjectId,
    candidateId: r.candidateId,
    assetId: r.assetId,
    state: r.state,
    hasValidEmbedding,
    embeddingDimension: hasValidEmbedding ? 128 : null,
    detectionStatus: null,
    hasChecksumOrPHash: Boolean(r.imageChecksum || r.perceptualHash),
    imageChecksum: r.imageChecksum ?? null,
    perceptualHash: r.perceptualHash ?? null,
    storageObjectKey: r.storageObjectKey ?? null,
  };
}

describe("Phase 2.0C historical face embedding backfill", () => {
  let noveltyRepo: MemoryNoveltyRepository;
  let embeddingRepo: MemoryEmbeddingRepository;
  let backfillRepo: MemoryHistoricalBackfillRepository;
  let openaiCalls: number;
  let paidProviderCalls: number;
  let extractCalls: number;
  let extractImpl: (src: string | Buffer) => Promise<FaceExtractionResult>;

  beforeEach(() => {
    noveltyRepo = new MemoryNoveltyRepository();
    embeddingRepo = new MemoryEmbeddingRepository();
    backfillRepo = new MemoryHistoricalBackfillRepository(
      noveltyRepo,
      embeddingRepo,
    );
    openaiCalls = 0;
    paidProviderCalls = 0;
    extractCalls = 0;
    extractImpl = async () => {
      extractCalls += 1;
      return baseExtraction();
    };
    process.env[PERSONA_FACE_NOVELTY_DEBUG_ENV] = "true";
    delete process.env[PERSONA_FACE_HISTORICAL_COVERAGE_MIN_PERCENT_ENV];
    setCreationRepositoryForTests(new MemoryCreationRepository());
  });

  afterEach(() => {
    setCreationRepositoryForTests(null);
    delete process.env[PERSONA_FACE_NOVELTY_DEBUG_ENV];
  });

  const deps = () => ({
    backfillRepo,
    embeddingRepo,
    evaluatorReady: true,
    extractEmbedding: async (src: string | Buffer) => extractImpl(src),
    loadImageBytes: async () => Buffer.from("fake-image-bytes"),
    resolveAsset: async ({ candidateId, assetId }: {
      scope: WorkspaceScope;
      candidateId: string;
      assetId: string;
    }) => ({
      id: assetId,
      candidateId,
      storagePath: `workspace/${WS}/persona-creation/${PROJECT}/candidates/${candidateId}/${assetId}.png`,
      mimeType: "image/png",
    }),
  });

  it("1. historical record without embedding is processed", async () => {
    const rec = makeNovelty({ state: "shown" });
    await noveltyRepo.upsert(rec);
    const outcome = await runHistoricalFaceEmbeddingBackfillUntilDone(scope, {
      confirmed: true,
      deps: deps(),
    });
    assert.equal(outcome.results[0]?.resultStatus, "embedded");
    assert.equal(await embeddingRepo.hasEmbedding(rec.id, WS), true);
    assert.equal(outcome.openaiCalls, 0);
    assert.equal(outcome.paidProviderCalls, 0);
    assert.equal(openaiCalls, 0);
    assert.equal(paidProviderCalls, 0);
  });

  it("2. existing embedding is skipped", async () => {
    const rec = makeNovelty({ state: "exhausted" });
    await noveltyRepo.upsert(rec);
    await embeddingRepo.saveEmbedding({
      noveltyRecordId: rec.id,
      workspaceId: WS,
      embedding: makeEmbedding(2),
      embeddingDimension: 128,
      embeddingModel: "faceRecognitionNet",
      embeddingVersion: FACE_SIMILARITY_EVALUATOR_VERSION,
      detectionConfidence: 0.9,
      faceCount: 1,
      detectionStatus: "performed",
      similarityThresholdVersion: "v1.0.0",
    });
    const before = extractCalls;
    const outcome = await runHistoricalFaceEmbeddingBackfillUntilDone(scope, {
      confirmed: true,
      deps: deps(),
    });
    // Already-embedded records are not eligible — never recomputed.
    assert.equal(outcome.results.length, 0);
    assert.equal(extractCalls, before);
    assert.equal(await embeddingRepo.hasEmbedding(rec.id, WS), true);
    assert.equal(isBackfillEligible(toEligibility(rec, true), WS), false);
  });

  it("3. forbidden states are included", () => {
    for (const state of HISTORICAL_BACKFILL_FORBIDDEN_STATES) {
      assert.equal(isForbiddenBackfillState(state), true);
      const el = toEligibility(makeNovelty({ state }));
      assert.equal(isBackfillEligible(el, WS), true);
    }
  });

  it("4. non-forbidden states are excluded", () => {
    assert.equal(isForbiddenBackfillState("generated"), false);
    const el = toEligibility(makeNovelty({ state: "generated" }));
    assert.equal(isBackfillEligible(el, WS), false);
  });

  it("5. another workspace is excluded", async () => {
    const other = makeNovelty({ workspaceId: OTHER_WS, state: "shown" });
    const own = makeNovelty({ state: "shown" });
    await noveltyRepo.upsert(other);
    await noveltyRepo.upsert(own);
    const outcome = await runHistoricalFaceEmbeddingBackfillUntilDone(scope, {
      confirmed: true,
      deps: deps(),
    });
    assert.equal(outcome.results.length, 1);
    assert.equal(outcome.results[0]?.noveltyRecordId, own.id);
    assert.equal(await embeddingRepo.hasEmbedding(other.id, OTHER_WS), false);
  });

  it("6. missing asset is recorded safely", async () => {
    const rec = makeNovelty({ state: "saved" });
    await noveltyRepo.upsert(rec);
    const outcome = await runHistoricalFaceEmbeddingBackfillUntilDone(scope, {
      confirmed: true,
      deps: {
        ...deps(),
        resolveAsset: async () => null,
      },
    });
    assert.equal(outcome.results[0]?.resultStatus, "missing_asset");
    assert.equal(outcome.job.failedRecords, 1);
    assert.equal(await embeddingRepo.hasEmbedding(rec.id, WS), false);
  });

  it("7. no_face does not stop the batch", async () => {
    const a = makeNovelty({ state: "shown", candidateId: "c-a", assetId: "a-a" });
    const b = makeNovelty({ state: "shown", candidateId: "c-b", assetId: "a-b" });
    await noveltyRepo.upsert(a);
    await noveltyRepo.upsert(b);
    let n = 0;
    extractImpl = async () => {
      extractCalls += 1;
      n += 1;
      if (n === 1) return baseExtraction({ status: "no_face", embedding: undefined });
      return baseExtraction({ embedding: makeEmbedding(9) });
    };
    const outcome = await runHistoricalFaceEmbeddingBackfillUntilDone(scope, {
      confirmed: true,
      batchSize: 5,
      deps: deps(),
    });
    assert.equal(outcome.results.length, 2);
    assert.ok(outcome.results.some((r) => r.resultStatus === "no_face"));
    assert.ok(outcome.results.some((r) => r.resultStatus === "embedded"));
    assert.equal(outcome.job.status, "completed_with_errors");
  });

  it("8. evaluator error does not stop the batch", async () => {
    const a = makeNovelty({ state: "rejected", candidateId: "c1", assetId: "x1" });
    const b = makeNovelty({ state: "approved", candidateId: "c2", assetId: "x2" });
    await noveltyRepo.upsert(a);
    await noveltyRepo.upsert(b);
    let n = 0;
    extractImpl = async () => {
      extractCalls += 1;
      n += 1;
      if (n === 1) {
        return baseExtraction({
          status: "error",
          embedding: undefined,
          safeErrorCode: "face_extraction_error",
          safeErrorMessage: "boom",
        });
      }
      return baseExtraction({ embedding: makeEmbedding(3) });
    };
    const outcome = await runHistoricalFaceEmbeddingBackfillUntilDone(scope, {
      confirmed: true,
      deps: deps(),
    });
    assert.ok(outcome.results.some((r) => r.resultStatus === "evaluator_error"));
    assert.ok(outcome.results.some((r) => r.resultStatus === "embedded"));
  });

  it("9. successful embedding is persisted once", async () => {
    const rec = makeNovelty({ state: "shortlisted" });
    await noveltyRepo.upsert(rec);
    await runHistoricalFaceEmbeddingBackfillUntilDone(scope, {
      confirmed: true,
      deps: deps(),
    });
    const firstCalls = extractCalls;
    assert.equal(firstCalls, 1);
    const second = await runHistoricalFaceEmbeddingBackfillUntilDone(scope, {
      confirmed: true,
      deps: deps(),
    });
    assert.equal(extractCalls, firstCalls);
    assert.equal(second.results.length, 0);
    assert.equal(await embeddingRepo.hasEmbedding(rec.id, WS), true);
  });

  it("10. duplicate asset is processed once", async () => {
    const assetId = randomUUID();
    const a = makeNovelty({ state: "shown", assetId, candidateId: "cand-1" });
    const b = makeNovelty({ state: "exhausted", assetId, candidateId: "cand-2" });
    await noveltyRepo.upsert(a);
    await noveltyRepo.upsert(b);
    const { unique, duplicateAssetIds } = dedupeEligibleByAsset([
      toEligibility(a),
      toEligibility(b),
    ]);
    assert.equal(unique.length, 1);
    assert.equal(duplicateAssetIds.has(assetId), true);

    const outcome = await runHistoricalFaceEmbeddingBackfillUntilDone(scope, {
      confirmed: true,
      deps: deps(),
    });
    assert.equal(extractCalls, 1);
    assert.equal(
      outcome.results.filter((r) => r.resultStatus === "embedded").length,
      1,
    );
  });

  it("11. interrupted job can resume", async () => {
    const records = Array.from({ length: 3 }, (_, i) =>
      makeNovelty({
        state: "shown",
        candidateId: `cand-r-${i}`,
        assetId: `asset-r-${i}`,
      }),
    );
    for (const r of records) await noveltyRepo.upsert(r);

    const first = await runHistoricalFaceEmbeddingBackfillBatch(scope, {
      confirmed: true,
      batchSize: 1,
      deps: deps(),
    });
    assert.equal(first.job.status, "running");
    assert.equal(first.job.processedRecords, 1);

    const done = await runHistoricalFaceEmbeddingBackfillUntilDone(scope, {
      confirmed: true,
      batchSize: 1,
      resumeJobId: first.job.id,
      deps: deps(),
    });
    assert.ok(
      done.job.status === "completed" || done.job.status === "completed_with_errors",
    );
    assert.equal(done.job.processedRecords, 3);
    assert.equal(done.job.id, first.job.id);
  });

  it("12. rerun is idempotent", async () => {
    const rec = makeNovelty({ state: "shown" });
    await noveltyRepo.upsert(rec);
    const first = await runHistoricalFaceEmbeddingBackfillUntilDone(scope, {
      confirmed: true,
      deps: deps(),
    });
    assert.equal(first.results[0]?.resultStatus, "embedded");
    const second = await runHistoricalFaceEmbeddingBackfillUntilDone(scope, {
      confirmed: true,
      deps: deps(),
    });
    assert.equal(second.results.length, 0);
    assert.equal(second.openaiCalls, 0);
    assert.equal(extractCalls, 1);
  });

  it("13. retry failed records works", async () => {
    const rec = makeNovelty({ state: "shown", candidateId: "fail-1", assetId: "fa-1" });
    await noveltyRepo.upsert(rec);
    extractImpl = async () =>
      baseExtraction({ status: "no_face", embedding: undefined });
    await runHistoricalFaceEmbeddingBackfillUntilDone(scope, {
      confirmed: true,
      deps: deps(),
    });
    extractImpl = async () => {
      extractCalls += 1;
      return baseExtraction({ embedding: makeEmbedding(7) });
    };
    const retry = await runHistoricalFaceEmbeddingBackfillUntilDone(scope, {
      confirmed: true,
      retryFailedOnly: true,
      deps: deps(),
    });
    assert.equal(retry.results[0]?.resultStatus, "embedded");
    assert.equal(await embeddingRepo.hasEmbedding(rec.id, WS), true);
  });

  it("14. progress is persisted", async () => {
    const rec = makeNovelty({ state: "shown" });
    await noveltyRepo.upsert(rec);
    const outcome = await runHistoricalFaceEmbeddingBackfillUntilDone(scope, {
      confirmed: true,
      deps: deps(),
    });
    const job = await backfillRepo.getJob(outcome.job.id, WS);
    assert.ok(job);
    assert.equal(job!.processedRecords, 1);
    assert.equal(job!.embeddedRecords, 1);
    const results = await backfillRepo.listResults(outcome.job.id, WS);
    assert.equal(results.length, 1);
  });

  it("15. coverage calculation is accurate", () => {
    const coverage = calculateExtendedHistoricalCoverage({
      records: [
        toEligibility(makeNovelty({ state: "shown" }), true),
        toEligibility(
          makeNovelty({ state: "exhausted", imageChecksum: "abc" }),
          false,
        ),
        toEligibility(makeNovelty({ state: "saved", assetId: "" }), false),
      ],
      missingAssetIds: new Set([""]),
      failedProcessingIds: new Set(),
    });
    assert.equal(coverage.forbiddenFacesTotal, 3);
    assert.equal(coverage.protectedByEmbedding, 1);
    assert.equal(coverage.protectedOnlyByChecksumOrPHash, 1);
    assert.equal(coverage.missingEmbedding, 2);
    assert.equal(coverage.missingAsset, 1);
    assert.equal(coverage.processableTotal, 2);
    assert.equal(coverage.processableCoveragePercentage, 50);
    // Does not claim 100% when failures / gaps remain.
    assert.notEqual(coverage.processableCoveragePercentage, 100);
  });

  it("16. new discovery gate blocks incomplete coverage", () => {
    const coverage = calculateExtendedHistoricalCoverage({
      records: [
        toEligibility(makeNovelty({ state: "shown" }), true),
        toEligibility(makeNovelty({ state: "shown" }), false),
      ],
    });
    const gate = evaluateDiscoveryCoverageGate({
      evaluatorReady: true,
      coverage,
      acknowledgeUnresolvedFailures: true,
      env: { NODE_ENV: "development", [PERSONA_FACE_NOVELTY_DEBUG_ENV]: "true" },
    });
    assert.equal(gate.blocked, true);
    assert.ok(gate.reasonCodes.includes("incomplete_historical_coverage"));
    assert.equal(gate.openaiCalls, 0);
    assert.equal(gate.paidProviderCalls, 0);
  });

  it("17. gate allows complete processable coverage", () => {
    const coverage = calculateExtendedHistoricalCoverage({
      records: [
        toEligibility(makeNovelty({ state: "shown" }), true),
        toEligibility(makeNovelty({ state: "exhausted" }), true),
      ],
    });
    const gate = evaluateDiscoveryCoverageGate({
      evaluatorReady: true,
      coverage,
      env: { NODE_ENV: "development", [PERSONA_FACE_NOVELTY_DEBUG_ENV]: "true" },
    });
    assert.equal(gate.allowed, true);
    assert.equal(gate.blocked, false);
    assert.equal(gate.actualProcessableCoveragePercent, 100);
  });

  it("18. no OpenAI or paid provider call occurs", async () => {
    const rec = makeNovelty({ state: "shown" });
    await noveltyRepo.upsert(rec);
    const preflight = await loadHistoricalBackfillPreflight(scope, {
      deps: { ...deps(), evaluatorReady: true },
    });
    assert.equal(preflight.paidProviderCostEur, 0);
    assert.equal(preflight.openaiCalls, 0);
    const outcome = await runHistoricalFaceEmbeddingBackfillUntilDone(scope, {
      confirmed: true,
      deps: deps(),
    });
    assert.equal(outcome.openaiCalls, 0);
    assert.equal(outcome.paidProviderCalls, 0);
  });

  it("19. current project candidates are included", async () => {
    // Project 64ed1965… — A/B embedded, C/D eligible for backfill.
    const a = makeNovelty({
      state: "shown",
      candidateId: "cand-a",
      assetId: "asset-a",
      creationProjectId: PROJECT,
    });
    const b = makeNovelty({
      state: "shown",
      candidateId: "cand-b",
      assetId: "asset-b",
      creationProjectId: PROJECT,
    });
    const c = makeNovelty({
      state: "exhausted",
      candidateId: "cand-c",
      assetId: "asset-c",
      creationProjectId: PROJECT,
    });
    const d = makeNovelty({
      state: "exhausted",
      candidateId: "cand-d",
      assetId: "asset-d",
      creationProjectId: PROJECT,
    });
    for (const r of [a, b, c, d]) await noveltyRepo.upsert(r);
    for (const r of [a, b]) {
      await embeddingRepo.saveEmbedding({
        noveltyRecordId: r.id,
        workspaceId: WS,
        embedding: makeEmbedding(5),
        embeddingDimension: 128,
        embeddingModel: "faceRecognitionNet",
        embeddingVersion: FACE_SIMILARITY_EVALUATOR_VERSION,
        detectionConfidence: 0.9,
        faceCount: 1,
        detectionStatus: "performed",
        similarityThresholdVersion: "v1.0.0",
      });
    }

    // A/B already protected — not eligible. C/D backfilled from stored images.
    assert.equal(await embeddingRepo.hasEmbedding(a.id, WS), true);
    assert.equal(await embeddingRepo.hasEmbedding(b.id, WS), true);
    const outcome = await runHistoricalFaceEmbeddingBackfillUntilDone(scope, {
      confirmed: true,
      deps: deps(),
    });
    const byCand = new Map(
      outcome.results.map((r) => [r.candidateId, r.resultStatus]),
    );
    assert.equal(byCand.has("cand-a"), false);
    assert.equal(byCand.has("cand-b"), false);
    assert.equal(byCand.get("cand-c"), "embedded");
    assert.equal(byCand.get("cand-d"), "embedded");
    assert.equal(await embeddingRepo.hasEmbedding(c.id, WS), true);
    assert.equal(await embeddingRepo.hasEmbedding(d.id, WS), true);
  });

  it("20. embeddings and signed URLs are absent from debug/job output", async () => {
    const rec = makeNovelty({ state: "shown" });
    await noveltyRepo.upsert(rec);
    const outcome = await runHistoricalFaceEmbeddingBackfillUntilDone(scope, {
      confirmed: true,
      deps: deps(),
    });
    assert.doesNotThrow(() => assertSafeFaceNoveltyDebugDto(outcome));
    const json = JSON.stringify(outcome);
    assert.equal(json.includes("face_embedding"), false);
    assert.equal(json.includes("?token="), false);
    assert.equal(json.includes("/object/sign/"), false);
    assert.equal(/\[[\d\s.,eE+-]{200,}\]/.test(json), false);

    const summary = buildHistoricalBackfillPreflightSummary({
      records: [toEligibility(rec)],
      evaluatorReady: true,
      batchSize: 5,
    });
    assert.doesNotThrow(() => assertSafeFaceNoveltyDebugDto(summary));
  });

  it("21. RLS/workspace isolation remains green", async () => {
    const foreign = makeNovelty({ workspaceId: OTHER_WS, state: "shown" });
    await noveltyRepo.upsert(foreign);
    const records = await backfillRepo.loadEligibilityRecords({
      workspaceId: WS,
    });
    assert.equal(records.every((r) => r.workspaceId === WS), true);
    assert.equal(
      records.some((r) => r.noveltyRecordId === foreign.id),
      false,
    );
    const job = await backfillRepo.createJob({
      workspaceId: WS,
      totalRecords: 0,
    });
    const foreignGet = await backfillRepo.getJob(job.id, OTHER_WS);
    assert.equal(foreignGet, null);
  });

  it("22. eligibility preflight counts are consistent", async () => {
    const embedded = makeNovelty({ state: "shown" });
    const missing = makeNovelty({ state: "exhausted", imageChecksum: "zz" });
    await noveltyRepo.upsert(embedded);
    await noveltyRepo.upsert(missing);
    await embeddingRepo.saveEmbedding({
      noveltyRecordId: embedded.id,
      workspaceId: WS,
      embedding: makeEmbedding(1),
      embeddingDimension: 128,
      embeddingModel: "faceRecognitionNet",
      embeddingVersion: FACE_SIMILARITY_EVALUATOR_VERSION,
      detectionConfidence: 0.9,
      faceCount: 1,
      detectionStatus: "performed",
      similarityThresholdVersion: "v1.0.0",
    });
    const summary = await loadHistoricalBackfillPreflight(scope, {
      deps: { ...deps(), evaluatorReady: true },
    });
    assert.equal(summary.historicalForbiddenFacesTotal, 2);
    assert.equal(summary.alreadyProtectedByEmbedding, 1);
    assert.equal(summary.missingEmbedding, 1);
    assert.equal(summary.paidProviderCostEur, 0);

    const snap = await loadHistoricalProtectionSnapshot(scope, {
      deps: deps(),
    });
    assert.equal(snap.protectedByEmbedding, 1);
    assert.equal(snap.missingEmbedding, 1);
  });

  it("23. brand_role archetype filter must not zero out historical discovery", async () => {
    // Records stored under official cast archetype id (live path).
    const rec = makeNovelty({
      state: "shown",
      archetypeId: "arch-mediterranean-premium-hero",
    });
    await noveltyRepo.upsert(rec);

    // UI/API historically passed creation-project brand_role — must still find rows.
    const byBrandRole = await backfillRepo.loadEligibilityRecords({
      workspaceId: WS,
      archetypeId: "primary_male",
    });
    assert.equal(byBrandRole.length, 1);
    assert.equal(byBrandRole[0]?.archetypeId, "arch-mediterranean-premium-hero");

    // Exact novelty archetype id still filters correctly.
    const byExact = await backfillRepo.loadEligibilityRecords({
      workspaceId: WS,
      archetypeId: "arch-mediterranean-premium-hero",
    });
    assert.equal(byExact.length, 1);

    // Unrelated genuine archetype with no rows stays empty.
    const empty = await backfillRepo.loadEligibilityRecords({
      workspaceId: WS,
      archetypeId: "arch-other-genuine-empty",
    });
    assert.equal(empty.length, 0);
  });
});
