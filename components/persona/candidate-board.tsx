"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  CandidateAssetType,
  PersonaCandidate,
  PersonaCandidateAssetView,
} from "@/lib/persona/domain/creation-types";
import { CandidateStatusBadge } from "@/components/persona/candidate-status-badge";
import { PersonaStatusChip } from "@/components/persona/persona-status-chip";
import { readNotesHistory } from "@/lib/persona/creation/candidate-intelligence/notes";

export function getCandidateVariationLabel(candidate: PersonaCandidate): string {
  const variation = candidate.generation_settings?.variation as
    | { label?: string }
    | undefined;
  return variation?.label || candidate.candidate_name;
}

export function getCandidateOverallScore(candidate: PersonaCandidate): number | null {
  const qa = candidate.generation_settings?.qualityAssessment as
    | { dimensions?: { overall?: number } }
    | undefined;
  if (typeof qa?.dimensions?.overall === "number") return qa.dimensions.overall;
  if (typeof candidate.brand_fit_score === "number") return candidate.brand_fit_score;
  return null;
}

export function getCandidateDiversityWarning(
  candidates: PersonaCandidate[],
): string | null {
  for (const c of candidates) {
    const d = c.generation_settings?.diversity as
      | { lowDiversity?: boolean; warning?: string | null }
      | undefined;
    if (d?.lowDiversity && d.warning) return d.warning;
  }
  return null;
}

export function CandidateComparePanel({
  candidate,
  peers,
}: {
  candidate: PersonaCandidate;
  peers: PersonaCandidate[];
}) {
  const diversity = candidate.generation_settings?.diversity as
    | {
        pairwise?: Array<{ a: number; b: number; score: number }>;
        warning?: string | null;
        lowDiversity?: boolean;
      }
    | undefined;

  const rows = peers
    .filter((p) => p.id !== candidate.id)
    .map((peer) => {
      const pair = diversity?.pairwise?.find(
        (row) =>
          (row.a === candidate.candidate_number && row.b === peer.candidate_number) ||
          (row.b === candidate.candidate_number && row.a === peer.candidate_number),
      );
      const score = pair?.score ?? null;
      const similarity = score == null ? null : Math.max(0, 100 - score);
      return {
        peer,
        score,
        similarity,
        label: getCandidateVariationLabel(peer),
      };
    });

  if (rows.length === 0) return null;

  return (
    <div className="ps-ci-compare">
      <h3>Compare Against Others</h3>
      {diversity?.lowDiversity ? (
        <div className="ps-callout ps-callout-warn">
          <p>
            <strong>Candidate diversity is low.</strong> Consider regenerating.
          </p>
        </div>
      ) : null}
      <div className="ps-ci-compare-list">
        {rows.map((row) => (
          <div key={row.peer.id} className="ps-ci-compare-row">
            <div className="ps-ci-compare-label">
              <span>
                #{row.peer.candidate_number} {row.label}
              </span>
              <strong>
                {row.similarity == null ? "—" : `${row.similarity}% similar`}
              </strong>
            </div>
            <div className="ps-score-track" aria-hidden>
              <span
                className="ps-score-fill"
                style={{ width: `${row.similarity ?? 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <dl className="ps-ci-diff-fingerprint">
        <div>
          <dt>Difference Fingerprint</dt>
          <dd>
            {(candidate.generation_settings?.variation as { id?: string } | undefined)?.id ??
              "—"}
          </dd>
        </div>
        <div>
          <dt>Lighting</dt>
          <dd>Studio soft key</dd>
        </div>
        <div>
          <dt>Pose</dt>
          <dd>Front · Three Quarter · Half Body</dd>
        </div>
        <div>
          <dt>Expression</dt>
          <dd>
            {(candidate.generation_settings?.variation as { style?: string } | undefined)
              ?.style ?? "—"}
          </dd>
        </div>
        <div>
          <dt>Styling</dt>
          <dd>
            {(candidate.generation_settings?.variation as { aesthetic?: string } | undefined)
              ?.aesthetic ?? "—"}
          </dd>
        </div>
        <div>
          <dt>Camera</dt>
          <dd>Identity-locked multi-angle set</dd>
        </div>
        <div>
          <dt>Color Temperature</dt>
          <dd>Neutral premium daylight</dd>
        </div>
      </dl>
    </div>
  );
}

function formatEur(n: number): string {
  return `${n.toFixed(2)} €`;
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function CandidateBoardCard({
  candidate,
  previewUrl,
  active,
  onSelect,
}: {
  candidate: PersonaCandidate;
  previewUrl: string | null;
  active: boolean;
  onSelect: () => void;
}) {
  const overall = getCandidateOverallScore(candidate);
  const styleLabel = getCandidateVariationLabel(candidate);
  const qualityMode =
    typeof candidate.generation_settings?.quality === "string"
      ? candidate.generation_settings.quality
      : null;

  return (
    <button
      type="button"
      className={`ps-ci-card${active ? " is-active" : ""}`}
      onClick={onSelect}
    >
      <div className="ps-ci-card-hero">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={candidate.candidate_name} />
        ) : (
          <div className="ps-ci-card-hero-empty">No preview</div>
        )}
        <div className="ps-ci-card-hero-meta">
          <CandidateStatusBadge candidate={candidate} />
          {overall != null ? (
            <span className="ps-ci-score-pill">{overall}</span>
          ) : null}
        </div>
      </div>
      <div className="ps-ci-card-body">
        <strong>
          #{candidate.candidate_number} {styleLabel}
        </strong>
        <div className="ps-ci-card-chips">
          <PersonaStatusChip
            label={candidate.provider || "provider"}
            tone="commercial"
          />
          {qualityMode ? (
            <PersonaStatusChip label={String(qualityMode)} tone="premium" />
          ) : null}
          <PersonaStatusChip label={styleLabel} tone="luxury" />
        </div>
        <dl className="ps-ci-card-stats">
          <div>
            <dt>Cost</dt>
            <dd>{formatEur(candidate.actual_generation_cost ?? 0)}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatWhen(candidate.created_at)}</dd>
          </div>
          <div>
            <dt>Fit</dt>
            <dd>{candidate.brand_fit_score ?? "—"}</dd>
          </div>
          <div>
            <dt>Identity</dt>
            <dd>{candidate.identity_consistency_score ?? "—"}</dd>
          </div>
        </dl>
      </div>
    </button>
  );
}

const GALLERY_ORDER: CandidateAssetType[] = [
  "portrait_front",
  "portrait_three_quarter",
  "half_body",
];

function assetLabel(type: CandidateAssetType): string {
  switch (type) {
    case "portrait_front":
      return "Front";
    case "portrait_three_quarter":
      return "Three Quarter";
    case "half_body":
      return "Half Body";
    default:
      return type.replace(/_/g, " ");
  }
}

export function CandidateLightbox({
  assets,
  startIndex,
  onClose,
}: {
  assets: PersonaCandidateAssetView[];
  startIndex: number;
  onClose: () => void;
}) {
  const viewable = assets.filter((a) => a.signed_url);
  const [index, setIndex] = useState(
    Math.max(0, Math.min(startIndex, Math.max(0, viewable.length - 1))),
  );
  const [zoomed, setZoomed] = useState(false);
  const current = viewable[index] ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") {
        setIndex((i) => (viewable.length ? (i + 1) % viewable.length : 0));
      }
      if (e.key === "ArrowLeft") {
        setIndex((i) =>
          viewable.length ? (i - 1 + viewable.length) % viewable.length : 0,
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, viewable.length]);

  if (!current?.signed_url) return null;

  return (
    <div className="ps-ci-lightbox" role="dialog" aria-modal="true">
      <button type="button" className="ps-ci-lightbox-backdrop" onClick={onClose} />
      <div className="ps-ci-lightbox-panel">
        <header className="ps-ci-lightbox-header">
          <span>{assetLabel(current.asset_type)}</span>
          <div className="ps-ci-lightbox-actions">
            <button type="button" onClick={() => setZoomed((z) => !z)}>
              {zoomed ? "Fit" : "Zoom"}
            </button>
            <a href={current.signed_url} download target="_blank" rel="noreferrer">
              Download
            </a>
            <button type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </header>
        <div className={`ps-ci-lightbox-stage${zoomed ? " is-zoomed" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.signed_url} alt={current.asset_type} />
        </div>
        <p className="ps-muted">
          ← → to switch · Esc to close · {index + 1}/{viewable.length}
        </p>
      </div>
    </div>
  );
}

export function CandidateQualityPanel({ candidate }: { candidate: PersonaCandidate }) {
  const qa = candidate.generation_settings?.qualityAssessment as
    | {
        dimensions?: Record<string, number>;
        strengths?: string[];
        risks?: string[];
      }
    | undefined;
  if (!qa?.dimensions) return null;
  const dims = qa.dimensions;
  return (
    <div className="ps-ci-quality">
      <h3>AI Quality Score</h3>
      <div className="ps-ci-quality-grid">
        {[
          ["Overall", dims.overall],
          ["Authenticity", dims.authenticity],
          ["Relatability", dims.relatability],
          ["Lifestyle Fit", dims.lifestyleFit],
          ["Streetwear Match", dims.streetwearMatch],
          ["Community", dims.communityAppeal],
          ["Social Presence", dims.socialMediaPresence],
          ["Brand Match", dims.brandMatch],
          ["Commercial", dims.commercialQuality],
          ["Face Consistency", dims.faceConsistency],
          ["Lighting", dims.lighting],
          ["Pose", dims.poseQuality],
          ["Editorial", dims.editorialQuality],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <span>{label}</span>
            <strong>{value ?? "—"}</strong>
          </div>
        ))}
      </div>
      {qa.strengths?.length ? (
        <p className="ps-muted">Strengths: {qa.strengths.join(" · ")}</p>
      ) : null}
      {qa.risks?.length ? (
        <p className="ps-callout ps-callout-warn">{qa.risks.join(" · ")}</p>
      ) : null}
    </div>
  );
}

export function CandidateNotesPanel({
  candidate,
  notes,
  onNotesChange,
  onSave,
}: {
  candidate: PersonaCandidate;
  notes: string;
  onNotesChange: (value: string) => void;
  onSave: () => void;
}) {
  const history = useMemo(
    () => readNotesHistory(candidate.generation_settings),
    [candidate.generation_settings],
  );

  return (
    <div className="ps-ci-notes">
      <label>
        Notes
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
          placeholder="Creative direction, casting notes…"
        />
      </label>
      <button type="button" onClick={onSave}>
        Save note
      </button>
      {history.length > 0 ? (
        <details className="ps-tech">
          <summary>Note history ({history.length})</summary>
          <ul className="ps-ci-note-history">
            {[...history].reverse().map((rev) => (
              <li key={rev.version}>
                <strong>v{rev.version}</strong> · {formatWhen(rev.timestamp)} · {rev.author}
                <p>{rev.note || "(empty)"}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

export function CandidateDetailGallery({
  assets,
  onOpen,
}: {
  assets: PersonaCandidateAssetView[];
  onOpen: (index: number) => void;
}) {
  const ordered = useMemo(() => {
    const byType = new Map(assets.map((a) => [a.asset_type, a]));
    const primary = GALLERY_ORDER.map((t) => byType.get(t)).filter(
      (a): a is PersonaCandidateAssetView => Boolean(a),
    );
    const rest = assets.filter((a) => !GALLERY_ORDER.includes(a.asset_type));
    return [...primary, ...rest];
  }, [assets]);

  const hero = ordered.find((a) => a.asset_type === "portrait_front") ?? ordered[0] ?? null;
  const angleStrip = GALLERY_ORDER.map((t) =>
    ordered.find((a) => a.asset_type === t),
  ).filter((a): a is PersonaCandidateAssetView => Boolean(a));

  return (
    <div className="ps-ci-detail-gallery">
      {hero?.signed_url ? (
        <button
          type="button"
          className="ps-ci-hero"
          onClick={() => onOpen(ordered.findIndex((a) => a.id === hero.id))}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero.signed_url} alt={hero.asset_type} />
        </button>
      ) : (
        <div className="ps-ci-hero ps-ci-hero-empty">No hero portrait</div>
      )}
      <div className="ps-ci-angle-strip">
        {angleStrip.map((a) => {
          const idx = ordered.findIndex((x) => x.id === a.id);
          return (
            <button
              key={a.id}
              type="button"
              className="ps-ci-angle"
              onClick={() => onOpen(idx)}
            >
              {a.signed_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.signed_url} alt={a.asset_type} />
              ) : (
                <span className="ps-muted">—</span>
              )}
              <span>{assetLabel(a.asset_type)}</span>
            </button>
          );
        })}
      </div>
      {ordered.some((a) => !GALLERY_ORDER.includes(a.asset_type)) ? (
        <div className="ps-ref-grid">
          {ordered
            .filter((a) => !GALLERY_ORDER.includes(a.asset_type))
            .map((a) => (
              <figure key={a.id} className="ps-ref-thumb">
                {a.signed_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.signed_url} alt={a.asset_type} />
                ) : (
                  <div className="ps-muted">Unavailable</div>
                )}
                <figcaption>{assetLabel(a.asset_type)}</figcaption>
              </figure>
            ))}
        </div>
      ) : null}
    </div>
  );
}
