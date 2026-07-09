"use client";

import {
  RESEARCH_RUN_STEPS,
  type ResearchRunPhase,
} from "./types";
import { cn } from "@/lib/utils";
import { Check, Loader2 } from "lucide-react";

interface ResearchStudioRunningProps {
  phase: ResearchRunPhase;
}

function stepIndex(phase: ResearchRunPhase): number {
  if (phase === "idle" || phase === "complete" || phase === "error") return -1;
  return RESEARCH_RUN_STEPS.findIndex((s) => s.id === phase);
}

export function ResearchStudioRunning({ phase }: ResearchStudioRunningProps) {
  const activeIndex = stepIndex(phase);

  return (
    <div className="research-studio-running" aria-live="polite">
      <div className="research-studio-running-glow" aria-hidden />
      <div className="research-studio-running-inner">
        <div className="research-studio-running-header">
          <Loader2 className="size-5 animate-spin text-violet-400" />
          <h2 className="research-studio-running-title">Research in progress</h2>
        </div>
        <p className="research-studio-running-subtitle">
          AI is analyzing live intelligence and building your report.
        </p>

        <ol className="research-studio-running-steps">
          {RESEARCH_RUN_STEPS.map((step, index) => {
            const isComplete =
              activeIndex > index || phase === "complete";
            const isActive = activeIndex === index && phase !== "complete";
            const isPending = activeIndex < index && phase !== "complete";

            return (
              <li
                key={step.id}
                className={cn(
                  "research-studio-running-step",
                  isComplete && "research-studio-running-step-done",
                  isActive && "research-studio-running-step-active",
                  isPending && "research-studio-running-step-pending",
                )}
              >
                <span className="research-studio-running-step-icon">
                  {isComplete ? (
                    <Check className="size-3.5" />
                  ) : isActive ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <span className="research-studio-running-step-dot" />
                  )}
                </span>
                <span>{step.label}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
