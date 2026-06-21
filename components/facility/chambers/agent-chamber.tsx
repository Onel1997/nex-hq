"use client";

import { ChamberEnvironment, type ChamberEnvironmentId } from "@/components/facility/chambers/chamber-environment";
import { ChamberReactor } from "@/components/facility/chambers/chamber-reactor";
import type { LabOpsState, ThinkingState } from "@/lib/facility/types";
import { cn } from "@/lib/utils";
import { memo, useRef } from "react";

const OPS_LABELS: Record<LabOpsState, string> = {
  idle: "Standby",
  queued: "Queued",
  executing: "Executing",
  review: "Review",
  approved: "Complete",
  error: "Error",
};

const SINGLE_CLICK_DELAY_MS = 260;

interface AgentChamberProps {
  agentId: ChamberEnvironmentId;
  label: string;
  opsState: LabOpsState;
  activity: string;
  progress?: number | null;
  progressLabel?: string | null;
  confidence?: number | null;
  thinkingState?: ThinkingState;
  color: string;
  selected?: boolean;
  highlighted?: boolean;
  interactive?: boolean;
  onSelect?: () => void;
  onEnter?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const AgentChamber = memo(function AgentChamber({
  agentId,
  label,
  opsState,
  activity,
  progress = null,
  progressLabel = null,
  confidence = null,
  thinkingState = "idle",
  color,
  selected = false,
  highlighted = false,
  interactive = true,
  onSelect,
  onEnter,
  className,
  style,
}: AgentChamberProps) {
  const clickTimerRef = useRef<number | null>(null);
  const isActive = opsState === "executing" || opsState === "review";
  const isThinking = thinkingState !== "idle" && opsState !== "idle";
  const workspaceActive = isActive || opsState === "queued";

  const handleClick = () => {
    if (!onSelect) return;
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      return;
    }
    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null;
      onSelect();
    }, SINGLE_CLICK_DELAY_MS);
  };

  const handleDoubleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    onEnter?.();
  };

  const shell = (
    <>
      <div className="facility-chamber-frame" aria-hidden>
        <div className="facility-chamber-frame-edge facility-chamber-frame-top" />
        <div className="facility-chamber-frame-edge facility-chamber-frame-left" />
        <div className="facility-chamber-frame-edge facility-chamber-frame-right" />
        <div className="facility-chamber-frame-edge facility-chamber-frame-bottom" />
      </div>

      <div className="facility-chamber-viewport">
        <ChamberEnvironment agentId={agentId} opsState={opsState} active={isActive} />
        <div className="facility-chamber-viewport-scanlines" aria-hidden />
        <div className="facility-chamber-viewport-vignette" aria-hidden />
      </div>

      <ChamberReactor state={opsState} progress={progress} color={color} />

      <span
        className={cn(
          "facility-chamber-workspace-badge",
          workspaceActive && "facility-chamber-workspace-badge-active",
        )}
      >
        <span className="facility-chamber-workspace-dot" aria-hidden />
        Studio
      </span>

      {isActive && (
        <div className="facility-chamber-particles" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="facility-chamber-particle"
              style={{ animationDelay: `${i * 0.35}s` }}
            />
          ))}
        </div>
      )}

      <div className="facility-chamber-hud">
        <div className="facility-chamber-hud-top">
          <span className="facility-chamber-callsign">{label}</span>
          <span
            className={cn(
              "facility-chamber-state",
              `facility-chamber-state-${opsState}`,
            )}
          >
            {OPS_LABELS[opsState]}
          </span>
        </div>

        <p className="facility-chamber-thought">
          {isThinking
            ? thinkingState.replace(/_/g, " ")
            : activity}
        </p>

        <div className="facility-chamber-metrics">
          {progressLabel ? (
            <span className="facility-chamber-metric">{progressLabel}</span>
          ) : progress !== null ? (
            <span className="facility-chamber-metric">{progress}%</span>
          ) : null}
          {confidence !== null && (
            <span className="facility-chamber-metric facility-chamber-metric-dim">
              {confidence}% conf
            </span>
          )}
        </div>
      </div>
    </>
  );

  const chamberClass = cn(
    "facility-agent-chamber",
    `facility-agent-chamber-${agentId}`,
    `facility-chamber-${opsState}`,
    isActive && "facility-chamber-active",
    selected && "facility-chamber-selected",
    highlighted && "facility-chamber-highlighted",
    className,
  );

  const chamberStyle = {
    ...style,
    "--chamber-accent": color,
    "--chamber-glow": `color-mix(in srgb, ${color} 55%, transparent)`,
  } as React.CSSProperties;

  if (!interactive) {
    return (
      <div
        className={chamberClass}
        style={chamberStyle}
        aria-label={`${label} — ${activity}`}
      >
        {shell}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cn(chamberClass, "facility-node")}
      style={chamberStyle}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      aria-label={`Open ${label} chamber — double-click to enter studio`}
    >
      {shell}
    </button>
  );
});
