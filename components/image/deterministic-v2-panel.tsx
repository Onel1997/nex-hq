"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { BrandModelTrace } from "@/lib/persona/domain/brand-model-contract";
import type { MasterArtworkReference } from "@/lib/design/master-artwork-authority/types";
import {
  callBrowserFetch,
  clearPrepareError,
  handlePrepareClick,
  initialPrepareFlowState,
  isPrepareButtonEnabled,
  isPrepareInFlight,
  listPrepareBlockers,
  type PrepareAuthorityInputs,
  type PrepareFlowState,
  type V2PreparedJob,
} from "@/lib/image/deterministic-v2-panel/prepare-flow";
import {
  EMPTY_CORNER_FIELDS,
  validateHumanDefinedQuad,
  type CornerFieldKey,
  type CornerKey,
} from "@/lib/image/print-surface/validate-quad";

type V2Recovery = {
  state: string;
  job: V2PreparedJob;
  stages: Array<{ stage?: string; stageAttempt?: number; status?: string; checksumSha256?: string | null }>;
  asset: null | { id: string; reviewStatus: string; accessUrl?: string | null; mockupReview: Record<string, unknown> };
};

const CHECKS = ["identity", "productFidelity", "artworkFidelityExact", "placement", "perspective", "lightingIntegration"] as const;
const CORNERS: CornerKey[] = ["tl", "tr", "br", "bl"];
const AXES = ["x", "y"] as const;

function authorityFrom(input: {
  reportRecordId: string | null;
  reportId: string | null;
  assetId: string | null;
  brandModelTrace: BrandModelTrace | null;
  masterArtwork: MasterArtworkReference | null;
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
  points: PrepareAuthorityInputs["points"];
}): PrepareAuthorityInputs {
  return {
    reportRecordId: input.reportRecordId,
    reportId: input.reportId,
    assetId: input.assetId,
    hasBrandModel: Boolean(input.brandModelTrace),
    hasMasterArtwork: Boolean(input.masterArtwork),
    shopifyProductId: input.shopifyProductId,
    shopifyVariantId: input.shopifyVariantId,
    points: input.points,
  };
}

export function DeterministicV2Panel(props: {
  reportRecordId: string | null;
  reportId: string | null;
  assetId: string | null;
  brandModelTrace: BrandModelTrace | null;
  masterArtwork: MasterArtworkReference | null;
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
}) {
  const [points, setPoints] = useState(EMPTY_CORNER_FIELDS);
  const [flow, setFlow] = useState<PrepareFlowState>(initialPrepareFlowState);
  const [recovery, setRecovery] = useState<V2Recovery | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [checklist, setChecklist] = useState<Record<(typeof CHECKS)[number], boolean>>({
    identity: false,
    productFidelity: false,
    artworkFidelityExact: false,
    placement: false,
    perspective: false,
    lightingIntegration: false,
  });
  const prepareLock = useRef(false);
  const flowRef = useRef(flow);
  flowRef.current = flow;

  const authority = useMemo(
    () => authorityFrom({
      reportRecordId: props.reportRecordId,
      reportId: props.reportId,
      assetId: props.assetId,
      brandModelTrace: props.brandModelTrace,
      masterArtwork: props.masterArtwork,
      shopifyProductId: props.shopifyProductId,
      shopifyVariantId: props.shopifyVariantId,
      points,
    }),
    [points, props.reportRecordId, props.reportId, props.assetId, props.brandModelTrace, props.masterArtwork, props.shopifyProductId, props.shopifyVariantId],
  );
  const blockers = useMemo(() => listPrepareBlockers(authority), [authority]);
  const quadResult = useMemo(() => validateHumanDefinedQuad(points), [points]);
  const quad = quadResult.ok ? quadResult.quad : null;
  const fieldErrors = quadResult.ok ? {} : quadResult.fieldErrors;
  const busy = isPrepareInFlight(flow) || actionBusy;
  const job = flow.job;
  const canPrepare = isPrepareButtonEnabled(authority, flow);
  const inputSignature = [
    points.tlx, points.tly, points.trx, points.try, points.brx, points.bry, points.blx, points.bly,
    props.reportRecordId, props.reportId, props.assetId,
    props.brandModelTrace?.brandModelId, props.brandModelTrace?.identityLockVersion,
    props.masterArtwork?.id, props.masterArtwork?.version, props.masterArtwork?.checksum,
    props.shopifyProductId, props.shopifyVariantId,
  ].join("|");

  const recover = useCallback(async (jobId: string) => {
    const response = await callBrowserFetch(`/api/image/v2/jobs/${jobId}`, { cache: "no-store" });
    const payload = await response.json() as { recovery?: V2Recovery; error?: string };
    if (!response.ok || !payload.recovery) throw new Error(payload.error ?? "V2 recovery failed.");
    setFlow((current) => ({ ...current, job: payload.recovery!.job, status: "ready", statusLabel: "Ready for confirmation", error: null }));
    setRecovery(payload.recovery);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void callBrowserFetch("/api/image/v2/jobs", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then(async (payload: { jobs?: V2PreparedJob[] } | null) => {
      const latest = payload?.jobs?.find((candidate) => ["awaiting_confirmation", "confirmed", "running", "failed", "succeeded", "unknown_outcome"].includes(candidate.status));
      if (!cancelled && latest) await recover(latest.id);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [recover]);

  useEffect(() => {
    setFlow((current) => clearPrepareError(current));
  }, [inputSignature]);

  async function prepare() {
    if (prepareLock.current || isPrepareInFlight(flowRef.current)) {
      setFlow((current) => ({ ...current, duplicateClickIgnored: true }));
      return;
    }
    prepareLock.current = true;
    try {
      const result = await handlePrepareClick({
        authority,
        payload: { brandModelTrace: props.brandModelTrace, masterArtwork: props.masterArtwork },
        flow: flowRef.current,
        onState: setFlow,
        onDiagnostics: (details) => {
          console.error("V2 prepare diagnostics", details);
        },
      });
      setFlow(result);
      if (result.job) await recover(result.job.id);
    } catch (error) {
      setFlow((current) => ({
        ...current,
        status: "error",
        statusLabel: null,
        error: error instanceof Error ? error.message : "V2 preparation failed.",
      }));
    } finally {
      prepareLock.current = false;
    }
  }

  async function act(action: "confirm" | "execute_fake" | "retry_composite") {
    if (!job) return;
    setActionBusy(true);
    try {
      const response = await callBrowserFetch(`/api/image/v2/jobs/${job.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, inputFingerprint: job.inputFingerprint }) });
      const payload = await response.json() as { job?: V2PreparedJob; recovery?: V2Recovery; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "V2 action failed.");
      if (payload.recovery) {
        setRecovery(payload.recovery);
        setFlow((current) => ({ ...current, job: payload.recovery!.job, status: "ready", statusLabel: "Ready for confirmation", error: null }));
      } else if (payload.job) {
        setFlow((current) => ({ ...current, job: payload.job!, error: null }));
        await recover(payload.job.id);
      }
    } catch (error) {
      setFlow((current) => ({ ...current, status: "error", statusLabel: null, error: error instanceof Error ? error.message : "V2 action failed." }));
    } finally {
      setActionBusy(false);
    }
  }

  async function review(decision: "APPROVED" | "REJECTED") {
    if (!recovery?.asset) return;
    setActionBusy(true);
    try {
      const values = Object.fromEntries(CHECKS.map((key) => [key, checklist[key] ? "PASS" : "NEEDS_REVIEW"]));
      const response = await callBrowserFetch(`/api/image/v2/assets/${recovery.asset.id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, checklist: values, note: null }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Review failed.");
      await recover(job!.id);
    } catch (error) {
      setFlow((current) => ({ ...current, status: "error", statusLabel: null, error: error instanceof Error ? error.message : "Review failed." }));
    } finally {
      setActionBusy(false);
    }
  }

  return <section className="is-inspector-card is-inspector-card--open" aria-label="Production deterministic composite v2">
    <div className="is-inspector-card-body">
      <h3 className="is-panel-heading">Production — Deterministic Composite V2</h3>
      <p><strong>Stage A:</strong> base image only. <strong>Stage B:</strong> original approved Artwork pixels are applied locally; they are not sent for generative redrawing.</p>
      <p>Define <strong>front_center</strong> as four normalized corners (0–1). No geometry is assumed. Enter TL → TR → BR → BL explicitly.</p>
      <div className="is-v2-calibration-grid">
        {CORNERS.map((corner) => (
          <div key={corner} className="is-v2-corner">
            <strong>{corner.toUpperCase()}</strong>
            {AXES.map((axis) => {
              const key = `${corner}${axis}` as CornerFieldKey;
              const numeric = points[key].trim() === "" ? null : Number(points[key]);
              const display = numeric !== null && Number.isFinite(numeric) ? numeric.toFixed(4).replace(/0+$/, "").replace(/\.$/, "") : "—";
              return (
                <label key={key} className="is-v2-corner-axis" htmlFor={`v2-print-${key}`}>
                  <span>{axis.toUpperCase()}</span>
                  <input
                    id={`v2-print-${key}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="1"
                    step="0.01"
                    value={points[key]}
                    aria-invalid={Boolean(fieldErrors[key])}
                    aria-describedby={fieldErrors[key] ? `v2-print-${key}-error` : `v2-print-${key}-value`}
                    onChange={(event) => setPoints((current) => ({ ...current, [key]: event.target.value }))}
                  />
                  <span id={`v2-print-${key}-value`} className="is-v2-corner-value">current {display}</span>
                  {fieldErrors[key] ? <span id={`v2-print-${key}-error`} className="is-v2-field-error">{fieldErrors[key]}</span> : null}
                </label>
              );
            })}
          </div>
        ))}
      </div>
      <svg viewBox="0 0 100 100" className="is-v2-surface-preview" role="img" aria-label="Normalized PrintSurface preview">
        <rect x="1" y="1" width="98" height="98" fill="#222" stroke="#777" />
        {quad ? <polygon points={quad.map((point) => `${point.x * 100},${point.y * 100}`).join(" ")} fill="rgba(255,190,0,.2)" stroke="#ffbe00" /> : null}
      </svg>
      {flow.statusLabel ? <p id="v2-prepare-status" className="is-v2-status" aria-live="polite">{flow.statusLabel}</p> : null}
      {!job && blockers.length > 0 ? (
        <div id="v2-prepare-blockers" className="is-v2-blockers" role="status">
          {blockers.map((blocker) => <p key={blocker.code}>{blocker.message}</p>)}
        </div>
      ) : null}
      {!job ? (
        <button
          type="button"
          className="is-btn is-btn--primary"
          disabled={busy || !canPrepare}
          aria-disabled={busy || !canPrepare}
          aria-describedby={!canPrepare && blockers.length > 0 ? "v2-prepare-blockers" : flow.statusLabel ? "v2-prepare-status" : undefined}
          onClick={() => void prepare()}
        >
          Freeze references + Prepare / Estimate V2
        </button>
      ) : null}
      {job ? <div>
        <p><strong>Mode:</strong> {job.inputSnapshot.productionMode}</p>
        <p><strong>Artwork:</strong> {job.inputSnapshot.masterArtwork.designId} · {job.inputSnapshot.masterArtwork.version}</p>
        <p><strong>Product:</strong> {job.inputSnapshot.product.productName} · {job.inputSnapshot.product.color ?? "variant"}</p>
        <p><strong>Brand Model:</strong> {job.inputSnapshot.brandModel.displayName} · Lock v{job.inputSnapshot.brandModel.identityLockVersion}</p>
        <p><strong>PrintSurface:</strong> {job.inputSnapshot.printSurface.region} · v{job.inputSnapshot.printSurface.version}</p>
        <p><strong>Shot:</strong> {job.inputSnapshot.shot.title}</p>
        <p><strong>Estimate maximum (Stage A only):</strong> {job.estimate.maximum.toFixed(4)} {job.estimate.currency}</p>
        <p><strong>State:</strong> {recovery?.state ?? job.status}</p>
        <div className="is-staging-actions">
          {job.status === "awaiting_confirmation" ? <button className="is-btn is-btn--primary" disabled={busy} onClick={() => void act("confirm")}>Confirm exact V2 input</button> : null}
          {job.status === "confirmed" && process.env.NODE_ENV !== "production" ? <button className="is-btn is-btn--primary" disabled={busy} onClick={() => void act("execute_fake")}>Run synthetic Stage A + deterministic Stage B</button> : null}
          {recovery?.state === "COMPOSITE_FAILED" ? <button className="is-btn is-btn--primary" disabled={busy} onClick={() => void act("retry_composite")}>Retry Composite only</button> : null}
        </div>
      </div> : null}
      {recovery?.stages.length ? <p>Lineage: {recovery.stages.map((stage) => `${stage.stage} #${stage.stageAttempt} ${stage.status}`).join(" → ")}</p> : null}
      {recovery?.asset ? <div>
        <h4>Human mockup review — {recovery.asset.reviewStatus}</h4>
        {recovery.asset.accessUrl ? <a href={recovery.asset.accessUrl} target="_blank" rel="noreferrer">Open temporary private composite preview</a> : <p>Preview missing/expired; reload for fresh private access.</p>}
        <div>{CHECKS.map((key) => <label key={key}><input type="checkbox" checked={checklist[key]} onChange={(event) => setChecklist((current) => ({ ...current, [key]: event.target.checked }))} /> {key}</label>)}</div>
        {recovery.asset.reviewStatus === "REVIEW_REQUIRED" ? <div className="is-staging-actions">
          <button className="is-btn is-btn--primary" disabled={busy || !Object.values(checklist).every(Boolean)} onClick={() => void review("APPROVED")}>Approve after all checks pass</button>
          <button className="is-btn" disabled={busy} onClick={() => void review("REJECTED")}>Reject</button>
        </div> : null}
      </div> : null}
      {flow.error ? (
        <div className="is-error-banner is-v2-error" role="alert">
          <p className="is-error-banner__summary">{flow.error}</p>
          <button type="button" className="is-btn" onClick={() => setFlow((current) => clearPrepareError(current))}>Dismiss</button>
        </div>
      ) : null}
    </div>
  </section>;
}
