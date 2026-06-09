"use client";

import { DataFlowParticle } from "@/components/facility/motion/data-flow-particle";
import { TransmissionPacket } from "@/components/facility/motion/transmission-packet";
import {
  buildLabStateMap,
  computeSynapseEdges,
  type SynapseEdgeComputed,
} from "@/lib/facility/graph";
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
  ambient: "rgb(56 189 248 / 0.06)",
  active: "rgb(56 189 248 / 0.32)",
  executing: "rgb(34 211 238 / 0.5)",
  error: "rgb(248 113 113 / 0.5)",
  pulse: "rgb(234 242 255 / 0.55)",
} as const;

function particleCount(
  flowMode: SynapseEdgeComputed["flowMode"],
  active: boolean,
  surge: boolean,
): number {
  if (!active) return flowMode === "ambient" ? 1 : 0;
  switch (flowMode) {
    case "to-brain":
    case "from-brain":
      return surge ? 5 : 3;
    case "error":
      return 2;
    case "ambient":
      return 1;
    default:
      return 0;
  }
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
}: {
  edge: SynapseEdgeComputed;
  networkPulse?: boolean;
  networkSurge?: NetworkSurgeMode;
  accelerated?: boolean;
}) {
  const isError = edge.flowMode === "error";
  const isExecuting = edge.flowMode === "to-brain" && accelerated;
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
          : edge.active
            ? STROKE_COLORS.active
            : STROKE_COLORS.ambient;

  const count = particleCount(edge.flowMode, edge.active, isSurge);

  return (
    <g>
      {edge.active && (
        <path
          d={edge.path}
          fill="none"
          stroke={stroke}
          strokeWidth={isExecuting ? 4 : 3}
          strokeLinecap="round"
          opacity={0.15}
          style={{ filter: "blur(3px)" }}
        />
      )}
      <motion.path
        d={edge.path}
        fill="none"
        stroke={stroke}
        strokeWidth={edge.active ? (isExecuting ? 2 : 1.5) : 0.75}
        strokeLinecap="round"
        strokeDasharray={edge.active ? "6 10" : undefined}
        animate={
          isError
            ? { opacity: [0.35, 0.95, 0.35] }
            : networkPulse && edge.active
              ? { opacity: [0.5, 1, 0.5], strokeDashoffset: [0, -32] }
              : edge.active
                ? { strokeDashoffset: [0, -32] }
                : { opacity: [0.4, 0.65, 0.4] }
        }
        transition={
          isError
            ? { duration: 1, repeat: Infinity }
            : edge.active
              ? {
                  strokeDashoffset: {
                    duration: accelerated ? 0.8 : 2.5,
                    repeat: Infinity,
                    ease: "linear",
                  },
                  opacity: networkPulse
                    ? { duration: 0.9, repeat: 1 }
                    : undefined,
                }
              : { duration: 5, repeat: Infinity, ease: "easeInOut" }
        }
      />
      {Array.from({ length: count }, (_, i) => (
        <DataFlowParticle
          key={`${edge.id}-p-${i}`}
          path={edge.path}
          flowMode={edge.flowMode}
          index={i}
          accelerated={accelerated}
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

  const transmissionPath = useMemo(() => {
    if (!activeTransmission) return null;
    const edge = edges.find((e) => e.id === activeTransmission.edgeId);
    return edge?.path ?? null;
  }, [edges, activeTransmission]);

  const cx = width / 2;
  const cy = height / 2;
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
          cx={cx}
          cy={cy}
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
          transition={{ duration: networkSurge === "final-report" ? 2 : 1.4, ease: "easeOut" }}
        />
      )}
      <g filter="url(#synapse-glow)">
        {edges.map((edge) => (
          <SynapsePath
            key={edge.id}
            edge={edge}
            networkPulse={networkPulse}
            networkSurge={networkSurge}
            accelerated={isExecutingEdge(edge, labs) || networkSurge !== "none"}
          />
        ))}
      </g>
      {transmissionPath && activeTransmission && (
        <g filter="url(#synapse-glow-strong)">
          <TransmissionPacket
            transmission={activeTransmission}
            path={transmissionPath}
          />
        </g>
      )}
    </svg>
  );
});
