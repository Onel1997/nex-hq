"use client";

import type { AgentId } from "@/lib/constants/agents";
import type { PlaceholderLabId } from "@/lib/facility/placeholder-labs";
import type { LabOpsState } from "@/lib/facility/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { memo } from "react";

export type ChamberEnvironmentId =
  | Exclude<AgentId, "ceo">
  | PlaceholderLabId;

interface ChamberEnvironmentProps {
  agentId: ChamberEnvironmentId;
  opsState: LabOpsState;
  active: boolean;
}

export const ChamberEnvironment = memo(function ChamberEnvironment({
  agentId,
  opsState,
  active,
}: ChamberEnvironmentProps) {
  const live =
    active ||
    opsState === "executing" ||
    opsState === "review" ||
    opsState === "queued";

  return (
    <div
      className={cn(
        "facility-chamber-env",
        `facility-chamber-env-${agentId}`,
        live && "facility-chamber-env-live",
        `facility-chamber-env-${opsState}`,
      )}
      aria-hidden
    >
      {agentId === "research" && <ResearchEnvironment live={live} />}
      {agentId === "designer" && <DesignEnvironment live={live} />}
      {agentId === "marketing" && <MarketingEnvironment live={live} />}
      {agentId === "content" && <ContentEnvironment live={live} />}
      {agentId === "image" && <ImageEnvironment live={live} />}
      {agentId === "shopify" && <ShopifyEnvironment live={live} />}
      {agentId === "analytics" && <AnalyticsEnvironment live={live} />}
      {agentId === "operations" && <OperationsEnvironment live={live} />}
      {agentId === "commerce" && <CommerceEnvironment live={live} />}
    </div>
  );
});

function ResearchEnvironment({ live }: { live: boolean }) {
  return (
    <>
      <div className="facility-ch-env-radar">
        <motion.div
          className="facility-ch-env-radar-sweep"
          animate={live ? { rotate: 360 } : undefined}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />
        <div className="facility-ch-env-radar-grid" />
      </div>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="facility-ch-env-data-ring"
          style={{ inset: `${8 + i * 10}%` }}
          animate={live ? { rotate: i % 2 === 0 ? 360 : -360 } : undefined}
          transition={{ duration: 12 + i * 4, repeat: Infinity, ease: "linear" }}
        />
      ))}
      {[0, 1, 2].map((i) => (
        <motion.span
          key={`doc-${i}`}
          className="facility-ch-env-doc"
          style={{ left: `${18 + i * 22}%`, top: `${20 + (i % 2) * 18}%` }}
          animate={
            live
              ? { y: [0, -4, 0], opacity: [0.4, 0.9, 0.4] }
              : { opacity: 0.2 }
          }
          transition={{ duration: 2.5 + i * 0.3, repeat: Infinity, delay: i * 0.4 }}
        />
      ))}
      <div className="facility-ch-env-atmo facility-ch-env-atmo-purple" />
    </>
  );
}

function DesignEnvironment({ live }: { live: boolean }) {
  return (
    <>
      <div className="facility-ch-env-blueprint" />
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="facility-ch-env-panel"
          style={{
            left: `${12 + i * 24}%`,
            top: `${16 + (i % 2) * 20}%`,
            rotate: `${-6 + i * 4}deg`,
          }}
          animate={
            live
              ? { y: [0, -5, 0], opacity: [0.45, 0.95, 0.45] }
              : { opacity: 0.25 }
          }
          transition={{ duration: 3 + i * 0.4, repeat: Infinity, delay: i * 0.35 }}
        />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={`card-${i}`}
          className="facility-ch-env-concept-card"
          style={{ left: `${20 + i * 16}%`, bottom: `${22 + (i % 2) * 8}%` }}
          animate={live ? { scale: [0.95, 1.04, 0.95] } : undefined}
          transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.25 }}
        />
      ))}
      <div className="facility-ch-env-atmo facility-ch-env-atmo-cyan" />
    </>
  );
}

function MarketingEnvironment({ live }: { live: boolean }) {
  return (
    <>
      <div className="facility-ch-env-chart">
        {[35, 55, 42, 72, 48, 65].map((h, i) => (
          <motion.span
            key={i}
            className="facility-ch-env-chart-bar"
            animate={live ? { height: [`${h * 0.5}%`, `${h}%`] } : undefined}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              repeatType: "reverse",
              delay: i * 0.12,
            }}
          />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="facility-ch-env-signal-wave"
          style={{ bottom: `${28 + i * 12}%` }}
          animate={
            live
              ? { scaleX: [0.2, 1, 0.2], opacity: [0.3, 0.85, 0.3] }
              : { opacity: 0.15 }
          }
          transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.5 }}
        />
      ))}
      <div className="facility-ch-env-atmo facility-ch-env-atmo-orange" />
    </>
  );
}

function ContentEnvironment({ live }: { live: boolean }) {
  return (
    <>
      <div className="facility-ch-env-text-stream">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.span
            key={i}
            className="facility-ch-env-text-line"
            style={{ width: `${40 + (i % 3) * 18}%` }}
            animate={
              live
                ? { opacity: [0.15, 0.75, 0.15], x: [0, 3, 0] }
                : { opacity: 0.12 }
            }
            transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.22 }}
          />
        ))}
      </div>
      {live && (
        <div className="facility-ch-env-typing">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.18,
              }}
            />
          ))}
        </div>
      )}
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.span
          key={`p-${i}`}
          className="facility-ch-env-blue-particle"
          style={{ left: `${10 + i * 18}%`, top: `${25 + (i % 3) * 15}%` }}
          animate={
            live
              ? { y: [0, -10, 0], opacity: [0, 0.8, 0] }
              : { opacity: 0 }
          }
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.35 }}
        />
      ))}
      <div className="facility-ch-env-atmo facility-ch-env-atmo-blue" />
    </>
  );
}

function ImageEnvironment({ live }: { live: boolean }) {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="facility-ch-env-visual-tile"
          style={{
            left: `${10 + (i % 2) * 38}%`,
            top: `${18 + Math.floor(i / 2) * 28}%`,
            rotate: `${-4 + i * 3}deg`,
          }}
          animate={
            live
              ? { opacity: [0.35, 0.9, 0.35], scale: [0.96, 1.03, 0.96] }
              : { opacity: 0.2 }
          }
          transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3 }}
        />
      ))}
      {[0, 1, 2].map((i) => (
        <motion.span
          key={`frag-${i}`}
          className="facility-ch-env-image-fragment"
          style={{ right: `${12 + i * 14}%`, top: `${22 + i * 12}%` }}
          animate={
            live
              ? { rotate: [0, 8, 0], opacity: [0.3, 0.8, 0.3] }
              : { opacity: 0.15 }
          }
          transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}
        />
      ))}
      <div className="facility-ch-env-atmo facility-ch-env-atmo-magenta" />
    </>
  );
}

function ShopifyEnvironment({ live }: { live: boolean }) {
  return (
    <>
      <div className="facility-ch-env-commerce-grid" />
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="facility-ch-env-commerce-icon"
          style={{ left: `${20 + i * 22}%`, top: `${24 + (i % 2) * 18}%` }}
          animate={live ? { y: [0, -3, 0], opacity: [0.4, 1, 0.4] } : { opacity: 0.2 }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.35 }}
        />
      ))}
      {[0, 1].map((i) => (
        <motion.span
          key={`tx-${i}`}
          className="facility-ch-env-tx-pulse"
          style={{ bottom: `${30 + i * 14}%` }}
          animate={
            live
              ? { scaleX: [0.3, 1, 0.3], opacity: [0.25, 0.85, 0.25] }
              : { opacity: 0.12 }
          }
          transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.45 }}
        />
      ))}
      <div className="facility-ch-env-atmo facility-ch-env-atmo-green" />
    </>
  );
}

function AnalyticsEnvironment({ live }: { live: boolean }) {
  return (
    <>
      <svg className="facility-ch-env-graph" viewBox="0 0 100 50" preserveAspectRatio="none">
        <motion.polyline
          points="0,40 15,32 30,36 45,18 60,24 75,10 90,14 100,8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          animate={live ? { opacity: [0.3, 0.9, 0.3] } : { opacity: 0.2 }}
          transition={{ duration: 2.5, repeat: Infinity }}
        />
      </svg>
      <div className="facility-ch-env-metrics">
        {["42%", "1.2k", "89"].map((m, i) => (
          <motion.span
            key={m}
            animate={live ? { opacity: [0.3, 0.85, 0.3] } : { opacity: 0.2 }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
          >
            {m}
          </motion.span>
        ))}
      </div>
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          className="facility-ch-env-data-particle"
          style={{ left: `${15 + i * 20}%`, top: `${30 + (i % 2) * 20}%` }}
          animate={
            live
              ? { y: [0, -8, 0], opacity: [0, 0.7, 0] }
              : { opacity: 0 }
          }
          transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.3 }}
        />
      ))}
      <div className="facility-ch-env-atmo facility-ch-env-atmo-violet" />
    </>
  );
}

function OperationsEnvironment({ live }: { live: boolean }) {
  return (
    <>
      <div className="facility-ch-env-task-queue">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="facility-ch-env-queue-item"
            animate={
              live
                ? { opacity: [0.25, 0.85, 0.25], x: [0, 2, 0] }
                : { opacity: 0.15 }
            }
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.25 }}
          />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="facility-ch-env-exec-indicator"
          style={{ right: `${14 + i * 8}%`, top: `${20 + i * 14}%` }}
          animate={live ? { opacity: [0.2, 1, 0.2] } : { opacity: 0.15 }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
      <div className="facility-ch-env-atmo facility-ch-env-atmo-teal" />
    </>
  );
}

function CommerceEnvironment({ live }: { live: boolean }) {
  return (
    <>
      <div className="facility-ch-env-commerce-shelf">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="facility-ch-env-shelf-item"
            animate={live ? { opacity: [0.3, 0.8, 0.3] } : { opacity: 0.15 }}
            transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.35 }}
          />
        ))}
      </div>
      <motion.div
        className="facility-ch-env-catalog-scan"
        animate={live ? { top: ["15%", "75%"] } : undefined}
        transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
      />
      <div className="facility-ch-env-atmo facility-ch-env-atmo-amber" />
    </>
  );
}
