"use client";

import {
  phaseAtLeast,
  type FacilityStartup,
} from "@/components/facility/hooks/use-facility-startup";
import { useFacilityAmbience } from "@/components/facility/hooks/use-facility-ambience";
import { useFacilityReactions } from "@/components/facility/hooks/use-facility-reactions";
import {
  navigationTransform,
  useFacilityNavigation,
} from "@/components/facility/hooks/use-facility-navigation";
import { CeoCommandBanner } from "@/components/facility/hud/ceo-command-banner";
import { BrainCore } from "@/components/facility/nodes/brain-core";
import { CeoCore } from "@/components/facility/nodes/ceo-core";
import { LabPod } from "@/components/facility/nodes/lab-pod";
import { PlaceholderLabPod } from "@/components/facility/nodes/placeholder-lab-pod";
import { FacilityBackdrop } from "@/components/facility/scene/facility-backdrop";
import { FacilityStartupOverlay } from "@/components/facility/scene/facility-startup-overlay";
import { SPECIALIST_AGENT_IDS, type AgentId } from "@/lib/constants/agents";
import {
  depthAtmosphere,
  FACILITY_COMPOSITION_OFFSET,
  getNodeLayout,
} from "@/lib/facility/layout";
import { FACILITY_SILENT_CORE } from "@/lib/facility/silent-core";
import type { FacilityNodeLayout } from "@/lib/facility/types";
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

function nodeDepthClasses(layout: FacilityNodeLayout) {
  return cn(
    `facility-depth-${layout.depth}`,
    `facility-tier-${layout.tier}`,
  );
}

function nodeStyle(
  id: Parameters<typeof getNodeLayout>[0],
  zIndex?: number,
) {
  const layout = getNodeLayout(id);
  const atmosphere = depthAtmosphere(layout.depth);
  return {
    left: `${layout.left}%`,
    top: `${layout.top}%`,
    width: layout.size,
    height: layout.size,
    transform: `translate(-50%, -50%) translateZ(${atmosphere.translateZ}px) scale(${atmosphere.scale})`,
    zIndex: (zIndex ?? 2) + atmosphere.zBias,
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
        FACILITY_SILENT_CORE && "facility-scene-silent-core",
        isChamberNav && "facility-scene-nav-chamber",
        isCeoChamber && "facility-scene-nav-ceo-chamber",
      )}
    >
      <motion.div
        className="facility-composition"
        animate={{
          x: `${FACILITY_COMPOSITION_OFFSET.x}%`,
          y: `${FACILITY_COMPOSITION_OFFSET.y}%`,
        }}
        transition={{ type: "spring", damping: 26, stiffness: 160 }}
      >
        <FacilityBackdrop />

        <motion.div
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
          className={cn(
            "facility-scene-node-wrap facility-scene-brain-wrap",
            nodeDepthClasses(getNodeLayout("brain")),
          )}
          data-facility-node="brain"
        >
          <BrainCore
            stats={data.brain}
            labs={data.labs}
            pulse={brainPulse}
            pulseIntensity={pulseIntensity}
            networkPulse={networkPulse}
            networkSurge={networkSurge}
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
          className={cn(
            "facility-scene-node-wrap facility-scene-ceo-wrap",
            nodeDepthClasses(getNodeLayout("ceo")),
          )}
          data-facility-node="ceo"
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
              nodeDepthClasses(getNodeLayout(agentId)),
              isFocused && "facility-scene-node-focused facility-scene-chamber-active",
              ambientPulse?.agentId === agentId && "facility-scene-node-ambient",
            )}
            data-facility-node={agentId}
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
            className={cn(
              "facility-scene-node-wrap",
              nodeDepthClasses(getNodeLayout(labId)),
            )}
            data-facility-node={labId}
          >
            <PlaceholderLabPod
              lab={PLACEHOLDER_LABS[labId]}
              nodeSize={getNodeLayout(labId).size}
            />
          </motion.div>
        ))}

        <CeoCommandBanner decisions={ceoDecisions} />
        </motion.div>
      </motion.div>

      <FacilityStartupOverlay
        phase={startup.phase}
        progress={startup.progress}
      />
    </div>
  );
}
