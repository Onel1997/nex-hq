/**
 * Decisions — decision log with rationale, alternatives, owners, outcomes.
 */

export type DecisionStatus = "proposed" | "approved" | "rejected" | "deferred" | "superseded";

export interface DecisionAlternative {
  option: string;
  pros?: string[];
  cons?: string[];
  rejectedReason?: string;
}

export interface DecisionContent {
  kind: "decisions";
  decisionId: string;
  question: string;
  rationale: string;
  status: DecisionStatus;
  alternatives?: DecisionAlternative[];
  decidedBy: "human" | "ceo" | "agent";
  ownerId?: string;
  outcome?: string;
  relatedTaskIds?: string[];
  relatedReportIds?: string[];
  decidedAt?: string;
}
