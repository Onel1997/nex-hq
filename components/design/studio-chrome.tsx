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
  "Image Studio",
] as const;

interface StudioChromeProps {
  title: string;
  collectionName?: string;
  activeStep: number;
  loading?: string | null;
  hasConcept: boolean;
  designs?: Array<{ designId: string; title: string }>;
  activeDesignId?: string;
  onSelectDesign?: (id: string) => void;
  onGenerateConcept: () => void;
}

export function StudioChrome({
  title,
  collectionName,
  activeStep,
  loading,
  hasConcept,
  designs,
  activeDesignId,
  onSelectDesign,
  onGenerateConcept,
}: StudioChromeProps) {
  return (
    <header className="cs-chrome">
      <div className="cs-chrome-left">
        <p className="cs-chrome-eyebrow">{collectionName ?? "Design Studio"}</p>
        <h1 className="cs-chrome-title">{title}</h1>
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
          {hasConcept ? "Refresh Concept" : "AI Concept"}
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
): number {
  if (isApproved) return 6;
  if (hasArtwork) return 4;
  if (hasSelectedDirection) return 3;
  if (hasDirections) return 2;
  if (hasConcept) return 1;
  return 0;
}
