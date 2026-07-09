import type { ReportListItem } from "@/lib/mock/reports";
import type {
  AgentPresence,
  CeoCoreSnapshot,
  CeoVerdict,
  FacilityEvent,
  LabSnapshot,
} from "@/lib/facility/types";

const CEO_ACTIVITIES = [
  "Analyzing Objective...",
  "Decomposing Founder Goal...",
  "Assigning Specialists...",
  "Reviewing Reports...",
  "Synthesizing Strategy...",
  "Final Verdict Ready...",
] as const;

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function deriveCeoActivity(lab: LabSnapshot): string {
  const { opsState, activeTask, presence } = lab;

  if (presence.thinkingState === "synthesizing") {
    return "Synthesizing Strategy...";
  }
  if (opsState === "review") return "Review Requested";
  if (opsState === "approved") return "Final Verdict Ready...";
  if (opsState === "idle") return "Command Standby";

  const minuteBucket = Math.floor(Date.now() / 40_000);
  const seed = hashSeed(`ceo-${activeTask?.id ?? "none"}-${minuteBucket}`);
  return CEO_ACTIVITIES[seed % CEO_ACTIVITIES.length];
}

function isFinalReportTitle(title: string): boolean {
  const lower = title.toLowerCase();
  return (
    lower.includes("final") ||
    lower.includes("synthesis") ||
    lower.includes("strategy") ||
    lower.includes("verdict")
  );
}

function deriveVerdict(
  reports: ReportListItem[],
  events: FacilityEvent[],
): CeoVerdict | null {
  const recentFinalEvent = events.find(
    (e) =>
      e.type === "ceo.final_report.generated" ||
      e.type === "ceo.final_report.completed",
  );

  const recentReject = events.find(
    (e) =>
      e.type === "report.rejected" ||
      e.type === "report.revision_requested",
  );

  const ceoReports = reports
    .filter((r) => r.agentId === "ceo")
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  const latestFinal = ceoReports.find(
    (r) => isFinalReportTitle(r.title) || r.status !== "draft",
  );

  if (recentReject) {
    return {
      mode: "revision",
      confidence: latestFinal
        ? Math.round(latestFinal.confidence * 100)
        : 67,
      label: "REVISION REQUIRED",
      active: true,
    };
  }

  if (recentFinalEvent || latestFinal) {
    const confidence = latestFinal
      ? Math.round(latestFinal.confidence * 100)
      : 94;
    return {
      mode: "approved",
      confidence,
      label: "APPROVED",
      active: Boolean(recentFinalEvent) || latestFinal?.status === "approved",
    };
  }

  return null;
}

export function deriveCeoCoreState(
  lab: LabSnapshot,
  reports: ReportListItem[],
  events: FacilityEvent[],
): CeoCoreSnapshot {
  const presence: AgentPresence = {
    ...lab.presence,
    currentActivity: deriveCeoActivity(lab),
    thinkingState:
      lab.opsState === "executing" ? "synthesizing" : lab.presence.thinkingState,
  };

  return {
    opsState: lab.opsState,
    presence,
    verdict: deriveVerdict(reports, events),
  };
}
