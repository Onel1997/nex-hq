"use client";

import type { CommandHistoryEntry } from "@/components/facility/hooks/use-command-history";
import { EventStreamPanel } from "@/components/facility/hud/event-stream-panel";
import { GoalProgressRail } from "@/components/facility/hud/goal-progress-rail";
import { ReviewQueuePanel } from "@/components/facility/hud/review-queue-panel";
import {
  CommandDock,
  type DelegationStatus,
} from "@/components/facility/hud/command-dock";
import { useFacilityStartup } from "@/components/facility/hooks/use-facility-startup";
import { FacilityHud } from "@/components/facility/facility-hud";
import { FacilityScene } from "@/components/facility/scene/facility-scene";
import type { AgentId } from "@/lib/constants/agents";
import {
  ACTIVE_FACILITY_THEME,
  getFacilityTheme,
  themeStyleProps,
} from "@/lib/facility/facility-theme";
import type { PlaceholderLabId } from "@/lib/facility/placeholder-labs";
import type { BrainPulseKind, FacilitySnapshot } from "@/lib/facility/types";
import { Loader2 } from "lucide-react";

const facilityTheme = getFacilityTheme(ACTIVE_FACILITY_THEME);

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
  onLabEnter: (agentId: AgentId) => void;
  onPlaceholderEnter?: (labId: PlaceholderLabId) => void;
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
  onLabEnter,
  onPlaceholderEnter,
  onDelegate,
}: FacilityShellProps) {
  const startup = useFacilityStartup(Boolean(data));

  return (
    <div
      className={`facility-shell ${facilityTheme.cssClass}`}
      style={themeStyleProps(ACTIVE_FACILITY_THEME)}
    >
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
          <div className="facility-main facility-main-immersive">
            <div
              className={`facility-scene-wrap${selectedLabId ? " facility-scene-wrap-zoomed" : ""}`}
            >
              <FacilityScene
                data={data}
                selectedLabId={selectedLabId}
                highlightedLabs={highlightedLabs}
                delegationPulse={delegationPulse}
                startup={startup}
                onLabSelect={onLabSelect}
                onLabEnter={onLabEnter}
                onPlaceholderEnter={onPlaceholderEnter}
              />
              <ReviewQueuePanel
                items={data.reviewQueue}
                startupReady={startup.isComplete}
              />
              <EventStreamPanel
                events={data.events}
                startupReady={startup.isComplete}
              />
              <CommandDock
                history={commandHistory}
                status={delegationStatus}
                statusMessage={delegationMessage}
                onSubmit={onDelegate}
              />
            </div>
          </div>
          <GoalProgressRail goal={data.goal} />
        </>
      ) : null}
    </div>
  );
}
