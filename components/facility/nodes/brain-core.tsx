"use client";

import { BrainPulse, NeuralNexus } from "@/components/facility/motion";
import { BrainKnowledgePanel } from "@/components/facility/nodes/brain-knowledge-panel";
import {
  deriveBrainNexusState,
} from "@/lib/facility/derive-brain-nexus-state";
import type {
  BrainCoreStats,
  BrainPulseKind,
  FacilityLabId,
  KnowledgeFlowSequence,
  LabSnapshot,
  PulseIntensity,
} from "@/lib/facility/types";
import { cn } from "@/lib/utils";
import { memo, useMemo } from "react";

interface BrainCoreProps {
  stats: BrainCoreStats;
  labs: Record<FacilityLabId, LabSnapshot>;
  pulse?: BrainPulseKind;
  pulseIntensity?: PulseIntensity;
  networkPulse?: boolean;
  knowledgeFlow?: KnowledgeFlowSequence | null;
  failedTasks?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const BrainCore = memo(function BrainCore({
  stats,
  labs,
  pulse = "none",
  pulseIntensity = "medium",
  networkPulse = false,
  knowledgeFlow = null,
  failedTasks = 0,
  className,
  style,
}: BrainCoreProps) {
  const isSurge = pulse !== "none";

  const nexusState = useMemo(
    () =>
      deriveBrainNexusState({
        pulse,
        activeExecutions: stats.activeExecutions,
        failedTasks,
        ceoOpsState: labs.ceo.opsState,
        labs,
      }),
    [pulse, stats.activeExecutions, failedTasks, labs],
  );

  return (
    <div
      className={cn(
        "facility-brain-nexus-stack",
        `facility-brain-nexus-${nexusState}`,
        isSurge && "facility-brain-nexus-surging",
        knowledgeFlow && "facility-brain-nexus-receiving",
        className,
      )}
      style={style}
    >
      <div className="facility-brain-nexus-chamber">
        <div className="facility-brain-nexus-frame">
          <NeuralNexus
            state={nexusState}
            labs={labs}
            knowledgeFlow={knowledgeFlow}
            surge={isSurge}
          />
          <BrainPulse
            kind={pulse}
            intensity={pulseIntensity}
            networkPulse={networkPulse}
          />
        </div>
      </div>

      <BrainKnowledgePanel knowledge={stats.knowledge} />
    </div>
  );
});
