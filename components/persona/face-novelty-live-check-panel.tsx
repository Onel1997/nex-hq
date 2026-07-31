"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  FaceNoveltyCopyDebugPayload,
  FaceNoveltyRunLiveDebug,
  HistoricalFaceProtectionSummary,
  SafeFaceNoveltyLiveDebug,
} from "@/lib/persona/face-novelty-memory/live-debug";
import type { FaceNoveltyPreflightReport } from "@/lib/persona/face-novelty-memory/preflight";
import type { PersonaCandidate } from "@/lib/persona/domain/creation-types";

type NoveltyDebugApi = {
  enabled: boolean;
  reason?: string;
  run?: FaceNoveltyRunLiveDebug;
  historicalCoverage?: HistoricalFaceProtectionSummary;
  candidates?: SafeFaceNoveltyLiveDebug[];
  copyPayload?: FaceNoveltyCopyDebugPayload;
};

function candidateDebugFromSettings(
  candidate: PersonaCandidate,
): SafeFaceNoveltyLiveDebug | null {
  const raw = candidate.generation_settings?.faceNoveltyLiveDebug;
  if (!raw || typeof raw !== "object") return null;
  return raw as SafeFaceNoveltyLiveDebug;
}

export function FaceNoveltyLiveCheckPanel({
  projectId,
  archetypeId,
  candidates,
}: {
  projectId: string;
  archetypeId?: string;
  candidates: PersonaCandidate[];
}) {
  const [apiDebug, setApiDebug] = useState<NoveltyDebugApi | null>(null);
  const [preflight, setPreflight] = useState<FaceNoveltyPreflightReport | null>(null);
  const [preflightBusy, setPreflightBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/persona/creation-projects/${projectId}/novelty-debug`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as NoveltyDebugApi & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Novelty debug load failed");
      setApiDebug(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const fromCandidates: SafeFaceNoveltyLiveDebug[] = [];
  for (const c of candidates) {
    const d = candidateDebugFromSettings(c);
    if (!d) continue;
    fromCandidates.push({
      ...d,
      slot: d.slot ?? c.candidate_number,
      candidateId: d.candidateId ?? c.id,
      assetId: d.assetId ?? c.primary_preview_asset_id ?? undefined,
      candidateProjectId: d.candidateProjectId ?? c.creation_project_id,
    });
  }

  const candidateDebug: SafeFaceNoveltyLiveDebug[] = apiDebug?.candidates?.length
    ? apiDebug.candidates
    : fromCandidates;

  const run = apiDebug?.run;
  const coverage = apiDebug?.historicalCoverage;

  const onPreflight = async () => {
    setPreflightBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/persona/creation-projects/${projectId}/novelty-debug`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "preflight" }),
        },
      );
      const data = (await res.json()) as FaceNoveltyPreflightReport & {
        enabled?: boolean;
        error?: string;
        reason?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Preflight failed");
      if (data.enabled === false) {
        setError(data.reason ?? "Preflight unavailable");
        return;
      }
      setPreflight(data as FaceNoveltyPreflightReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreflightBusy(false);
    }
  };

  const onCopy = async () => {
    const payload =
      apiDebug?.copyPayload ??
      ({
        projectId,
        archetypeId: archetypeId ?? "unknown",
        evaluatorHealth: run,
        historicalCoverage: coverage,
        candidates: candidateDebug,
        finalDecisions: candidateDebug.map((c) => ({
          candidateId: c.candidateId,
          slot: c.slot,
          finalDecision: c.finalDecision,
          hardRejectReason: c.hardRejectReason,
        })),
      } as FaceNoveltyCopyDebugPayload);
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  };

  if (apiDebug && apiDebug.enabled === false) {
    return null;
  }

  // Wait for first successful enabled response before rendering the panel.
  if (!apiDebug?.enabled) {
    return null;
  }

  return (
    <details className="ps-tech ps-ci-debug-panel" style={{ marginBottom: "1rem" }}>
      <summary>Face Novelty Live Check</summary>
      {error ? <p className="ps-muted" style={{ color: "#c0392b" }}>{error}</p> : null}

      <div style={{ display: "flex", gap: "0.5rem", margin: "0.5rem 0" }}>
        <button type="button" className="ps-btn" onClick={() => void onPreflight()} disabled={preflightBusy}>
          {preflightBusy ? "Running preflight…" : "Run Face Novelty Preflight"}
        </button>
        <button type="button" className="ps-btn" onClick={() => void onCopy()}>
          Copy Face Novelty Debug
        </button>
        <button type="button" className="ps-btn" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {preflight ? (
        <div className="ps-callout" style={{ marginBottom: "0.75rem" }}>
          <p>
            <strong>{preflight.verdict}</strong>
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "12px" }}>
            {preflight.checks
              .filter((c) => !c.ok)
              .map((c) => (
                <li key={c.id}>
                  {c.id}: {c.detail}
                </li>
              ))}
            {preflight.ready ? <li>All checks passed — no OpenAI call made.</li> : null}
          </ul>
        </div>
      ) : null}

      {run ? (
        <dl style={{ fontSize: "12px" }}>
          <div><dt>Evaluator</dt><dd>{run.evaluatorStatus}</dd></div>
          <div><dt>Evaluator model</dt><dd>{run.evaluatorModel}</dd></div>
          <div><dt>Evaluator version</dt><dd>{run.evaluatorVersion}</dd></div>
          <div><dt>Failure mode</dt><dd>{run.failureMode}</dd></div>
          <div><dt>Threshold version</dt><dd>{run.thresholdVersion}</dd></div>
          <div><dt>Duplicate threshold</dt><dd>{run.duplicateThreshold}</dd></div>
          <div><dt>Warning threshold</dt><dd>{run.warningThreshold}</dd></div>
          <div><dt>Prior embeddings loaded</dt><dd>{run.priorEmbeddingsLoaded}</dd></div>
          <div><dt>Current run project ID</dt><dd>{run.currentRunProjectId}</dd></div>
          <div><dt>Current archetype ID</dt><dd>{run.currentArchetypeId}</dd></div>
          <div><dt>Last evaluation time</dt><dd>{run.lastEvaluationTime ?? "—"}</dd></div>
          <div><dt>Pipeline status</dt><dd>{run.pipelineStatus}</dd></div>
        </dl>
      ) : (
        <p className="ps-muted" style={{ fontSize: "12px" }}>
          Run-level status will appear after the first evaluated candidate (or after Refresh).
        </p>
      )}

      {coverage ? (
        <div style={{ marginTop: "0.75rem" }}>
          <p style={{ fontSize: "12px", marginBottom: "0.25rem" }}>
            <strong>Historical Face Protection</strong>
          </p>
          <dl style={{ fontSize: "12px" }}>
            <div><dt>Forbidden faces total</dt><dd>{coverage.forbiddenFacesTotal}</dd></div>
            <div><dt>Protected by embedding</dt><dd>{coverage.protectedByEmbedding}</dd></div>
            <div>
              <dt>Protected only by checksum/pHash</dt>
              <dd>{coverage.protectedOnlyByChecksumOrPHash}</dd>
            </div>
            <div>
              <dt>Unprotected for biological similarity</dt>
              <dd>{coverage.unprotectedForBiologicalSimilarity}</dd>
            </div>
            <div><dt>Coverage percentage</dt><dd>{coverage.coveragePercentage}%</dd></div>
          </dl>
        </div>
      ) : null}

      {candidateDebug.length > 0 ? (
        <div style={{ marginTop: "0.75rem" }}>
          <p style={{ fontSize: "12px", marginBottom: "0.25rem" }}>
            <strong>Candidate-level debug</strong>
          </p>
          {candidateDebug.map((c) => (
            <details key={c.candidateId ?? String(c.slot)} style={{ fontSize: "11px", marginBottom: "0.35rem" }}>
              <summary>
                Slot {c.slot ?? "—"} · {c.candidateId?.slice(0, 8) ?? "—"} · {c.finalDecision}
              </summary>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                {JSON.stringify(
                  {
                    slot: c.slot,
                    candidateId: c.candidateId,
                    assetId: c.assetId,
                    candidateProjectId: c.candidateProjectId,
                    evaluatorActive: c.evaluatorActive ? "yes" : "no",
                    faceDetectionStatus: c.faceDetectionStatus,
                    faceCount: c.faceCount,
                    detectionConfidence: c.detectionConfidence,
                    embeddingStatus: c.embeddingStatus,
                    embeddingDimension: c.embeddingDimension,
                    priorEmbeddingsCompared: c.priorEmbeddingsLoaded,
                    closestPriorCandidateId: c.closestPriorCandidateId,
                    closestPriorAssetId: c.closestPriorAssetId,
                    similarityScore: c.similarity,
                    duplicateThreshold: c.duplicateThreshold,
                    warningThreshold: c.warningThreshold,
                    duplicateDecision: c.duplicateDecision,
                    finalNoveltyResult: c.finalDecision,
                    hardRejectReason: c.hardRejectReason,
                    replacementConfirmationRequired: c.requiresReplacementConfirmation,
                    evaluationDurationMs: c.evaluationDurationMs,
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
          ))}
        </div>
      ) : null}
    </details>
  );
}
