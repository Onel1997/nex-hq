/** Client-safe types for Reports Center V1. */

import type { ReportAgentTab, ReportSource } from "@/lib/reports/report-source";

export type ReportsCenterSource = ReportSource;
export type ReportsCenterAgentTab = ReportAgentTab;

export type ReportsCenterType =
  | "commerce"
  | "research"
  | "design"
  | "marketing"
  | "ceo_briefing"
  | "mission_summary";

export type ReportsCenterStatus =
  | "approved"
  | "pending_review"
  | "draft"
  | "archived"
  | "classified";

export interface ReportsCenterLinkedMission {
  id: string;
  title: string;
}

export interface ReportsCenterPreview {
  executiveSummary: string;
  keyFindings: string[];
  recommendations: string[];
  linkedMissions: ReportsCenterLinkedMission[];
  connectedDepartments: string[];
}

export interface ReportsCenterReport {
  id: string;
  title: string;
  department: string;
  agent: string;
  date: string;
  status: ReportsCenterStatus;
  confidence: number;
  tags: string[];
  type: ReportsCenterType;
  source: ReportsCenterSource;
  agentTab: ReportsCenterAgentTab;
  isCeoBriefing?: boolean;
  preview: ReportsCenterPreview;
}

export interface ReportsCenterAgentTabFilter {
  id: ReportsCenterAgentTab | "all";
  label: string;
  count: number;
}

export interface ReportsCenterSourceFilter {
  id: ReportsCenterSource | "all";
  label: string;
  count: number;
}

/** @deprecated Use agentTabs — kept for activity feed kinds */
export interface ReportsCenterTypeFilter {
  id: ReportsCenterType | "all";
  label: string;
  count: number;
}

export interface ReportsCenterActivityItem {
  id: string;
  message: string;
  department: string;
  timestamp: string;
  kind: ReportsCenterType | "mission";
}

export interface ReportsCenterCommandBar {
  totalReports: number;
  liveReports: number;
  approved: number;
  pendingReview: number;
  legacyArchived: number;
  lastSync: string;
}

export interface ReportsCenterPayload {
  commandBar: ReportsCenterCommandBar;
  agentTabs: ReportsCenterAgentTabFilter[];
  sourceFilters: ReportsCenterSourceFilter[];
  reports: ReportsCenterReport[];
  legacyArchive: ReportsCenterReport[];
  activityFeed: ReportsCenterActivityItem[];
  exportModules: string[];
  loadedAt: string;
}
