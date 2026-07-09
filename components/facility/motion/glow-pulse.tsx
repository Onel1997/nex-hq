"use client";

import { motion } from "framer-motion";
import { memo } from "react";
import { cn } from "@/lib/utils";

interface GlowPulseProps {
  className?: string;
  color?: string;
  intensity?: "subtle" | "normal" | "strong";
}

const INTENSITY_SCALE: Record<
  "subtle" | "normal" | "strong",
  [number, number]
> = {
  subtle: [1, 1.08],
  normal: [1, 1.15],
  strong: [1, 1.28],
};

export const GlowPulse = memo(function GlowPulse({
  className,
  color = "oklch(0.82 0.08 85 / 0.35)",
  intensity = "normal",
}: GlowPulseProps) {
  return (
    <motion.div
      className={cn("pointer-events-none absolute inset-0 rounded-full", className)}
      style={{
        background: `radial-gradient(circle, ${color}, transparent 70%)`,
      }}
      animate={{ scale: INTENSITY_SCALE[intensity], opacity: [0.5, 0.9, 0.5] }}
      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
    />
  );
});
