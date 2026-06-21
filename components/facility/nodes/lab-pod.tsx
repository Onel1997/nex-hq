"use client";

import { AgentChamber } from "@/components/facility/chambers";
import { getAgentColor } from "@/lib/facility/facility-theme";
import type { AgentId } from "@/lib/constants/agents";
import type { LabSnapshot } from "@/lib/facility/types";
import { memo } from "react";

const LAB_LABELS: Record<Exclude<AgentId, "ceo">, string> = {
  research: "Research Lab",
  designer: "Design Lab",
  marketing: "Marketing Lab",
  content: "Content Lab",
  image: "Image Lab",
  shopify: "Shopify Lab",
};

interface LabPodProps {
  lab: LabSnapshot;
  nodeSize: number;
  selected?: boolean;
  highlighted?: boolean;
  onSelect?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/** @deprecated Use AgentChamber — retained as scene adapter. */
export const LabPod = memo(function LabPod({
  lab,
  selected = false,
  highlighted = false,
  onSelect,
  className,
  style,
}: LabPodProps) {
  const agentId = lab.agentId as Exclude<AgentId, "ceo">;
  const { presence } = lab;

  return (
    <AgentChamber
      agentId={agentId}
      label={LAB_LABELS[agentId]}
      opsState={lab.opsState}
      activity={presence.currentActivity}
      progress={presence.progress}
      progressLabel={presence.progressLabel}
      confidence={presence.confidence}
      thinkingState={presence.thinkingState}
      color={getAgentColor(agentId)}
      selected={selected}
      highlighted={highlighted}
      onSelect={onSelect}
      className={className}
      style={style}
    />
  );
});
