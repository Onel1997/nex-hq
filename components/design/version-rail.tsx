"use client";

import type { DesignIteration } from "@/lib/design/design-mission-store";
import { resolveMasterArtworkView } from "@/lib/design/master-artwork";
import { cn } from "@/lib/utils";
import { CheckCircle2, Star } from "lucide-react";

interface VersionRailProps {
  iterations: DesignIteration[];
  activeId: string;
  onSelect: (id: string) => void;
}

function resolveThumbnail(iteration: DesignIteration): string | undefined {
  const view = resolveMasterArtworkView(iteration.assets, iteration.label);
  return (
    view.previewImageUrl ??
    iteration.assets.mockupUrl ??
    iteration.assets.renderUrl ??
    iteration.assets.svgUrl
  );
}

function resolveCommercialScore(iteration: DesignIteration): number | undefined {
  const view = resolveMasterArtworkView(iteration.assets, iteration.label);
  return (
    view.state.commercialScore ??
    iteration.assets.commercialScore ??
    iteration.brief.commercialScore
  );
}

function resolveStatus(iteration: DesignIteration): string {
  const view = resolveMasterArtworkView(iteration.assets, iteration.label);
  if (view.isApproved) return "Approved";
  if (view.hasArtwork) return "In Review";
  if (iteration.assets.aiDesignerConcept) return "Concept";
  return "Draft";
}

export function VersionRail({ iterations, activeId, onSelect }: VersionRailProps) {
  const visible = iterations.slice(0, 5);

  return (
    <section className="cw-v2-version-rail" aria-label="Design versions">
      <header className="cw-v2-version-rail-header">
        <p className="cw-v2-kicker">Version System</p>
        <h2 className="cw-v2-section-title">Creative Versions</h2>
      </header>
      <div className="cw-v2-version-row">
        {visible.map((iteration) => {
          const thumb = resolveThumbnail(iteration);
          const score = resolveCommercialScore(iteration);
          const status = resolveStatus(iteration);
          const approved = status === "Approved";

          return (
            <button
              key={iteration.id}
              type="button"
              className={cn(
                "cw-v2-version-card",
                iteration.id === activeId && "is-active",
                approved && "is-approved",
              )}
              onClick={() => onSelect(iteration.id)}
            >
              <div className="cw-v2-version-thumb">
                {thumb ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={thumb} alt="" />
                ) : (
                  <span className="cw-v2-version-thumb-empty">V{iteration.version}</span>
                )}
                {approved ? (
                  <span className="cw-v2-version-approved-badge" title="Approved">
                    <CheckCircle2 className="size-3" />
                  </span>
                ) : null}
              </div>
              <div className="cw-v2-version-meta">
                <span className="cw-v2-version-label">
                  V{iteration.version}
                  {iteration.favorite ? <Star className="size-3 fill-current" /> : null}
                </span>
                <span className="cw-v2-version-status">{status}</span>
                {score != null ? (
                  <span className="cw-v2-version-score">{Math.round(score)}%</span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
