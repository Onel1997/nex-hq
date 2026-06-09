"use client";

import { getFacilityTheme } from "@/lib/facility/facility-theme";
import { motion } from "framer-motion";
import { memo } from "react";
import type { PulseIntensity } from "@/lib/facility/types";

interface BrainReactorProps {
  intensity?: PulseIntensity;
  surge?: boolean;
}

const theme = getFacilityTheme();
const { coreWhite, reactorGold, neuralBlue, veinBlue } = theme.brain;

const GLOW_BY_INTENSITY: Record<PulseIntensity, string> = {
  small: `color-mix(in srgb, ${coreWhite} 36%, transparent)`,
  medium: `color-mix(in srgb, ${coreWhite} 49%, transparent)`,
  large: `color-mix(in srgb, ${coreWhite} 65%, transparent)`,
};

export const BrainReactor = memo(function BrainReactor({
  intensity = "medium",
  surge = false,
}: BrainReactorProps) {
  const glow = GLOW_BY_INTENSITY[intensity];

  return (
    <div className="facility-brain-reactor facility-brain-reactor-v3" aria-hidden>
      <motion.div
        className="facility-brain-ambient-pulse"
        style={{
          background: `radial-gradient(circle, color-mix(in srgb, ${neuralBlue} 30%, transparent), transparent 65%)`,
        }}
        animate={{
          scale: surge ? [1, 1.22, 1] : [1, 1.08, 1],
          opacity: surge ? [0.33, 0.65, 0.33] : [0.23, 0.49, 0.23],
        }}
        transition={{
          duration: surge ? 1.2 : 4.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={`ring-${i}`}
          className="facility-brain-energy-ring"
          style={{
            inset: `${-6 - i * 9}%`,
            borderColor: `color-mix(in srgb, ${i < 2 ? reactorGold : neuralBlue} ${20 + i * 9}%, transparent)`,
            borderStyle: i % 2 === 0 ? "solid" : "dashed",
            borderWidth: i === 0 ? "1.5px" : "1px",
            boxShadow:
              i === 0
                ? `0 0 32px color-mix(in srgb, ${reactorGold} 32%, transparent)`
                : i === 4
                  ? `0 0 48px color-mix(in srgb, ${neuralBlue} 22%, transparent)`
                  : undefined,
          }}
          animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
          transition={{
            duration: 10 + i * 5,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}

      <div className="facility-brain-neural-sphere">
        <div
          className="facility-brain-neural-texture"
          style={{
            background: `
              repeating-conic-gradient(from 0deg, color-mix(in srgb, ${neuralBlue} 22%, transparent) 0deg 6deg, transparent 6deg 12deg),
              radial-gradient(circle, color-mix(in srgb, ${coreWhite} 12%, transparent), transparent 70%)
            `,
          }}
        />
        <motion.div
          className="facility-brain-core-glow"
          style={{
            background: `radial-gradient(circle, ${glow}, color-mix(in srgb, ${neuralBlue} 22%, transparent) 55%, transparent 70%)`,
          }}
          animate={{
            opacity: surge ? [0.46, 0.65, 0.46] : [0.36, 0.62, 0.36],
            scale: surge ? [1, 1.14, 1] : [0.96, 1.05, 0.96],
          }}
          transition={{
            duration: surge ? 0.8 : 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="facility-brain-nucleus"
          style={{
            background: `radial-gradient(circle, color-mix(in srgb, ${coreWhite} 72%, transparent), color-mix(in srgb, ${neuralBlue} 50%, transparent) 40%, transparent 65%)`,
          }}
          animate={{
            scale: [0.92, 1.08, 0.92],
            opacity: [0.55, 0.72, 0.55],
          }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <div
          className="facility-brain-white-core"
          style={{
            background: `radial-gradient(circle, color-mix(in srgb, ${coreWhite} 65%, transparent), color-mix(in srgb, ${neuralBlue} 40%, transparent) 45%, transparent 70%)`,
          }}
        />
      </div>

      <svg className="facility-brain-veins" viewBox="0 0 100 100" aria-hidden>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
          <motion.line
            key={`vein-${angle}`}
            x1="50"
            y1="50"
            x2={50 + 42 * Math.cos((angle * Math.PI) / 180)}
            y2={50 + 42 * Math.sin((angle * Math.PI) / 180)}
            stroke={veinBlue}
            strokeWidth="1"
            strokeOpacity={0.72}
            animate={{ opacity: [0.25, 0.92, 0.25] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.22,
              ease: "easeInOut",
            }}
          />
        ))}
      </svg>
    </div>
  );
});
