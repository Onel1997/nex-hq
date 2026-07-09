"use client";

import { NeuralPathway } from "@/components/facility/motion/neural-pathway";
import { TransmissionPacket } from "@/components/facility/motion/transmission-packet";
import { buildLabStateMap, type SynapseEdgeComputed } from "@/lib/facility/graph";
import {
  computeSynapseEdgesFromMeasured,
  type MeasuredSceneGeometry,
} from "@/lib/facility/measured-conduits";
import type { FacilityDepthLayer } from "@/lib/facility/types";
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
  measuredGeometry: MeasuredSceneGeometry | null;
  networkPulse?: boolean;
  networkSurge?: NetworkSurgeMode;
  activeTransmission?: TransmissionEvent | null;
}

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

const DEPTH_RENDER_ORDER: FacilityDepthLayer[] = [
  "background",
  "midground",
  "foreground",
];

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

export const NeuralGraph = memo(function NeuralGraph({
  width,
  height,
  labs,
  measuredGeometry,
  networkPulse,
  networkSurge = "none",
  activeTransmission,
}: NeuralGraphProps) {
  const edges = useMemo(() => {
    if (!measuredGeometry?.ready) return [];
    const labStates = buildLabStateMap(labs);
    return computeSynapseEdgesFromMeasured(measuredGeometry, labStates);
  }, [measuredGeometry, labs]);

  const edgesByDepth = useMemo(() => {
    const grouped: Record<
      FacilityDepthLayer,
      Array<{ edge: SynapseEdgeComputed; phase: number }>
    > = {
      background: [],
      midground: [],
      foreground: [],
    };
    for (const edge of edges) {
      grouped[edge.depthLayer].push({
        edge,
        phase: EDGE_PHASE[edge.id] ?? 0,
      });
    }
    return grouped;
  }, [edges]);

  const transmissionPath = useMemo(() => {
    if (!activeTransmission) return null;
    const edge = edges.find((e) => e.id === activeTransmission.edgeId);
    return edge?.path ?? null;
  }, [edges, activeTransmission]);

  const brainCenter = measuredGeometry?.brainNexus.center ?? {
    x: width * 0.47,
    y: height * 0.36,
  };
  const surgeRadius = Math.min(width, height) * 0.45;

  if (width <= 0 || height <= 0 || edges.length === 0) return null;

  return (
    <svg
      className="facility-neural-graph facility-conduit-network"
      width={width}
      height={height}
      aria-hidden
    >
      <defs>
        <filter id="conduit-glow">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
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

      <g filter="url(#conduit-glow)">
        {DEPTH_RENDER_ORDER.map((layer) =>
          edgesByDepth[layer].map(({ edge, phase }) => (
            <NeuralPathway
              key={edge.id}
              path={edge.path}
              start={edge.start}
              end={edge.end}
              flowMode={
                networkPulse && edge.active ? "to-brain" : edge.flowMode
              }
              phase={phase}
              depthLayer={edge.depthLayer}
              active={edge.active || networkPulse}
              accelerated={
                isExecutingEdge(edge, labs) || networkSurge !== "none"
              }
              isCommand={edge.id === "ceo-brain"}
            />
          )),
        )}
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
