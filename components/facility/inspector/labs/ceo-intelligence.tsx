"use client";

import { memo, useMemo } from "react";
import type { ReportListItem } from "@/lib/mock/reports";
import type { FacilityEvent, LabTaskSnapshot } from "@/lib/facility/types";
import { extractCeoIntelligence } from "@/lib/facility/lab-intelligence";
import { formatInspectorDate } from "@/lib/facility/lab-intelligence";
import {
  IntelReportRow,
  IntelSubsection,
} from "./intel-primitives";

interface CeoIntelligencePanelProps {
  reports: ReportListItem[];
  tasks: LabTaskSnapshot[];
  events: FacilityEvent[];
}

export const CeoIntelligencePanel = memo(function CeoIntelligencePanel({
  reports,
  tasks,
  events,
}: CeoIntelligencePanelProps) {
  const intel = useMemo(
    () => extractCeoIntelligence(reports, tasks, events),
    [reports, tasks, events],
  );

  const hasData =
    intel.currentObjective ||
    intel.activeDelegations.length > 0 ||
    intel.finalReports.length > 0 ||
    intel.recentDecisions.length > 0;

  if (!hasData) {
    return (
      <p className="facility-inspector-empty">
        No executive intelligence yet — delegate a founder goal to activate the CEO Core.
      </p>
    );
  }

  return (
    <div className="facility-intel-panel">
      {intel.currentObjective ? (
        <div className="facility-intel-highlight">
          <span className="facility-intel-highlight-label">Current Objective</span>
          <span className="facility-intel-highlight-value">{intel.currentObjective}</span>
        </div>
      ) : null}

      {intel.completionPercentage != null ? (
        <div className="facility-lab-room-confidence">
          <span className="facility-lab-room-confidence-value">
            {intel.completionPercentage}%
          </span>
          <div className="facility-lab-room-confidence-bar">
            <div
              className="facility-lab-room-confidence-fill"
              style={{ width: `${intel.completionPercentage}%` }}
            />
          </div>
          <span className="facility-inspector-meta">Completion</span>
        </div>
      ) : null}

      {intel.activeDelegations.length > 0 ? (
        <IntelSubsection label="Active Delegations">
          <ul className="facility-inspector-list facility-lab-room-list">
            {intel.activeDelegations.slice(0, 6).map((task) => (
              <li
                key={task.id}
                className="facility-inspector-list-item facility-lab-room-list-item"
              >
                <span>{task.title}</span>
                <span className="facility-inspector-meta">{task.status}</span>
              </li>
            ))}
          </ul>
        </IntelSubsection>
      ) : null}

      {intel.recentDecisions.length > 0 ? (
        <IntelSubsection label="Recent Decisions">
          <ul className="facility-intel-list">
            {intel.recentDecisions.map((d) => (
              <li key={`${d.timestamp}-${d.label}`} className="facility-intel-list-item">
                {d.label}
                <span className="facility-inspector-meta">
                  {formatInspectorDate(d.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        </IntelSubsection>
      ) : null}

      {intel.finalReports.length > 0 ? (
        <IntelSubsection label="Final Reports">
          <div className="facility-intel-report-stack">
            {intel.finalReports.slice(0, 3).map((r) => (
              <IntelReportRow
                key={r.title}
                title={r.title}
                meta={`${r.completionScore}% complete`}
                summary={r.verdict}
              />
            ))}
          </div>
        </IntelSubsection>
      ) : null}
    </div>
  );
});
