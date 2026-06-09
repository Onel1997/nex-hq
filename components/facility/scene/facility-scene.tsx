"use client";

import {
  phaseAtLeast,
  type FacilityStartup,
} from "@/components/facility/hooks/use-facility-startup";
import { useCanvasSize } from "@/components/facility/hooks/use-canvas-size";
import { useFacilityReactions } from "@/components/facility/hooks/use-facility-reactions";
import { CeoCommandBanner } from "@/components/facility/hud/ceo-command-banner";
import { NeuralGraph } from "@/components/facility/neural-graph";
import { BrainCore } from "@/components/facility/nodes/brain-core";
import { CeoCore } from "@/components/facility/nodes/ceo-core";
import { LabPod } from "@/components/facility/nodes/lab-pod";
import { FacilityBackdrop } from "@/components/facility/scene/facility-backdrop";
import { FacilityStartupOverlay } from "@/components/facility/scene/facility-startup-overlay";
import { SPECIALIST_AGENT_IDS, type AgentId } from "@/lib/constants/agents";
import { getNodeLayout } from "@/lib/facility/layout";
import type { BrainPulseKind, FacilitySnapshot } from "@/lib/facility/types";
import { motion } from "framer-motion";
import { useMemo } from "react";

interface FacilitySceneProps {
  data: FacilitySnapshot;
  selectedLabId: AgentId | null;
  highlightedLabs: AgentId[];
  delegationPulse: BrainPulseKind;
  startup: FacilityStartup;
  onLabSelect: (agentId: AgentId) => void;
}

function nodeStyle(
  id: Parameters<typeof getNodeLayout>[0],
  zIndex?: number,
) {
  const layout = getNodeLayout(id);
  return {
    left: `${layout.left}%`,
    top: `${layout.top}%`,
    width: layout.size,
    height: layout.size,
    transform: "translate(-50%, -50%)",
    zIndex: zIndex ?? 2,
  } as React.CSSProperties;
}

function labZIndex(
  agentId: AgentId,
  labs: FacilitySnapshot["labs"],
): number {
  const state = labs[agentId].opsState;
  if (state === "executing" || state === "review") return 3;
  return 2;
}

export function FacilityScene({
  data,
  selectedLabId,
  highlightedLabs,
  delegationPulse,
  startup,
  onLabSelect,
}: FacilitySceneProps) {
  const { ref, size } = useCanvasSize<HTMLDivElement>();
  const {
    brainPulse,
    pulseIntensity,
    networkPulse,
    networkSurge,
    activeTransmission,
    ceoDecisions,
    verdictPulse,
  } = useFacilityReactions(data.events, delegationPulse);

  const highlightedSet = useMemo(
    () => new Set(highlightedLabs),
    [highlightedLabs],
  );

  const fadeIn = (from: Parameters<typeof phaseAtLeast>[1]) =>
    startup.isComplete || phaseAtLeast(startup.phase, from);

  return (
    <div className="facility-scene facility-scene-depth">
      <FacilityBackdrop />

      <FacilityStartupOverlay
        phase={startup.phase}
        progress={startup.progress}
      />

      <div ref={ref} className="facility-scene-canvas">
        <motion.div
          className="facility-scene-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: fadeIn("synapses") ? 1 : 0 }}
          transition={{ duration: 0.8 }}
        >
          <NeuralGraph
            width={size.width}
            height={size.height}
            labs={data.labs}
            networkPulse={networkPulse}
            networkSurge={networkSurge}
            activeTransmission={activeTransmission}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{
            opacity: fadeIn("brain") ? 1 : 0,
            scale: fadeIn("brain") ? 1 : 0.7,
          }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          style={nodeStyle("brain", 5)}
          className="facility-scene-node-wrap"
        >
          <BrainCore
            stats={data.brain}
            pulse={brainPulse}
            pulseIntensity={pulseIntensity}
            networkPulse={networkPulse}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{
            opacity: fadeIn("ceo") ? 1 : 0,
            y: fadeIn("ceo") ? 0 : -20,
          }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          style={nodeStyle("ceo", 4)}
          className="facility-scene-node-wrap"
        >
          <CeoCore
            ceo={data.ceo}
            verdictPulse={verdictPulse}
            selected={selectedLabId === "ceo"}
            onSelect={() => onLabSelect("ceo")}
          />
        </motion.div>

        {SPECIALIST_AGENT_IDS.map((agentId, i) => (
          <motion.div
            key={agentId}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{
              opacity: fadeIn("labs") ? 1 : 0,
              scale: fadeIn("labs") ? 1 : 0.85,
            }}
            transition={{ duration: 0.5, delay: i * 0.06, ease: "easeOut" }}
            style={nodeStyle(agentId, labZIndex(agentId, data.labs))}
            className="facility-scene-node-wrap"
          >
            <LabPod
              lab={data.labs[agentId]}
              nodeSize={getNodeLayout(agentId).size}
              selected={selectedLabId === agentId}
              highlighted={highlightedSet.has(agentId)}
              onSelect={() => onLabSelect(agentId)}
            />
          </motion.div>
        ))}

        <CeoCommandBanner decisions={ceoDecisions} />
      </div>
    </div>
  );
}
