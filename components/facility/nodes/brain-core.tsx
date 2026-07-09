"use client";

import { BrainPulse, NeuralNexus } from "@/components/facility/motion";
import { BrainKnowledgePanel } from "@/components/facility/nodes/brain-knowledge-panel";
import {
  deriveBrainNexusState,
  deriveBrainStatusLabel,
} from "@/lib/facility/derive-brain-nexus-state";
import { FACILITY_SILENT_CORE } from "@/lib/facility/silent-core";
import type {
  BrainCoreStats,
  BrainPulseKind,
  FacilityLabId,
  KnowledgeFlowSequence,
  LabSnapshot,
  NetworkSurgeMode,
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
  networkSurge?: NetworkSurgeMode;
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
  networkSurge = "none",
  knowledgeFlow = null,
  failedTasks = 0,
  className,
  style,
}: BrainCoreProps) {
  const isSurge = pulse !== "none";
  const synthesisMode =
    pulse === "final-report" || networkSurge === "final-report";

  const nexusContext = useMemo(
    () => ({
      pulse,
      activeExecutions: stats.activeExecutions,
      failedTasks,
      ceoOpsState: labs.ceo.opsState,
      labs,
      networkSurge,
    }),
    [pulse, stats.activeExecutions, failedTasks, labs, networkSurge],
  );

  const nexusState = useMemo(
    () => deriveBrainNexusState(nexusContext),
    [nexusContext],
  );

  const statusLabel = useMemo(
    () => deriveBrainStatusLabel(nexusContext),
    [nexusContext],
  );

  return (
    <div
      className={cn(
        "facility-brain-nexus-stack facility-brain-nexus-v4",
        `facility-brain-nexus-${nexusState}`,
        !FACILITY_SILENT_CORE && "facility-brain-nexus-routing",
        isSurge && "facility-brain-nexus-surging",
        synthesisMode && "facility-brain-nexus-synthesis",
        knowledgeFlow && "facility-brain-nexus-receiving",
        networkPulse && "facility-brain-nexus-streaming",
        className,
      )}
      style={style}
    >
      <div className="facility-brain-nexus-chamber" data-facility-nexus="chamber">
        <div className="facility-brain-status" data-status={statusLabel}>
          <span className="facility-brain-status-dot" aria-hidden />
          <span className="facility-brain-status-label">{statusLabel}</span>
        </div>

        <div className="facility-brain-nexus-frame">
          <NeuralNexus
            state={nexusState}
            labs={labs}
            knowledgeFlow={knowledgeFlow}
            surge={isSurge}
            pulse={pulse}
            networkSurge={networkSurge}
            activeExecutions={stats.activeExecutions}
          />
          <BrainPulse
            kind={pulse}
            intensity={pulseIntensity}
            networkPulse={networkPulse}
            synthesisMode={synthesisMode}
          />
        </div>
      </div>

      <BrainKnowledgePanel knowledge={stats.knowledge} />
    </div>
  );
});
