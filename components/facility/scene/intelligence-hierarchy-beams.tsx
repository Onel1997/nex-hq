"use client";

import { computeConnectionPath, getBrainEmergenceMask } from "@/lib/facility/graph";
import type { FacilityLabId, LabSnapshot } from "@/lib/facility/types";
import { memo, useMemo } from "react";

interface IntelligenceHierarchyBeamsProps {
  width: number;
  height: number;
  labs: Record<FacilityLabId, LabSnapshot>;
}

/**
 * CEO command spine only — lab streams are rendered exclusively via NeuralGraph
 * so every agent connection shares the same organic emergence behavior.
 */
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

      return {
        ceoPath,
        brainMask: getBrainEmergenceMask(width, height),
      };
    }, [width, height]);

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
        <defs>
          <mask id="facility-hierarchy-emergence-mask">
            <rect width="100%" height="100%" fill="white" />
            <ellipse
              cx={geometry.brainMask.cx}
              cy={geometry.brainMask.cy}
              rx={geometry.brainMask.rx}
              ry={geometry.brainMask.ry}
              fill="black"
            />
          </mask>
        </defs>

        <g mask="url(#facility-hierarchy-emergence-mask)">
          <path
            d={geometry.ceoPath}
            fill="none"
            stroke="#FFD166"
            strokeWidth={ceoActive ? 1.1 : 0.65}
            strokeLinecap="round"
            opacity={ceoActive ? 0.28 : 0.1}
            strokeDasharray={ceoActive ? "3 20" : "2 24"}
          />
          {ceoActive && (
            <circle r="2" fill="#FFD166" opacity="0.55">
              <animateMotion
                dur="3.8s"
                repeatCount="indefinite"
                path={geometry.ceoPath}
              />
            </circle>
          )}
        </g>
      </svg>
    );
  },
);
