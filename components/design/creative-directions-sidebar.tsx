"use client";

import type { DesignDirection } from "@/lib/design/design-directions";
import type { DesignIteration } from "@/lib/design/design-mission-store";
import { resolveMasterArtworkView } from "@/lib/design/master-artwork";
import { cn } from "@/lib/utils";
import {
  Archive,
  Check,
  ChevronDown,
  Copy,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

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

type PipelineStepStatus = "complete" | "current" | "future";

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

function DirectionNavCard({
  direction,
  onSelect,
  onArchive,
  onDuplicate,
}: {
  direction: DesignDirection;
  onSelect: (id: string) => void;
  onArchive: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const handleClick = () => {
    onSelect(direction.id);
    document.getElementById(`pitch-card-${direction.id}`)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  };

  return (
    <div
      className={cn(
        "cs-dir-nav-card-wrap",
        direction.selected && "is-selected",
        direction.archived && !direction.selected && "is-archived",
      )}
    >
      <button type="button" className="cs-dir-nav-card" onClick={handleClick}>
        <DirectionPreview colors={direction.thumbnailColors} />
        <div className="cs-dir-nav-body">
          <span className="cs-dir-nav-title">{direction.title}</span>
          <span className="cs-dir-nav-score">{direction.scores.commercial}% commercial</span>
        </div>
        {direction.selected ? (
          <span className="cs-dir-nav-selected" aria-label="Selected">
            <Check className="size-3" />
          </span>
        ) : null}
      </button>
      <div className="cs-dir-nav-actions">
        <button type="button" title="Archive" onClick={() => onArchive(direction.id)}>
          <Archive className="size-2.5" />
        </button>
        <button type="button" title="Duplicate" onClick={() => onDuplicate(direction.id)}>
          <Copy className="size-2.5" />
        </button>
      </div>
    </div>
  );
}

function PipelineStep({
  label,
  status,
  isLast,
  children,
  defaultOpen = true,
}: {
  label: string;
  status: PipelineStepStatus;
  isLast?: boolean;
  children?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasBody = Boolean(children);

  return (
    <li className={cn("cs-pipeline-step", `is-${status}`, isLast && "is-last")}>
      <div className="cs-pipeline-rail" aria-hidden>
        <span className="cs-pipeline-node">
          {status === "complete" ? <Check className="size-2.5" /> : null}
        </span>
        {!isLast ? <span className="cs-pipeline-line" /> : null}
      </div>
      <div className="cs-pipeline-content">
        {hasBody ? (
          <button
            type="button"
            className="cs-pipeline-step-head"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <span>{label}</span>
            <ChevronDown className={cn("cs-pipeline-chevron", open && "is-open")} />
          </button>
        ) : (
          <span className="cs-pipeline-step-label">{label}</span>
        )}
        {hasBody && open ? <div className="cs-pipeline-step-body">{children}</div> : null}
      </div>
    </li>
  );
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
  const visibleVersions = iterations.slice(0, 6);
  const selectedDirection = directions?.find((direction) => direction.selected);
  const hasDirections = Boolean(directions?.length);
  const activeNavDirections = directions?.filter((d) => !d.archived) ?? [];

  const researchStatus: PipelineStepStatus = hasConcept ? "complete" : "current";
  const directionsStatus: PipelineStepStatus = !hasConcept
    ? "future"
    : hasDirections
      ? selectedDirection
        ? "complete"
        : "current"
      : "current";
  const versionsStatus: PipelineStepStatus =
    iterations.length > 1 ? "current" : selectedDirection ? "current" : "future";

  return (
    <aside className="cs-sidebar cs-sidebar-left cs-sidebar-pitch" aria-label="Creative pipeline">
      <header className="cs-pipeline-header">
        <p className="cs-pipeline-kicker">Creative Pipeline</p>
      </header>

      <ol className="cs-pipeline cs-pipeline-compact cs-nexhq-scroll">
        <PipelineStep label="Research" status={researchStatus} isLast={false} defaultOpen={false}>
          <p className="cs-pipeline-note">
            {hasConcept ? "Brief ready" : "Awaiting concept"}
          </p>
        </PipelineStep>

        <PipelineStep label="Design Directions" status={directionsStatus} defaultOpen>
          {!hasConcept ? (
            <p className="cs-pipeline-note">Generate concept first</p>
          ) : !hasDirections ? (
            <div className="cs-pipeline-actions">
              <button
                type="button"
                className="cs-btn cs-btn-primary cs-btn-compact cs-pipeline-generate"
                disabled={loading}
                onClick={onGenerateDirections}
              >
                {loading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                Generate Directions
              </button>
            </div>
          ) : (
            <div className="cs-dir-nav-list">
              {activeNavDirections.map((direction) => (
                <DirectionNavCard
                  key={direction.id}
                  direction={direction}
                  onSelect={onSelectDirection}
                  onArchive={onArchiveDirection}
                  onDuplicate={onDuplicateDirection}
                />
              ))}
            </div>
          )}
        </PipelineStep>

        <PipelineStep label="Master Artwork" status={selectedDirection ? "current" : "future"} defaultOpen={false}>
          <p className="cs-pipeline-note">
            {selectedDirection
              ? `${selectedDirection.title} selected`
              : "Select a direction first"}
          </p>
        </PipelineStep>

        <PipelineStep label="Versions" status={versionsStatus} isLast defaultOpen={false}>
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
                    <span className="cs-version-thumb cs-version-thumb-empty">
                      V{iteration.version}
                    </span>
                  )}
                  <span>{iteration.label || `V${iteration.version}`}</span>
                </button>
              );
            })}
          </div>
        </PipelineStep>
      </ol>
    </aside>
  );
}
