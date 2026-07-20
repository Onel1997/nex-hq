"use client";

import { PersonaStatusChip, type PersonaChipTone } from "@/components/persona/persona-status-chip";
import type { CandidateStatus, PersonaCandidate } from "@/lib/persona/domain/creation-types";

const STATUS_LABEL: Record<string, string> = {
  ready: "READY",
  shortlisted: "SHORTLISTED",
  selected: "SELECTED",
  rejected: "REJECTED",
  needs_manual_references: "REFERENCE",
  queued: "QUEUED",
  generating: "GENERATING",
  failed: "FAILED",
  archived: "ARCHIVED",
  identity_validation_failed: "IDENTITY FAIL",
};

export function candidateStatusLabel(status: CandidateStatus | string): string {
  return STATUS_LABEL[status] ?? String(status).toUpperCase();
}

export function candidateStatusTone(status: CandidateStatus | string): PersonaChipTone {
  switch (status) {
    case "ready":
      return "approved";
    case "shortlisted":
      return "editorial";
    case "selected":
      return "selected";
    case "rejected":
      return "rejected";
    case "needs_manual_references":
      return "reference";
    case "generating":
    case "queued":
      return "commercial";
    default:
      return "muted";
  }
}

export function CandidateStatusBadge({
  candidate,
}: {
  candidate: Pick<PersonaCandidate, "status" | "converted_persona_id">;
}) {
  if (candidate.converted_persona_id) {
    return <PersonaStatusChip label="PRODUCTION" tone="production" />;
  }
  return (
    <PersonaStatusChip
      label={candidateStatusLabel(candidate.status)}
      tone={candidateStatusTone(candidate.status)}
    />
  );
}
