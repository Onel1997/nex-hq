"use client";

import { useCanvasSize } from "@/components/facility/hooks/use-canvas-size";
import { useFacilityReactions } from "@/components/facility/hooks/use-facility-reactions";
import { NeuralGraph } from "@/components/facility/neural-graph";
import { BrainCore } from "@/components/facility/nodes/brain-core";
import { LabPod } from "@/components/facility/nodes/lab-pod";
import { FacilityBackdrop } from "@/components/facility/scene/facility-backdrop";
import { AGENT_IDS, type AgentId } from "@/lib/constants/agents";
import { getNodeLayout } from "@/lib/facility/layout";
import type { BrainPulseKind, FacilitySnapshot } from "@/lib/facility/types";
import { useMemo } from "react";

interface FacilitySceneProps {
  data: FacilitySnapshot;
  selectedLabId: AgentId | null;
  highlightedLabs: AgentId[];
  delegationPulse: BrainPulseKind;
  onLabSelect: (agentId: AgentId) => void;
}

function nodeStyle(id: Parameters<typeof getNodeLayout>[0]) {
  const layout = getNodeLayout(id);
  return {
    left: `${layout.left}%`,
    top: `${layout.top}%`,
    width: layout.size,
    height: layout.size,
    transform: "translate(-50%, -50%)",
  } as React.CSSProperties;
}

export function FacilityScene({
  data,
  selectedLabId,
  highlightedLabs,
  delegationPulse,
  onLabSelect,
}: FacilitySceneProps) {
  const { ref, size } = useCanvasSize<HTMLDivElement>();
  const { brainPulse, networkPulse } = useFacilityReactions(
    data.events,
    delegationPulse,
  );

  const highlightedSet = useMemo(
    () => new Set(highlightedLabs),
    [highlightedLabs],
  );

  return (
    <div className="facility-scene">
      <FacilityBackdrop />

      <div ref={ref} className="facility-scene-canvas">
        <NeuralGraph
          width={size.width}
          height={size.height}
          labs={data.labs}
          networkPulse={networkPulse}
        />

        <BrainCore
          stats={data.brain}
          pulse={brainPulse}
          networkPulse={networkPulse}
          style={nodeStyle("brain")}
        />

        {AGENT_IDS.map((agentId) => (
          <LabPod
            key={agentId}
            lab={data.labs[agentId]}
            nodeSize={getNodeLayout(agentId).size}
            selected={selectedLabId === agentId}
            highlighted={highlightedSet.has(agentId)}
            onSelect={() => onLabSelect(agentId)}
            style={nodeStyle(agentId)}
          />
        ))}
      </div>
    </div>
  );
}
