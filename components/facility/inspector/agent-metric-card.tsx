"use client";

import type { AgentId } from "@/lib/constants/agents";
import { getAgentColor } from "@/lib/facility/facility-theme";
import { cn } from "@/lib/utils";
import { memo } from "react";

interface AgentMetricCardProps {
  label: string;
  value: string | number;
  agentId?: AgentId;
  suffix?: string;
  className?: string;
}

export const AgentMetricCard = memo(function AgentMetricCard({
  label,
  value,
  agentId,
  suffix,
  className,
}: AgentMetricCardProps) {
  const accent = agentId ? getAgentColor(agentId) : "#FFD166";

  return (
    <div
      className={cn("facility-agent-metric-card", className)}
      style={{ "--agent-accent": accent } as React.CSSProperties}
    >
      <span className="facility-agent-metric-label">{label}</span>
      <span className="facility-agent-metric-value">
        {value}
        {suffix ? (
          <span className="facility-agent-metric-suffix">{suffix}</span>
        ) : null}
      </span>
    </div>
  );
});

interface AgentMetricsGridProps {
  agentId: AgentId;
  metrics: {
    confidence: number | null;
    reportCount: number;
    activeTaskCount: number;
    approvedReportCount: number;
  };
}

export const AgentMetricsGrid = memo(function AgentMetricsGrid({
  agentId,
  metrics,
}: AgentMetricsGridProps) {
  return (
    <div className="facility-agent-metrics-grid">
      <AgentMetricCard
        agentId={agentId}
        label="Confidence"
        value={
          metrics.confidence != null
            ? Math.round(metrics.confidence * 100)
            : "—"
        }
        suffix={metrics.confidence != null ? "%" : undefined}
      />
      <AgentMetricCard
        agentId={agentId}
        label="Reports"
        value={metrics.reportCount}
      />
      <AgentMetricCard
        agentId={agentId}
        label="Active Tasks"
        value={metrics.activeTaskCount}
      />
      <AgentMetricCard
        agentId={agentId}
        label="Approved"
        value={metrics.approvedReportCount}
      />
    </div>
  );
});
