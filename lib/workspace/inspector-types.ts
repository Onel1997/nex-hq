import type { AgentId } from "@/lib/constants/agents";
import type { ReportListItem } from "@/lib/mock/reports";
import type { TaskPriority, TaskStatus } from "@/tasks/types";

export type LabOpsState = "idle" | "queued" | "executing" | "review" | "approved" | "error";
export type ThinkingState = "idle" | "thinking" | "reviewing" | "transmitting" | "synthesizing";

export interface LabTaskSnapshot {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  updatedAt: string;
}

export interface LabReportSnapshot {
  id: string;
  title: string;
  status: ReportListItem["status"];
  confidence: number;
  updatedAt: string;
}

export interface AgentPresence {
  currentActivity: string;
  progress: number | null;
  progressLabel: string | null;
  confidence: number | null;
  thinkingState: ThinkingState;
}

export interface LabSnapshot {
  agentId: AgentId;
  label: string;
  opsState: LabOpsState;
  activeTask: LabTaskSnapshot | null;
  latestReport: LabReportSnapshot | null;
  presence: AgentPresence;
}

export type WorkspaceEventCategory = "task" | "report" | "ceo" | "system" | "delegation";
export type WorkspaceEventPriority = "normal" | "high" | "critical";

export interface WorkspaceEvent {
  id: string;
  type: string;
  timestamp: string;
  actorType: string;
  actorId: string;
  domain: string | null;
  summary: string;
  category?: WorkspaceEventCategory;
  priority?: WorkspaceEventPriority;
}

export interface KnowledgeRef {
  id: string;
  title: string;
  domain: "reports" | "tasks";
  updatedAt: string;
}

export interface TimelineItem {
  id: string;
  timestamp: string;
  time: string;
  type: string;
  label: string;
}

export interface LabReportDetail {
  id: string;
  title: string;
  status: ReportListItem["status"];
  confidence: number;
  createdAt: string;
  summary: string;
}

export interface LabInspectorMetrics {
  confidence: number | null;
  reportCount: number;
  activeTaskCount: number;
  approvedReportCount: number;
}

export interface LabInspectorData {
  agentId: AgentId;
  agentName: string;
  role: string;
  opsState: LabOpsState;
  confidence: number | null;
  currentTask: LabTaskSnapshot | null;
  taskQueue: LabTaskSnapshot[];
  reports: LabReportDetail[];
  fullReports: ReportListItem[];
  metrics: LabInspectorMetrics;
  recentEvents: WorkspaceEvent[];
  timeline: TimelineItem[];
  knowledgeRefs: KnowledgeRef[];
}
