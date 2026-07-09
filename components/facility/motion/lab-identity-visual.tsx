"use client";

import type { AgentId } from "@/lib/constants/agents";
import type { LabOpsState } from "@/lib/facility/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { memo } from "react";

type SpecialistId = Exclude<AgentId, "ceo">;

interface LabIdentityVisualProps {
  agentId: SpecialistId;
  opsState: LabOpsState;
  color: string;
}

export const LabIdentityVisual = memo(function LabIdentityVisual({
  agentId,
  opsState,
  color,
}: LabIdentityVisualProps) {
  const active =
    opsState === "executing" || opsState === "review" || opsState === "queued";

  return (
    <div
      className={cn(
        "facility-lab-identity",
        `facility-lab-identity-${agentId}`,
        active && "facility-lab-identity-active",
      )}
      aria-hidden
      style={{ "--lab-accent": color } as React.CSSProperties}
    >
      {agentId === "research" && <ResearchIdentity active={active} />}
      {agentId === "designer" && <DesignIdentity active={active} />}
      {agentId === "marketing" && <MarketingIdentity active={active} />}
      {agentId === "shopify" && <ShopifyIdentity active={active} />}
      {agentId === "content" && <ContentIdentity active={active} />}
      {agentId === "image" && <ImageIdentity active={active} />}
    </div>
  );
});

function ResearchIdentity({ active }: { active: boolean }) {
  return (
    <>
      <div className="facility-lab-id-scanner" />
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="facility-lab-id-data-stream"
          style={{ top: `${28 + i * 18}%` }}
          animate={active ? { x: ["-120%", "120%"] } : { opacity: 0.25 }}
          transition={{
            duration: 2.2 + i * 0.4,
            repeat: Infinity,
            ease: "linear",
            delay: i * 0.3,
          }}
        />
      ))}
      <div className="facility-lab-id-scan-grid" />
    </>
  );
}

function DesignIdentity({ active }: { active: boolean }) {
  const swatches = ["#F472B6", "#A78BFA", "#38BDF8", "#FBBF24", "#34D399"];
  return (
    <div className="facility-lab-id-moodboard">
      {swatches.map((c, i) => (
        <motion.span
          key={c}
          className="facility-lab-id-swatch"
          style={{ background: c }}
          animate={
            active
              ? { scale: [1, 1.08, 1], opacity: [0.5, 0.9, 0.5] }
              : { opacity: 0.35 }
          }
          transition={{
            duration: 2.5,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}

function MarketingIdentity({ active }: { active: boolean }) {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="facility-lab-id-reach-ring"
          style={{ inset: `${12 + i * 10}%` }}
          animate={
            active
              ? { scale: [0.85, 1.15], opacity: [0.5, 0] }
              : { opacity: 0.15 }
          }
          transition={{
            duration: 2.8,
            repeat: Infinity,
            delay: i * 0.6,
            ease: "easeOut",
          }}
        />
      ))}
      <div className="facility-lab-id-growth-bars">
        {[40, 65, 50, 80, 55].map((h, i) => (
          <motion.span
            key={i}
            className="facility-lab-id-growth-bar"
            animate={active ? { height: [`${h * 0.6}%`, `${h}%`] } : {}}
            transition={{ duration: 1.2, repeat: Infinity, repeatType: "reverse", delay: i * 0.15 }}
          />
        ))}
      </div>
    </>
  );
}

function ShopifyIdentity({ active }: { active: boolean }) {
  return (
    <>
      <div className="facility-lab-id-commerce-grid" />
      {[0, 1].map((i) => (
        <motion.span
          key={i}
          className="facility-lab-id-revenue-pulse"
          style={{ bottom: `${22 + i * 14}%` }}
          animate={active ? { scaleX: [0.3, 1, 0.3], opacity: [0.3, 0.8, 0.3] } : { opacity: 0.2 }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
        />
      ))}
      <span className="facility-lab-id-store-dot" />
    </>
  );
}

function ContentIdentity({ active }: { active: boolean }) {
  return (
    <div className="facility-lab-id-pipeline">
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          className="facility-lab-id-pipeline-stage"
          animate={
            active
              ? { opacity: [0.2, 1, 0.2], x: [0, 4, 0] }
              : { opacity: 0.25 }
          }
          transition={{
            duration: 1.8,
            repeat: Infinity,
            delay: i * 0.35,
          }}
        />
      ))}
      <motion.span
        className="facility-lab-id-pipeline-flow"
        animate={active ? { left: ["0%", "85%"] } : { opacity: 0.2 }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

function ImageIdentity({ active }: { active: boolean }) {
  return (
    <>
      <span className="facility-lab-id-gen-frame facility-lab-id-gen-tl" />
      <span className="facility-lab-id-gen-frame facility-lab-id-gen-tr" />
      <span className="facility-lab-id-gen-frame facility-lab-id-gen-bl" />
      <span className="facility-lab-id-gen-frame facility-lab-id-gen-br" />
      <motion.span
        className="facility-lab-id-gen-core"
        animate={
          active
            ? { opacity: [0.3, 0.85, 0.3], scale: [0.92, 1.05, 0.92] }
            : { opacity: 0.2 }
        }
        transition={{ duration: 2.2, repeat: Infinity }}
      />
      {active &&
        [0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="facility-lab-id-render-line"
            style={{ top: `${35 + i * 12}%` }}
            animate={{ scaleX: [0, 1, 0], opacity: [0, 0.7, 0] }}
            transition={{
              duration: 1.6,
              repeat: Infinity,
              delay: i * 0.4,
            }}
          />
        ))}
    </>
  );
}
