"use client";

import { DataFlowParticle } from "@/components/facility/motion/data-flow-particle";
import { EnergyStreamPulse } from "@/components/facility/motion/energy-stream-pulse";
import { TransmissionPacket } from "@/components/facility/motion/transmission-packet";
import {
  buildLabStateMap,
  computeSynapseEdges,
  getBrainCenter,
  type SynapseEdgeComputed,
} from "@/lib/facility/graph";
import { getNodeLayout } from "@/lib/facility/layout";
import type {
  FacilityLabId,
  LabSnapshot,
  NetworkSurgeMode,
  TransmissionEvent,
} from "@/lib/facility/types";
import { motion } from "framer-motion";
import { memo, useMemo } from "react";

interface NeuralGraphProps {
  width: number;
  height: number;
  labs: Record<FacilityLabId, LabSnapshot>;
  networkPulse?: boolean;
  networkSurge?: NetworkSurgeMode;
  activeTransmission?: TransmissionEvent | null;
}

const STROKE_COLORS = {
  ambient: "rgb(56 189 248 / 0.14)",
  active: "rgb(56 189 248 / 0.38)",
  executing: "rgb(34 211 238 / 0.55)",
  error: "rgb(248 113 113 / 0.55)",
  pulse: "rgb(234 242 255 / 0.6)",
  command: "rgb(255 209 102 / 0.22)",
} as const;

const EDGE_PHASE: Record<string, number> = {
  "research-brain": 0,
  "analytics-brain": 1,
  "ceo-brain": 2,
  "image-brain": 3,
  "marketing-brain": 4,
  "shopify-brain": 5,
  "commerce-brain": 6,
  "content-brain": 7,
  "designer-brain": 8,
  "operations-brain": 9,
};

function streamParticleCount(
  edge: SynapseEdgeComputed,
  active: boolean,
  surge: boolean,
): number {
  const isBrainEdge = edge.to === "brain" || edge.from === "brain";
  if (!isBrainEdge) return 0;
  if (edge.flowMode === "error") return 2;
  if (active) return surge ? 4 : 2;
  return 1;
}

function labState(
  id: SynapseEdgeComputed["from"],
  labs: Record<FacilityLabId, LabSnapshot>,
): string | undefined {
  if (id === "brain") return undefined;
  return labs[id as FacilityLabId]?.opsState;
}

function isExecutingEdge(
  edge: SynapseEdgeComputed,
  labs: Record<FacilityLabId, LabSnapshot>,
): boolean {
  return (
    labState(edge.from, labs) === "executing" ||
    labState(edge.to, labs) === "executing"
  );
}

const SynapsePath = memo(function SynapsePath({
  edge,
  networkPulse,
  networkSurge,
  accelerated,
  phase,
}: {
  edge: SynapseEdgeComputed;
  networkPulse?: boolean;
  networkSurge?: NetworkSurgeMode;
  accelerated?: boolean;
  phase: number;
}) {
  const isError = edge.flowMode === "error";
  const isExecuting = edge.flowMode === "to-brain" && accelerated;
  const isCommand = edge.id === "ceo-brain";
  const isBrainEdge = edge.to === "brain" || edge.from === "brain";
  const isSurge = networkSurge !== "none" && networkSurge !== undefined;
  const stroke =
    isSurge && edge.active
      ? networkSurge === "final-report"
        ? "rgb(234 242 255 / 0.75)"
        : STROKE_COLORS.pulse
      : networkPulse && edge.active
        ? STROKE_COLORS.pulse
        : isError
          ? STROKE_COLORS.error
          : isExecuting
            ? STROKE_COLORS.executing
            : isCommand
              ? STROKE_COLORS.command
              : edge.active
                ? STROKE_COLORS.active
                : STROKE_COLORS.ambient;

  const count = streamParticleCount(edge, edge.active, isSurge);
  const isAmbient = !edge.active && !isCommand;
  const flowColor = isCommand
    ? "#FFD166"
    : isError
      ? "#F87171"
      : isExecuting
        ? "#22D3EE"
        : "#38BDF8";

  const dashDirection = edge.flowTowardLab ? -40 : 40;

  return (
    <g>
      <path
        d={edge.path}
        fill="none"
        stroke={stroke}
        strokeWidth={edge.active ? (isExecuting ? 4 : 3) : isAmbient ? 2.5 : 2}
        strokeLinecap="round"
        opacity={edge.active ? 0.12 : isAmbient ? 0.05 : 0.08}
        style={{ filter: "blur(3px)" }}
      />
      <motion.path
        d={edge.path}
        fill="none"
        stroke={stroke}
        strokeWidth={
          edge.active
            ? isExecuting
              ? 2
              : 1.5
            : isCommand
              ? 0.85
              : isAmbient
                ? 0.9
                : 0.75
        }
        strokeLinecap="round"
        strokeDasharray={
          edge.active ? "6 10" : isAmbient ? "3 16" : isCommand ? "3 12" : "2 14"
        }
        animate={
          isError
            ? { strokeDashoffset: [0, dashDirection] }
            : networkPulse && edge.active
              ? { strokeDashoffset: [0, dashDirection] }
              : edge.active || isAmbient || isCommand
                ? { strokeDashoffset: [0, dashDirection] }
                : undefined
        }
        transition={
          isError
            ? {
                strokeDashoffset: {
                  duration: 1.2,
                  repeat: Infinity,
                  ease: "linear",
                },
              }
            : edge.active
              ? {
                  strokeDashoffset: {
                    duration: accelerated ? 0.8 : 2.5,
                    repeat: Infinity,
                    ease: "linear",
                  },
                }
              : isAmbient
                ? {
                    strokeDashoffset: {
                      duration: 5.5,
                      repeat: Infinity,
                      ease: "linear",
                    },
                  }
                : isCommand
                  ? {
                      strokeDashoffset: {
                        duration: 4.5,
                        repeat: Infinity,
                        ease: "linear",
                      },
                    }
                  : undefined
        }
      />
      {isBrainEdge && (
        <EnergyStreamPulse
          path={edge.path}
          phase={phase}
          active={edge.active || isCommand}
          color={flowColor}
          reverse={!edge.flowTowardLab}
        />
      )}
      {Array.from({ length: count }, (_, i) => (
        <DataFlowParticle
          key={`${edge.id}-p-${i}`}
          path={edge.path}
          flowMode={edge.active ? edge.flowMode : "ambient"}
          index={i}
          accelerated={accelerated}
          reverse={!edge.flowTowardLab}
        />
      ))}
    </g>
  );
});

export const NeuralGraph = memo(function NeuralGraph({
  width,
  height,
  labs,
  networkPulse,
  networkSurge = "none",
  activeTransmission,
}: NeuralGraphProps) {
  const edges = useMemo(() => {
    const labStates = buildLabStateMap(labs);
    return computeSynapseEdges(width, height, labStates);
  }, [width, height, labs]);

  const brainMask = useMemo(() => {
    const center = getBrainCenter(width, height);
    const layout = getNodeLayout("brain");
    return {
      cx: center.x,
      cy: center.y,
      rx: layout.size * 0.5,
      ry: layout.size * 0.46,
    };
  }, [width, height]);

  const transmissionPath = useMemo(() => {
    if (!activeTransmission) return null;
    const edge = edges.find((e) => e.id === activeTransmission.edgeId);
    return edge?.path ?? null;
  }, [edges, activeTransmission]);

  const brainCenter = useMemo(
    () => getBrainCenter(width, height),
    [width, height],
  );
  const surgeRadius = Math.min(width, height) * 0.45;

  if (width <= 0 || height <= 0) return null;

  return (
    <svg
      className="facility-neural-graph"
      width={width}
      height={height}
      aria-hidden
    >
      <defs>
        <mask id="facility-brain-convergence-mask">
          <rect width="100%" height="100%" fill="white" />
          <ellipse
            cx={brainMask.cx}
            cy={brainMask.cy}
            rx={brainMask.rx}
            ry={brainMask.ry}
            fill="black"
          />
        </mask>
        <filter id="synapse-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="synapse-glow-strong">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {networkSurge !== "none" && (
        <motion.circle
          cx={brainCenter.x}
          cy={brainCenter.y}
          r={surgeRadius}
          fill="none"
          stroke={
            networkSurge === "final-report"
              ? "rgb(234 242 255 / 0.35)"
              : "rgb(56 189 248 / 0.3)"
          }
          strokeWidth={networkSurge === "final-report" ? 3 : 2}
          initial={{ r: surgeRadius * 0.3, opacity: 0.8 }}
          animate={{ r: surgeRadius * 1.1, opacity: 0 }}
          transition={{
            duration: networkSurge === "final-report" ? 2 : 1.4,
            ease: "easeOut",
          }}
        />
      )}
      <g filter="url(#synapse-glow)" mask="url(#facility-brain-convergence-mask)">
        {edges.map((edge) => (
          <SynapsePath
            key={edge.id}
            edge={edge}
            networkPulse={networkPulse}
            networkSurge={networkSurge}
            accelerated={isExecutingEdge(edge, labs) || networkSurge !== "none"}
            phase={EDGE_PHASE[edge.id] ?? 0}
          />
        ))}
      </g>
      {transmissionPath && activeTransmission && (
        <g
          filter="url(#synapse-glow-strong)"
          mask="url(#facility-brain-convergence-mask)"
        >
          <TransmissionPacket
            transmission={activeTransmission}
            path={transmissionPath}
          />
        </g>
      )}
    </svg>
  );
});
