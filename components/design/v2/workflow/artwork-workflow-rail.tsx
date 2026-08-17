"use client";

import { ARTWORK_WORKFLOW_STEPS, type ArtworkWorkflowStep } from "@/components/design/v2/types";
import { cn } from "@/lib/utils";
import { ChevronRight, Loader2 } from "lucide-react";

interface ArtworkWorkflowRailProps {
  activeStep: ArtworkWorkflowStep;
  canContinueToImageStudio?: boolean;
  handoffBusy?: boolean;
  handoffError?: string | null;
  onContinueToImageStudio?: () => void;
  className?: string;
}

function stepIndex(step: ArtworkWorkflowStep): number {
  return ARTWORK_WORKFLOW_STEPS.findIndex((entry) => entry.id === step);
}

export function ArtworkWorkflowRail({
  activeStep,
  canContinueToImageStudio = false,
  handoffBusy = false,
  handoffError = null,
  onContinueToImageStudio,
  className,
}: ArtworkWorkflowRailProps) {
  const activeIndex = stepIndex(activeStep);
  const showContinueAction =
    activeStep === "image-studio" && canContinueToImageStudio && onContinueToImageStudio;

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
          const isImageStudioStep = step.id === "image-studio";
          const isActionable =
            isImageStudioStep && isCurrent && canContinueToImageStudio && onContinueToImageStudio;

          return (
            <li key={step.id} className="dsv2-workflow-step-wrap">
              {isActionable ? (
                <button
                  type="button"
                  className={cn(
                    "dsv2-workflow-step dsv2-workflow-step-action",
                    isDone && "is-done",
                    isCurrent && "is-current",
                  )}
                  onClick={() => void onContinueToImageStudio()}
                  disabled={handoffBusy}
                >
                  <span className="dsv2-workflow-dot" />
                  <span className="dsv2-workflow-label">{step.label}</span>
                </button>
              ) : (
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
              )}
              {index < ARTWORK_WORKFLOW_STEPS.length - 1 ? (
                <ChevronRight className="dsv2-workflow-arrow" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>

      {showContinueAction ? (
        <div className="dsv2-workflow-cta">
          <button
            type="button"
            className="dsv2-workflow-continue-btn"
            onClick={() => void onContinueToImageStudio()}
            disabled={handoffBusy}
          >
            {handoffBusy ? <Loader2 className="size-4 animate-spin" /> : null}
            Continue to Image Studio
          </button>
          {handoffError ? (
            <p className="dsv2-workflow-error" role="alert">
              {handoffError}
            </p>
          ) : null}
        </div>
      ) : handoffError ? (
        <p className="dsv2-workflow-error" role="alert">
          {handoffError}
        </p>
      ) : null}
    </footer>
  );
}
