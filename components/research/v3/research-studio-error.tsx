"use client";

import type { ResearchRunError } from "./types";
import { useDictionary } from "@/lib/i18n";
import { AlertTriangle, RotateCcw } from "lucide-react";

function formatReceived(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") {
    return value.length > 120 ? `${value.slice(0, 120)}…` : value;
  }
  try {
    const json = JSON.stringify(value);
    return json.length > 120 ? `${json.slice(0, 120)}…` : json;
  } catch {
    return String(value);
  }
}

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
  const { research } = useDictionary();
  const err = research.studio.error;

  return (
    <div className="rs3-error" role="alert">
      <div className="rs3-error-glow" aria-hidden />
      <div className="rs3-error-panel">
        <div className="rs3-error-header">
          <span className="rs3-error-icon-wrap">
            <AlertTriangle className="size-4" />
          </span>
          <div>
            <h2 className="rs3-error-title">{err.title}</h2>
            {error.stage ? (
              <p className="rs3-error-stage">
                {err.stage}: {error.stage}
              </p>
            ) : null}
          </div>
        </div>

        <p className="rs3-error-message">{error.message}</p>

        {error.missingFields && error.missingFields.length > 0 ? (
          <div className="rs3-error-sources">
            <p className="rs3-error-sources-label">{err.missingFields}</p>
            <ul>
              {error.missingFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {error.validationIssues && error.validationIssues.length > 0 ? (
          <div className="rs3-error-validation">
            <p className="rs3-error-sources-label">
              {err.validationIssues.replace(
                "{count}",
                String(error.validationIssues.length),
              )}
            </p>
            <ul>
              {error.validationIssues.map((issue) => (
                <li key={`${issue.path}-${issue.message}`}>
                  <span className="rs3-error-validation-path">{issue.path}</span>
                  <span className="rs3-error-validation-message">
                    {issue.message}
                  </span>
                  <span className="rs3-error-validation-meta">
                    {err.expected}: {issue.expected}
                    {issue.received !== undefined
                      ? ` · ${err.received}: ${formatReceived(issue.received)}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {error.sourceErrors && error.sourceErrors.length > 0 ? (
          <div className="rs3-error-sources">
            <p className="rs3-error-sources-label">{err.sourceIssues}</p>
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
            {err.retry}
          </button>
          <button
            type="button"
            className="rs3-btn rs3-btn-ghost"
            onClick={onDismiss}
          >
            {err.editPrompt}
          </button>
        </div>
      </div>
    </div>
  );
}
