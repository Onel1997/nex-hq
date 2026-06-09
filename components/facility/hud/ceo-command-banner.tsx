"use client";

import { getAgentColor, getAgentGlow } from "@/lib/facility/facility-theme";
import type { CeoDecision } from "@/lib/facility/types";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, FileCheck, Send } from "lucide-react";
import { memo } from "react";

interface CeoCommandBannerProps {
  decisions: CeoDecision[];
}

const TYPE_ICON = {
  assign: Send,
  review: FileCheck,
  verdict: Crown,
} as const;

export const CeoCommandBanner = memo(function CeoCommandBanner({
  decisions,
}: CeoCommandBannerProps) {
  const active = decisions.slice(0, 3);

  return (
    <div className="facility-ceo-command-banners" aria-live="polite">
      <AnimatePresence mode="popLayout">
        {active.map((decision, index) => {
          const Icon = TYPE_ICON[decision.type];
          const accent = decision.targetAgentId
            ? getAgentColor(decision.targetAgentId)
            : getAgentColor("ceo");

          return (
            <motion.div
              key={decision.id}
              layout
              className={cn(
                "facility-ceo-decision-card",
                `facility-ceo-decision-${decision.type}`,
              )}
              style={
                {
                  "--decision-accent": accent,
                  "--decision-glow": getAgentGlow(
                    decision.targetAgentId ?? "ceo",
                    0.35,
                  ),
                  top: `${index * 2.75}rem`,
                } as React.CSSProperties
              }
              initial={{ opacity: 0, y: -12, x: 20 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, x: 30, scale: 0.95 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <Icon className="facility-ceo-decision-icon" strokeWidth={1.75} />
              <div className="facility-ceo-decision-body">
                <span className="facility-ceo-decision-prefix">CEO</span>
                <span className="facility-ceo-decision-label">
                  {decision.label}
                </span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
});
