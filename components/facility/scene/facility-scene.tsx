"use client";

import {
  phaseAtLeast,
  type FacilityStartup,
} from "@/components/facility/hooks/use-facility-startup";
import { useCanvasSize } from "@/components/facility/hooks/use-canvas-size";
import { useFacilityAmbience } from "@/components/facility/hooks/use-facility-ambience";
import { useFacilityReactions } from "@/components/facility/hooks/use-facility-reactions";
import {
  navigationTransform,
  useFacilityNavigation,
} from "@/components/facility/hooks/use-facility-navigation";
import { CeoCommandBanner } from "@/components/facility/hud/ceo-command-banner";
import { NeuralGraph } from "@/components/facility/neural-graph";
import { BrainCore } from "@/components/facility/nodes/brain-core";
import { CeoCore } from "@/components/facility/nodes/ceo-core";
import { LabPod } from "@/components/facility/nodes/lab-pod";
import { PlaceholderLabPod } from "@/components/facility/nodes/placeholder-lab-pod";
import { FacilityBackdrop } from "@/components/facility/scene/facility-backdrop";
import { FacilityStartupOverlay } from "@/components/facility/scene/facility-startup-overlay";
import { IntelligenceHierarchyBeams } from "@/components/facility/scene/intelligence-hierarchy-beams";
import { KnowledgeFlowOverlay } from "@/components/facility/scene/knowledge-flow-overlay";
import { SPECIALIST_AGENT_IDS, type AgentId } from "@/lib/constants/agents";
import { getNodeLayout } from "@/lib/facility/layout";
import {
  PLACEHOLDER_LAB_IDS,
  PLACEHOLDER_LABS,
} from "@/lib/facility/placeholder-labs";
import type { BrainPulseKind, FacilitySnapshot } from "@/lib/facility/types";
import { cn } from "@/lib/utils";
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
  const { navigation } = useFacilityNavigation();
  const camera = navigationTransform(
    navigation.mode,
    navigation.focusTarget,
  );
  const ambientPulse = useFacilityAmbience(
    data.telemetry.activeExecutions,
    startup.isComplete,
  );

  const {
    brainPulse,
    pulseIntensity,
    networkPulse,
    networkSurge,
    activeTransmission,
    activeKnowledgeFlow,
    ceoDecisions,
    verdictPulse,
  } = useFacilityReactions(data.events, delegationPulse);

  const highlightedSet = useMemo(
    () => new Set(highlightedLabs),
    [highlightedLabs],
  );

  const fadeIn = (from: Parameters<typeof phaseAtLeast>[1]) =>
    startup.isComplete || phaseAtLeast(startup.phase, from);

  const isChamberNav = navigation.mode === "lab-focus";
  const isCeoChamber = navigation.mode === "ceo-focus";

  return (
    <div
      className={cn(
        "facility-scene facility-scene-depth",
        isChamberNav && "facility-scene-nav-chamber",
        isCeoChamber && "facility-scene-nav-ceo-chamber",
      )}
    >
      <FacilityBackdrop />

      <FacilityStartupOverlay
        phase={startup.phase}
        progress={startup.progress}
      />

      <motion.div
        ref={ref}
        className="facility-scene-canvas"
        style={{ perspective: camera.perspective }}
        animate={{
          scale: camera.scale,
          x: `${camera.x}%`,
          y: `${camera.y}%`,
          rotateX: camera.rotateX,
        }}
        transition={{ type: "spring", damping: 26, stiffness: 160 }}
      >
        <motion.div
          className="facility-scene-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: fadeIn("synapses") ? 1 : 0 }}
          transition={{ duration: 0.8 }}
        >
          <IntelligenceHierarchyBeams
            width={size.width}
            height={size.height}
            labs={data.labs}
          />
          <NeuralGraph
            width={size.width}
            height={size.height}
            labs={data.labs}
            networkPulse={networkPulse || Boolean(ambientPulse)}
            networkSurge={networkSurge}
            activeTransmission={activeTransmission}
          />
          <KnowledgeFlowOverlay
            width={size.width}
            height={size.height}
            flow={activeKnowledgeFlow}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{
            opacity: fadeIn("brain") ? 1 : 0,
            scale: fadeIn("brain") ? 1 : 0.7,
          }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          style={{
            ...nodeStyle("brain", 5),
            height: "auto",
            minHeight: getNodeLayout("brain").size,
          }}
          className="facility-scene-node-wrap facility-scene-brain-wrap"
        >
          <BrainCore
            stats={data.brain}
            labs={data.labs}
            pulse={brainPulse}
            pulseIntensity={pulseIntensity}
            networkPulse={networkPulse}
            knowledgeFlow={activeKnowledgeFlow}
            failedTasks={data.telemetry.failedTasks}
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
          className="facility-scene-node-wrap facility-scene-ceo-wrap"
        >
          <CeoCore
            ceo={data.ceo}
            verdictPulse={verdictPulse}
            selected={selectedLabId === "ceo"}
            onSelect={() => onLabSelect("ceo")}
          />
        </motion.div>

        {SPECIALIST_AGENT_IDS.map((agentId, i) => {
          const isFocused = navigation.focusTarget === agentId;
          return (
          <motion.div
            key={agentId}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{
              opacity: fadeIn("labs") ? (isChamberNav && !isFocused ? 0.38 : 1) : 0,
              scale: fadeIn("labs") ? (isFocused ? 1.08 : 1) : 0.85,
              filter: isChamberNav && !isFocused ? "blur(1px)" : "blur(0px)",
            }}
            transition={{ duration: 0.5, delay: i * 0.06, ease: "easeOut" }}
            style={nodeStyle(agentId, labZIndex(agentId, data.labs))}
            className={cn(
              "facility-scene-node-wrap",
              isFocused && "facility-scene-node-focused facility-scene-chamber-active",
              ambientPulse?.agentId === agentId && "facility-scene-node-ambient",
            )}
          >
            <LabPod
              lab={data.labs[agentId]}
              nodeSize={getNodeLayout(agentId).size}
              selected={selectedLabId === agentId}
              highlighted={highlightedSet.has(agentId)}
              onSelect={() => onLabSelect(agentId)}
            />
          </motion.div>
          );
        })}

        {PLACEHOLDER_LAB_IDS.map((labId, i) => (
          <motion.div
            key={labId}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{
              opacity: fadeIn("labs") ? 1 : 0,
              scale: fadeIn("labs") ? 1 : 0.85,
            }}
            transition={{
              duration: 0.5,
              delay: (SPECIALIST_AGENT_IDS.length + i) * 0.06,
              ease: "easeOut",
            }}
            style={nodeStyle(labId, 2)}
            className="facility-scene-node-wrap"
          >
            <PlaceholderLabPod
              lab={PLACEHOLDER_LABS[labId]}
              nodeSize={getNodeLayout(labId).size}
            />
          </motion.div>
        ))}

        <CeoCommandBanner decisions={ceoDecisions} />
      </motion.div>
    </div>
  );
}
