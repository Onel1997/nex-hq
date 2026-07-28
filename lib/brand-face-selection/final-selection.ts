/**
 * Final candidate selection — exactly one per archetype selection project.
 * No automatic approval. Conversion creates Draft Persona separately.
 */

import { BrandFaceSelectionError } from "./constants";
import type { BrandFaceSelectionProject } from "./types";

export function selectFinalCandidate(
  project: BrandFaceSelectionProject,
  candidateId: string,
  now = new Date().toISOString(),
): BrandFaceSelectionProject {
  if (project.status !== "candidate_selected") {
    throw new BrandFaceSelectionError(
      "Final selection is only available after A2 validation completes",
      "WORKFLOW",
      { status: project.status },
    );
  }

  if (!project.a2CompletedAt) {
    throw new BrandFaceSelectionError(
      "Final selection requires completed A2 validation",
      "WORKFLOW",
    );
  }

  if (!project.discoveryCandidateIds.includes(candidateId)) {
    throw new BrandFaceSelectionError(
      "Final selection must be a discovery candidate",
      "WORKFLOW",
    );
  }

  if (!project.shortlistCandidateIds.includes(candidateId)) {
    throw new BrandFaceSelectionError(
      "Final selection must be a shortlisted candidate",
      "WORKFLOW",
    );
  }

  if (project.rejectedCandidateIds.includes(candidateId)) {
    throw new BrandFaceSelectionError(
      "Rejected candidates cannot be selected as Brand Face",
      "WORKFLOW",
    );
  }

  if (
    project.selectedCandidateId &&
    project.selectedCandidateId !== candidateId
  ) {
    throw new BrandFaceSelectionError(
      "Exactly one final candidate per archetype selection — deselect first",
      "WORKFLOW",
      { selectedCandidateId: project.selectedCandidateId },
    );
  }

  const reviews = { ...project.candidateReviews };
  for (const id of project.discoveryCandidateIds) {
    const existing = reviews[id];
    if (!existing) continue;
    if (id === candidateId) {
      reviews[id] = { ...existing, decision: "selected" };
      continue;
    }
    if (existing.decision === "selected") {
      reviews[id] = {
        ...existing,
        decision: project.shortlistCandidateIds.includes(id)
          ? "shortlisted"
          : "undecided",
      };
      continue;
    }
    if (existing.decision === "rejected") {
      reviews[id] = { ...existing, decision: "preserved_rejected" };
    }
  }

  return {
    ...project,
    selectedCandidateId: candidateId,
    candidateReviews: reviews,
    // Preserve rejected IDs — never delete.
    rejectedCandidateIds: [...project.rejectedCandidateIds],
    brandFaceApprovalStatus: "not_started",
    updatedAt: now,
  };
}

export function clearFinalCandidate(
  project: BrandFaceSelectionProject,
  now = new Date().toISOString(),
): BrandFaceSelectionProject {
  if (!project.selectedCandidateId) return project;
  const id = project.selectedCandidateId;
  const reviews = { ...project.candidateReviews };
  if (reviews[id]) {
    reviews[id] = {
      ...reviews[id]!,
      decision: project.shortlistCandidateIds.includes(id)
        ? "shortlisted"
        : "undecided",
    };
  }
  return {
    ...project,
    selectedCandidateId: null,
    candidateReviews: reviews,
    updatedAt: now,
  };
}

export function attachDraftPersona(
  project: BrandFaceSelectionProject,
  draftPersonaId: string,
  now = new Date().toISOString(),
): BrandFaceSelectionProject {
  if (!project.selectedCandidateId) {
    throw new BrandFaceSelectionError(
      "Select a final candidate before converting to Draft Persona",
      "WORKFLOW",
    );
  }
  if (project.draftPersonaId && project.draftPersonaId !== draftPersonaId) {
    throw new BrandFaceSelectionError(
      "Draft Persona already attached to this selection project",
      "WORKFLOW",
      { draftPersonaId: project.draftPersonaId },
    );
  }
  return {
    ...project,
    draftPersonaId,
    updatedAt: now,
  };
}

export function assertExactlyOneSelected(
  project: BrandFaceSelectionProject,
): void {
  if (!project.selectedCandidateId) {
    throw new BrandFaceSelectionError(
      "Exactly one final candidate must be selected",
      "WORKFLOW",
    );
  }
  const selectedCount = Object.values(project.candidateReviews).filter(
    (r) => r.decision === "selected",
  ).length;
  if (selectedCount !== 1) {
    throw new BrandFaceSelectionError(
      "Exactly one candidate may have decision=selected",
      "WORKFLOW",
      { selectedCount },
    );
  }
}
