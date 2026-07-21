"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const LIVE_GENERATION_STEPS = [
  "Preparing discovery casting",
  "Building identity locks",
  "Provider processing Candidate 1",
  "Provider processing Candidate 2",
  "Provider processing Candidate 3",
  "Provider processing Candidate 4",
  "Saving discovery assets",
  "Computing brief-fit scores",
  "Discovery ready",
] as const;

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

/**
 * Premium live generation loading UI.
 * Presentation only — does not call providers or change generation.
 */
export function PersonaGenerationExperience({
  active = false,
  candidateCount = 4,
  estimatedSeconds = 90,
}: {
  active?: boolean;
  candidateCount?: number;
  /** Rough ETA for the progress remaining display. */
  estimatedSeconds?: number;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const steps = LIVE_GENERATION_STEPS.map((label, i) => {
    if (label.startsWith("Rendering Candidate")) {
      const n = Number(label.replace(/\D/g, ""));
      if (n > candidateCount) return null;
    }
    return label;
  }).filter((s): s is (typeof LIVE_GENERATION_STEPS)[number] => s != null);

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      setElapsed(0);
      return;
    }

    const elapsedTimer = window.setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);

    const stepTimer = window.setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    }, Math.max(2500, Math.floor((estimatedSeconds * 1000) / steps.length)));

    return () => {
      window.clearInterval(elapsedTimer);
      window.clearInterval(stepTimer);
    };
  }, [active, estimatedSeconds, steps.length]);

  if (!active) return null;

  // Never show 100% until the final "Discovery ready" step (cosmetic timeline only —
  // real readiness is DB finalization on the server).
  const rawProgress = Math.round(((stepIndex + 1) / steps.length) * 100);
  const progress =
    stepIndex >= steps.length - 1 ? 100 : Math.min(95, rawProgress);
  const remaining = Math.max(0, estimatedSeconds - elapsed);
  const currentStep = steps[stepIndex] ?? steps[0];
  const stillWaiting = elapsed >= 90;

  return (
    <div className="ps-gen-live" role="status" aria-live="polite">
      <div className="ps-gen-live-atmosphere" aria-hidden>
        <div className="ps-gen-live-orb">
          <Loader2 className="size-7 animate-spin" strokeWidth={1.2} />
        </div>
        <div className="ps-gen-live-portraits">
          {Array.from({ length: Math.min(4, candidateCount) }, (_, i) => (
            <div
              key={i}
              className={`ps-gen-live-frame${i <= stepIndex - 2 ? " is-done" : i === stepIndex - 2 ? " is-active" : ""}`}
            >
              <div className="ps-gen-shimmer" />
            </div>
          ))}
        </div>
      </div>

      <p className="ps-eyebrow">Discovery casting</p>
      <h2 className="ps-gen-live-title">Generate 4 discovery faces</h2>
      <p className="ps-gen-live-subtitle">
        One portrait per candidate — angle validation is a separate confirmed step.
      </p>

      <div className="ps-gen-live-progress" aria-hidden>
        <div className="ps-gen-live-progress-track">
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="ps-gen-live-progress-meta">
          <span>{progress}%</span>
          <span>{currentStep}</span>
        </div>
      </div>

      <dl className="ps-gen-live-timing">
        <div>
          <dt>Current Step</dt>
          <dd>{currentStep}</dd>
        </div>
        <div>
          <dt>Elapsed</dt>
          <dd>{formatElapsed(elapsed)}</dd>
        </div>
        <div>
          <dt>Est. Remaining</dt>
          <dd>{formatElapsed(remaining)}</dd>
        </div>
      </dl>

      {stillWaiting ? (
        <p className="ps-muted">
          Provider is still processing. Your request remains active.
        </p>
      ) : null}
      <ol className="ps-gen-live-timeline">
        {steps.map((label, i) => {
          const state = i < stepIndex ? "done" : i === stepIndex ? "current" : "pending";
          return (
            <li key={label} className={`is-${state}`}>
              <span className="ps-gen-live-marker" aria-hidden>
                {state === "done" ? "✓" : state === "current" ? "●" : "○"}
              </span>
              <span>{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
