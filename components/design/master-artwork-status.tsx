"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export type MasterArtworkStatusPhase = "idle" | "reveal" | "glow" | "commercial" | "success";

const STATUS_STEPS = [
  { id: "generated", label: "Artwork generated", minPhase: "reveal" as const },
  { id: "print", label: "Print ready", minPhase: "glow" as const },
  { id: "score", label: "Commercial score calculated", minPhase: "commercial" as const },
  { id: "approval", label: "Ready for approval", minPhase: "success" as const },
] as const;

const PHASE_ORDER: MasterArtworkStatusPhase[] = [
  "idle",
  "reveal",
  "glow",
  "commercial",
  "success",
];

function phaseIndex(phase: MasterArtworkStatusPhase): number {
  const index = PHASE_ORDER.indexOf(phase);
  return index < 0 ? 0 : index;
}

interface MasterArtworkStatusProps {
  phase: MasterArtworkStatusPhase;
  fallbackLabel: string;
  isApproved?: boolean;
  className?: string;
}

export function MasterArtworkStatus({
  phase,
  fallbackLabel,
  isApproved,
  className,
}: MasterArtworkStatusProps) {
  const activeIndex = phaseIndex(phase);
  const showChecklist = activeIndex >= phaseIndex("reveal");

  if (!showChecklist) {
    return (
      <span className={cn("ma-stage-status", isApproved && "is-approved", className)}>
        {fallbackLabel}
      </span>
    );
  }

  return (
    <div
      className={cn(
        "ma-status-panel",
        phase === "success" && "is-complete",
        isApproved && "is-approved",
        className,
      )}
      aria-live="polite"
    >
      <ul className="ma-status-checklist">
        {STATUS_STEPS.map((step, index) => {
          const stepIndex = phaseIndex(step.minPhase);
          const visible = activeIndex >= stepIndex;
          const done = activeIndex > stepIndex || phase === "success";
          return (
            <li
              key={step.id}
              className={cn(
                "ma-status-checklist-item",
                visible && "is-visible",
                done && "is-done",
              )}
              style={{ transitionDelay: `${index * 120}ms` }}
            >
              <span className="ma-status-check-icon" aria-hidden>
                {done ? <Check className="size-2.5" /> : null}
              </span>
              <span>{step.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
