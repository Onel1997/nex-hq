/** Client-safe types for Mission Control V1. */

export type MissionPriority = "Critical" | "High" | "Medium" | "Low";
export type MissionStatus = "Queued" | "Active" | "Review" | "Completed";

export interface MissionControlMission {
  id: string;
  title: string;
  department: string;
  departmentId: string;
  assignedAgent: string;
  priority: MissionPriority;
  status: MissionStatus;
  progress: number | null;
  deadline: string | null;
  outputs: string[];
}

export interface MissionTimelineStage {
  id: string;
  label: string;
  status: "complete" | "active" | "queued" | "blocked";
  missionTitle: string | null;
  dependsOn: string | null;
}

export interface AgentActivityItem {
  id: string;
  department: string;
  message: string;
  time: string;
}

export interface CeoCommandInsight {
  id: string;
  type: "priority" | "bottleneck" | "action" | "decision";
  label: string;
  message: string;
}

export interface MissionControlCommandBar {
  activeMissions: number;
  completedMissions: number;
  criticalTasks: number;
  departmentsOnline: number;
  agentActivity: number;
}

export interface MissionControlPayload {
  commandBar: MissionControlCommandBar;
  missions: MissionControlMission[];
  timeline: MissionTimelineStage[];
  activityFeed: AgentActivityItem[];
  ceoPanel: CeoCommandInsight[];
  futureFeatures: string[];
  loadedAt: string;
}
