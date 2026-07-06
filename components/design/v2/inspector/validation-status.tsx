"use client";

import {
  formatValidationStatusLabel,
  type ArtworkValidationIssue,
  type ArtworkValidationResult,
  type ValidationStatus,
} from "@/lib/design/artwork-validation";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";

interface ValidationStatusBadgeProps {
  status: ValidationStatus;
  className?: string;
}

export function ValidationStatusBadge({ status, className }: ValidationStatusBadgeProps) {
  const Icon =
    status === "checking"
      ? Loader2
      : status === "valid"
        ? CheckCircle2
        : status === "warning"
          ? AlertTriangle
          : status === "invalid"
            ? XCircle
            : null;

  return (
    <span className={cn("dsv2-validation-badge", `is-${status}`, className)}>
      {Icon ? (
        <Icon className={cn("size-3.5", status === "checking" && "animate-spin")} />
      ) : null}
      {formatValidationStatusLabel(status)}
    </span>
  );
}

interface ValidationIssuesListProps {
  issues: ArtworkValidationIssue[];
  className?: string;
}

export function ValidationIssuesList({ issues, className }: ValidationIssuesListProps) {
  if (issues.length === 0) {
    return <p className="dsv2-inspector-placeholder">No issues detected.</p>;
  }

  return (
    <ul className={cn("dsv2-validation-issues", className)}>
      {issues.map((issue) => (
        <li
          key={`${issue.code}-${issue.message}`}
          className={cn("dsv2-validation-issue", `is-${issue.severity}`)}
        >
          {issue.severity === "error" ? (
            <XCircle className="size-3.5 shrink-0" />
          ) : (
            <AlertTriangle className="size-3.5 shrink-0" />
          )}
          <span>{issue.message}</span>
        </li>
      ))}
    </ul>
  );
}

interface ValidationSummaryProps {
  validation: ArtworkValidationResult;
}

export function ValidationSummary({ validation }: ValidationSummaryProps) {
  return (
    <div className="dsv2-validation-summary">
      <ValidationStatusBadge status={validation.status} />
      {validation.status === "invalid" ? (
        <ValidationIssuesList issues={validation.issues.filter((i) => i.severity === "error")} />
      ) : validation.status === "warning" ? (
        <ValidationIssuesList issues={validation.issues} />
      ) : validation.status === "valid" ? (
        <p className="dsv2-validation-ok">Artwork passed basic production checks.</p>
      ) : validation.status === "checking" ? (
        <p className="dsv2-inspector-placeholder">Running file validation…</p>
      ) : (
        <p className="dsv2-inspector-placeholder">Upload artwork to begin validation.</p>
      )}
    </div>
  );
}
