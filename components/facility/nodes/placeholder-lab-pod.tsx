"use client";

import { ActivityRing } from "@/components/facility/motion";
import type { PlaceholderLabSnapshot } from "@/lib/facility/placeholder-labs";
import { cn } from "@/lib/utils";
import { BarChart3, Package, Settings2, type LucideIcon } from "lucide-react";
import { memo } from "react";

const PLACEHOLDER_ICONS: Record<PlaceholderLabSnapshot["id"], LucideIcon> = {
  operations: Settings2,
  commerce: Package,
  analytics: BarChart3,
};

const OPS_LABELS = {
  idle: "Standby",
  queued: "Queued",
  executing: "Executing",
  review: "Review",
  approved: "Complete",
  error: "Error",
} as const;

interface PlaceholderLabPodProps {
  lab: PlaceholderLabSnapshot;
  nodeSize: number;
  className?: string;
  style?: React.CSSProperties;
}

export const PlaceholderLabPod = memo(function PlaceholderLabPod({
  lab,
  nodeSize,
  className,
  style,
}: PlaceholderLabPodProps) {
  const Icon = PLACEHOLDER_ICONS[lab.id];
  const isActive = lab.opsState === "executing" || lab.opsState === "review";
  const glow = `rgb(${parseInt(lab.color.slice(1, 3), 16)} ${parseInt(lab.color.slice(3, 5), 16)} ${parseInt(lab.color.slice(5, 7), 16)} / 0.45)`;

  return (
    <div
      className={cn(
        "facility-node facility-lab-chamber facility-placeholder-lab",
        `facility-lab-${lab.opsState}`,
        isActive && "facility-lab-active",
        className,
      )}
      style={
        {
          ...style,
          "--agent-color": lab.color,
          "--agent-glow": glow,
        } as React.CSSProperties
      }
      aria-label={`${lab.label} — ${lab.activity}`}
    >
      <ActivityRing
        size={nodeSize}
        state={lab.opsState}
        progress={lab.progress}
        agentColor={lab.color}
      />

      <div className="facility-lab-glow" aria-hidden />
      <div className="facility-lab-chamber-inner">
        <div className="facility-lab-header">
          <Icon
            className="facility-lab-icon"
            strokeWidth={1.5}
            style={{ color: lab.color }}
          />
          <span
            className={cn(
              "facility-lab-state-badge",
              `facility-lab-state-${lab.opsState}`,
            )}
          >
            {OPS_LABELS[lab.opsState]}
          </span>
        </div>

        <p className="facility-lab-name">{lab.label}</p>
        <p className="facility-lab-activity">{lab.activity}</p>

        <div className="facility-lab-progress-row">
          {lab.progressLabel ? (
            <span className="facility-lab-progress-label">
              {lab.progressLabel}
            </span>
          ) : (
            <span className="facility-lab-progress-label facility-lab-progress-muted">
              —
            </span>
          )}
          {lab.progress !== null && lab.opsState === "executing" && (
            <div className="facility-lab-progress-bar">
              <div
                className="facility-lab-progress-fill"
                style={{
                  width: `${lab.progress}%`,
                  background: `linear-gradient(90deg, ${lab.color}, color-mix(in srgb, ${lab.color} 60%, white))`,
                }}
              />
            </div>
          )}
        </div>

        {lab.confidence !== null && (
          <p className="facility-lab-confidence-row">
            Confidence {lab.confidence}%
          </p>
        )}
      </div>
    </div>
  );
});
