"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { BrandModelTrace } from "@/lib/persona/domain/brand-model-contract";
import type { MasterArtworkReference } from "@/lib/design/master-artwork-authority/types";

type PointKey = "tlx" | "tly" | "trx" | "try" | "brx" | "bry" | "blx" | "bly";
type V2Job = {
  id: string;
  inputFingerprint: string;
  status: string;
  estimate: { maximum: number; currency: string; basis: string };
  confirmationExpiresAt: string;
  inputSnapshot: {
    productionMode: string;
    brandModel: { displayName: string; identityLockVersion: number };
    masterArtwork: { designId: string; version: string };
    product: { productName: string; color: string | null; variantId: string | null };
    printSurface: { printSurfaceId: string; version: number; region: string };
    shot: { title: string };
    baseGeneration: { provider: string; model: string };
    compositing: { compositorVersion: string };
  };
};
type V2Recovery = {
  state: string;
  job: V2Job;
  stages: Array<{ stage?: string; stageAttempt?: number; status?: string; checksumSha256?: string | null }>;
  asset: null | { id: string; reviewStatus: string; accessUrl?: string | null; mockupReview: Record<string, unknown> };
};

const EMPTY: Record<PointKey, string> = { tlx: "", tly: "", trx: "", try: "", brx: "", bry: "", blx: "", bly: "" };
const CHECKS = ["identity", "productFidelity", "artworkFidelityExact", "placement", "perspective", "lightingIntegration"] as const;

export function DeterministicV2Panel(props: {
  reportRecordId: string | null;
  reportId: string | null;
  assetId: string | null;
  brandModelTrace: BrandModelTrace | null;
  masterArtwork: MasterArtworkReference | null;
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
}) {
  const [points, setPoints] = useState(EMPTY);
  const [job, setJob] = useState<V2Job | null>(null);
  const [recovery, setRecovery] = useState<V2Recovery | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Record<(typeof CHECKS)[number], boolean>>({ identity: false, productFidelity: false, artworkFidelityExact: false, placement: false, perspective: false, lightingIntegration: false });
  const complete = Object.values(points).every((value) => value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1);
  const quad = useMemo(() => complete ? [
    { x: Number(points.tlx), y: Number(points.tly) }, { x: Number(points.trx), y: Number(points.try) },
    { x: Number(points.brx), y: Number(points.bry) }, { x: Number(points.blx), y: Number(points.bly) },
  ] : null, [complete, points]);

  const recover = useCallback(async (jobId: string) => {
    const response = await fetch(`/api/image/v2/jobs/${jobId}`, { cache: "no-store" });
    const payload = await response.json() as { recovery?: V2Recovery; error?: string };
    if (!response.ok || !payload.recovery) throw new Error(payload.error ?? "V2 recovery failed.");
    setJob(payload.recovery.job); setRecovery(payload.recovery);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/image/v2/jobs", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then(async (payload: { jobs?: V2Job[] } | null) => {
      const latest = payload?.jobs?.find((candidate) => ["awaiting_confirmation", "confirmed", "running", "failed", "succeeded", "unknown_outcome"].includes(candidate.status));
      if (!cancelled && latest) await recover(latest.id);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [recover]);

  async function prepare() {
    if (!quad || !props.reportRecordId || !props.reportId || !props.assetId || !props.brandModelTrace || !props.masterArtwork || !props.shopifyProductId || !props.shopifyVariantId) {
      setMessage("Select exact Artwork, Shopify Product/variant, Brand Model, one shot, and enter all four normalized corners."); return;
    }
    setBusy(true); setMessage(null);
    try {
      const surfaceId = `front-center:${props.shopifyVariantId}`;
      const calibrationResponse = await fetch("/api/image/v2/product-profiles/calibrate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ authority: "SHOPIFY_LIVE", productId: props.shopifyProductId, variantId: props.shopifyVariantId, surface: { printSurfaceId: surfaceId, region: "front_center", quad, calibrationAttestation: true } }) });
      const calibration = await calibrationResponse.json() as { profile?: { productProfileId: string; version: number }; printSurface?: { printSurfaceId: string; version: number }; error?: string };
      if (!calibrationResponse.ok || !calibration.profile || !calibration.printSurface) throw new Error(calibration.error ?? "Product reference freeze / PrintSurface calibration failed.");
      const prepareResponse = await fetch("/api/image/v2/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportRecordId: props.reportRecordId, reportId: props.reportId, assetId: props.assetId, brandModelTrace: props.brandModelTrace, masterArtwork: { reference: props.masterArtwork }, productProfile: { profileKey: calibration.profile.productProfileId, version: calibration.profile.version, variantId: props.shopifyVariantId }, printSurface: calibration.printSurface }) });
      const prepared = await prepareResponse.json() as { job?: V2Job; error?: string };
      if (!prepareResponse.ok || !prepared.job) throw new Error(prepared.error ?? "V2 Prepare / Estimate failed.");
      setJob(prepared.job); await recover(prepared.job.id);
    } catch (error) { setMessage(error instanceof Error ? error.message : "V2 preparation failed."); }
    finally { setBusy(false); }
  }

  async function act(action: "confirm" | "execute_fake" | "retry_composite") {
    if (!job) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/image/v2/jobs/${job.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, inputFingerprint: job.inputFingerprint }) });
      const payload = await response.json() as { job?: V2Job; recovery?: V2Recovery; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "V2 action failed.");
      if (payload.recovery) { setRecovery(payload.recovery); setJob(payload.recovery.job); }
      else if (payload.job) { setJob(payload.job); await recover(payload.job.id); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "V2 action failed."); }
    finally { setBusy(false); }
  }

  async function review(decision: "APPROVED" | "REJECTED") {
    if (!recovery?.asset) return;
    setBusy(true); setMessage(null);
    try {
      const values = Object.fromEntries(CHECKS.map((key) => [key, checklist[key] ? "PASS" : "NEEDS_REVIEW"]));
      const response = await fetch(`/api/image/v2/assets/${recovery.asset.id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, checklist: values, note: null }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Review failed.");
      await recover(job!.id);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Review failed."); }
    finally { setBusy(false); }
  }

  return <section className="is-inspector-card is-inspector-card--open" aria-label="Production deterministic composite v2">
    <div className="is-inspector-card-body">
      <h3 className="is-panel-heading">Production — Deterministic Composite V2</h3>
      <p><strong>Stage A:</strong> base image only. <strong>Stage B:</strong> original approved Artwork pixels are applied locally; they are not sent for generative redrawing.</p>
      <p>Define <strong>front_center</strong> as four normalized corners (0–1). No geometry is assumed.</p>
      <div className="is-v2-calibration-grid">
        {(["tl", "tr", "br", "bl"] as const).map((corner) => <div key={corner}><strong>{corner.toUpperCase()}</strong>{(["x", "y"] as const).map((axis) => { const key = `${corner}${axis}` as PointKey; return <label key={key}>{axis.toUpperCase()}<input type="number" min="0" max="1" step="0.01" value={points[key]} onChange={(event) => setPoints((current) => ({ ...current, [key]: event.target.value }))} /></label>; })}</div>)}
      </div>
      <svg viewBox="0 0 100 100" className="is-v2-surface-preview" role="img" aria-label="Normalized PrintSurface preview"><rect x="1" y="1" width="98" height="98" fill="#222" stroke="#777" />{quad ? <polygon points={quad.map((point) => `${point.x * 100},${point.y * 100}`).join(" ")} fill="rgba(255,190,0,.2)" stroke="#ffbe00" /> : null}</svg>
      {!job ? <button type="button" className="is-btn is-btn--primary" disabled={busy || !complete} onClick={() => void prepare()}>Freeze references + Prepare / Estimate V2</button> : null}
      {job ? <div><p><strong>Mode:</strong> {job.inputSnapshot.productionMode}</p><p><strong>Artwork:</strong> {job.inputSnapshot.masterArtwork.designId} · {job.inputSnapshot.masterArtwork.version}</p><p><strong>Product:</strong> {job.inputSnapshot.product.productName} · {job.inputSnapshot.product.color ?? "variant"}</p><p><strong>Brand Model:</strong> {job.inputSnapshot.brandModel.displayName} · Lock v{job.inputSnapshot.brandModel.identityLockVersion}</p><p><strong>PrintSurface:</strong> {job.inputSnapshot.printSurface.region} · v{job.inputSnapshot.printSurface.version}</p><p><strong>Shot:</strong> {job.inputSnapshot.shot.title}</p><p><strong>Estimate maximum (Stage A only):</strong> {job.estimate.maximum.toFixed(4)} {job.estimate.currency}</p><p><strong>State:</strong> {recovery?.state ?? job.status}</p><div className="is-staging-actions">{job.status === "awaiting_confirmation" ? <button className="is-btn is-btn--primary" disabled={busy} onClick={() => void act("confirm")}>Confirm exact V2 input</button> : null}{job.status === "confirmed" && process.env.NODE_ENV !== "production" ? <button className="is-btn is-btn--primary" disabled={busy} onClick={() => void act("execute_fake")}>Run synthetic Stage A + deterministic Stage B</button> : null}{recovery?.state === "COMPOSITE_FAILED" ? <button className="is-btn is-btn--primary" disabled={busy} onClick={() => void act("retry_composite")}>Retry Composite only</button> : null}</div></div> : null}
      {recovery?.stages.length ? <p>Lineage: {recovery.stages.map((stage) => `${stage.stage} #${stage.stageAttempt} ${stage.status}`).join(" → ")}</p> : null}
      {recovery?.asset ? <div><h4>Human mockup review — {recovery.asset.reviewStatus}</h4>{recovery.asset.accessUrl ? <a href={recovery.asset.accessUrl} target="_blank" rel="noreferrer">Open temporary private composite preview</a> : <p>Preview missing/expired; reload for fresh private access.</p>}<div>{CHECKS.map((key) => <label key={key}><input type="checkbox" checked={checklist[key]} onChange={(event) => setChecklist((current) => ({ ...current, [key]: event.target.checked }))} /> {key}</label>)}</div>{recovery.asset.reviewStatus === "REVIEW_REQUIRED" ? <div className="is-staging-actions"><button className="is-btn is-btn--primary" disabled={busy || !Object.values(checklist).every(Boolean)} onClick={() => void review("APPROVED")}>Approve after all checks pass</button><button className="is-btn" disabled={busy} onClick={() => void review("REJECTED")}>Reject</button></div> : null}</div> : null}
      {message ? <p className="is-error-banner__summary">{message}</p> : null}
    </div>
  </section>;
}
