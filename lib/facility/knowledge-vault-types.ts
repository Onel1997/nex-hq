/** Client-safe types for Knowledge Vault V1. */

export type KnowledgeVaultSectionId =
  | "commerce"
  | "research"
  | "design"
  | "marketing"
  | "agents";

export type KnowledgeVaultSubsection =
  | "revenue"
  | "product_performance"
  | "seasonal"
  | "category"
  | "trends"
  | "competitors"
  | "market"
  | "collections"
  | "moodboards"
  | "color"
  | "campaigns"
  | "hooks"
  | "copy"
  | "missions"
  | "outputs"
  | "decisions";

export type KnowledgeVaultReportStatus =
  | "approved"
  | "pending_review"
  | "draft"
  | "archived"
  | "classified";

export interface KnowledgeVaultReportCard {
  id: string;
  title: string;
  department: string;
  date: string;
  authorAgent: string;
  status: KnowledgeVaultReportStatus;
  sectionId: KnowledgeVaultSectionId;
  subsection: KnowledgeVaultSubsection;
  summary?: string;
  tags?: string[];
}

export interface KnowledgeVaultTimelineEvent {
  id: string;
  message: string;
  department: string;
  timestamp: string;
  kind: "research" | "commerce" | "design" | "marketing" | "agent" | "mission";
}

export interface KnowledgeVaultSection {
  id: KnowledgeVaultSectionId;
  label: string;
  subsections: Array<{ id: KnowledgeVaultSubsection; label: string }>;
  count: number;
}

export interface KnowledgeVaultCommandBar {
  totalEntries: number;
  sectionsIndexed: number;
  agentsContributing: number;
  lastSync: string;
}

export type KnowledgeVaultSearchScope =
  | "products"
  | "reports"
  | "missions"
  | "trends"
  | "agents"
  | "all";

export interface KnowledgeVaultPayload {
  commandBar: KnowledgeVaultCommandBar;
  sections: KnowledgeVaultSection[];
  reports: KnowledgeVaultReportCard[];
  timeline: KnowledgeVaultTimelineEvent[];
  futureModules: string[];
  loadedAt: string;
}
