"use client";

import { motion } from "framer-motion";
import { memo } from "react";
import type { LabOpsState, ThinkingState } from "@/lib/facility/types";
import { cn } from "@/lib/utils";

interface ThinkingIndicatorProps {
  opsState: LabOpsState;
  thinkingState: ThinkingState;
  size?: "sm" | "md";
  accentColor?: string;
}

export const ThinkingIndicator = memo(function ThinkingIndicator({
  opsState,
  thinkingState,
  size = "sm",
  accentColor = "#38BDF8",
}: ThinkingIndicatorProps) {
  const isActive = thinkingState !== "idle";

  return (
    <div
      className={cn(
        "facility-thinking-indicator",
        `facility-thinking-${opsState}`,
        size === "md" && "facility-thinking-md",
      )}
      aria-hidden
    >
      {opsState === "executing" && (
        <motion.div
          className="facility-scanner-sweep"
          style={{
            background: `conic-gradient(from 0deg, transparent 0deg, color-mix(in srgb, ${accentColor} 35%, transparent) 30deg, transparent 60deg)`,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
        />
      )}

      {opsState === "review" && (
        <motion.div
          className="facility-review-breathe"
          animate={{ opacity: [0.3, 0.85, 0.3], scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {opsState === "approved" && (
        <motion.div
          className="facility-approved-flash"
          initial={{ opacity: 1, scale: 0.8 }}
          animate={{ opacity: 0, scale: 1.4 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      )}

      {opsState === "error" && (
        <motion.div
          className="facility-error-pulse"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {isActive && opsState !== "approved" && (
        <div className="facility-typing-dots">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="facility-typing-dot"
              style={{ background: accentColor }}
              animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
              transition={{
                duration: 1.1,
                repeat: Infinity,
                delay: i * 0.18,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      )}

      {opsState === "executing" && (
        <div className="facility-particle-field">
          {[0, 1, 2, 3].map((i) => (
            <motion.span
              key={`p-${i}`}
              className="facility-micro-particle"
              style={{
                left: `${20 + i * 18}%`,
                top: `${30 + (i % 2) * 25}%`,
                background: accentColor,
              }}
              animate={{
                opacity: [0, 0.9, 0],
                y: [0, -8, 0],
                x: [0, i % 2 === 0 ? 4 : -4, 0],
              }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                delay: i * 0.3,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
});
