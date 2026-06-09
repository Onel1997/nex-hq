"use client";

import { motion } from "framer-motion";
import { memo, useMemo } from "react";
import type { LabOpsState } from "@/lib/facility/types";
import { cn } from "@/lib/utils";

interface ActivityRingProps {
  size: number;
  state: LabOpsState;
}

const STROKE: Record<LabOpsState, string> = {
  idle: "oklch(0.4 0.01 55 / 0.25)",
  queued: "oklch(0.62 0.1 240 / 0.6)",
  executing: "oklch(0.78 0.14 75 / 0.85)",
  review: "oklch(0.65 0.16 300 / 0.75)",
  approved: "oklch(0.72 0.14 145 / 0.85)",
  error: "oklch(0.62 0.18 25 / 0.85)",
};

export const ActivityRing = memo(function ActivityRing({
  size,
  state,
}: ActivityRingProps) {
  const r = size / 2 - 3;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = useMemo(() => 2 * Math.PI * r, [r]);

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
          stroke={STROKE.idle}
          strokeWidth={1}
        />
      </svg>
    );
  }

  if (state === "executing") {
    return (
      <motion.svg
        className="pointer-events-none absolute inset-0"
        width={size}
        height={size}
        aria-hidden
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        style={{ originX: "50%", originY: "50%" }}
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={STROKE.executing}
          strokeWidth={2}
          strokeDasharray={`${circumference * 0.22} ${circumference * 0.78}`}
          strokeLinecap="round"
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
          stroke={STROKE.review}
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
          stroke={STROKE.approved}
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
          stroke={STROKE.error}
          strokeWidth={2}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.svg>
    );
  }

  // queued — dim rotating ring
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
        stroke={STROKE.queued}
        strokeWidth={1.5}
        strokeDasharray={`${circumference * 0.12} ${circumference * 0.88}`}
      />
    </motion.svg>
  );
});
