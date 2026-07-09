import type { AgentId } from "@/lib/constants/agents";

export type ReportStatus =
  | "draft"
  | "pending_review"
  | "submitted"
  | "approved"
  | "rejected"
  | "revision_requested";

export interface ReportArtifact {
  id: string;
  type: "text" | "markdown" | "image" | "json";
  label: string;
  content: string;
  url?: string;
}

export interface AgentReport {
  id: string;
  taskId: string;
  agentId: AgentId;
  status: ReportStatus;
  summary: string;
  artifacts: ReportArtifact[];
  confidence: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitReportInput {
  taskId: string;
  agentId: AgentId;
  summary: string;
  artifacts?: ReportArtifact[];
  confidence?: number;
  notes?: string;
}
