"use client";

import { motion, AnimatePresence } from "framer-motion";
import { memo } from "react";
import type { BrainPulseKind, PulseIntensity } from "@/lib/facility/types";

interface BrainPulseProps {
  kind: BrainPulseKind;
  intensity?: PulseIntensity;
  networkPulse?: boolean;
  synthesisMode?: boolean;
}

const PULSE_CONFIG: Record<
  Exclude<BrainPulseKind, "none">,
  { scale: number; duration: number; color: string; intensity: PulseIntensity }
> = {
  "task-started": {
    scale: 1.25,
    duration: 0.6,
    color: "rgb(34 211 238 / 0.4)",
    intensity: "small",
  },
  "task-complete": {
    scale: 1.4,
    duration: 0.8,
    color: "rgb(234 242 255 / 0.45)",
    intensity: "small",
  },
  "report-approved": {
    scale: 1.65,
    duration: 1.2,
    color: "rgb(34 197 94 / 0.4)",
    intensity: "medium",
  },
  "report-rejected": {
    scale: 1.35,
    duration: 0.9,
    color: "rgb(248 113 113 / 0.4)",
    intensity: "small",
  },
  "final-report": {
    scale: 2.8,
    duration: 2.4,
    color: "rgb(234 242 255 / 0.7)",
    intensity: "large",
  },
  delegation: {
    scale: 1.9,
    duration: 1.6,
    color: "rgb(255 209 102 / 0.55)",
    intensity: "medium",
  },
};

const INTENSITY_MULTIPLIER: Record<PulseIntensity, number> = {
  small: 1,
  medium: 1.2,
  large: 1.55,
};

export const BrainPulse = memo(function BrainPulse({
  kind,
  intensity: overrideIntensity,
  networkPulse,
  synthesisMode = false,
}: BrainPulseProps) {
  const config = kind !== "none" ? PULSE_CONFIG[kind] : null;
  const intensity = overrideIntensity ?? config?.intensity ?? "medium";
  const multiplier = INTENSITY_MULTIPLIER[intensity];

  return (
    <>
      <AnimatePresence>
        {config ? (
          <>
            <motion.div
              key={`${kind}-inner`}
              className="pointer-events-none absolute inset-[-12%] rounded-full facility-brain-pulse-ring"
              style={{
                border: `1px solid ${config.color}`,
                boxShadow: `0 0 ${22 * multiplier}px ${config.color}`,
              }}
              initial={{ scale: 0.85, opacity: 0.65 }}
              animate={{ scale: config.scale * multiplier * 0.75, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: config.duration, ease: "easeOut" }}
            />
            {intensity !== "small" && (
              <motion.div
                key={`${kind}-outer`}
                className="pointer-events-none absolute inset-[-40%] rounded-full"
                style={{
                  border: `1px solid ${config.color}`,
                  opacity: 0.5,
                }}
                initial={{ scale: 0.6, opacity: 0.6 }}
                animate={{ scale: config.scale * multiplier * 1.3, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: config.duration * 1.15,
                  ease: "easeOut",
                  delay: 0.08,
                }}
              />
            )}
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {networkPulse ? (
          <motion.div
            key="network"
            className="pointer-events-none absolute inset-[-55%] rounded-full facility-neural-wave"
            style={{
              border: synthesisMode
                ? "1.5px solid rgb(255 209 102 / 0.55)"
                : "1px solid rgb(234 242 255 / 0.35)",
              boxShadow: synthesisMode
                ? "0 0 80px rgb(255 209 102 / 0.35), 0 0 120px rgb(56 189 248 / 0.25)"
                : "0 0 60px rgb(56 189 248 / 0.2)",
            }}
            initial={{ scale: 0.5, opacity: synthesisMode ? 0.85 : 0.7 }}
            animate={{ scale: synthesisMode ? 3.2 * multiplier : 2.6 * multiplier, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: synthesisMode ? 2.4 : 1.6, ease: "easeOut" }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {synthesisMode ? (
          <motion.div
            key="synthesis-surge"
            className="pointer-events-none absolute inset-[-30%] rounded-full facility-brain-synthesis-wave"
            style={{
              border: "1px solid rgb(34 211 238 / 0.45)",
              boxShadow: "0 0 48px rgb(56 189 248 / 0.3)",
            }}
            initial={{ scale: 0.7, opacity: 0.8 }}
            animate={{ scale: 2.4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.8, ease: "easeOut" }}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
});
