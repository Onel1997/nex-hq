"use client";

import type { CommandHistoryEntry } from "@/components/facility/hooks/use-command-history";
import { EventStreamPanel } from "@/components/facility/hud/event-stream-panel";
import { GoalProgressRail } from "@/components/facility/hud/goal-progress-rail";
import { ReviewQueuePanel } from "@/components/facility/hud/review-queue-panel";
import {
  CommandDock,
  type DelegationStatus,
} from "@/components/facility/hud/command-dock";
import { FacilityHud } from "@/components/facility/facility-hud";
import { FacilityScene } from "@/components/facility/scene/facility-scene";
import type { AgentId } from "@/lib/constants/agents";
import type { BrainPulseKind, FacilitySnapshot } from "@/lib/facility/types";
import { Loader2 } from "lucide-react";

interface FacilityShellProps {
  data: FacilitySnapshot | null;
  loading: boolean;
  error: string | null;
  connected: boolean;
  selectedLabId: AgentId | null;
  highlightedLabs: AgentId[];
  delegationPulse: BrainPulseKind;
  commandHistory: CommandHistoryEntry[];
  delegationStatus: DelegationStatus;
  delegationMessage?: string;
  onLabSelect: (agentId: AgentId) => void;
  onDelegate: (goal: string) => void;
}

export function FacilityShell({
  data,
  loading,
  error,
  connected,
  selectedLabId,
  highlightedLabs,
  delegationPulse,
  commandHistory,
  delegationStatus,
  delegationMessage,
  onLabSelect,
  onDelegate,
}: FacilityShellProps) {
  return (
    <div className="facility-shell">
      {loading && !data ? (
        <div className="facility-loading">
          <Loader2 className="size-8 animate-spin text-[var(--facility-glow-gold)]" />
          <p className="facility-loading-text">Initializing facility…</p>
        </div>
      ) : error && !data ? (
        <div className="facility-error">
          <p className="facility-error-title">Facility offline</p>
          <p className="facility-error-message">{error}</p>
        </div>
      ) : data ? (
        <>
          <FacilityHud data={data} connected={connected} />
          <div className="facility-main">
            <ReviewQueuePanel items={data.reviewQueue} />
            <div className="facility-scene-wrap">
              <FacilityScene
                data={data}
                selectedLabId={selectedLabId}
                highlightedLabs={highlightedLabs}
                delegationPulse={delegationPulse}
                onLabSelect={onLabSelect}
              />
              <CommandDock
                history={commandHistory}
                status={delegationStatus}
                statusMessage={delegationMessage}
                onSubmit={onDelegate}
              />
            </div>
            <EventStreamPanel events={data.events} />
          </div>
          <GoalProgressRail goal={data.goal} />
        </>
      ) : null}
    </div>
  );
}
