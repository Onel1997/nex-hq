"use client";

import type { StartupPhase } from "@/components/facility/hooks/use-facility-startup";
import { AnimatePresence, motion } from "framer-motion";
import { memo } from "react";

const BOOT_LINES: Record<StartupPhase, string> = {
  boot: "Initializing neural facility…",
  brain: "Brain Core reactor online",
  synapses: "Synapse network activating",
  labs: "Agent labs coming online",
  ceo: "CEO Core boot sequence",
  telemetry: "Operations feed streaming",
  complete: "Facility operational",
};

interface FacilityStartupOverlayProps {
  phase: StartupPhase;
  progress: number;
}

export const FacilityStartupOverlay = memo(function FacilityStartupOverlay({
  phase,
  progress,
}: FacilityStartupOverlayProps) {
  return (
    <AnimatePresence>
      {phase !== "complete" ? (
        <motion.div
          className="facility-startup-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="facility-startup-core">
            <motion.div
              className="facility-startup-reactor"
              animate={{ scale: [0.9, 1.05, 0.9], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <p className="facility-startup-label">NEXHQ FACILITY</p>
            <AnimatePresence mode="wait">
              <motion.p
                key={phase}
                className="facility-startup-line"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
              >
                {BOOT_LINES[phase]}
              </motion.p>
            </AnimatePresence>
            <div className="facility-startup-progress-track">
              <motion.div
                className="facility-startup-progress-fill"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
});
