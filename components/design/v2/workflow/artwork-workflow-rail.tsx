"use client";

import { ARTWORK_WORKFLOW_STEPS, type ArtworkWorkflowStep } from "@/components/design/v2/types";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface ArtworkWorkflowRailProps {
  activeStep: ArtworkWorkflowStep;
  className?: string;
}

function stepIndex(step: ArtworkWorkflowStep): number {
  return ARTWORK_WORKFLOW_STEPS.findIndex((s) => s.id === step);
}

export function ArtworkWorkflowRail({ activeStep, className }: ArtworkWorkflowRailProps) {
  const activeIndex = stepIndex(activeStep);

  return (
    <footer className={cn("dsv2-workflow", className)} aria-label="Production workflow">
      <div className="dsv2-workflow-track">
        <div
          className="dsv2-workflow-progress"
          style={{
            width: `${(activeIndex / (ARTWORK_WORKFLOW_STEPS.length - 1)) * 100}%`,
          }}
          aria-hidden
        />
      </div>

      <ol className="dsv2-workflow-steps">
        {ARTWORK_WORKFLOW_STEPS.map((step, index) => {
          const isDone = index < activeIndex;
          const isCurrent = index === activeIndex;

          return (
            <li key={step.id} className="dsv2-workflow-step-wrap">
              <span
                className={cn(
                  "dsv2-workflow-step",
                  isDone && "is-done",
                  isCurrent && "is-current",
                )}
              >
                <span className="dsv2-workflow-dot" />
                <span className="dsv2-workflow-label">{step.label}</span>
              </span>
              {index < ARTWORK_WORKFLOW_STEPS.length - 1 ? (
                <ChevronRight className="dsv2-workflow-arrow" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>
    </footer>
  );
}
