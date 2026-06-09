"use client";

import { ActivityRing } from "@/components/facility/motion";
import type { AgentId } from "@/lib/constants/agents";
import type { LabOpsState, LabSnapshot } from "@/lib/facility/types";
import { cn } from "@/lib/utils";
import {
  Crown,
  Megaphone,
  Palette,
  PenLine,
  Search,
  ShoppingBag,
  Wand2,
  type LucideIcon,
} from "lucide-react";

const LAB_ICONS: Record<AgentId, LucideIcon> = {
  ceo: Crown,
  research: Search,
  designer: Palette,
  marketing: Megaphone,
  content: PenLine,
  image: Wand2,
  shopify: ShoppingBag,
};

const LAB_SHORT_LABELS: Record<AgentId, string> = {
  ceo: "CEO Core",
  research: "Research Lab",
  designer: "Design Lab",
  marketing: "Marketing Lab",
  content: "Content Lab",
  image: "Image Lab",
  shopify: "Shopify Lab",
};

const OPS_STATE_LABELS: Record<LabOpsState, string> = {
  idle: "Idle",
  queued: "Queued",
  executing: "Executing",
  review: "Review",
  approved: "Approved",
  error: "Error",
};

interface LabPodProps {
  lab: LabSnapshot;
  nodeSize: number;
  selected?: boolean;
  highlighted?: boolean;
  onSelect?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function LabPod({
  lab,
  nodeSize,
  selected = false,
  highlighted = false,
  onSelect,
  className,
  style,
}: LabPodProps) {
  const Icon = LAB_ICONS[lab.agentId];
  const shortLabel = LAB_SHORT_LABELS[lab.agentId];

  return (
    <button
      type="button"
      className={cn(
        "facility-node facility-lab-pod",
        `facility-lab-${lab.opsState}`,
        selected && "facility-lab-selected",
        highlighted && "facility-lab-highlighted",
        className,
      )}
      style={style}
      onClick={onSelect}
      aria-label={`Open ${shortLabel} inspector`}
    >
      <ActivityRing
        key={`${lab.agentId}-${lab.opsState}-${lab.activeTask?.id ?? "none"}`}
        size={nodeSize}
        state={lab.opsState}
      />
      <div className="facility-lab-glow" aria-hidden />
      <div className="facility-node-inner">
        <div className="facility-lab-header">
          <Icon className="facility-lab-icon" strokeWidth={1.5} />
          <span
            className={cn(
              "facility-ops-dot",
              `facility-ops-dot-${lab.opsState}`,
            )}
          />
        </div>
        <p className="facility-lab-name">{shortLabel}</p>
        <p
          className={cn(
            "facility-ops-state",
            `facility-ops-state-${lab.opsState}`,
          )}
        >
          {OPS_STATE_LABELS[lab.opsState]}
        </p>
        <p className="facility-lab-task">
          {lab.activeTask?.title ?? "No active task"}
        </p>
        <p className="facility-lab-report">
          {lab.latestReport
            ? `${lab.latestReport.title} · ${lab.latestReport.status}`
            : "No report"}
        </p>
      </div>
    </button>
  );
}
