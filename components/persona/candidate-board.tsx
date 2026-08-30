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
import {
  readCandidateCastingScores,
  readCandidateOverallScore,
  selectTopCandidatesForDisplay,
  ACTIVE_CASTING_POOL,
} from "@/lib/persona/creation/candidate-intelligence";
import { discoveryIntendedUseLabel } from "@/components/persona/persona-studio-project-sync";

export function getCandidateVariationLabel(candidate: PersonaCandidate): string {
  const variation = candidate.generation_settings?.variation as
    | { label?: string }
    | undefined;
  return variation?.label || candidate.candidate_name;
}

export function getCandidateOverallScore(candidate: PersonaCandidate): number | null {
  return readCandidateOverallScore(
    candidate.generation_settings,
    candidate.brand_fit_score,
  );
}

export function getCandidateCastingScores(candidate: PersonaCandidate) {
  return readCandidateCastingScores(candidate.generation_settings);
}

/**
 * Rank board candidates by brief-fit score (best first).
 * Recommended Brand Face is NEVER set from rule-based brief fit alone —
 * only when a completed visual evaluation exists.
 */
export function rankCandidatesForBoard(
  candidates: PersonaCandidate[],
): Array<{
  candidate: PersonaCandidate;
  rank: number;
  isRecommendedBrandFace: boolean;
  overallScore: number;
}> {
  const rankable = candidates.map((candidate) => {
    const scores = readCandidateCastingScores(candidate.generation_settings);
    return {
      id: candidate.id,
      candidate_number: candidate.candidate_number,
      overallScore: scores.briefFit ?? scores.overall ?? candidate.brand_fit_score ?? 0,
      commercialFace: scores.commercialFace ?? undefined,
      streetwearMatch: scores.streetwearMatch ?? undefined,
      authenticity: scores.authenticity ?? undefined,
      visualStatus: scores.visualStatus,
      candidate,
    };
  });

  const ranked = selectTopCandidatesForDisplay(rankable, ACTIVE_CASTING_POOL);
  const anyVisual = ranked.some(
    (row) => row.source.visualStatus === "completed",
  );

  const mapped = ranked.map((row) => ({
    candidate: row.source.candidate,
    rank: row.rank,
    // Do not fabricate Recommended Brand Face from metadata-only scores.
    isRecommendedBrandFace: anyVisual
      ? row.isRecommendedBrandFace && row.source.visualStatus === "completed"
      : false,
    overallScore: row.overallScore,
  }));

  // Phase 2.3B — selected Brand Face stays pinned at the front of the board.
  return mapped.sort((a, b) => {
    const aSelected =
      a.candidate.status === "selected" && !a.candidate.converted_persona_id
        ? 1
        : 0;
    const bSelected =
      b.candidate.status === "selected" && !b.candidate.converted_persona_id
        ? 1
        : 0;
    if (aSelected !== bSelected) return bSelected - aSelected;
    return a.rank - b.rank;
  });
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
      <h3>Mit anderen Kandidaten vergleichen</h3>
      {diversity?.lowDiversity ? (
        <div className="ps-callout ps-callout-warn">
          <p>
            <strong>Die Kandidaten ähneln sich zu stark.</strong> Erwäge eine neue Entdeckung.
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
                {row.similarity == null ? "—" : `${row.similarity}% ähnlich`}
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
          <dt>Unterscheidungsmerkmal</dt>
          <dd>
            {(candidate.generation_settings?.variation as { id?: string } | undefined)?.id ??
              "—"}
          </dd>
        </div>
        <div>
          <dt>Licht</dt>
          <dd>Weiches Studiolicht</dd>
        </div>
        <div>
          <dt>Pose</dt>
          <dd>Frontal · Dreiviertel · Halbkörper</dd>
        </div>
        <div>
          <dt>Ausdruck</dt>
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
          <dt>Kamera</dt>
          <dd>Identitätsgesichertes Set aus mehreren Winkeln</dd>
        </div>
        <div>
          <dt>Farbtemperatur</dt>
          <dd>Neutrales Premium-Tageslicht</dd>
        </div>
      </dl>
    </div>
  );
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
  isRecommendedBrandFace = false,
  primaryLabel,
  secondaryLabel,
}: {
  candidate: PersonaCandidate;
  previewUrl: string | null;
  active: boolean;
  onSelect: () => void;
  isRecommendedBrandFace?: boolean;
  /** Integrity validation: Candidate A/B/C/D — never use variation as identity. */
  primaryLabel?: string;
  secondaryLabel?: string;
}) {
  const overall = getCandidateOverallScore(candidate);
  const casting = getCandidateCastingScores(candidate);
  const styleLabel = secondaryLabel ?? getCandidateVariationLabel(candidate);
  const titleLabel =
    primaryLabel ?? `#${candidate.candidate_number} ${styleLabel}`;
  const qualityMode =
    typeof candidate.generation_settings?.quality === "string"
      ? candidate.generation_settings.quality
      : null;
  const recommendedUse = casting.primaryUse ?? casting.bestFor[0] ?? null;
  const intendedUse = discoveryIntendedUseLabel(candidate);
  const costLabel =
    typeof candidate.generation_settings?.costLabel === "string"
      ? candidate.generation_settings.costLabel
      : "allocated_estimate";
  const visualLabel =
    casting.visualStatus === "completed"
      ? "Visual evaluated"
      : casting.visualStatus === "manual_review_required"
        ? "Manual review required"
        : "not_performed";
  const discoveryNovelty = candidate.generation_settings?.discoveryNovelty as
    | {
        classification?: string;
        distance?: number | null;
        threshold?: number;
        closestPriorCandidateId?: string | null;
      }
    | undefined;
  const showSimilarityWarning =
    discoveryNovelty?.classification === "WARNING" ||
    (typeof candidate.generation_settings?.faceNoveltyLiveDebug === "object" &&
      (candidate.generation_settings.faceNoveltyLiveDebug as { discoveryClassification?: string })
        ?.discoveryClassification === "WARNING");
  const faceFreshness = candidate.generation_settings?.faceFreshness as
    | {
        score?: number;
        classification?: string;
        label?: string;
        closestRecentCandidateId?: string | null;
        closestDistance?: number | null;
        projectsCompared?: string[];
      }
    | undefined;
  const showFaceFreshnessDebug =
    process.env.NODE_ENV === "development" &&
    typeof faceFreshness?.score === "number";
  const faceFreshnessClass =
    typeof faceFreshness?.classification === "string"
      ? faceFreshness.classification.toUpperCase()
      : "";
  const faceFreshnessPretty =
    faceFreshnessClass === "VERY_FRESH"
      ? "Very Fresh"
      : faceFreshnessClass === "VERY_FAMILIAR"
        ? "Very Familiar"
        : faceFreshnessClass === "FRESH"
          ? "Fresh"
          : faceFreshnessClass === "FAMILIAR"
            ? "Familiar"
            : faceFreshnessClass || "—";
  const faceFreshnessTitle = [
    faceFreshness?.label,
    faceFreshness?.closestRecentCandidateId
      ? `closest: ${faceFreshness.closestRecentCandidateId}`
      : null,
    faceFreshness?.closestDistance != null
      ? `distance: ${Number(faceFreshness.closestDistance).toFixed(3)}`
      : null,
    faceFreshness?.projectsCompared?.length
      ? `projects compared: ${faceFreshness.projectsCompared.length}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      className={`ps-ci-card${active ? " is-active" : ""}${isRecommendedBrandFace ? " is-recommended" : ""}${candidate.status === "selected" && !candidate.converted_persona_id ? " is-selected-brand-face" : ""}`}
      onClick={onSelect}
    >
      <div className="ps-ci-card-hero">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={titleLabel} />
        ) : (
          <div className="ps-ci-card-hero-empty">Keine Vorschau</div>
        )}
        {candidate.status === "selected" && !candidate.converted_persona_id ? (
          <span className="ps-ci-selected-badge">AUSGEWÄHLTES MARKENMODEL</span>
        ) : isRecommendedBrandFace ? (
          <span className="ps-ci-recommended-badge">★ Empfohlenes Markenmodel</span>
        ) : null}
        <div className="ps-ci-card-hero-meta">
          <CandidateStatusBadge candidate={candidate} />
          {showSimilarityWarning ? (
            <span
              className="ps-ci-score-pill"
              title="Ähnlichkeit mit einem anderen Gesicht – weiterhin auswählbar"
            >
              Ähnlichkeit prüfen
            </span>
          ) : null}
          {overall != null ? (
            <span className="ps-ci-score-pill" title="Brief Fit (metadata — not visual)">
              Brief {overall}
            </span>
          ) : null}
        </div>
      </div>
      <div className="ps-ci-card-body">
        <strong>{titleLabel}</strong>
        {primaryLabel ? (
          <p className="ps-muted" style={{ margin: "0.25rem 0 0" }}>
            {styleLabel}
          </p>
        ) : null}
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
            <dt>Briefing-Passung</dt>
            <dd>{casting.briefFit ?? overall ?? "—"}</dd>
          </div>
          <div>
            <dt>Technisch</dt>
            <dd>{casting.technicalCompleteness ?? "—"}</dd>
          </div>
          {showFaceFreshnessDebug ? (
            <div
              className={`ps-ci-freshness-stat ps-ci-freshness-${faceFreshnessClass.toLowerCase().replace(/_/g, "-")}`}
              data-face-freshness="metadata"
              title={faceFreshnessTitle}
            >
              <dt>Face Freshness</dt>
              <dd>
                {faceFreshness!.score}
                <span className="ps-ci-freshness-sep">/</span>
                100
                <span className="ps-ci-freshness-class"> · {faceFreshnessPretty}</span>
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Visuelle Prüfung</dt>
            <dd>{visualLabel}</dd>
          </div>
          <div>
            <dt>Geplante Nutzung</dt>
            <dd>{intendedUse ?? recommendedUse ?? "—"}</dd>
          </div>
          <div>
            <dt>Kosten</dt>
            <dd>
              {candidate.actual_generation_cost != null
                ? `${candidate.actual_generation_cost.toFixed(2)} €`
                : "—"}
            </dd>
          </div>
          <div>
            <dt>Kostenstatus</dt>
            <dd>
              {costLabel === "allocated_estimate"
                ? "Zugeordnete Schätzung"
                : costLabel === "estimated"
                  ? "Geschätzt"
                  : String(costLabel)}
            </dd>
          </div>
        </dl>
      </div>
    </button>
  );
}

export function NoveltyFailureSlotCard({
  slot,
  onGenerateNewFace,
  onRetryEvaluation,
  replacementUi,
  onRetryFailedReplacement,
}: {
  slot: import("@/lib/persona/face-novelty-memory/board-visibility").NoveltyFailureSlotDto;
  /** Phase 2.1E — paid novelty replacement (face_similarity_duplicate). */
  onGenerateNewFace?: () => void | Promise<void>;
  /** Dev-only: re-evaluate the same stored asset without OpenAI. */
  onRetryEvaluation?: () => void | Promise<void>;
  replacementUi?: {
    phase: "idle" | "confirming" | "generating" | "polling" | "failed";
    attemptNumber: number;
    maxAttempts: number;
    elapsedDisplay: string;
    stageLabel?: string;
    safeError?: string | null;
    providerMayHaveCompleted?: boolean;
  } | null;
  onRetryFailedReplacement?: () => void | Promise<void>;
}) {
  const isBlocked = slot.status === "novelty_blocked";
  const slotLabel = ["A", "B", "C", "D"][slot.slot - 1] ?? String(slot.slot);
  const exhausted = Boolean(slot.slotExhausted);
  const isFailedReplacement = replacementUi?.phase === "failed";
  const isGenerating =
    replacementUi != null &&
    !isFailedReplacement &&
    (replacementUi.phase === "generating" ||
      replacementUi.phase === "polling" ||
      replacementUi.phase === "confirming");
  const showGenerateNewFace =
    isBlocked &&
    Boolean(slot.requiresReplacementConfirmation) &&
    Boolean(onGenerateNewFace) &&
    !isGenerating &&
    !isFailedReplacement &&
    !exhausted;
  const showRetryEval = !isBlocked && Boolean(onRetryEvaluation) && !isGenerating;

  if (isFailedReplacement && replacementUi) {
    return (
      <div
        className="ps-ci-card"
        data-novelty-slot="replacement-failed"
        data-replacement-phase="failed"
      >
        <div className="ps-ci-card-hero">
          <div className="ps-ci-card-hero-empty">Ersetzung fehlgeschlagen</div>
        </div>
        <div className="ps-ci-card-body">
          <strong>Kandidat {slotLabel}</strong>
          <p style={{ marginTop: "0.5rem" }}>
            {replacementUi.safeError ??
              "Die Ersetzung ist nach der Provider-Generierung fehlgeschlagen. Das Ergebnis konnte nicht gespeichert werden. Es wird keine weitere Generierung automatisch gestartet."}
          </p>
          {onRetryFailedReplacement ? (
            <button
              type="button"
              className="ps-btn ps-btn-primary"
              style={{ marginTop: "0.75rem" }}
              onClick={() => void onRetryFailedReplacement()}
            >
              Kandidat {slotLabel} erneut versuchen
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (isGenerating && replacementUi) {
    return (
      <div
        className="ps-ci-card"
        data-novelty-slot="generating"
        data-replacement-phase={replacementUi.phase}
      >
        <div className="ps-ci-card-hero">
          <div className="ps-ci-card-hero-empty">Neues Gesicht wird erstellt</div>
        </div>
        <div className="ps-ci-card-body">
          <strong>Kandidat {slotLabel}</strong>
          <p style={{ marginTop: "0.5rem" }}>
            Versuch {replacementUi.attemptNumber} von {replacementUi.maxAttempts}
          </p>
          <div
            role="progressbar"
            aria-valuetext={replacementUi.stageLabel ?? "Wird erstellt"}
            style={{
              marginTop: "0.75rem",
              height: 6,
              borderRadius: 999,
              background: "rgba(0,0,0,0.08)",
              overflow: "hidden",
            }}
          >
            <div
              className="ps-novelty-indeterminate"
              style={{
                width: "40%",
                height: "100%",
                borderRadius: 999,
                background: "currentColor",
                animation: "ps-novelty-indeterminate 1.2s ease-in-out infinite",
              }}
            />
          </div>
          <p className="ps-muted" style={{ fontSize: "12px", marginTop: "0.75rem" }}>
            {replacementUi.stageLabel ??
              "Bild wird erstellt und Gesichtsähnlichkeit geprüft…"}
          </p>
          <p className="ps-muted" style={{ fontSize: "12px" }}>
            Vergangen {replacementUi.elapsedDisplay}
          </p>
          {replacementUi.safeError ? (
            <p style={{ marginTop: "0.75rem", color: "var(--ps-danger, #b42318)" }}>
              {replacementUi.safeError}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="ps-ci-card" data-novelty-slot={slot.status}>
      <div className="ps-ci-card-hero">
        <div className="ps-ci-card-hero-empty">
          {exhausted
            ? "Versuche ausgeschöpft"
            : isBlocked
              ? "Blockierter Platz"
              : "Fehlgeschlagener Platz"}
        </div>
      </div>
      <div className="ps-ci-card-body">
        <strong>Kandidat {slotLabel}</strong>
        <p className="ps-muted" style={{ marginTop: "0.5rem" }}>
          {exhausted
            ? "Nach vier Versuchen ausgeschöpft. Starte eine neue Entdeckung."
            : isBlocked
              ? slot.reason?.includes("similar") ||
                slot.reason === "face_similarity_duplicate"
                ? "Das neue Gesicht war weiterhin zu ähnlich."
                : "Kandidat durch den Schutz vor Gesichtsduplikaten blockiert."
              : "Die Prüfung auf Gesichtsduplikate ist fehlgeschlagen. Es wurde kein Kandidat angezeigt."}
        </p>
        <p className="ps-muted" style={{ fontSize: "12px" }}>
          {slot.reason}
        </p>
        {typeof slot.attemptNumber === "number" ? (
          <p className="ps-muted" style={{ fontSize: "12px" }}>
            Versuch {slot.attemptNumber} von {slot.maxAttempts ?? 4}
            {slot.nextAttemptNumber != null
              ? ` · nächster ${slot.nextAttemptNumber}`
              : ""}
          </p>
        ) : null}
        {showGenerateNewFace ? (
          <button
            type="button"
            className="ps-btn"
            style={{ marginTop: "0.75rem" }}
            onClick={() => void onGenerateNewFace?.()}
          >
                    Neues Gesicht erstellen
          </button>
        ) : null}
        {showRetryEval ? (
          <button
            type="button"
            className="ps-btn"
            style={{ marginTop: "0.75rem" }}
            onClick={() => void onRetryEvaluation?.()}
          >
                    Gesichtsprüfung wiederholen
          </button>
        ) : null}
      </div>
    </div>
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
              return "Dreiviertel";
    case "half_body":
              return "Halbkörper";
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
                      {zoomed ? "Einpassen" : "Vergrößern"}
            </button>
            <a href={current.signed_url} download target="_blank" rel="noreferrer">
                      Herunterladen
            </a>
            <button type="button" onClick={onClose}>
                      Schließen
            </button>
          </div>
        </header>
        <div className={`ps-ci-lightbox-stage${zoomed ? " is-zoomed" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.signed_url} alt={current.asset_type} />
        </div>
        <p className="ps-muted">
                  ← → wechseln · Esc schließen · {index + 1}/{viewable.length}
        </p>
      </div>
    </div>
  );
}

export function CandidateQualityPanel({ candidate }: { candidate: PersonaCandidate }) {
  const casting = getCandidateCastingScores(candidate);
  const qa = candidate.generation_settings?.qualityAssessment as
    | {
        method?: string;
        briefFit?: number;
        technicalCompleteness?: number;
        dimensions?: Record<string, number>;
        strengths?: string[];
        risks?: string[];
        scoreHonesty?: {
          briefFitLabel?: string;
          technicalLabel?: string;
          visualLabel?: string;
        };
        casting?: {
          bestFor?: string[];
          primaryUse?: string;
          marketFitLabel?: string;
          campaignReadinessLabel?: string;
        };
        reviews?: {
          castingAnalysis?: string;
          commercialPotential?: string;
          brandCompatibility?: string;
          campaignReadiness?: string;
          marketFit?: string;
          lifestylePresence?: string;
          identityStrength?: string;
          memorability?: string;
        };
      }
    | undefined;
  if (!qa?.dimensions && casting.briefFit == null) return null;
  const dims = qa?.dimensions ?? {};

  return (
    <div className="ps-ci-quality">
      <h3>Casting-Analyse</h3>
      <p className="ps-muted ps-ci-quality-lede">
                {qa?.scoreHonesty?.briefFitLabel ?? "Briefing-Passung"} ·{" "}
                {qa?.scoreHonesty?.technicalLabel ?? "Technische Vollständigkeit"} ·{" "}
                {qa?.scoreHonesty?.visualLabel ?? "Nicht visuell geprüft"}
        {qa?.method ? ` · ${qa.method}` : ""}
      </p>
      <div className="ps-ci-quality-grid">
        {[
                  ["Briefing-Passung", casting.briefFit ?? qa?.briefFit ?? dims.overall],
                  ["Technische Vollständigkeit", casting.technicalCompleteness ?? qa?.technicalCompleteness],
                  ["Visuelle Prüfung", null],
                  ["Briefing · Streetwear-Passung", dims.streetwearMatch],
                  ["Briefing · Marken-Passung", dims.brandMatch],
                  ["Briefing · Community", dims.communityAppeal],
                  ["Briefing · Authentizität", dims.authenticity ?? dims.lifestyleAuthenticity],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <span>{label}</span>
            <strong>
                      {label === "Visuelle Prüfung"
                ? casting.visualStatus === "completed"
                          ? "Abgeschlossen"
                          : "Nicht visuell geprüft"
                : (value ?? "—")}
            </strong>
          </div>
        ))}
      </div>
      <p className="ps-muted">
                Briefing-Werte sind Metadatenheuristiken und keine verifizierte Bildanalyse. Kommerzielle Bewertungen werden nicht als visuelle Urteile dargestellt.
      </p>

      {qa?.casting?.bestFor?.length ? (
        <div className="ps-ci-casting-rec">
          <h4>Besonders geeignet für</h4>
          <ul>
            {qa.casting.bestFor.map((channel) => (
              <li key={channel}>{channel}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {qa?.strengths?.length ? (
        <div className="ps-ci-strengths">
          <h4>Stärken</h4>
          <ul>
            {qa.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {qa?.risks?.length ? (
        <div className="ps-ci-risks">
          <h4>Mögliche Risiken</h4>
          <ul>
            {qa.risks.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
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
                Notizen
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
                  placeholder="Kreative Richtung, Casting-Notizen…"
        />
      </label>
      <button type="button" onClick={onSave}>
                Notiz speichern
      </button>
      {history.length > 0 ? (
        <details className="ps-tech">
                  <summary>Notizverlauf ({history.length})</summary>
          <ul className="ps-ci-note-history">
            {[...history].reverse().map((rev) => (
              <li key={rev.version}>
                <strong>v{rev.version}</strong> · {formatWhen(rev.timestamp)} · {rev.author}
                        <p>{rev.note || "(leer)"}</p>
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
        <div className="ps-ci-hero ps-ci-hero-empty">Kein Hero-Porträt</div>
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
                  <div className="ps-muted">Nicht verfügbar</div>
                )}
                <figcaption>{assetLabel(a.asset_type)}</figcaption>
              </figure>
            ))}
        </div>
      ) : null}
    </div>
  );
}
