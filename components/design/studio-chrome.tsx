"use client";

import { cn } from "@/lib/utils";
import { ChevronRight, Loader2, Sparkles } from "lucide-react";

const WORKFLOW_STEPS = [
  "Research",
  "Design Directions",
  "Select Winner",
  "Master Artwork",
  "Commercial Review",
  "Approve",
  "Marketing Studio",
] as const;

interface StudioChromeProps {
  title: string;
  reportTitle?: string;
  sourceLabel?: string;
  collectionName?: string;
  activeStep: number;
  loading?: string | null;
  hasConcept: boolean;
  hasReportBrief?: boolean;
  designs?: Array<{ designId: string; title: string }>;
  activeDesignId?: string;
  onSelectDesign?: (id: string) => void;
  onGenerateConcept: () => void;
}

export function StudioChrome({
  title,
  reportTitle,
  sourceLabel,
  collectionName,
  activeStep,
  loading,
  hasConcept,
  hasReportBrief = false,
  designs,
  activeDesignId,
  onSelectDesign,
  onGenerateConcept,
}: StudioChromeProps) {
  const headerTitle = reportTitle?.trim() || title;

  return (
    <header className="cs-chrome">
      <div className="cs-chrome-left">
        <p className="cs-chrome-eyebrow">
          {sourceLabel ?? collectionName ?? "Design Studio"}
        </p>
        <h1 className="cs-chrome-title">{headerTitle}</h1>
        {designs && designs.length > 1 ? (
          <div className="cs-chrome-designs">
            {designs.map((design) => (
              <button
                key={design.designId}
                type="button"
                className={cn(
                  "cs-chrome-design-pill",
                  design.designId === activeDesignId && "is-active",
                )}
                onClick={() => onSelectDesign?.(design.designId)}
              >
                {design.title}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <nav className="cs-chrome-workflow" aria-label="Creative workflow">
        {WORKFLOW_STEPS.map((step, index) => (
          <span
            key={step}
            className={cn(
              "cs-workflow-step",
              index < activeStep && "is-done",
              index === activeStep && "is-current",
              index > activeStep && "is-future",
            )}
          >
            {step}
            {index < WORKFLOW_STEPS.length - 1 ? (
              <ChevronRight className="size-3 cs-workflow-arrow" aria-hidden />
            ) : null}
          </span>
        ))}
      </nav>

      <div className="cs-chrome-actions">
        <button
          type="button"
          className="cs-btn cs-btn-primary cs-btn-compact"
          disabled={loading === "Generate AI Design Concept"}
          onClick={onGenerateConcept}
        >
          {loading === "Generate AI Design Concept" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          {hasConcept ? "Refresh Concept" : hasReportBrief ? "Generate AI Design Concept" : "AI Concept"}
        </button>
      </div>
    </header>
  );
}

export function deriveWorkflowStep(
  hasConcept: boolean,
  hasDirections: boolean,
  hasSelectedDirection: boolean,
  hasArtwork: boolean,
  isApproved: boolean,
  hasReportBrief = false,
): number {
  if (isApproved) return 6;
  if (hasArtwork) return 4;
  if (hasSelectedDirection) return 3;
  if (hasDirections) return 2;
  if (hasConcept) return 1;
  if (hasReportBrief) return 0;
  return 0;
}
