import "server-only";

import type { AgentId } from "@/lib/constants/agents";
import { AGENT_IDS } from "@/lib/constants/agents";
import type { FacilitySnapshot, LabSnapshot } from "@/lib/facility/types";
import type {
  AgentActivityItem,
  CeoCommandInsight,
  MissionControlCommandBar,
  MissionControlMission,
  MissionControlPayload,
  MissionPriority,
  MissionStatus,
  MissionTimelineStage,
} from "@/lib/facility/mission-control-types";
import { AGENT_STUDIO_NAMES } from "@/lib/workspace/agent-routes";
import type { TaskListItem, TaskPriority, TaskStatus } from "@/tasks/types";

const TIMELINE_ORDER: Array<{ id: AgentId; label: string }> = [
  { id: "research", label: "Research" },
  { id: "designer", label: "Design" },
  { id: "image", label: "Image" },
  { id: "content", label: "Content" },
  { id: "marketing", label: "Marketing" },
];

const DEPARTMENT_EXAMPLES: Record<
  AgentId | "commerce" | "shopify",
  { title: string; status: MissionStatus; progress: number | null }
> = {
  designer: {
    title: "Summer Capsule Collection",
    status: "Active",
    progress: 72,
  },
  research: {
    title: "Streetwear Trend Analysis",
    status: "Review",
    progress: 90,
  },
  commerce: {
    title: "Historical Commerce Analysis",
    status: "Completed",
    progress: 100,
  },
  marketing: {
    title: "Summer Campaign Launch",
    status: "Queued",
    progress: null,
  },
  shopify: {
    title: "Store Optimization",
    status: "Active",
    progress: 45,
  },
  ceo: { title: "Strategic Review", status: "Active", progress: 30 },
  content: { title: "Drop Copy Package", status: "Queued", progress: null },
  image: { title: "Lookbook Visual Direction", status: "Queued", progress: null },
};

function agentCatalogName(id: AgentId): string {
  const names: Record<AgentId, string> = {
    ceo: "CEO Agent",
    research: "Research Agent",
    designer: "Design Agent",
    content: "Content Agent",
    image: "Image Agent",
    marketing: "Marketing Agent",
    shopify: "Shopify Agent",
  };
  return names[id];
}

function mapPriority(priority: TaskPriority): MissionPriority {
  switch (priority) {
    case "urgent":
      return "Critical";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    default:
      return "Low";
  }
}

function mapStatus(status: TaskStatus): MissionStatus {
  switch (status) {
    case "pending":
      return "Queued";
    case "assigned":
    case "in_progress":
      return "Active";
    case "review":
      return "Review";
    case "completed":
      return "Completed";
    default:
      return "Active";
  }
}

function progressFromTask(task: TaskListItem, lab?: LabSnapshot): number | null {
  const payloadProgress =
    typeof task.payload?.progress === "number" ? task.payload.progress : null;
  if (payloadProgress != null) return Math.min(100, Math.max(0, payloadProgress));
  if (lab?.presence.progress != null) return lab.presence.progress;

  switch (task.status) {
    case "completed":
      return 100;
    case "review":
      return 85;
    case "in_progress":
      return 55;
    case "assigned":
      return 20;
    case "pending":
      return 0;
    default:
      return null;
  }
}

function deadlineFromTask(task: TaskListItem): string | null {
  const payloadDeadline = task.payload?.deadline;
  if (typeof payloadDeadline === "string") return payloadDeadline;
  if (task.completedAt) return task.completedAt;
  return task.updatedAt;
}

function taskToMission(
  task: TaskListItem,
  labs: FacilitySnapshot["labs"],
): MissionControlMission {
  const agentId = task.assigneeAgentId ?? "ceo";
  const lab = task.assigneeAgentId ? labs[task.assigneeAgentId] : labs.ceo;
  const department =
    task.assigneeAgentId != null
      ? AGENT_STUDIO_NAMES[task.assigneeAgentId]
      : "CEO Command";

  const outputs: string[] = [];
  if (lab?.latestReport) {
    outputs.push(lab.latestReport.title);
  }
  if (task.status === "completed" && task.description) {
    outputs.push("Mission deliverables archived");
  }

  return {
    id: task.id,
    title: task.title,
    department,
    departmentId: agentId,
    assignedAgent:
      task.assigneeAgentId != null
        ? agentCatalogName(task.assigneeAgentId)
        : "CEO Agent",
    priority: mapPriority(task.priority),
    status: mapStatus(task.status),
    progress: progressFromTask(task, lab ?? undefined),
    deadline: deadlineFromTask(task),
    outputs,
  };
}

function deriveLabMission(
  id: AgentId | "commerce" | "shopify",
  lab: LabSnapshot | null,
  example: (typeof DEPARTMENT_EXAMPLES)[keyof typeof DEPARTMENT_EXAMPLES],
): MissionControlMission {
  const title =
    lab?.activeTask?.title ??
    (lab?.presence.currentActivity &&
    !lab.presence.currentActivity.startsWith("Awaiting")
      ? lab.presence.currentActivity
      : example.title);

  const status = lab?.activeTask
    ? mapStatus(lab.activeTask.status)
    : lab?.opsState === "review"
      ? "Review"
      : lab?.opsState === "executing"
        ? "Active"
        : lab?.opsState === "approved"
          ? "Completed"
          : example.status;

  const department =
    id === "commerce"
      ? "Commerce Lab"
      : id === "shopify"
        ? AGENT_STUDIO_NAMES.shopify
        : AGENT_STUDIO_NAMES[id as AgentId] ?? String(id);

  return {
    id: `derived-${id}`,
    title,
    department,
    departmentId: id,
    assignedAgent:
      id === "commerce"
        ? "Commerce Intelligence"
        : agentCatalogName(id as AgentId),
    priority: status === "Review" ? "High" : status === "Active" ? "Medium" : "Low",
    status,
    progress: lab?.presence.progress ?? example.progress,
    deadline: lab?.activeTask?.updatedAt ?? null,
    outputs: lab?.latestReport ? [lab.latestReport.title] : [],
  };
}

function buildMissions(
  tasks: TaskListItem[],
  snapshot: FacilitySnapshot,
): MissionControlMission[] {
  const fromTasks = tasks.map((t) => taskToMission(t, snapshot.labs));
  const taskDepts = new Set(fromTasks.map((m) => m.departmentId));

  const derived: MissionControlMission[] = [];

  for (const agentId of AGENT_IDS) {
    if (taskDepts.has(agentId)) continue;
    const lab = snapshot.labs[agentId];
    if (lab.opsState === "idle" && !lab.activeTask) continue;
    derived.push(
      deriveLabMission(agentId, lab, DEPARTMENT_EXAMPLES[agentId]),
    );
  }

  if (!taskDepts.has("shopify") && !derived.some((m) => m.departmentId === "shopify")) {
    derived.push(
      deriveLabMission(
        "shopify",
        snapshot.labs.shopify,
        DEPARTMENT_EXAMPLES.shopify,
      ),
    );
  }

  if (!taskDepts.has("commerce")) {
    derived.push(
      deriveLabMission("commerce", null, DEPARTMENT_EXAMPLES.commerce),
    );
  }

  if (fromTasks.length === 0 && derived.length === 0) {
    return [
      deriveLabMission("designer", snapshot.labs.designer, DEPARTMENT_EXAMPLES.designer),
      deriveLabMission("research", snapshot.labs.research, DEPARTMENT_EXAMPLES.research),
      deriveLabMission("commerce", null, DEPARTMENT_EXAMPLES.commerce),
      deriveLabMission("marketing", snapshot.labs.marketing, DEPARTMENT_EXAMPLES.marketing),
      deriveLabMission("shopify", snapshot.labs.shopify, DEPARTMENT_EXAMPLES.shopify),
    ];
  }

  return [...fromTasks, ...derived];
}

function buildCommandBar(
  missions: MissionControlMission[],
  snapshot: FacilitySnapshot,
): MissionControlCommandBar {
  return {
    activeMissions: missions.filter((m) => m.status === "Active" || m.status === "Review")
      .length,
    completedMissions: missions.filter((m) => m.status === "Completed").length,
    criticalTasks: missions.filter((m) => m.priority === "Critical").length,
    departmentsOnline: Object.values(snapshot.labs).filter(
      (lab) => lab.opsState !== "idle",
    ).length,
    agentActivity: snapshot.telemetry.activeExecutions + snapshot.events.length,
  };
}

function buildTimeline(missions: MissionControlMission[]): MissionTimelineStage[] {
  return TIMELINE_ORDER.map((stage, index) => {
    const stageMission = missions.find(
      (m) => m.departmentId === stage.id && m.status !== "Completed",
    );
    const completedMission = missions.find(
      (m) => m.departmentId === stage.id && m.status === "Completed",
    );

    let status: MissionTimelineStage["status"] = "queued";
    if (completedMission && !stageMission) status = "complete";
    else if (stageMission?.status === "Review") status = "blocked";
    else if (stageMission?.status === "Active") status = "active";
    else if (stageMission?.status === "Queued") status = "queued";
    else if (completedMission) status = "complete";

    const prevStage = TIMELINE_ORDER[index - 1];
    const prevComplete =
      !prevStage ||
      missions.some(
        (m) =>
          m.departmentId === prevStage.id &&
          (m.status === "Completed" || m.status === "Review"),
      );

    if (stageMission && !prevComplete && index > 0) {
      status = "blocked";
    }

    return {
      id: stage.id,
      label: stage.label,
      status,
      missionTitle: stageMission?.title ?? completedMission?.title ?? null,
      dependsOn: index > 0 ? TIMELINE_ORDER[index - 1]!.label : null,
    };
  });
}

function buildActivityFeed(snapshot: FacilitySnapshot): AgentActivityItem[] {
  const fromEvents: AgentActivityItem[] = snapshot.events.slice(0, 6).map((e) => ({
    id: e.id,
    department:
      e.actorType === "agent"
        ? AGENT_STUDIO_NAMES[e.actorId as AgentId] ?? e.actorId
        : "HQ",
    message: e.summary,
    time: e.timestamp,
  }));

  if (fromEvents.length >= 4) return fromEvents;

  const labFeed: AgentActivityItem[] = [];
  const feedTemplates: Array<{ id: AgentId | "commerce"; msg: string }> = [
    { id: "research", msg: "Trend report delivered." },
    { id: "commerce", msg: "Revenue analysis complete." },
    { id: "designer", msg: "Collection concepts generated." },
    { id: "marketing", msg: "Campaign queued." },
    { id: "shopify", msg: "Catalog sync active." },
    { id: "content", msg: "Product copy drafted." },
  ];

  for (const tpl of feedTemplates) {
    const lab = tpl.id === "commerce" ? null : snapshot.labs[tpl.id];
    const activity = lab?.presence.currentActivity;
    labFeed.push({
      id: `feed-${tpl.id}`,
      department:
        tpl.id === "commerce" ? "Commerce Lab" : AGENT_STUDIO_NAMES[tpl.id],
      message:
        activity && activity !== "Awaiting deployment" ? activity : tpl.msg,
      time: snapshot.refreshedAt,
    });
  }

  return [...fromEvents, ...labFeed].slice(0, 8);
}

function buildCeoPanel(missions: MissionControlMission[]): CeoCommandInsight[] {
  const insights: CeoCommandInsight[] = [];
  let id = 0;

  const priorityMission = [...missions]
    .sort((a, b) => {
      const p = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      return p[b.priority] - p[a.priority];
    })
    .find((m) => m.status === "Active" || m.status === "Review");

  if (priorityMission) {
    insights.push({
      id: `ceo-${++id}`,
      type: "priority",
      label: "High Priority",
      message: priorityMission.title,
    });
  }

  const reviewBacklog = missions.filter((m) => m.status === "Review");
  if (reviewBacklog.length > 0) {
    insights.push({
      id: `ceo-${++id}`,
      type: "bottleneck",
      label: "Bottleneck",
      message: `${reviewBacklog[0]!.department} awaiting review — ${reviewBacklog[0]!.title}`,
    });
  }

  const contentWaiting = missions.find(
    (m) => m.departmentId === "content" && m.status === "Queued",
  );
  const designActive = missions.find(
    (m) => m.departmentId === "designer" && m.status === "Active",
  );
  if (contentWaiting && designActive) {
    insights.push({
      id: `ceo-${++id}`,
      type: "bottleneck",
      label: "Bottleneck",
      message: "Marketing assets missing — content blocked on design output.",
    });
  }

  const imageQueued = missions.find(
    (m) => m.departmentId === "image" && m.status === "Queued",
  );
  if (imageQueued) {
    insights.push({
      id: `ceo-${++id}`,
      type: "action",
      label: "Next Action",
      message: "Assign Image Studio.",
    });
  }

  const marketingQueued = missions.find(
    (m) => m.departmentId === "marketing" && m.status === "Queued",
  );
  if (marketingQueued) {
    insights.push({
      id: `ceo-${++id}`,
      type: "decision",
      label: "Recommended Decision",
      message: `Launch ${marketingQueued.title.replace(" Launch", " Collection")}.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: `ceo-${++id}`,
      type: "action",
      label: "Next Action",
      message: "Deploy agents from Facility HQ command dock.",
    });
  }

  return insights.slice(0, 5);
}

export function buildMissionControlPayload(
  snapshot: FacilitySnapshot,
  tasks: TaskListItem[],
): MissionControlPayload {
  const missions = buildMissions(tasks, snapshot);

  return {
    commandBar: buildCommandBar(missions, snapshot),
    missions,
    timeline: buildTimeline(missions),
    activityFeed: buildActivityFeed(snapshot),
    ceoPanel: buildCeoPanel(missions),
    futureFeatures: [
      "Automated Missions",
      "Cross-Agent Workflows",
      "AI Task Routing",
      "Mission Scheduling",
    ],
    loadedAt: new Date().toISOString(),
  };
}
