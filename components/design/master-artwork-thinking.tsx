"use client";

import { cn } from "@/lib/utils";
import { FASHION_ENGINE_UI_STEPS } from "@/lib/design/fashion-design-engine/progress";
import { useEffect, useState } from "react";

/** Legacy steps — kept for backward compatibility. */
export const MASTER_ARTWORK_THINKING_STEPS = [
  "Analyzing selected direction…",
  "Building typography system…",
  "Balancing composition…",
  "Refining negative space…",
  "Optimizing for print…",
  "Checking commercial potential…",
  "Preparing transparent artwork…",
  "Final quality review…",
] as const;

/** Fashion Design Engine V2 — internal progress sequence shown during master artwork generation. */
export const FASHION_DESIGN_ENGINE_STEPS = FASHION_ENGINE_UI_STEPS.map(
  (step) => step.label,
);

interface MasterArtworkThinkingProps {
  active: boolean;
  className?: string;
  variant?: "panel" | "canvas";
  /** Use Fashion Design Engine V2 progress labels (default). */
  useFashionEngineSteps?: boolean;
}

export function MasterArtworkThinking({
  active,
  className,
  variant = "panel",
  useFashionEngineSteps = true,
}: MasterArtworkThinkingProps) {
  const steps = useFashionEngineSteps
    ? FASHION_DESIGN_ENGINE_STEPS
    : MASTER_ARTWORK_THINKING_STEPS;

  const [stepIndex, setStepIndex] = useState(0);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      return;
    }

    const stepTimer = window.setInterval(() => {
      setStepIndex((current) =>
        current >= steps.length - 1 ? current : current + 1,
      );
      setPulse(true);
      window.setTimeout(() => setPulse(false), 400);
    }, 1400);

    return () => window.clearInterval(stepTimer);
  }, [active, steps.length]);

  if (!active) return null;

  return (
    <div
      className={cn(
        "cs-thinking",
        variant === "canvas" && "cs-thinking-canvas",
        className,
      )}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="cs-thinking-orb" aria-hidden />
      <ol className="cs-thinking-steps">
        {steps.map((step, index) => {
          const done = index < stepIndex;
          const current = index === stepIndex;
          return (
            <li
              key={step}
              className={cn(
                "cs-thinking-step",
                done && "is-done",
                current && "is-current",
                current && pulse && "is-pulse",
              )}
            >
              <span className="cs-thinking-dot" aria-hidden />
              <span>{step}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
