/**
 * Reports — agent report archive linked to tasks.
 * Bridges Brain memory to the reports module.
 */

import type { AgentId } from "@/lib/constants/agents";
import type { ReportArtifact, ReportStatus } from "@/reports/types";

/** Snapshot of an agent report stored in Brain for long-term context. */
export interface BrainReportContent {
  kind: "reports";
  reportId: string;
  taskId: string;
  agentId: AgentId;
  status: ReportStatus;
  summary: string;
  artifacts: ReportArtifact[];
  confidence: number;
  notes?: string;
  /** Key takeaways indexed for fast agent retrieval. */
  keyFindings?: string[];
}
