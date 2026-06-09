"use client";

import type { AgentId } from "@/lib/constants/agents";
import { getAgentColor } from "@/lib/facility/facility-theme";
import { layoutToPoint } from "@/lib/facility/graph";
import { getNodeLayout } from "@/lib/facility/layout";
import type { KnowledgeFlowSequence } from "@/lib/facility/types";
import { motion, AnimatePresence } from "framer-motion";
import { memo, useMemo } from "react";

interface KnowledgeFlowOverlayProps {
  width: number;
  height: number;
  flow: KnowledgeFlowSequence | null;
}

function curvedPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const cx = mx - dy * 0.18;
  const cy = my + dx * 0.18;
  return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}

export const KnowledgeFlowOverlay = memo(function KnowledgeFlowOverlay({
  width,
  height,
  flow,
}: KnowledgeFlowOverlayProps) {
  const points = useMemo(() => {
    if (width <= 0 || height <= 0) return null;
    const brain = layoutToPoint("brain", width, height);
    const ceo = layoutToPoint("ceo", width, height);
    return { brain, ceo };
  }, [width, height]);

  if (!flow || !points || flow.phase === "complete") return null;

  const agentId = flow.agentId;
  const color =
    agentId === "ceo" ? "#FFD166" : getAgentColor(agentId as AgentId);

  const labPoint =
    agentId !== "ceo"
      ? layoutToPoint(agentId, width, height)
      : points.brain;

  const labToNexusPath = curvedPath(labPoint, points.brain);
  const nexusToCeoPath = curvedPath(points.brain, points.ceo);

  const showLabToNexus =
    flow.phase === "lab-to-nexus" || flow.phase === "nexus-absorb";
  const showNexusToCeo =
    flow.phase === "nexus-absorb" || flow.phase === "nexus-to-ceo";

  return (
    <svg
      className="facility-knowledge-flow-overlay"
      width={width}
      height={height}
      aria-hidden
    >
      <defs>
        <filter id="knowledge-flow-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <AnimatePresence>
        {showLabToNexus && (
          <g key={`lab-${flow.id}`} filter="url(#knowledge-flow-glow)">
            <motion.path
              d={labToNexusPath}
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: [0, 0.9, 0.7] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
            <circle r="5" fill={color}>
              <animateMotion
                dur="2s"
                repeatCount="indefinite"
                path={labToNexusPath}
              />
            </circle>
            <circle r="12" fill={color} opacity="0.15">
              <animateMotion
                dur="2s"
                repeatCount="indefinite"
                path={labToNexusPath}
              />
            </circle>
          </g>
        )}

        {flow.phase === "nexus-absorb" && (
          <motion.circle
            key={`absorb-${flow.id}`}
            cx={points.brain.x}
            cy={points.brain.y}
            r={getNodeLayout("brain").size * 0.35}
            fill="none"
            stroke="#38BDF8"
            strokeWidth={1.5}
            initial={{ opacity: 0.8, scale: 0.6 }}
            animate={{ opacity: 0, scale: 1.4 }}
            transition={{ duration: 1.4, ease: "easeOut" }}
          />
        )}

        {showNexusToCeo && (
          <g key={`ceo-${flow.id}`} filter="url(#knowledge-flow-glow)">
            <motion.path
              d={nexusToCeoPath}
              fill="none"
              stroke="#FFD166"
              strokeWidth={2}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: [0, 1, 0.85] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
            <circle r="4" fill="#FFD166">
              <animateMotion
                dur="1.6s"
                repeatCount="indefinite"
                path={nexusToCeoPath}
              />
            </circle>
          </g>
        )}
      </AnimatePresence>

      {flow.label && (
        <foreignObject
          x={points.brain.x - 80}
          y={points.brain.y - getNodeLayout("brain").size * 0.55}
          width={160}
          height={24}
        >
          <div className="facility-knowledge-flow-label">{flow.label}</div>
        </foreignObject>
      )}
    </svg>
  );
});
