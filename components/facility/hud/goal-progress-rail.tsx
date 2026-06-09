"use client";

import { getAgentColor } from "@/lib/facility/facility-theme";
import type { GoalProgress } from "@/lib/facility/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Crosshair } from "lucide-react";
import { memo } from "react";

interface GoalProgressRailProps {
  goal: GoalProgress | null;
}

const CHECKPOINT_META = {
  research: { label: "Research", color: getAgentColor("research") },
  designer: { label: "Design", color: getAgentColor("designer") },
  marketing: { label: "Marketing", color: getAgentColor("marketing") },
  content: { label: "Content", color: getAgentColor("content") },
  shopify: { label: "Shopify", color: getAgentColor("shopify") },
} as const;

const CHECKPOINT_ORDER = [
  "research",
  "designer",
  "marketing",
  "content",
  "shopify",
] as const;

const MissionCheckpoint = memo(function MissionCheckpoint({
  label,
  status,
  color,
}: {
  label: string;
  status: "complete" | "active" | "pending";
  color: string;
}) {
  return (
    <motion.span
      className={cn(
        "facility-mission-chip",
        status === "complete" && "facility-mission-chip-complete",
        status === "active" && "facility-mission-chip-active",
        status === "pending" && "facility-mission-chip-pending",
      )}
      style={{ "--chip-color": color } as React.CSSProperties}
      layout
      animate={
        status === "active"
          ? { scale: [1, 1.04, 1], opacity: [0.85, 1, 0.85] }
          : undefined
      }
      transition={
        status === "active"
          ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
          : undefined
      }
    >
      <span className="facility-mission-chip-dot" />
      {label}
    </motion.span>
  );
});

export const GoalProgressRail = memo(function GoalProgressRail({
  goal,
}: GoalProgressRailProps) {
  if (!goal) {
    return (
      <div className="facility-mission-rail facility-mission-rail-empty">
        <Crosshair className="facility-mission-rail-icon" strokeWidth={1.5} />
        <span className="facility-mission-empty-label">
          No active mission — deploy from Mission Control
        </span>
      </div>
    );
  }

  const activeAgents = CHECKPOINT_ORDER.filter(
    (id) => goal.checkpoints[id].status === "active",
  );
  const completeCount = CHECKPOINT_ORDER.filter(
    (id) => goal.checkpoints[id].status === "complete",
  ).length;
  const phaseLabel =
    completeCount === CHECKPOINT_ORDER.length
      ? "MISSION COMPLETE"
      : activeAgents.length > 0
        ? `PHASE ${completeCount + 1} · ${activeAgents.length} ACTIVE`
        : `PHASE ${completeCount + 1} · STANDBY`;

  return (
    <div className="facility-mission-rail">
      <div className="facility-mission-rail-header">
        <Crosshair className="facility-mission-rail-icon" strokeWidth={1.5} />
        <div className="facility-mission-rail-titles">
          <span className="facility-mission-rail-label">Mission Progress</span>
          <span className="facility-mission-rail-title">{goal.founderGoal}</span>
        </div>
        <span className="facility-mission-phase">{phaseLabel}</span>
      </div>

      <div className="facility-mission-progress-wrap">
        <div className="facility-mission-progress-track">
          <motion.div
            className="facility-mission-progress-fill"
            initial={false}
            animate={{ width: `${goal.progressPct}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        </div>
        <span className="facility-mission-pct">{goal.progressPct}%</span>
      </div>

      <div className="facility-mission-checkpoints">
        {CHECKPOINT_ORDER.map((id) => (
          <MissionCheckpoint
            key={id}
            label={CHECKPOINT_META[id].label}
            status={goal.checkpoints[id].status}
            color={CHECKPOINT_META[id].color}
          />
        ))}
      </div>
    </div>
  );
});
