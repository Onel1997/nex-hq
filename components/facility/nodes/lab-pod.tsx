"use client";

import { ActivityRing, ThinkingIndicator } from "@/components/facility/motion";
import { LabIdentityVisual } from "@/components/facility/motion/lab-identity-visual";
import { getAgentColor, getAgentGlow } from "@/lib/facility/facility-theme";
import type { AgentId } from "@/lib/constants/agents";
import type { LabSnapshot } from "@/lib/facility/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Megaphone,
  Palette,
  PenLine,
  Search,
  ShoppingBag,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { memo } from "react";

const LAB_ICONS: Record<Exclude<AgentId, "ceo">, LucideIcon> = {
  research: Search,
  designer: Palette,
  marketing: Megaphone,
  content: PenLine,
  image: Wand2,
  shopify: ShoppingBag,
};

const LAB_SHORT_LABELS: Record<Exclude<AgentId, "ceo">, string> = {
  research: "Research Lab",
  designer: "Design Lab",
  marketing: "Marketing Lab",
  content: "Content Lab",
  image: "Image Lab",
  shopify: "Shopify Lab",
};

const OPS_LABELS = {
  idle: "Standby",
  queued: "Queued",
  executing: "Executing",
  review: "Review",
  approved: "Complete",
  error: "Error",
} as const;

interface LabPodProps {
  lab: LabSnapshot;
  nodeSize: number;
  selected?: boolean;
  highlighted?: boolean;
  onSelect?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const LabPod = memo(function LabPod({
  lab,
  nodeSize,
  selected = false,
  highlighted = false,
  onSelect,
  className,
  style,
}: LabPodProps) {
  const agentId = lab.agentId as Exclude<AgentId, "ceo">;
  const Icon = LAB_ICONS[agentId];
  const shortLabel = LAB_SHORT_LABELS[agentId];
  const { presence } = lab;
  const isActive = lab.opsState === "executing" || lab.opsState === "review";
  const agentColor = getAgentColor(agentId);
  const showProgressBar =
    presence.progress !== null && lab.opsState === "executing";

  return (
    <button
      type="button"
      className={cn(
        "facility-node facility-lab-chamber",
        `facility-lab-${lab.opsState}`,
        isActive && "facility-lab-active",
        selected && "facility-lab-selected",
        highlighted && "facility-lab-highlighted",
        className,
      )}
      style={
        {
          ...style,
          "--agent-color": agentColor,
          "--agent-glow": getAgentGlow(agentId, 0.45),
        } as React.CSSProperties
      }
      onClick={onSelect}
      aria-label={`Open ${shortLabel} chamber`}
    >
      <LabIdentityVisual
        agentId={agentId}
        opsState={lab.opsState}
        color={agentColor}
      />
      <div className="facility-lab-containment-field" aria-hidden />
      <div className="facility-lab-containment-ring" aria-hidden />
      <ActivityRing
        key={`${lab.agentId}-${lab.opsState}-${lab.activeTask?.id ?? "none"}`}
        size={nodeSize}
        state={lab.opsState}
        progress={presence.progress}
        agentColor={agentColor}
      />
      <ThinkingIndicator
        opsState={lab.opsState}
        thinkingState={presence.thinkingState}
        size="sm"
        accentColor={agentColor}
      />

      {isActive && (
        <div className="facility-lab-particles" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.span
              key={i}
              className="facility-lab-particle"
              style={{ background: agentColor }}
              animate={{
                opacity: [0, 0.8, 0],
                y: [0, -12 - i * 2, 0],
                x: [0, i % 2 === 0 ? 6 : -6, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.35,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      )}

      <div className="facility-lab-glow" aria-hidden />
      <div className="facility-lab-chamber-inner">
        <div className="facility-lab-header">
          <Icon
            className="facility-lab-icon"
            strokeWidth={1.5}
            style={{ color: agentColor }}
          />
          <span
            className={cn(
              "facility-lab-state-badge",
              `facility-lab-state-${lab.opsState}`,
            )}
          >
            {OPS_LABELS[lab.opsState]}
          </span>
        </div>

        <p className="facility-lab-name">{shortLabel}</p>
        <p className="facility-lab-activity">{presence.currentActivity}</p>

        <div className="facility-lab-progress-row">
          {presence.progressLabel ? (
            <span className="facility-lab-progress-label">
              {presence.progressLabel}
            </span>
          ) : presence.progress !== null ? (
            <span className="facility-lab-progress-label">
              {presence.progress}%
            </span>
          ) : (
            <span className="facility-lab-progress-label facility-lab-progress-muted">
              —
            </span>
          )}
          {showProgressBar && (
            <div className="facility-lab-progress-bar">
              <motion.div
                className="facility-lab-progress-fill"
                style={{
                  background: `linear-gradient(90deg, ${agentColor}, color-mix(in srgb, ${agentColor} 60%, white))`,
                }}
                initial={false}
                animate={{ width: `${presence.progress}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          )}
        </div>

        {presence.confidence !== null && (
          <p className="facility-lab-confidence-row">
            Confidence {presence.confidence}%
          </p>
        )}
      </div>
    </button>
  );
});
