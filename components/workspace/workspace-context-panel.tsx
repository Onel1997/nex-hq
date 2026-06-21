"use client";

import { AgentTimeline } from "@/components/facility/inspector/agent-timeline";
import type { AgentId } from "@/lib/constants/agents";
import type { LabInspectorData } from "@/lib/facility/types";
import { Loader2 } from "lucide-react";

interface WorkspaceContextPanelProps {
  data: LabInspectorData | null;
  loading: boolean;
}

export function WorkspaceContextPanel({
  data,
  loading,
}: WorkspaceContextPanelProps) {
  return (
    <aside className="workspace-context" aria-label="Live context">
      <header className="workspace-context-header">
        <h2 className="workspace-context-title">Live Context</h2>
      </header>

      <div className="workspace-context-body">
        {loading && !data ? (
          <div className="workspace-context-loading">
            <Loader2 className="size-4 animate-spin" />
            <span>Syncing…</span>
          </div>
        ) : data ? (
          <>
            <div
              className={`workspace-context-status workspace-context-status-${data.opsState}`}
            >
              <span className="workspace-context-status-pulse" aria-hidden />
              <span>{data.opsState}</span>
            </div>

            <div className="workspace-context-block">
              <p className="workspace-context-block-label">Current Mission</p>
              <p className="workspace-context-block-text">
                {data.currentTask?.title ?? "No active mission"}
              </p>
            </div>

            {data.reports.length > 0 ? (
              <div className="workspace-context-block">
                <p className="workspace-context-block-label">Latest Report</p>
                <p className="workspace-context-block-text">
                  {data.reports[0].title}
                </p>
              </div>
            ) : null}

            {data.taskQueue.filter(
              (t) => t.status !== "completed" && t.status !== "failed",
            ).length > 0 ? (
              <div className="workspace-context-block">
                <p className="workspace-context-block-label">Active Tasks</p>
                <ul className="workspace-context-list">
                  {data.taskQueue
                    .filter(
                      (t) =>
                        t.status !== "completed" && t.status !== "failed",
                    )
                    .slice(0, 4)
                    .map((task) => (
                      <li key={task.id}>
                        <span>{task.title}</span>
                        <span className="workspace-context-meta">
                          {task.status}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : (
          <p className="workspace-context-empty">No live context available</p>
        )}
      </div>
    </aside>
  );
}

interface WorkspaceTimelineProps {
  agentId: AgentId;
  data: LabInspectorData | null;
}

export function WorkspaceTimeline({ agentId, data }: WorkspaceTimelineProps) {
  return (
    <footer className="workspace-timeline" aria-label="Activity timeline">
      <div className="workspace-timeline-header">
        <span className="workspace-timeline-label">Activity</span>
      </div>
      <div className="workspace-timeline-body">
        {data?.timeline.length ? (
          <AgentTimeline items={data.timeline} agentId={agentId} compact />
        ) : (
          <p className="workspace-timeline-empty">No recent activity</p>
        )}
      </div>
    </footer>
  );
}
