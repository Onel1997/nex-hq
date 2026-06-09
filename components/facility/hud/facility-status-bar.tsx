"use client";

import type { FacilityTelemetry } from "@/lib/facility/types";
import { cn } from "@/lib/utils";

interface FacilityStatusBarProps {
  workspaceName: string;
  telemetry: FacilityTelemetry;
  connected?: boolean;
}

function TelemetryChip({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "facility-telemetry-chip",
        highlight && "facility-telemetry-chip-highlight",
      )}
    >
      <span className="facility-telemetry-value">{value}</span>
      <span className="facility-telemetry-label">{label}</span>
    </div>
  );
}

export function FacilityStatusBar({
  workspaceName,
  telemetry,
  connected = true,
}: FacilityStatusBarProps) {
  return (
    <header className="facility-status-bar">
      <div className="facility-status-left">
        <span className="facility-status-title">NEXHQ FACILITY OPS</span>
        <span className="facility-status-divider">·</span>
        <span className="facility-status-workspace">{workspaceName}</span>
      </div>

      <div className="facility-status-right">
        <div className="facility-live-indicator">
          <span
            className={cn(
              "facility-live-dot",
              connected && telemetry.live && "facility-live-dot-active",
            )}
          />
          <span className="facility-live-label">
            {connected ? (telemetry.live ? "LIVE" : "STANDBY") : "RECONNECT"}
          </span>
        </div>
        <TelemetryChip
          label="Active Executions"
          value={telemetry.activeExecutions}
          highlight={telemetry.activeExecutions > 0}
        />
        <TelemetryChip
          label="Pending Review"
          value={telemetry.pendingReview}
          highlight={telemetry.pendingReview > 0}
        />
        <TelemetryChip
          label="Completed Today"
          value={telemetry.completedToday}
        />
        <TelemetryChip
          label="Failed Tasks"
          value={telemetry.failedTasks}
          highlight={telemetry.failedTasks > 0}
        />
      </div>
    </header>
  );
}
