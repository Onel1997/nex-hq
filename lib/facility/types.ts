import type { AgentId } from "@/lib/constants/agents";
import type { ReportListItem } from "@/lib/mock/reports";
import type { TaskPriority, TaskStatus } from "@/tasks/types";

export type FacilityLabId = AgentId;

export type LabOpsState =
  | "idle"
  | "queued"
  | "executing"
  | "review"
  | "approved"
  | "error";

export interface FacilityTelemetry {
  live: boolean;
  activeExecutions: number;
  pendingReview: number;
  completedToday: number;
  failedTasks: number;
}

export interface BrainCoreStats {
  totalTasks: number;
  totalReports: number;
  activeExecutions: number;
  completionPct: number;
}

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

export interface LabSnapshot {
  agentId: FacilityLabId;
  label: string;
  opsState: LabOpsState;
  activeTask: LabTaskSnapshot | null;
  latestReport: LabReportSnapshot | null;
  presence: AgentPresence;
}

export interface ReviewQueueItem {
  reportId: string;
  brainRecordId: string;
  title: string;
  agentId: AgentId;
  taskId?: string;
  submittedAt: string;
}

export type FacilityEventCategory =
  | "task"
  | "report"
  | "ceo"
  | "system"
  | "delegation";

export type FacilityEventPriority = "normal" | "high" | "critical";

export interface FacilityEvent {
  id: string;
  type: string;
  timestamp: string;
  actorType: string;
  actorId: string;
  domain: string | null;
  summary: string;
  category?: FacilityEventCategory;
  priority?: FacilityEventPriority;
}

export type GoalCheckpointStatus = "complete" | "active" | "pending";

export interface GoalCheckpoint {
  agentId: "research" | "designer" | "marketing" | "content" | "shopify";
  status: GoalCheckpointStatus;
}

export interface GoalProgress {
  parentGoalTaskId: string;
  founderGoal: string;
  progressPct: number;
  checkpoints: Record<
    "research" | "designer" | "marketing" | "content" | "shopify",
    GoalCheckpoint
  >;
}

export type BrainPulseKind =
  | "none"
  | "task-started"
  | "task-complete"
  | "report-approved"
  | "report-rejected"
  | "final-report"
  | "delegation";

export type PulseIntensity = "small" | "medium" | "large";

export type ThinkingState =
  | "idle"
  | "thinking"
  | "reviewing"
  | "transmitting"
  | "synthesizing";

export interface AgentPresence {
  currentActivity: string;
  progress: number | null;
  progressLabel: string | null;
  confidence: number | null;
  thinkingState: ThinkingState;
}

export type NetworkSurgeMode = "none" | "approval" | "final-report" | "delegation";

export interface TransmissionEvent {
  id: string;
  from: FacilityLabId;
  to: FacilityLabId;
  edgeId: string;
  label: string;
  timestamp: number;
}

export type CeoVerdictMode = "approved" | "revision";

export interface CeoVerdict {
  mode: CeoVerdictMode;
  confidence: number;
  label: string;
  active: boolean;
}

export interface CeoCoreSnapshot {
  opsState: LabOpsState;
  presence: AgentPresence;
  verdict: CeoVerdict | null;
}

export type CeoDecisionType = "assign" | "review" | "verdict";

export interface CeoDecision {
  id: string;
  label: string;
  type: CeoDecisionType;
  targetAgentId?: FacilityLabId;
  timestamp: number;
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

export interface LabInspectorData {
  agentId: FacilityLabId;
  agentName: string;
  role: string;
  opsState: LabOpsState;
  confidence: number | null;
  currentTask: LabTaskSnapshot | null;
  taskQueue: LabTaskSnapshot[];
  reports: LabReportDetail[];
  recentEvents: FacilityEvent[];
  timeline: TimelineItem[];
  knowledgeRefs: KnowledgeRef[];
}

export interface FacilitySnapshot {
  workspace: { id: string; name: string };
  telemetry: FacilityTelemetry;
  brain: BrainCoreStats;
  ceo: CeoCoreSnapshot;
  labs: Record<FacilityLabId, LabSnapshot>;
  reviewQueue: ReviewQueueItem[];
  events: FacilityEvent[];
  goal: GoalProgress | null;
  refreshedAt: string;
}

export interface FacilityNodeLayout {
  id: FacilityLabId | "brain";
  left: number;
  top: number;
  size: number;
}
