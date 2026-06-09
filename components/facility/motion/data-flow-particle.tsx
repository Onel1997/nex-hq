"use client";

import { motion } from "framer-motion";
import { memo } from "react";
import type { SynapseFlowMode } from "@/lib/facility/graph";

interface DataFlowParticleProps {
  path: string;
  flowMode: SynapseFlowMode;
  index: number;
}

const PARTICLE_COLORS: Record<SynapseFlowMode, string> = {
  "to-brain": "oklch(0.78 0.14 75)",
  "from-brain": "oklch(0.82 0.08 85)",
  ambient: "oklch(0.62 0.04 80 / 0.5)",
  error: "oklch(0.62 0.18 25)",
};

const PARTICLE_DURATIONS: Record<SynapseFlowMode, number> = {
  "to-brain": 2.2,
  "from-brain": 2.6,
  ambient: 6,
  error: 1.2,
};

export const DataFlowParticle = memo(function DataFlowParticle({
  path,
  flowMode,
  index,
}: DataFlowParticleProps) {
  const duration = PARTICLE_DURATIONS[flowMode];
  const delay = index * (duration / 3);
  const reverse = flowMode === "from-brain";

  return (
    <motion.circle
      r={flowMode === "ambient" ? 1.5 : 2.5}
      fill={PARTICLE_COLORS[flowMode]}
      style={{
        offsetPath: `path('${path}')`,
        offsetRotate: "0deg",
        filter:
          flowMode === "error"
            ? "drop-shadow(0 0 4px oklch(0.62 0.18 25))"
            : flowMode !== "ambient"
              ? "drop-shadow(0 0 3px oklch(0.82 0.08 85 / 0.6))"
              : undefined,
      }}
      initial={{ offsetDistance: reverse ? "100%" : "0%" }}
      animate={{
        offsetDistance: reverse ? "0%" : "100%",
        opacity:
          flowMode === "error" ? [0.4, 1, 0.4] : flowMode === "ambient" ? 0.45 : 1,
      }}
      transition={{
        offsetDistance: {
          duration,
          repeat: Infinity,
          ease: "linear",
          delay,
        },
        opacity:
          flowMode === "error"
            ? { duration: 1, repeat: Infinity, ease: "easeInOut" }
            : undefined,
      }}
    />
  );
});
