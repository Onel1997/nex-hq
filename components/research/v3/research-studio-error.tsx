"use client";

import type { ResearchRunError } from "./types";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ResearchStudioErrorProps {
  error: ResearchRunError;
  onRetry: () => void;
  onDismiss: () => void;
}

export function ResearchStudioError({
  error,
  onRetry,
  onDismiss,
}: ResearchStudioErrorProps) {
  return (
    <div className="rs3-error" role="alert">
      <div className="rs3-error-glow" aria-hidden />
      <div className="rs3-error-panel">
        <div className="rs3-error-header">
          <span className="rs3-error-icon-wrap">
            <AlertTriangle className="size-4" />
          </span>
          <div>
            <h2 className="rs3-error-title">Research could not complete</h2>
            {error.stage ? (
              <p className="rs3-error-stage">Stage: {error.stage}</p>
            ) : null}
          </div>
        </div>

        <p className="rs3-error-message">{error.message}</p>

        {error.sourceErrors && error.sourceErrors.length > 0 ? (
          <div className="rs3-error-sources">
            <p className="rs3-error-sources-label">Source issues</p>
            <ul>
              {error.sourceErrors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rs3-error-actions">
          <button
            type="button"
            className="rs3-btn rs3-btn-primary"
            onClick={onRetry}
          >
            <RotateCcw className="size-3.5" />
            Retry research
          </button>
          <button
            type="button"
            className="rs3-btn rs3-btn-ghost"
            onClick={onDismiss}
          >
            Edit prompt
          </button>
        </div>
      </div>
    </div>
  );
}
