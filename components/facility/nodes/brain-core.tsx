"use client";

import {
  BrainPulse,
  BrainReactor,
  GlowPulse,
} from "@/components/facility/motion";
import type {
  BrainCoreStats,
  BrainPulseKind,
  PulseIntensity,
} from "@/lib/facility/types";
import { cn } from "@/lib/utils";
import { memo } from "react";

interface BrainCoreProps {
  stats: BrainCoreStats;
  pulse?: BrainPulseKind;
  pulseIntensity?: PulseIntensity;
  networkPulse?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const BrainCore = memo(function BrainCore({
  stats,
  pulse = "none",
  pulseIntensity = "medium",
  networkPulse = false,
  className,
  style,
}: BrainCoreProps) {
  const isSurge = pulse !== "none";

  return (
    <div
      className={cn(
        "facility-node facility-brain-core facility-brain-core-v2",
        isSurge && "facility-brain-surging",
        className,
      )}
      style={style}
    >
      <BrainReactor intensity={pulseIntensity} surge={isSurge} />
      <GlowPulse intensity="strong" color="rgb(234 242 255 / 0.45)" />
      <BrainPulse
        kind={pulse}
        intensity={pulseIntensity}
        networkPulse={networkPulse}
      />
      <div className="facility-node-inner facility-brain-inner">
        <p className="facility-node-label">Brain Core</p>
        <p className="facility-brain-title">Neural Reactor</p>
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
});
