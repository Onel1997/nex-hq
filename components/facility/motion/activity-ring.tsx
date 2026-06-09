"use client";

import { motion } from "framer-motion";
import { memo, useMemo } from "react";
import type { LabOpsState } from "@/lib/facility/types";
import { cn } from "@/lib/utils";

interface ActivityRingProps {
  size: number;
  state: LabOpsState;
  progress?: number | null;
  agentColor?: string;
}

const STATE_STROKE: Record<LabOpsState, string | null> = {
  idle: null,
  queued: "rgb(56 189 248 / 0.6)",
  executing: null,
  review: "rgb(168 85 247 / 0.75)",
  approved: "rgb(34 197 94 / 0.85)",
  error: "rgb(248 113 113 / 0.85)",
};

export const ActivityRing = memo(function ActivityRing({
  size,
  state,
  progress,
  agentColor = "#7E8CA3",
}: ActivityRingProps) {
  const r = size / 2 - 3;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = useMemo(() => 2 * Math.PI * r, [r]);
  const stroke = STATE_STROKE[state] ?? agentColor;

  if (state === "idle") {
    return (
      <svg
        className="pointer-events-none absolute inset-0"
        width={size}
        height={size}
        aria-hidden
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={`color-mix(in srgb, ${agentColor} 25%, transparent)`}
          strokeWidth={1}
        />
      </svg>
    );
  }

  if (state === "executing") {
    const pct = progress ?? 30;
    const arcLen = circumference * (pct / 100) * 0.85;
    const gap = circumference - arcLen;
    return (
      <motion.svg
        className="pointer-events-none absolute inset-0"
        width={size}
        height={size}
        aria-hidden
        animate={{ rotate: 360 }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
        style={{ originX: "50%", originY: "50%" }}
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={`color-mix(in srgb, ${agentColor} 20%, transparent)`}
          strokeWidth={1.5}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={agentColor}
          strokeWidth={2.5}
          strokeDasharray={`${arcLen} ${gap}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px color-mix(in srgb, ${agentColor} 60%, transparent))` }}
        />
      </motion.svg>
    );
  }

  if (state === "review") {
    return (
      <motion.svg
        className="pointer-events-none absolute inset-0"
        width={size}
        height={size}
        aria-hidden
      >
        <motion.circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          animate={{ opacity: [0.35, 0.9, 0.35] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.svg>
    );
  }

  if (state === "approved") {
    return (
      <motion.svg
        className="pointer-events-none absolute inset-0"
        width={size}
        height={size}
        aria-hidden
      >
        <motion.circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={2.5}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: [1, 0], scale: [1, 1.12] }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </motion.svg>
    );
  }

  if (state === "error") {
    return (
      <motion.svg
        className={cn("pointer-events-none absolute inset-0")}
        width={size}
        height={size}
        aria-hidden
      >
        <motion.circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.svg>
    );
  }

  return (
    <motion.svg
      className="pointer-events-none absolute inset-0"
      width={size}
      height={size}
      aria-hidden
      animate={{ rotate: 360 }}
      transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
      style={{ originX: "50%", originY: "50%" }}
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeDasharray={`${circumference * 0.12} ${circumference * 0.88}`}
      />
    </motion.svg>
  );
});
