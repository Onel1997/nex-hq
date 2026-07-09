"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export const TEAM_PRESENTATION_STEPS = [
  "Research Director is validating trend signals…",
  "Creative Director is exploring creative directions…",
  "Brand Director is checking DNA consistency…",
  "Commercial Director is evaluating market fit…",
  "Production Director is validating print feasibility…",
] as const;

interface TeamPresentationThinkingProps {
  active: boolean;
  className?: string;
}

export function TeamPresentationThinking({ active, className }: TeamPresentationThinkingProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      return;
    }

    const stepTimer = window.setInterval(() => {
      setStepIndex((current) =>
        current >= TEAM_PRESENTATION_STEPS.length - 1 ? current : current + 1,
      );
      setPulse(true);
      window.setTimeout(() => setPulse(false), 400);
    }, 1100);

    return () => window.clearInterval(stepTimer);
  }, [active]);

  if (!active) return null;

  return (
    <div className={cn("cs-presentation-thinking", className)} aria-live="polite" aria-busy="true">
      <p className="cs-presentation-thinking-kicker">AI Creative Team · Creative Pitch</p>
      <ol className="cs-presentation-thinking-steps">
        {TEAM_PRESENTATION_STEPS.map((step, index) => {
          const done = index < stepIndex;
          const current = index === stepIndex;
          return (
            <li
              key={step}
              className={cn(
                "cs-presentation-thinking-step",
                done && "is-done",
                current && "is-current",
                current && pulse && "is-pulse",
              )}
            >
              <span className="cs-presentation-thinking-dot" aria-hidden />
              <span>{step}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Minimum thinking duration before concepts can be revealed (ms). */
export const PRESENTATION_MIN_THINKING_MS = 5200;
