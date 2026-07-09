"use client";

import { motion } from "framer-motion";
import { memo } from "react";
import type { SynapsePoint } from "@/lib/facility/graph";

interface BrainStreamAbsorptionProps {
  entries: Array<{ id: string; point: SynapsePoint; active: boolean }>;
}

export const BrainStreamAbsorption = memo(function BrainStreamAbsorption({
  entries,
}: BrainStreamAbsorptionProps) {
  return (
    <g className="facility-brain-stream-absorption" aria-hidden>
      {entries.map(({ id, point, active }, i) => (
        <g key={id}>
          <motion.circle
            cx={point.x}
            cy={point.y}
            r={active ? 5 : 3.5}
            fill="rgb(56 189 248 / 0.06)"
            stroke="rgb(56 189 248 / 0.22)"
            strokeWidth={0.8}
            animate={{
              r: active ? [4, 6.5, 4] : [3, 5, 3],
              opacity: active ? [0.35, 0.65, 0.35] : [0.2, 0.4, 0.2],
            }}
            transition={{
              duration: active ? 2.8 : 4.2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.22,
            }}
          />
          <motion.circle
            cx={point.x}
            cy={point.y}
            r={2}
            fill="rgb(56 189 248 / 0.35)"
            animate={{
              opacity: [0.15, 0.5, 0.15],
              scale: [0.8, 1.15, 0.8],
            }}
            transition={{
              duration: 3.6,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.31 + 0.5,
            }}
            style={{ transformOrigin: `${point.x}px ${point.y}px` }}
          />
        </g>
      ))}
    </g>
  );
});
