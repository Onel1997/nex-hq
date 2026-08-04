/**
 * Server helpers for Phase 2.0B.2 controlled live novelty test mode.
 * Used by API routes — never call paid providers.
 */

import type { WorkspaceScope } from "../domain/types";
import {
  buildCopyDebugPayload,
  buildRunLiveDebug,
  calculateHistoricalEmbeddingCoverage,
  type FaceNoveltyCopyDebugPayload,
  type FaceNoveltyPipelineStatus,
  type FaceNoveltyRunLiveDebug,
  type HistoricalFaceProtectionSummary,
  type SafeFaceNoveltyLiveDebug,
} from "./live-debug";
import { SupabaseLiveDiagnosticStore } from "./supabase-diagnostic-store";
import { SupabaseNoveltyRepository } from "./supabase-novelty-repository";
import { SupabaseEmbeddingRepository } from "./supabase-embedding-repository";
import { runFaceNoveltyPreflight, type FaceNoveltyPreflightReport } from "./preflight";
import { FACE_NOVELTY_STATES } from "./types";
import { loadHistoricalProtectionSnapshot } from "./historical-backfill-service";
import { evaluateDiscoveryCoverageGate } from "./discovery-coverage-gate";
import type { DiscoveryCoverageGateResult } from "./discovery-coverage-gate";
import type { HistoricalBackfillPreflightSummary } from "./historical-backfill-types";
import { loadHistoricalBackfillPreflight } from "./historical-backfill-service";

export type ProjectNoveltyLiveDebugResponse = {
  enabled: true;
  run: FaceNoveltyRunLiveDebug;
  historicalCoverage: HistoricalFaceProtectionSummary;
  candidates: SafeFaceNoveltyLiveDebug[];
  copyPayload: FaceNoveltyCopyDebugPayload;
  discoveryCoverageGate?: DiscoveryCoverageGateResult;
  backfillPreflight?: HistoricalBackfillPreflightSummary | null;
} | {
  enabled: false;
  reason: "flag_disabled" | "production";
};

function derivePipelineStatus(
  candidates: SafeFaceNoveltyLiveDebug[],
): FaceNoveltyPipelineStatus {
  if (candidates.length === 0) return "waiting";
  if (candidates.some((c) => c.finalDecision === "failed")) return "failed";
  if (candidates.some((c) => c.finalDecision === "blocked")) return "blocked";
  if (candidates.every((c) => c.finalDecision === "allowed")) return "passed";
  return "evaluating";
}

export async function loadProjectNoveltyLiveDebug(
  scope: WorkspaceScope,
  projectId: string,
  archetypeId: string,
): Promise<ProjectNoveltyLiveDebugResponse> {
  // Phase 2.0C.1 — Historical Face Protection is always available in development.
  // PERSONA_FACE_NOVELTY_DEBUG is no longer required to mount the panel.
  if (process.env.NODE_ENV === "production") {
    return { enabled: false, reason: "production" };
  }

  const diagnosticStore = new SupabaseLiveDiagnosticStore();
  const noveltyRepo = new SupabaseNoveltyRepository();
  const embeddingRepo = new SupabaseEmbeddingRepository();

  const candidates = await diagnosticStore.loadEvidenceForProject(
    scope.workspaceId,
    projectId,
  );

  const allRecords = await noveltyRepo.findMany({
    workspaceId: scope.workspaceId,
    archetypeId,
    states: [...FACE_NOVELTY_STATES].filter((s) => s !== "generated"),
  });

  const embeddings = await embeddingRepo.loadEmbeddingsForWorkspace(
    scope.workspaceId,
    archetypeId,
  );
  const embeddingIds = new Set(
    embeddings.map((e) => `${e.candidateId}:${e.assetId}`),
  );

  const baseCoverage = calculateHistoricalEmbeddingCoverage(
    allRecords.map((r) => {
      const hasEmbedding =
        embeddingIds.has(`${r.candidateId}:${r.assetId}`) ||
        Boolean(r.embeddingVersion);
      const hasChecksumOrPHash = Boolean(r.imageChecksum || r.perceptualHash);
      return {
        hasEmbedding,
        hasChecksumOrPHash,
        detectionFailed: false,
        missingAssetAccess: !r.assetId,
      };
    }),
  );

  let coverage: HistoricalFaceProtectionSummary = baseCoverage;
  let discoveryCoverageGate: DiscoveryCoverageGateResult | undefined;
  let backfillPreflight: HistoricalBackfillPreflightSummary | null = null;
  try {
    const snapshot = await loadHistoricalProtectionSnapshot(scope, {
      archetypeId,
    });
    coverage = {
      ...baseCoverage,
      ...snapshot,
      // Prefer snapshot totals when available (workspace-wide forbidden set).
      forbiddenFacesTotal: snapshot.forbiddenFacesTotal,
      protectedByEmbedding: snapshot.protectedByEmbedding,
      protectedOnlyByChecksumOrPHash: snapshot.protectedOnlyByChecksumOrPHash,
      unprotectedForBiologicalSimilarity:
        snapshot.unprotectedForBiologicalSimilarity,
      coveragePercentage: snapshot.coveragePercentage,
    };
    const preflight = await runFaceNoveltyPreflight({
      historyCounts: {
        priorNoveltyHistoryCount: allRecords.length,
        priorEmbeddingCount: embeddings.length,
      },
    });
    discoveryCoverageGate = evaluateDiscoveryCoverageGate({
      evaluatorReady:
        preflight.ready && preflight.verdict === "READY FOR CONTROLLED LIVE TEST",
      coverage: snapshot,
      runningBackfillJob:
        snapshot.lastBackfillJob?.status === "running" ||
        snapshot.lastBackfillJob?.status === "pending"
          ? snapshot.lastBackfillJob
          : null,
    });
    backfillPreflight = await loadHistoricalBackfillPreflight(scope, {
      archetypeId,
      deps: { evaluatorReady: preflight.ready },
    });
  } catch {
    // Coverage snapshot is best-effort for the Live Check panel.
  }

  const lastEvaluationTime = candidates
    .map((c) => c.evaluatedAt)
    .filter((t): t is string => Boolean(t))
    .sort()
    .at(-1);

  const run = buildRunLiveDebug({
    projectId,
    archetypeId,
    evaluatorStatus: candidates.some((c) => c.evaluatorStatus === "failed")
      ? "failed"
      : "active",
    priorEmbeddingsLoaded: embeddings.length,
    pipelineStatus: derivePipelineStatus(candidates),
    lastEvaluationTime,
  });

  return {
    enabled: true,
    run,
    historicalCoverage: coverage,
    candidates,
    discoveryCoverageGate,
    backfillPreflight,
    copyPayload: buildCopyDebugPayload({
      projectId,
      archetypeId,
      run,
      coverage,
      candidates,
    }),
  };
}

export async function runProjectNoveltyPreflight(
  scope: WorkspaceScope,
  archetypeId: string,
): Promise<FaceNoveltyPreflightReport | { enabled: false; reason: string }> {
  if (process.env.NODE_ENV === "production") {
    return { enabled: false, reason: "production" };
  }

  const noveltyRepo = new SupabaseNoveltyRepository();
  const embeddingRepo = new SupabaseEmbeddingRepository();
  const records = await noveltyRepo.findMany({
    workspaceId: scope.workspaceId,
    archetypeId,
  });
  const embeddings = await embeddingRepo.loadEmbeddingsForWorkspace(
    scope.workspaceId,
    archetypeId,
  );

  return runFaceNoveltyPreflight({
    historyCounts: {
      priorNoveltyHistoryCount: records.length,
      priorEmbeddingCount: embeddings.length,
    },
  });
}
