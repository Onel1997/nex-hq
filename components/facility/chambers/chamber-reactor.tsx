"use client";

import { motion } from "framer-motion";
import { memo } from "react";
import type { LabOpsState } from "@/lib/facility/types";
import { cn } from "@/lib/utils";

interface ChamberReactorProps {
  state: LabOpsState;
  progress?: number | null;
  color: string;
}

export const ChamberReactor = memo(function ChamberReactor({
  state,
  progress,
  color,
}: ChamberReactorProps) {
  const pct = progress ?? 0;

  return (
    <div
      className={cn(
        "facility-chamber-reactor",
        `facility-chamber-reactor-${state}`,
      )}
      aria-hidden
      style={{ "--chamber-accent": color } as React.CSSProperties}
    >
      <div className="facility-chamber-reactor-housing">
        <div className="facility-chamber-reactor-core">
          {state === "executing" && (
            <motion.div
              className="facility-chamber-reactor-plasma"
              animate={{ opacity: [0.5, 1, 0.5], scale: [0.92, 1.06, 0.92] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          {state === "review" && (
            <motion.div
              className="facility-chamber-reactor-plasma"
              animate={{ opacity: [0.25, 0.7, 0.25] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          {state === "approved" && (
            <motion.div
              className="facility-chamber-reactor-burst"
              initial={{ opacity: 1, scale: 0.6 }}
              animate={{ opacity: 0, scale: 1.8 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
          )}
          {state === "error" && (
            <motion.div
              className="facility-chamber-reactor-alert"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 0.85, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </div>
        <div className="facility-chamber-reactor-rails">
          <span />
          <span />
          <span />
        </div>
      </div>

      {state === "executing" && pct > 0 && (
        <div className="facility-chamber-reactor-progress">
          <motion.div
            className="facility-chamber-reactor-progress-fill"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      )}
    </div>
  );
});
