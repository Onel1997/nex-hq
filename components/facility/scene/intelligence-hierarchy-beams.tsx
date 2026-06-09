"use client";

import { SPECIALIST_AGENT_IDS } from "@/lib/constants/agents";
import { getAgentColor } from "@/lib/facility/facility-theme";
import { layoutToPoint } from "@/lib/facility/graph";
import type { FacilityLabId, LabSnapshot } from "@/lib/facility/types";
import { memo, useMemo } from "react";

interface IntelligenceHierarchyBeamsProps {
  width: number;
  height: number;
  labs: Record<FacilityLabId, LabSnapshot>;
}

function beamPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${(mx - dy * 0.12).toFixed(1)} ${(my + dx * 0.12).toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}

export const IntelligenceHierarchyBeams = memo(
  function IntelligenceHierarchyBeams({
    width,
    height,
    labs,
  }: IntelligenceHierarchyBeamsProps) {
    const geometry = useMemo(() => {
      if (width <= 0 || height <= 0) return null;
      const brain = layoutToPoint("brain", width, height);
      const ceo = layoutToPoint("ceo", width, height);
      if (!brain || !ceo) return null;
      const labBeams = SPECIALIST_AGENT_IDS.flatMap((agentId) => {
        const from = layoutToPoint(agentId, width, height);
        if (!from) return [];
        const active =
          labs[agentId].opsState === "executing" ||
          labs[agentId].opsState === "review" ||
          labs[agentId].opsState === "queued";
        return [
          {
            agentId,
            path: beamPath(from, brain),
            color: getAgentColor(agentId),
            active,
          },
        ];
      });
      return {
        brain,
        ceo,
        ceoPath: beamPath(brain, ceo),
        labBeams,
      };
    }, [width, height, labs]);

    if (!geometry) return null;

    const ceoActive =
      labs.ceo.opsState === "executing" || labs.ceo.opsState === "review";

    return (
      <svg
        className="facility-hierarchy-beams"
        width={width}
        height={height}
        aria-hidden
      >
        {geometry.labBeams
          .filter(({ active }) => active)
          .map(({ agentId, path, color }) => (
          <g key={agentId} className="facility-hierarchy-lab-beam">
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={1.2}
              strokeLinecap="round"
              opacity={0.4}
            />
            <circle r="2.5" fill={color} opacity="0.85">
              <animateMotion
                dur="3.5s"
                repeatCount="indefinite"
                path={path}
              />
            </circle>
          </g>
        ))}

        <path
          d={geometry.ceoPath}
          fill="none"
          stroke="#FFD166"
          strokeWidth={ceoActive ? 1.5 : 0.7}
          strokeLinecap="round"
          opacity={ceoActive ? 0.5 : 0.15}
          strokeDasharray={ceoActive ? undefined : "4 8"}
        />
        <circle r="3" fill="#FFD166" opacity={ceoActive ? 0.9 : 0.35}>
          <animateMotion
            dur={ceoActive ? "2s" : "4.5s"}
            repeatCount="indefinite"
            path={geometry.ceoPath}
          />
        </circle>
      </svg>
    );
  },
);
