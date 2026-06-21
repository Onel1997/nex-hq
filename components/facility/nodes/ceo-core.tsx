"use client";

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
  const isActive = opsState === "executing" || opsState === "review";

  return (
    <button
      type="button"
      className={cn(
        "facility-node facility-ceo-chamber",
        `facility-chamber-${opsState}`,
        isActive && "facility-chamber-active",
        showVerdict && "facility-ceo-verdict-mode",
        verdictPulse && "facility-ceo-verdict-pulse",
        selected && "facility-chamber-selected",
        className,
      )}
      style={
        {
          ...style,
          "--chamber-accent": CEO_COLOR,
          "--chamber-glow": "rgb(255 209 102 / 0.45)",
        } as React.CSSProperties
      }
      onClick={onSelect}
      aria-label="Open CEO Core inspector"
    >
      <div className="facility-chamber-frame facility-ceo-chamber-frame" aria-hidden>
        <div className="facility-chamber-frame-edge facility-chamber-frame-top" />
        <div className="facility-chamber-frame-edge facility-chamber-frame-left" />
        <div className="facility-chamber-frame-edge facility-chamber-frame-right" />
        <div className="facility-chamber-frame-edge facility-chamber-frame-bottom" />
      </div>

      <div className="facility-ceo-chamber-viewport">
        <div className="facility-ceo-command-grid" aria-hidden />
        <motion.div
          className="facility-ceo-orbit-ring facility-ceo-orbit-ring-outer"
          animate={{ rotate: -360 }}
          transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
          aria-hidden
        />
        <motion.div
          className="facility-ceo-orbit-ring"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          aria-hidden
        />
        <div className="facility-ceo-command-particles" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <motion.span
              key={i}
              className="facility-ceo-command-particle"
              style={{ "--particle-i": i } as React.CSSProperties}
              animate={{ opacity: [0.25, 0.9, 0.25], scale: [0.85, 1.15, 0.85] }}
              transition={{
                duration: 2.4 + i * 0.3,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.35,
              }}
            />
          ))}
        </div>
        <motion.div
          className="facility-ceo-energy-core"
          animate={
            isActive
              ? { opacity: [0.4, 0.85, 0.4], scale: [0.95, 1.05, 0.95] }
              : { opacity: 0.25 }
          }
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        />
        <div className="facility-ch-env-atmo facility-ch-env-atmo-gold" />
      </div>

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

      <div className="facility-chamber-hud facility-ceo-chamber-hud">
        <div className="facility-chamber-hud-top">
          <Crown className="facility-ceo-crown-icon" strokeWidth={1.5} />
          <span className="facility-chamber-callsign">CEO Core</span>
          <span
            className={cn(
              "facility-chamber-state",
              `facility-chamber-state-${opsState}`,
            )}
          >
            {decisionStatus}
          </span>
        </div>
        <p className="facility-chamber-thought">{presence.currentActivity}</p>
        <p className="facility-ceo-rank">Executive Command</p>
        {showVerdict && verdict && <VerdictBadge verdict={verdict} />}
      </div>
    </button>
  );
});
