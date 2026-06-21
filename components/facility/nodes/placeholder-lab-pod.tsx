"use client";

import { AgentChamber } from "@/components/facility/chambers";
import type { PlaceholderLabSnapshot } from "@/lib/facility/placeholder-labs";
import { memo } from "react";

interface PlaceholderLabPodProps {
  lab: PlaceholderLabSnapshot;
  nodeSize: number;
  className?: string;
  style?: React.CSSProperties;
}

/** @deprecated Use AgentChamber — retained as scene adapter. */
export const PlaceholderLabPod = memo(function PlaceholderLabPod({
  lab,
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
      interactive={false}
      className={className}
      style={style}
    />
  );
});
