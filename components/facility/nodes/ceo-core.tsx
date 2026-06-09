"use client";

import { ThinkingIndicator } from "@/components/facility/motion";
import { getAgentColor } from "@/lib/facility/facility-theme";
import type { CeoCoreSnapshot, CeoVerdict, LabOpsState } from "@/lib/facility/types";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Crown } from "lucide-react";
import { memo } from "react";

interface CeoCoreProps {
  ceo: CeoCoreSnapshot;
  verdictPulse?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const CEO_COLOR = getAgentColor("ceo");

const DECISION_STATUS: Record<LabOpsState, string> = {
  idle: "Awaiting Directive",
  queued: "Mission Queued",
  executing: "Command Active",
  review: "Reviewing Intel",
  approved: "Directive Complete",
  error: "Command Interrupted",
};

function VerdictBadge({ verdict }: { verdict: CeoVerdict }) {
  const isApproved = verdict.mode === "approved";
  return (
    <motion.div
      className={cn(
        "facility-ceo-verdict",
        isApproved ? "facility-ceo-verdict-approved" : "facility-ceo-verdict-revision",
      )}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <span className="facility-ceo-verdict-label">{verdict.label}</span>
      <span className="facility-ceo-verdict-confidence">
        Confidence: {verdict.confidence}%
      </span>
    </motion.div>
  );
}

export const CeoCore = memo(function CeoCore({
  ceo,
  verdictPulse = false,
  selected = false,
  onSelect,
  className,
  style,
}: CeoCoreProps) {
  const { presence, opsState, verdict } = ceo;
  const showVerdict = verdict?.active && verdict.mode;
  const decisionStatus = showVerdict
    ? verdict!.label
    : DECISION_STATUS[opsState];

  return (
    <button
      type="button"
      className={cn(
        "facility-node facility-ceo-core-node",
        `facility-ceo-${opsState}`,
        showVerdict && "facility-ceo-verdict-mode",
        verdictPulse && "facility-ceo-verdict-pulse",
        selected && "facility-ceo-selected",
        className,
      )}
      style={
        {
          ...style,
          "--agent-color": CEO_COLOR,
        } as React.CSSProperties
      }
      onClick={onSelect}
      aria-label="Open CEO Core inspector"
    >
      <div className="facility-ceo-executive-ring" aria-hidden />
      <div className="facility-ceo-command-halo" aria-hidden />

      <motion.div
        className="facility-ceo-crown-ring"
        animate={{ rotate: 360 }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        aria-hidden
      />

      <motion.div
        className="facility-ceo-energy-field"
        animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.98, 1.03, 0.98] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />

      <AnimatePresence>
        {verdictPulse && (
          <motion.div
            key="verdict-wave"
            className="facility-ceo-command-wave"
            initial={{ scale: 0.7, opacity: 0.8 }}
            animate={{ scale: 2.2, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.8, ease: "easeOut" }}
            aria-hidden
          />
        )}
      </AnimatePresence>

      <ThinkingIndicator
        opsState={opsState}
        thinkingState={presence.thinkingState}
        size="md"
        accentColor={CEO_COLOR}
      />

      <div className="facility-node-inner facility-ceo-inner">
        <div className="facility-ceo-crown-wrap">
          <Crown className="facility-ceo-crown-icon" strokeWidth={1.5} />
        </div>
        <p className="facility-ceo-label">CEO Core</p>
        <p className="facility-ceo-rank">Executive Command</p>
        <p className="facility-ceo-decision-status">{decisionStatus}</p>
        <p className="facility-ceo-activity">{presence.currentActivity}</p>

        {showVerdict && verdict && <VerdictBadge verdict={verdict} />}
      </div>
    </button>
  );
});
