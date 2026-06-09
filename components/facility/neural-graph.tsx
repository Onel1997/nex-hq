"use client";

import { DataFlowParticle } from "@/components/facility/motion/data-flow-particle";
import {
  buildLabStateMap,
  computeSynapseEdges,
  type SynapseEdgeComputed,
} from "@/lib/facility/graph";
import type { FacilityLabId, LabSnapshot } from "@/lib/facility/types";
import { motion } from "framer-motion";
import { memo, useMemo } from "react";

interface NeuralGraphProps {
  width: number;
  height: number;
  labs: Record<FacilityLabId, LabSnapshot>;
  networkPulse?: boolean;
}

const STROKE_COLORS = {
  ambient: "oklch(0.82 0.055 85 / 0.08)",
  active: "oklch(0.82 0.055 85 / 0.22)",
  error: "oklch(0.62 0.18 25 / 0.45)",
  pulse: "oklch(0.82 0.1 85 / 0.5)",
} as const;

function particleCount(flowMode: SynapseEdgeComputed["flowMode"]): number {
  switch (flowMode) {
    case "to-brain":
    case "from-brain":
      return 2;
    case "error":
      return 1;
    case "ambient":
      return 1;
    default:
      return 0;
  }
}

const SynapsePath = memo(function SynapsePath({
  edge,
  networkPulse,
}: {
  edge: SynapseEdgeComputed;
  networkPulse?: boolean;
}) {
  const isError = edge.flowMode === "error";
  const stroke =
    networkPulse && edge.active
      ? STROKE_COLORS.pulse
      : isError
        ? STROKE_COLORS.error
        : edge.active
          ? STROKE_COLORS.active
          : STROKE_COLORS.ambient;

  const count = particleCount(edge.flowMode);

  return (
    <g>
      <motion.path
        d={edge.path}
        fill="none"
        stroke={stroke}
        strokeWidth={edge.active ? 1.5 : 1}
        strokeLinecap="round"
        animate={
          isError
            ? { opacity: [0.35, 0.9, 0.35] }
            : networkPulse && edge.active
              ? { opacity: [0.4, 1, 0.4] }
              : undefined
        }
        transition={
          isError || networkPulse
            ? { duration: 1.2, repeat: networkPulse ? 1 : Infinity }
            : undefined
        }
      />
      {Array.from({ length: count }, (_, i) => (
        <DataFlowParticle
          key={`${edge.id}-p-${i}`}
          path={edge.path}
          flowMode={edge.flowMode}
          index={i}
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
}: NeuralGraphProps) {
  const edges = useMemo(() => {
    const labStates = buildLabStateMap(labs);
    return computeSynapseEdges(width, height, labStates);
  }, [width, height, labs]);

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
      </defs>
      <g filter="url(#synapse-glow)">
        {edges.map((edge) => (
          <SynapsePath
            key={edge.id}
            edge={edge}
            networkPulse={networkPulse}
          />
        ))}
      </g>
    </svg>
  );
});
