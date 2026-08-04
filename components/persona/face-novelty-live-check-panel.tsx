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
import type { HistoricalBackfillPreflightSummary } from "@/lib/persona/face-novelty-memory/historical-backfill-types";
import type { DiscoveryCoverageGateResult } from "@/lib/persona/face-novelty-memory/discovery-coverage-gate";

type NoveltyDebugApi = {
  enabled: boolean;
  reason?: string;
  run?: FaceNoveltyRunLiveDebug;
  historicalCoverage?: HistoricalFaceProtectionSummary;
  candidates?: SafeFaceNoveltyLiveDebug[];
  copyPayload?: FaceNoveltyCopyDebugPayload;
  discoveryCoverageGate?: DiscoveryCoverageGateResult;
  backfillPreflight?: HistoricalBackfillPreflightSummary | null;
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
  const [backfillSummary, setBackfillSummary] =
    useState<HistoricalBackfillPreflightSummary | null>(null);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillConfirm, setBackfillConfirm] = useState(false);
  const [retryFailedOnly, setRetryFailedOnly] = useState(false);
  const [ackFailures, setAckFailures] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);
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
      if (data.backfillPreflight) setBackfillSummary(data.backfillPreflight);
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
  const gate = apiDebug?.discoveryCoverageGate;

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

  const onBackfillPreflight = async () => {
    setBackfillBusy(true);
    setError(null);
    setBackfillMessage(null);
    try {
      const res = await fetch(
        `/api/persona/creation-projects/${projectId}/novelty-debug`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "backfill_preflight" }),
        },
      );
      const data = (await res.json()) as HistoricalBackfillPreflightSummary & {
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Backfill preflight failed");
      setBackfillSummary(data);
      setBackfillConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBackfillBusy(false);
    }
  };

  const onBackfillRun = async () => {
    if (!backfillConfirm) {
      setError("Confirm the historical backfill summary before starting.");
      return;
    }
    setBackfillBusy(true);
    setError(null);
    setBackfillMessage(null);
    try {
      const res = await fetch(
        `/api/persona/creation-projects/${projectId}/novelty-debug`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "backfill_historical_embeddings",
            confirmed: true,
            processAll: true,
            retryFailedOnly,
          }),
        },
      );
      const data = (await res.json()) as {
        error?: string;
        job?: { id: string; status: string; embeddedRecords: number; failedRecords: number };
        openaiCalls?: number;
        paidProviderCalls?: number;
      };
      if (!res.ok) throw new Error(data.error ?? "Backfill failed");
      setBackfillMessage(
        `Backfill ${data.job?.status ?? "done"} · embedded ${data.job?.embeddedRecords ?? 0} · failed ${data.job?.failedRecords ?? 0} · paid €0.00`,
      );
      setBackfillConfirm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBackfillBusy(false);
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

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  // Phase 2.0C.1 — always mount in development. Do not hide when the
  // legacy PERSONA_FACE_NOVELTY_DEBUG flag is unset / returns flag_disabled.
  if (apiDebug && apiDebug.enabled === false && apiDebug.reason === "production") {
    return null;
  }

  const backfillAvailable =
    preflight?.ready ||
    backfillSummary?.evaluatorReady ||
    run?.evaluatorStatus === "ACTIVE" ||
    !apiDebug;

  return (
    <details
      className="ps-tech ps-ci-debug-panel"
      style={{ marginBottom: "1rem", marginTop: "0.75rem" }}
      open
    >
      <summary>Face Novelty Live Check · Historical Face Protection</summary>
      {error ? <p className="ps-muted" style={{ color: "#c0392b" }}>{error}</p> : null}
      {!apiDebug && !error ? (
        <p className="ps-muted" style={{ fontSize: "12px" }}>
          Loading historical face protection…
        </p>
      ) : null}

      <div style={{ display: "flex", gap: "0.5rem", margin: "0.5rem 0", flexWrap: "wrap" }}>
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
              <dt>Checksum/pHash only</dt>
              <dd>{coverage.protectedOnlyByChecksumOrPHash}</dd>
            </div>
            <div>
              <dt>Missing embedding</dt>
              <dd>{coverage.missingEmbedding ?? coverage.unprotectedForBiologicalSimilarity}</dd>
            </div>
            <div>
              <dt>Failed processing</dt>
              <dd>{coverage.failedProcessing ?? 0}</dd>
            </div>
            <div>
              <dt>Missing asset</dt>
              <dd>{coverage.missingAsset ?? 0}</dd>
            </div>
            <div>
              <dt>Unprotected for biological similarity</dt>
              <dd>{coverage.unprotectedForBiologicalSimilarity}</dd>
            </div>
            <div>
              <dt>Biological protection coverage</dt>
              <dd>
                {coverage.processableCoveragePercentage ?? coverage.coveragePercentage}%
                {coverage.processableTotal != null
                  ? ` (${coverage.protectedByEmbedding}/${coverage.processableTotal} processable)`
                  : ""}
              </dd>
            </div>
            <div>
              <dt>Last backfill job</dt>
              <dd>
                {coverage.lastBackfillJob
                  ? `${coverage.lastBackfillJob.id.slice(0, 8)} · ${coverage.lastBackfillJob.status}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Current progress</dt>
              <dd>
                {coverage.currentProgress
                  ? `${coverage.currentProgress.processedRecords}/${coverage.currentProgress.totalRecords} · embedded ${coverage.currentProgress.embeddedRecords} · failed ${coverage.currentProgress.failedRecords}`
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      {gate ? (
        <div className="ps-callout" style={{ marginTop: "0.75rem", fontSize: "12px" }}>
          <p>
            <strong>Paid discovery coverage gate</strong>{" "}
            {gate.blocked ? "BLOCKED" : "ALLOWED"}
          </p>
          {gate.message ? <p className="ps-muted">{gate.message}</p> : null}
          {gate.unresolvedFailures > 0 ? (
            <label style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={ackFailures}
                onChange={(e) => setAckFailures(e.target.checked)}
              />
              Acknowledge unresolved historical face failures ({gate.unresolvedFailures})
            </label>
          ) : null}
        </div>
      ) : null}

      <div style={{ marginTop: "0.75rem" }}>
        <p style={{ fontSize: "12px", marginBottom: "0.25rem" }}>
          <strong>Backfill Historical Face Protection</strong>
        </p>
        <p className="ps-muted" style={{ fontSize: "11px" }}>
          Development-only · local evaluator · paid provider cost €0.00 · never calls OpenAI
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "0.35rem 0" }}>
          <button
            type="button"
            className="ps-btn"
            onClick={() => void onBackfillPreflight()}
            disabled={backfillBusy}
          >
            {backfillBusy ? "Working…" : "Prepare backfill summary"}
          </button>
          <button
            type="button"
            className="ps-btn"
            onClick={() => void onBackfillRun()}
            disabled={backfillBusy || !backfillConfirm || !backfillAvailable}
          >
            Run historical backfill
          </button>
        </div>
        {backfillSummary ? (
          <div className="ps-callout" style={{ fontSize: "12px" }}>
            <dl>
              <div>
                <dt>Historical forbidden faces</dt>
                <dd>{backfillSummary.historicalForbiddenFacesTotal}</dd>
              </div>
              <div>
                <dt>Already protected by embedding</dt>
                <dd>{backfillSummary.alreadyProtectedByEmbedding}</dd>
              </div>
              <div>
                <dt>Missing embedding</dt>
                <dd>{backfillSummary.missingEmbedding}</dd>
              </div>
              <div>
                <dt>Missing assets</dt>
                <dd>{backfillSummary.missingAssets}</dd>
              </div>
              <div>
                <dt>Prior detection failures</dt>
                <dd>{backfillSummary.priorDetectionFailures}</dd>
              </div>
              <div>
                <dt>Estimated local processing</dt>
                <dd>{backfillSummary.estimatedLocalProcessingCount}</dd>
              </div>
              <div>
                <dt>Paid provider cost</dt>
                <dd>€{backfillSummary.paidProviderCostEur.toFixed(2)}</dd>
              </div>
              <div>
                <dt>Evaluator ready</dt>
                <dd>{backfillSummary.evaluatorReady ? "yes" : "no"}</dd>
              </div>
            </dl>
            <label style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginTop: "0.35rem" }}>
              <input
                type="checkbox"
                checked={retryFailedOnly}
                onChange={(e) => setRetryFailedOnly(e.target.checked)}
              />
              Retry failed records only
            </label>
            <label style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginTop: "0.35rem" }}>
              <input
                type="checkbox"
                checked={backfillConfirm}
                onChange={(e) => setBackfillConfirm(e.target.checked)}
              />
              I confirm running local historical face embedding backfill (€0.00)
            </label>
          </div>
        ) : null}
        {backfillMessage ? (
          <p className="ps-muted" style={{ fontSize: "12px" }}>{backfillMessage}</p>
        ) : null}
      </div>

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
