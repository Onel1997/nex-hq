"use client";

import type { DesignDirection } from "@/lib/design/design-directions";
import type { DesignIteration } from "@/lib/design/design-mission-store";
import { resolveMasterArtworkView } from "@/lib/design/master-artwork";
import { cn } from "@/lib/utils";
import { Archive, Copy, Loader2, Sparkles, Trophy } from "lucide-react";

interface CreativeDirectionsSidebarProps {
  directions?: DesignDirection[];
  iterations: DesignIteration[];
  activeIterationId: string;
  loading?: boolean;
  hasConcept: boolean;
  onGenerateDirections: () => void;
  onSelectDirection: (id: string) => void;
  onArchiveDirection: (id: string) => void;
  onDuplicateDirection: (id: string) => void;
  onSelectVersion: (id: string) => void;
}

function DirectionPreview({ colors }: { colors: string[] }) {
  return (
    <div className="cs-direction-preview" aria-hidden>
      {colors.map((color, index) => (
        <span key={`${color}-${index}`} style={{ background: color }} />
      ))}
    </div>
  );
}

function resolveVersionThumb(iteration: DesignIteration): string | undefined {
  const view = resolveMasterArtworkView(iteration.assets, iteration.label);
  return view.previewImageUrl ?? iteration.assets.mockupUrl ?? iteration.assets.svgUrl;
}

export function CreativeDirectionsSidebar({
  directions,
  iterations,
  activeIterationId,
  loading,
  hasConcept,
  onGenerateDirections,
  onSelectDirection,
  onArchiveDirection,
  onDuplicateDirection,
  onSelectVersion,
}: CreativeDirectionsSidebarProps) {
  const visibleVersions = iterations.slice(0, 5);

  return (
    <aside className="cs-sidebar cs-sidebar-left" aria-label="Creative directions">
      <div className="cs-sidebar-section">
        <header className="cs-sidebar-head">
          <h2>Directions</h2>
          <button
            type="button"
            className="cs-btn cs-btn-primary cs-btn-compact"
            disabled={!hasConcept || loading}
            onClick={onGenerateDirections}
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            Generate
          </button>
        </header>

        {!hasConcept ? (
          <p className="cs-sidebar-hint">Generate AI concept first.</p>
        ) : !directions?.length ? (
          <p className="cs-sidebar-hint">Create 3–5 directions to explore.</p>
        ) : (
          <div className="cs-direction-list">
            {directions.map((direction) => (
              <article
                key={direction.id}
                className={cn(
                  "cs-direction-card",
                  direction.selected && "is-selected",
                  direction.archived && !direction.selected && "is-archived",
                )}
              >
                <button
                  type="button"
                  className="cs-direction-select"
                  onClick={() => onSelectDirection(direction.id)}
                >
                  <DirectionPreview colors={direction.thumbnailColors} />
                  <div className="cs-direction-body">
                    <div className="cs-direction-title-row">
                      <h3>{direction.title}</h3>
                      {direction.selected ? (
                        <span className="cs-badge cs-badge-winner">
                          <Trophy className="size-3" /> Winner
                        </span>
                      ) : null}
                    </div>
                    <div className="cs-direction-scores">
                      <span>{direction.scores.luxury}% lux</span>
                      <span>{direction.scores.commercial}% com</span>
                      <span>{direction.scores.originality}% orig</span>
                    </div>
                    <div className="cs-direction-tags">
                      <span>{direction.mood}</span>
                      <span>{direction.typography}</span>
                      <span>{direction.printStyle}</span>
                    </div>
                    <span className="cs-direction-status">
                      {direction.selected ? "Active" : direction.archived ? "Archived" : "Candidate"}
                    </span>
                  </div>
                </button>
                <div className="cs-direction-actions">
                  <button
                    type="button"
                    title="Archive"
                    onClick={() => onArchiveDirection(direction.id)}
                  >
                    <Archive className="size-3" />
                  </button>
                  <button
                    type="button"
                    title="Duplicate"
                    onClick={() => onDuplicateDirection(direction.id)}
                  >
                    <Copy className="size-3" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="cs-sidebar-section cs-sidebar-versions">
        <header className="cs-sidebar-head">
          <h2>Versions</h2>
        </header>
        <div className="cs-version-list">
          {visibleVersions.map((iteration) => {
            const thumb = resolveVersionThumb(iteration);
            return (
              <button
                key={iteration.id}
                type="button"
                className={cn(
                  "cs-version-chip",
                  iteration.id === activeIterationId && "is-active",
                )}
                onClick={() => onSelectVersion(iteration.id)}
              >
                {thumb ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={thumb} alt="" className="cs-version-thumb" />
                ) : (
                  <span className="cs-version-thumb cs-version-thumb-empty">V{iteration.version}</span>
                )}
                <span>V{iteration.version}</span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
