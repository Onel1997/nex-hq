"use client";

import type { AgentId } from "@/lib/constants/agents";
import { getAgentColor } from "@/lib/facility/facility-theme";
import { cn } from "@/lib/utils";
import { memo, type ReactNode } from "react";

interface AgentSectionProps {
  title: string;
  agentId?: AgentId;
  children: ReactNode;
  className?: string;
  empty?: boolean;
  emptyMessage?: string;
}

export const AgentSection = memo(function AgentSection({
  title,
  agentId,
  children,
  className,
  empty,
  emptyMessage = "No data available",
}: AgentSectionProps) {
  const accent = agentId ? getAgentColor(agentId) : undefined;

  return (
    <section
      className={cn("facility-inspector-section facility-lab-room-section", className)}
      style={accent ? ({ "--agent-accent": accent } as React.CSSProperties) : undefined}
    >
      <h3
        className={cn(
          "facility-inspector-section-title",
          agentId && "facility-agent-section-title",
        )}
      >
        {title}
      </h3>
      {empty ? (
        <p className="facility-inspector-empty">{emptyMessage}</p>
      ) : (
        children
      )}
    </section>
  );
});
