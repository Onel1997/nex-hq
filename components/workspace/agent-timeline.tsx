"use client";

import { memo } from "react";
import type { AgentId } from "@/lib/constants/agents";
import { getAgentColor } from "@/lib/workspace/agent-theme";
import type { TimelineItem } from "@/lib/workspace/inspector-types";

export const AgentTimeline = memo(function AgentTimeline({
  items,
  agentId,
  compact = false,
}: {
  items: TimelineItem[];
  agentId: AgentId;
  compact?: boolean;
}) {
  if (!items.length) return <p className="workspace-activity-empty">No recent activity</p>;
  return (
    <div className={compact ? "workspace-timeline-track" : "workspace-agent-timeline"} style={{ "--agent-accent": getAgentColor(agentId) } as React.CSSProperties}>
      <ol className="workspace-activity-timeline">
        {items.map((item) => (
          <li key={item.id} className="workspace-activity-item">
            <span className="workspace-activity-time">{item.time}</span>
            <span className="workspace-activity-dot" />
            <div className="workspace-activity-content">
              <span className="workspace-activity-type">{item.type}</span>
              <p className="workspace-activity-label">{item.label}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
});
