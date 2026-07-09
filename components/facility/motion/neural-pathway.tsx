"use client";

import { motion } from "framer-motion";
import { memo } from "react";
import type { SynapseFlowMode, SynapsePoint } from "@/lib/facility/graph";
import type { FacilityDepthLayer } from "@/lib/facility/types";

interface NeuralPathwayProps {
  path: string;
  start: SynapsePoint;
  end: SynapsePoint;
  flowMode: SynapseFlowMode;
  phase: number;
  depthLayer: FacilityDepthLayer;
  active?: boolean;
  accelerated?: boolean;
  isCommand?: boolean;
}

const STROKE = {
  ambient: "rgb(56 189 248 / 0.42)",
  active: "rgb(56 189 248 / 0.58)",
  executing: "rgb(34 211 238 / 0.72)",
  error: "rgb(248 113 113 / 0.65)",
  command: "rgb(255 209 102 / 0.52)",
  glow: "rgb(56 189 248 / 0.16)",
} as const;

const DEPTH_OPACITY: Record<FacilityDepthLayer, number> = {
  background: 0.74,
  midground: 0.9,
  foreground: 1,
};

const PARTICLE_SPEEDS = [5.8, 4.2, 7.1] as const;

function resolveStroke(
  flowMode: SynapseFlowMode,
  active: boolean,
  isCommand: boolean,
) {
  if (isCommand) return STROKE.command;
  if (flowMode === "error") return STROKE.error;
  if (flowMode === "to-brain" && active) return STROKE.executing;
  if (active) return STROKE.active;
  return STROKE.ambient;
}

function resolveParticleColor(
  flowMode: SynapseFlowMode,
  active: boolean,
  isCommand: boolean,
) {
  if (isCommand) return "#FFD166";
  if (flowMode === "error") return "#F87171";
  if (flowMode === "to-brain" && active) return "#22D3EE";
  return "#38BDF8";
}

function particleCount(flowMode: SynapseFlowMode, active: boolean): number {
  if (flowMode === "error") return 2;
  return active ? 3 : 2;
}

/**
 * Facility data conduit — continuous spline anchored at lab and Brain intake,
 * with knowledge packets travelling along the curve.
 */
export const NeuralPathway = memo(function NeuralPathway({
  path,
  start,
  end,
  flowMode,
  phase,
  depthLayer,
  active = false,
  accelerated = false,
  isCommand = false,
}: NeuralPathwayProps) {
  const stroke = resolveStroke(flowMode, active, isCommand);
  const particleColor = resolveParticleColor(flowMode, active, isCommand);
  const towardBrain = flowMode !== "from-brain";
  const motionKey = towardBrain ? "0;1" : "1;0";
  const count = particleCount(flowMode, active);
  const pulseDur = active ? 3.2 : 5.6;
  const depthOpacity = DEPTH_OPACITY[depthLayer];

  return (
    <g className="facility-neural-pathway" opacity={depthOpacity}>
      {/* Glow halo — continuous conduit body */}
      <path
        d={path}
        fill="none"
        stroke={STROKE.glow}
        strokeWidth={6}
        strokeLinecap="round"
        opacity={0.6}
        style={{ filter: "blur(5px)" }}
      />

      {/* Primary spline — always visible data conduit */}
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={1.25}
        strokeLinecap="round"
        opacity={0.92}
      />

      {/* Orbital pulse — knowledge transfer rhythm */}
      <motion.path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={0.8}
        strokeLinecap="round"
        strokeDasharray="5 28"
        opacity={0.5}
        animate={{ strokeDashoffset: towardBrain ? [0, -33] : [0, 33] }}
        transition={{
          duration: pulseDur,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* Lab anchor — conduit originates from the real node */}
      <circle
        cx={start.x}
        cy={start.y}
        r={3}
        fill={particleColor}
        opacity={0.55}
        style={{ filter: "blur(1px)" }}
      />
      <circle
        cx={start.x}
        cy={start.y}
        r={1.6}
        fill={particleColor}
        opacity={0.9}
      />

      {/* Brain intake terminus — feeds into the Core glow (covered by Brain layer) */}
      <circle
        cx={end.x}
        cy={end.y}
        r={2.5}
        fill={isCommand ? "#FFD166" : "#38BDF8"}
        opacity={0.35}
        style={{ filter: "blur(2px)" }}
      />

      {/* Data packets — locked to spline, varied speeds */}
      {Array.from({ length: count }, (_, i) => {
        const base = PARTICLE_SPEEDS[i % PARTICLE_SPEEDS.length];
        const dur = accelerated ? base * 0.55 : base;
        const begin = phase * 0.35 + i * (dur / count);

        return (
          <g key={`packet-${i}`}>
            <circle r={2.4} fill={particleColor} opacity={0.18}>
              <animateMotion
                path={path}
                dur={`${dur}s`}
                repeatCount="indefinite"
                begin={`${begin}s`}
                keyPoints={motionKey}
                keyTimes="0;1"
                calcMode="linear"
              />
            </circle>
            <circle r={1.4} fill={particleColor} opacity={0.85}>
              <animateMotion
                path={path}
                dur={`${dur}s`}
                repeatCount="indefinite"
                begin={`${begin}s`}
                keyPoints={motionKey}
                keyTimes="0;1"
                calcMode="linear"
              />
            </circle>
          </g>
        );
      })}
    </g>
  );
});
