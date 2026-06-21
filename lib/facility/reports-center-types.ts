/** Client-safe types for Reports Center V1. */

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
  isCeoBriefing?: boolean;
  preview: ReportsCenterPreview;
}

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
  approved: number;
  pendingReview: number;
  ceoBriefings: number;
  lastSync: string;
}

export interface ReportsCenterPayload {
  commandBar: ReportsCenterCommandBar;
  types: ReportsCenterTypeFilter[];
  reports: ReportsCenterReport[];
  ceoBriefings: ReportsCenterReport[];
  activityFeed: ReportsCenterActivityItem[];
  exportModules: string[];
  loadedAt: string;
}
