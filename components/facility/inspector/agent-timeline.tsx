"use client";

import { ExecutionTimeline } from "@/components/facility/inspector/execution-timeline";
import type { AgentId } from "@/lib/constants/agents";
import { getAgentColor } from "@/lib/facility/facility-theme";
import type { TimelineItem } from "@/lib/facility/types";
import { memo } from "react";

interface AgentTimelineProps {
  items: TimelineItem[];
  agentId: AgentId;
  compact?: boolean;
}

export const AgentTimeline = memo(function AgentTimeline({
  items,
  agentId,
  compact = false,
}: AgentTimelineProps) {
  const accent = getAgentColor(agentId);

  return (
    <div
      className={compact ? "workspace-timeline-track" : "facility-agent-timeline"}
      style={{ "--agent-accent": accent } as React.CSSProperties}
    >
      <ExecutionTimeline items={items} />
    </div>
  );
});
