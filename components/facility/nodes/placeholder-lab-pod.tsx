"use client";

import { AgentChamber } from "@/components/facility/chambers";
import type { PlaceholderLabSnapshot } from "@/lib/facility/placeholder-labs";
import { memo } from "react";

interface PlaceholderLabPodProps {
  lab: PlaceholderLabSnapshot;
  nodeSize: number;
  interactive?: boolean;
  onEnter?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/** @deprecated Use AgentChamber — retained as scene adapter. */
export const PlaceholderLabPod = memo(function PlaceholderLabPod({
  lab,
  interactive = false,
  onEnter,
  className,
  style,
}: PlaceholderLabPodProps) {
  return (
    <AgentChamber
      agentId={lab.id}
      label={lab.label}
      opsState={lab.opsState}
      activity={lab.activity}
      progress={lab.progress}
      progressLabel={lab.progressLabel}
      confidence={lab.confidence}
      color={lab.color}
      interactive={interactive}
      onEnter={onEnter}
      className={className}
      style={style}
    />
  );
});
