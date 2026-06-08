/**
 * Reports — agent report archive linked to tasks.
 * Bridges Brain memory to the reports module.
 */

import type { AgentId } from "@/lib/constants/agents";
import type { ReportArtifact, ReportStatus } from "@/reports/types";

export const RESEARCH_REPORT_TYPES = [
  "competitor",
  "trend",
  "design",
  "pricing",
  "audience",
] as const;

export type ResearchReportType = (typeof RESEARCH_REPORT_TYPES)[number];

/** Structured competitor analysis sections (Research Agent V2). */
export interface BrainCompetitorReportSections {
  positioning: string;
  targetAudience: string;
  pricing: string;
  productCategories: string[];
  marketingStrategy: string;
  communityStrategy: string;
  strengths: string[];
  weaknesses: string[];
  brandOpportunities: string[];
}

/** Structured trend analysis sections (Research Agent V2). */
export interface BrainTrendReportSections {
  trendDescription: string;
  whyItMatters: string;
  adoptionLevel: "nascent" | "emerging" | "mainstream" | "declining";
  relevanceForBrand: string;
  designImplications: string[];
  contentImplications: string[];
}

/** Core research report sections stored separately for retrieval and UI. */
export interface BrainResearchSections {
  executiveSummary: string;
  keyFindings: string[];
  opportunities: string[];
  risks: string[];
  recommendations: string[];
  competitorReport?: BrainCompetitorReportSections;
  trendReport?: BrainTrendReportSections;
}

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
  /** Research Agent V2 — report classification. */
  reportType?: ResearchReportType;
  /** Research Agent V2 — structured section payload. */
  researchSections?: BrainResearchSections;
}
