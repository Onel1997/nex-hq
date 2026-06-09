"use client";

import { SPECIALIST_AGENT_IDS } from "@/lib/constants/agents";
import { getAgentColor } from "@/lib/facility/facility-theme";
import { computeConnectionPath } from "@/lib/facility/graph";
import type { FacilityLabId, LabSnapshot } from "@/lib/facility/types";
import { memo, useMemo } from "react";

interface IntelligenceHierarchyBeamsProps {
  width: number;
  height: number;
  labs: Record<FacilityLabId, LabSnapshot>;
}

export const IntelligenceHierarchyBeams = memo(
  function IntelligenceHierarchyBeams({
    width,
    height,
    labs,
  }: IntelligenceHierarchyBeamsProps) {
    const geometry = useMemo(() => {
      if (width <= 0 || height <= 0) return null;

      const ceoPath = computeConnectionPath("brain", "ceo", width, height, "ceo-brain");
      if (!ceoPath) return null;

      const labBeams = SPECIALIST_AGENT_IDS.flatMap((agentId) => {
        const path = computeConnectionPath(
          agentId,
          "brain",
          width,
          height,
          `${agentId}-brain`,
        );
        if (!path) return [];

        const active =
          labs[agentId].opsState === "executing" ||
          labs[agentId].opsState === "review" ||
          labs[agentId].opsState === "queued";

        return [
          {
            agentId,
            path,
            color: getAgentColor(agentId),
            active,
          },
        ];
      });

      return { ceoPath, labBeams };
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
