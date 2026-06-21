"use client";

import {
  depthParallaxTranslate,
  useDepthParallax,
} from "@/components/facility/hooks/use-depth-parallax";
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
  FACILITY_COMPOSITION_OFFSET,
  getNodeLayout,
  nodeSceneZIndex,
  depthAtmosphere,
} from "@/lib/facility/layout";
import { FACILITY_SILENT_CORE } from "@/lib/facility/silent-core";
import type { FacilityNodeLayout, FacilitySceneNodeId } from "@/lib/facility/types";
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
  onLabEnter: (agentId: AgentId) => void;
}

function nodeDepthClasses(layout: FacilityNodeLayout) {
  return cn(
    `facility-depth-${layout.depth}`,
    `facility-tier-${layout.tier}`,
  );
}

function nodeStyle(
  id: Parameters<typeof getNodeLayout>[0],
  parallax: ReturnType<typeof useDepthParallax>,
  zIndex?: number,
) {
  const layout = getNodeLayout(id);
  const atmosphere = depthAtmosphere(layout.depth);
  const drift = depthParallaxTranslate(layout.depth, parallax);
  const stackZ =
    zIndex ?? nodeSceneZIndex(id as FacilitySceneNodeId, layout);
  return {
    left: `${layout.left}%`,
    top: `${layout.top}%`,
    width: layout.size,
    height: layout.size,
    transform: `translate(-50%, -50%) translate(${drift}) translateZ(${atmosphere.translateZ}px) scale(${atmosphere.scale})`,
    zIndex: stackZ,
  } as React.CSSProperties;
}

function labZIndex(
  agentId: AgentId,
  labs: FacilitySnapshot["labs"],
): number {
  const layout = getNodeLayout(agentId);
  const state = labs[agentId].opsState;
  const active =
    state === "executing" || state === "review" ? 2 : 0;
  return nodeSceneZIndex(agentId, layout, active);
}

export function FacilityScene({
  data,
  selectedLabId,
  highlightedLabs,
  delegationPulse,
  startup,
  onLabSelect,
  onLabEnter,
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

  const isChamberNav = navigation.mode === "lab-focus";
  const isCeoChamber = navigation.mode === "ceo-focus";
  const parallax = useDepthParallax(
    startup.isComplete && !isChamberNav && !isCeoChamber,
  );

  const fadeIn = (from: Parameters<typeof phaseAtLeast>[1]) =>
    startup.isComplete || phaseAtLeast(startup.phase, from);

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
        {(["background", "midground", "foreground"] as const).flatMap(
          (depthLayer) => {
            const depthLabs = SPECIALIST_AGENT_IDS.filter(
              (id) => getNodeLayout(id).depth === depthLayer,
            );
            const depthPlaceholders = PLACEHOLDER_LAB_IDS.filter(
              (id) => getNodeLayout(id).depth === depthLayer,
            );

            return [
              depthLayer === "midground" ? (
                <motion.div
                  key="brain"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{
                    opacity: fadeIn("brain") ? 1 : 0,
                    scale: fadeIn("brain") ? 1 : 0.7,
                  }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                  style={{
                    ...nodeStyle("brain", parallax),
                    height: getNodeLayout("brain").size,
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
              ) : null,
              ...depthLabs.map((agentId, i) => {
                const isFocused = navigation.focusTarget === agentId;
                return (
                  <motion.div
                    key={agentId}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{
                      opacity: fadeIn("labs")
                        ? isChamberNav && !isFocused
                          ? 0.38
                          : 1
                        : 0,
                      scale: fadeIn("labs") ? (isFocused ? 1.08 : 1) : 0.85,
                      filter:
                        isChamberNav && !isFocused ? "blur(1px)" : "blur(0px)",
                    }}
                    transition={{
                      duration: 0.5,
                      delay: i * 0.06,
                      ease: "easeOut",
                    }}
                    style={nodeStyle(
                      agentId,
                      parallax,
                      labZIndex(agentId, data.labs),
                    )}
                    className={cn(
                      "facility-scene-node-wrap",
                      nodeDepthClasses(getNodeLayout(agentId)),
                      isFocused &&
                        "facility-scene-node-focused facility-scene-chamber-active",
                      ambientPulse?.agentId === agentId &&
                        "facility-scene-node-ambient",
                    )}
                    data-facility-node={agentId}
                  >
                    <LabPod
                      lab={data.labs[agentId]}
                      nodeSize={getNodeLayout(agentId).size}
                      selected={selectedLabId === agentId}
                      highlighted={highlightedSet.has(agentId)}
                      onSelect={() => onLabSelect(agentId)}
                      onEnter={() => onLabEnter(agentId)}
                    />
                  </motion.div>
                );
              }),
              ...depthPlaceholders.map((labId, i) => (
                <motion.div
                  key={labId}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{
                    opacity: fadeIn("labs") ? 1 : 0,
                    scale: fadeIn("labs") ? 1 : 0.85,
                  }}
                  transition={{
                    duration: 0.5,
                    delay: (depthLabs.length + i) * 0.06,
                    ease: "easeOut",
                  }}
                  style={nodeStyle(labId, parallax)}
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
              )),
            ];
          },
        )}

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{
            opacity: fadeIn("ceo") ? 1 : 0,
            y: fadeIn("ceo") ? 0 : -20,
          }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          style={nodeStyle("ceo", parallax)}
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
            onEnter={() => onLabEnter("ceo")}
          />
        </motion.div>

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
