"use client";

import { motion, AnimatePresence } from "framer-motion";
import { memo } from "react";
import type { BrainPulseKind } from "@/lib/facility/types";

interface BrainPulseProps {
  kind: BrainPulseKind;
  networkPulse?: boolean;
}

const PULSE_CONFIG: Record<
  Exclude<BrainPulseKind, "none">,
  { scale: number; duration: number; color: string }
> = {
  "task-complete": {
    scale: 1.35,
    duration: 0.8,
    color: "oklch(0.82 0.08 85 / 0.4)",
  },
  "report-approved": {
    scale: 1.55,
    duration: 1.2,
    color: "oklch(0.68 0.14 145 / 0.35)",
  },
  "final-report": {
    scale: 2,
    duration: 2,
    color: "oklch(0.82 0.12 85 / 0.55)",
  },
  delegation: {
    scale: 1.75,
    duration: 1.6,
    color: "oklch(0.82 0.12 85 / 0.5)",
  },
};

export const BrainPulse = memo(function BrainPulse({
  kind,
  networkPulse,
}: BrainPulseProps) {
  const config = kind !== "none" ? PULSE_CONFIG[kind] : null;

  return (
    <>
      <AnimatePresence>
        {config ? (
          <motion.div
            key={kind}
            className="pointer-events-none absolute inset-[-30%] rounded-full"
            style={{
              border: `1px solid ${config.color}`,
              boxShadow: `0 0 40px ${config.color}`,
            }}
            initial={{ scale: 0.8, opacity: 0.8 }}
            animate={{ scale: config.scale, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: config.duration, ease: "easeOut" }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {networkPulse ? (
          <motion.div
            key="network"
            className="pointer-events-none absolute inset-[-50%] rounded-full"
            style={{
              border: "1px solid oklch(0.82 0.08 85 / 0.25)",
            }}
            initial={{ scale: 0.6, opacity: 0.6 }}
            animate={{ scale: 2.2, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: "easeOut" }}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
});
