"use client";

import { BrainPulse, GlowPulse } from "@/components/facility/motion";
import type { BrainCoreStats, BrainPulseKind } from "@/lib/facility/types";
import { cn } from "@/lib/utils";

interface BrainCoreProps {
  stats: BrainCoreStats;
  pulse?: BrainPulseKind;
  networkPulse?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function BrainCore({
  stats,
  pulse = "none",
  networkPulse = false,
  className,
  style,
}: BrainCoreProps) {
  return (
    <div
      className={cn("facility-node facility-brain-core", className)}
      style={style}
    >
      <GlowPulse intensity="normal" />
      <BrainPulse kind={pulse} networkPulse={networkPulse} />
      <div className="facility-brain-ring" aria-hidden />
      <div className="facility-node-inner">
        <p className="facility-node-label">Brain Core</p>
        <p className="facility-brain-title">Neural Hub</p>
        <div className="facility-brain-stats">
          <div className="facility-stat">
            <span className="facility-stat-value">{stats.totalTasks}</span>
            <span className="facility-stat-label">Tasks</span>
          </div>
          <div className="facility-stat">
            <span className="facility-stat-value">{stats.totalReports}</span>
            <span className="facility-stat-label">Reports</span>
          </div>
          <div className="facility-stat">
            <span className="facility-stat-value">
              {stats.activeExecutions}
            </span>
            <span className="facility-stat-label">Active</span>
          </div>
          <div className="facility-stat">
            <span className="facility-stat-value">{stats.completionPct}%</span>
            <span className="facility-stat-label">Done</span>
          </div>
        </div>
      </div>
    </div>
  );
}
