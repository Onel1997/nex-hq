"use client";

import { useLocale, useDictionary } from "@/lib/i18n";
import { getResearchRunSteps } from "@/lib/i18n/data/research-studio";
import type { ResearchRunPhase } from "./types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles } from "lucide-react";

interface ResearchStudioRunningProps {
  phase: ResearchRunPhase;
}

export function ResearchStudioRunning({ phase }: ResearchStudioRunningProps) {
  const locale = useLocale();
  const { research } = useDictionary();
  const steps = getResearchRunSteps(locale);
  const activeIndex =
    phase === "idle" || phase === "complete" || phase === "error"
      ? -1
      : steps.findIndex((step) => step.id === phase);

  return (
    <div className="rs3-run" aria-live="polite" aria-busy="true">
      <div className="rs3-run-glow" aria-hidden />
      <div className="rs3-run-panel">
        <div className="rs3-run-header">
          <span className="rs3-run-icon-wrap">
            <Sparkles className="size-4" />
          </span>
          <div>
            <h2 className="rs3-run-title">{research.studio.running.title}</h2>
            <p className="rs3-run-subtitle">{research.studio.running.subtitle}</p>
          </div>
        </div>

        <ol className="rs3-run-steps">
          {steps.map((step, index) => {
            const isComplete = activeIndex > index || phase === "complete";
            const isActive = activeIndex === index && phase !== "complete";
            const isPending = activeIndex < index && phase !== "complete";

            return (
              <li
                key={step.id}
                className={cn(
                  "rs3-run-step",
                  isComplete && "rs3-run-step-done",
                  isActive && "rs3-run-step-active",
                  isPending && "rs3-run-step-pending",
                )}
              >
                <span className="rs3-run-step-icon" aria-hidden>
                  {isComplete ? (
                    <Check className="size-3.5" />
                  ) : isActive ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <span className="rs3-run-step-dot" />
                  )}
                </span>
                <span className="rs3-run-step-label">{step.label}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
