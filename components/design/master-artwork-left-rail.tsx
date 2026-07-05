"use client";

import type { DesignDirection } from "@/lib/design/design-directions";
import type { DesignIteration } from "@/lib/design/design-mission-store";
import {
  resolveMasterArtworkStatusLabel,
  resolveMasterArtworkView,
} from "@/lib/design/master-artwork";
import { cn } from "@/lib/utils";
import { Check, CheckCircle2, Trophy } from "lucide-react";

interface MasterArtworkLeftRailProps {
  direction: DesignDirection;
  iterations: DesignIteration[];
  activeIterationId: string;
  onSelectVersion: (id: string) => void;
}

function DirectionDnaChips({ direction }: { direction: DesignDirection }) {
  const chips = [
    direction.mood,
    direction.typography.split(/[,·]/)[0]?.trim(),
    direction.printStyle.split(/[,·]/)[0]?.trim(),
  ].filter(Boolean);

  return (
    <div className="ma-dna-chips" aria-label="Direction DNA">
      {chips.map((chip) => (
        <span key={chip} className="ma-dna-chip">
          {chip}
        </span>
      ))}
    </div>
  );
}

function DirectionMiniPreview({ colors }: { colors: string[] }) {
  return (
    <div className="ma-dir-mini-preview" aria-hidden>
      <div className="ma-dir-mini-frame">
        {colors.slice(0, 4).map((color, index) => (
          <span key={`${color}-${index}`} style={{ background: color }} />
        ))}
        <div className="ma-dir-mini-art" />
      </div>
    </div>
  );
}

function VersionCard({
  iteration,
  active,
  onSelect,
}: {
  iteration: DesignIteration;
  active: boolean;
  onSelect: () => void;
}) {
  const view = resolveMasterArtworkView(iteration.assets, iteration.label);
  const thumb =
    view.previewImageUrl ??
    iteration.assets.masterArtwork?.artworkImageUrl ??
    iteration.assets.masterArtwork?.previewUrl;
  const score =
    view.state.commercialScore ??
    iteration.assets.commercialScore ??
    iteration.brief.commercialScore;
  const approved = view.isApproved;
  const status = approved
    ? "Approved"
    : view.hasArtwork
      ? "In Review"
      : iteration.assets.aiDesignerConcept
        ? "Concept"
        : "Draft";

  return (
    <button
      type="button"
      className={cn("ma-version-card", active && "is-active", approved && "is-approved")}
      onClick={onSelect}
    >
      <div className="ma-version-thumb">
        {thumb ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={thumb} alt="" />
        ) : (
          <span className="ma-version-thumb-empty">V{iteration.version}</span>
        )}
        {approved ? (
          <span className="ma-version-approved" title="Approved">
            <CheckCircle2 className="size-3" />
          </span>
        ) : null}
      </div>
      <div className="ma-version-meta">
        <span className="ma-version-label">V{iteration.version}</span>
        <span className="ma-version-status">{status}</span>
        {score != null ? <span className="ma-version-score">{Math.round(score)}%</span> : null}
        <time className="ma-version-time">
          {new Date(iteration.timestamp).toLocaleDateString([], {
            month: "short",
            day: "numeric",
          })}
        </time>
      </div>
    </button>
  );
}

export function MasterArtworkLeftRail({
  direction,
  iterations,
  activeIterationId,
  onSelectVersion,
}: MasterArtworkLeftRailProps) {
  const activeIteration = iterations.find((i) => i.id === activeIterationId) ?? iterations[0];
  const activeView = activeIteration
    ? resolveMasterArtworkView(activeIteration.assets, activeIteration.label)
    : null;
  const versionSlots = Array.from({ length: 5 }, (_, index) => iterations[index] ?? null);

  return (
    <aside className="ma-left-rail cs-sidebar cs-sidebar-left" aria-label="Master artwork navigation">
      <section className="ma-left-section">
        <header className="ma-left-header">
          <p className="ma-left-kicker">Selected Direction</p>
          <div className="ma-dir-selected-badge">
            <Trophy className="size-3" />
            Winner
          </div>
        </header>

        <div className="ma-dir-summary">
          <DirectionMiniPreview colors={direction.thumbnailColors} />
          <div className="ma-dir-summary-body">
            <h2 className="ma-dir-title">{direction.title}</h2>
            <p className="ma-dir-philosophy">{direction.philosophy}</p>
            <DirectionDnaChips direction={direction} />
          </div>
        </div>

        <dl className="ma-dir-stats">
          <div>
            <dt>Commercial</dt>
            <dd>{direction.scores.commercial}%</dd>
          </div>
          <div>
            <dt>Brand Fit</dt>
            <dd>{direction.scores.brandFit}%</dd>
          </div>
          <div>
            <dt>Originality</dt>
            <dd>{direction.scores.originality}%</dd>
          </div>
        </dl>
      </section>

      <section className="ma-left-section">
        <header className="ma-left-header">
          <p className="ma-left-kicker">Versions</p>
          <span className="ma-left-meta">V1–V5</span>
        </header>
        <div className="ma-version-rail">
          {versionSlots.map((iteration, index) =>
            iteration ? (
              <VersionCard
                key={iteration.id}
                iteration={iteration}
                active={iteration.id === activeIterationId}
                onSelect={() => onSelectVersion(iteration.id)}
              />
            ) : (
              <div key={`empty-v${index + 1}`} className="ma-version-card is-empty">
                <div className="ma-version-thumb">
                  <span className="ma-version-thumb-empty">V{index + 1}</span>
                </div>
                <div className="ma-version-meta">
                  <span className="ma-version-label">V{index + 1}</span>
                  <span className="ma-version-status">—</span>
                </div>
              </div>
            ),
          )}
        </div>
      </section>

      <section className="ma-left-section ma-left-status">
        <header className="ma-left-header">
          <p className="ma-left-kicker">Status</p>
        </header>
        <div className="ma-status-card">
          <span
            className={cn(
              "ma-status-pill",
              activeView?.isApproved && "is-approved",
              activeView?.hasArtwork && !activeView.isApproved && "is-review",
            )}
          >
            {activeView
              ? resolveMasterArtworkStatusLabel(activeView.state.status)
              : "Awaiting artwork"}
          </span>
          {direction.selected ? (
            <p className="ma-status-note">
              <Check className="size-3" />
              Direction locked for production
            </p>
          ) : null}
        </div>
      </section>
    </aside>
  );
}
