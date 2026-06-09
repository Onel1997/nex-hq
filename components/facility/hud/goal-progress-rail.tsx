"use client";

import type { GoalProgress } from "@/lib/facility/types";
import { motion } from "framer-motion";
import { memo } from "react";
import { cn } from "@/lib/utils";

interface GoalProgressRailProps {
  goal: GoalProgress | null;
}

const CHECKPOINT_LABELS = {
  research: "Research",
  designer: "Design",
  marketing: "Marketing",
  content: "Content",
  shopify: "Shopify",
} as const;

const CHECKPOINT_ORDER = [
  "research",
  "designer",
  "marketing",
  "content",
  "shopify",
] as const;

function CheckpointChip({
  label,
  status,
}: {
  label: string;
  status: "complete" | "active" | "pending";
}) {
  return (
    <span
      className={cn(
        "facility-goal-chip",
        status === "complete" && "facility-goal-chip-complete",
        status === "active" && "facility-goal-chip-active",
        status === "pending" && "facility-goal-chip-pending",
      )}
    >
      {status === "complete" ? "✓" : status === "active" ? "◉" : "○"}{" "}
      {label}
    </span>
  );
}

export const GoalProgressRail = memo(function GoalProgressRail({
  goal,
}: GoalProgressRailProps) {
  if (!goal) {
    return (
      <div className="facility-goal-rail facility-goal-rail-empty">
        <span className="facility-goal-empty-label">No active founder goal</span>
      </div>
    );
  }

  return (
    <div className="facility-goal-rail">
      <div className="facility-goal-header">
        <span className="facility-goal-label">Founder Goal</span>
        <span className="facility-goal-title">{goal.founderGoal}</span>
      </div>

      <div className="facility-goal-progress-wrap">
        <div className="facility-goal-progress-track">
          <motion.div
            className="facility-goal-progress-fill"
            initial={false}
            animate={{ width: `${goal.progressPct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
        <span className="facility-goal-pct">{goal.progressPct}%</span>
      </div>

      <div className="facility-goal-checkpoints">
        {CHECKPOINT_ORDER.map((id) => (
          <CheckpointChip
            key={id}
            label={CHECKPOINT_LABELS[id]}
            status={goal.checkpoints[id].status}
          />
        ))}
      </div>
    </div>
  );
});
