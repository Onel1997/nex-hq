/**
 * Server helpers for Phase 2.0B.2 controlled live novelty test mode.
 * Used by API routes — never call paid providers.
 */

import type { WorkspaceScope } from "../domain/types";
import {
  buildCopyDebugPayload,
  buildRunLiveDebug,
  calculateHistoricalEmbeddingCoverage,
  isPersonaFaceNoveltyDebugEnabled,
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

export type ProjectNoveltyLiveDebugResponse = {
  enabled: true;
  run: FaceNoveltyRunLiveDebug;
  historicalCoverage: HistoricalFaceProtectionSummary;
  candidates: SafeFaceNoveltyLiveDebug[];
  copyPayload: FaceNoveltyCopyDebugPayload;
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
  if (process.env.NODE_ENV === "production") {
    return { enabled: false, reason: "production" };
  }
  if (!isPersonaFaceNoveltyDebugEnabled()) {
    return { enabled: false, reason: "flag_disabled" };
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

  const coverage = calculateHistoricalEmbeddingCoverage(
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
  if (!isPersonaFaceNoveltyDebugEnabled()) {
    return { enabled: false, reason: "flag_disabled" };
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
