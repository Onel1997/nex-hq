"use client";

import type { DesignDirection } from "@/lib/design/design-directions";
import type { DesignIteration } from "@/lib/design/design-mission-store";
import {
  resolveMasterArtworkStatusLabel,
  resolveMasterArtworkView,
} from "@/lib/design/master-artwork";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Trophy,
} from "lucide-react";
import { useState } from "react";

interface MasterArtworkLeftRailProps {
  direction: DesignDirection;
  iterations: DesignIteration[];
  activeIterationId: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onSelectVersion: (id: string) => void;
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

function formatVersionDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function resolveVersionStatus(
  iteration: DesignIteration,
  view: ReturnType<typeof resolveMasterArtworkView>,
): { label: string; tone: "approved" | "review" | "concept" | "draft" | "empty" } {
  if (view.isApproved) return { label: "Approved", tone: "approved" };
  if (view.hasArtwork) return { label: "In Review", tone: "review" };
  if (iteration.assets.aiDesignerConcept) return { label: "Concept", tone: "concept" };
  return { label: "Draft", tone: "draft" };
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
  const status = resolveVersionStatus(iteration, view);

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
      </div>
      <div className="ma-version-meta">
        <span className="ma-version-label">V{iteration.version}</span>
        <span className="ma-version-score">
          {score != null ? `${Math.round(score)}%` : "—"}
        </span>
        <time className="ma-version-time" dateTime={iteration.timestamp}>
          {formatVersionDate(iteration.timestamp)}
        </time>
        <span className={cn("ma-version-status-badge", `is-${status.tone}`)}>
          {status.label}
        </span>
      </div>
    </button>
  );
}

function VersionPlaceholder({ version }: { version: number }) {
  return (
    <div className="ma-version-card is-placeholder" aria-hidden>
      <div className="ma-version-thumb">
        <span className="ma-version-thumb-placeholder" />
      </div>
      <div className="ma-version-meta">
        <span className="ma-version-label">V{version}</span>
        <span className="ma-version-score is-muted">—</span>
        <span className="ma-version-time">—</span>
        <span className="ma-version-status-badge is-empty">Empty</span>
      </div>
    </div>
  );
}

export function MasterArtworkLeftRail({
  direction,
  iterations,
  activeIterationId,
  collapsed = false,
  onCollapsedChange,
  onSelectVersion,
}: MasterArtworkLeftRailProps) {
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [versionsExpanded, setVersionsExpanded] = useState(true);

  const activeIteration = iterations.find((i) => i.id === activeIterationId) ?? iterations[0];
  const activeView = activeIteration
    ? resolveMasterArtworkView(activeIteration.assets, activeIteration.label)
    : null;
  const versionSlots = Array.from({ length: 5 }, (_, index) => iterations[index] ?? null);

  const dnaChips = [
    direction.mood,
    direction.typography.split(/[,·]/)[0]?.trim(),
    direction.printStyle.split(/[,·]/)[0]?.trim(),
  ].filter(Boolean);

  return (
    <aside
      className={cn("ma-left-rail cs-sidebar cs-sidebar-left", collapsed && "is-collapsed")}
      aria-label="Master artwork navigation"
    >
      <button
        type="button"
        className="ma-panel-collapse"
        onClick={() => onCollapsedChange?.(!collapsed)}
        aria-label={collapsed ? "Expand direction panel" : "Collapse direction panel"}
        title={collapsed ? "Expand" : "Collapse"}
      >
        {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
      </button>

      {collapsed ? (
        <div className="ma-left-collapsed">
          <div className="ma-dir-selected-badge ma-dir-selected-badge--compact">
            <Trophy className="size-3" />
          </div>
          <DirectionMiniPreview colors={direction.thumbnailColors} />
          <span className="ma-collapsed-score">{direction.scores.commercial}%</span>
          {activeIteration ? (
            <span className="ma-collapsed-version">V{activeIteration.version}</span>
          ) : null}
        </div>
      ) : (
        <>
          <section className="ma-left-section ma-left-section--direction">
            <p className="ma-left-kicker">Selected Direction</p>

            <div className="ma-dir-card">
              <div className="ma-dir-card-row">
                <DirectionMiniPreview colors={direction.thumbnailColors} />
                <div className="ma-dir-card-head">
                  <h2 className="ma-dir-title">{direction.title}</h2>
                  <div className="ma-dir-selected-badge">
                    <Trophy className="size-2.5" />
                    Winner
                  </div>
                </div>
              </div>
              <dl className="ma-dir-stats ma-dir-stats--compact">
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
            </div>

            {dnaChips.length > 0 ? (
              <div className="ma-tags-block">
                <button
                  type="button"
                  className="ma-tags-toggle"
                  aria-expanded={tagsExpanded}
                  onClick={() => setTagsExpanded((value) => !value)}
                >
                  <span>Tags</span>
                  <ChevronDown className={cn("ma-tags-chevron", tagsExpanded && "is-open")} />
                </button>
                {tagsExpanded ? (
                  <div className="ma-dna-chips" aria-label="Direction DNA">
                    {dnaChips.map((chip) => (
                      <span key={chip} className="ma-dna-chip">
                        {chip}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="ma-left-section">
            <header className="ma-left-header">
              <button
                type="button"
                className="ma-section-toggle"
                aria-expanded={versionsExpanded}
                onClick={() => setVersionsExpanded((value) => !value)}
              >
                <p className="ma-left-kicker">Versions</p>
                <ChevronDown className={cn("ma-section-chevron", versionsExpanded && "is-open")} />
              </button>
              <span className="ma-left-meta">V1–V5</span>
            </header>
            {versionsExpanded ? (
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
                    <VersionPlaceholder key={`empty-v${index + 1}`} version={index + 1} />
                  ),
                )}
              </div>
            ) : (
              activeIteration ? (
                <VersionCard
                  iteration={activeIteration}
                  active
                  onSelect={() => onSelectVersion(activeIteration.id)}
                />
              ) : null
            )}
          </section>

          <section className="ma-left-section ma-left-status">
            <div className="ma-left-status-row">
              <p className="ma-left-kicker">Status</p>
              <span
                className={cn(
                  "ma-status-pill ma-status-pill--compact",
                  activeView?.isApproved && "is-approved",
                  activeView?.hasArtwork && !activeView?.isApproved && "is-review",
                )}
              >
                {activeView
                  ? resolveMasterArtworkStatusLabel(activeView.state.status)
                  : "Awaiting"}
              </span>
            </div>
          </section>
        </>
      )}
    </aside>
  );
}
