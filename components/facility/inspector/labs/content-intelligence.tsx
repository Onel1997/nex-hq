"use client";

import { memo, useMemo } from "react";
import type { ReportListItem } from "@/lib/mock/reports";
import type { LabTaskSnapshot } from "@/lib/facility/types";
import { extractContentIntelligence } from "@/lib/facility/lab-intelligence";
import {
  IntelList,
  IntelReportRow,
  IntelSubsection,
  reportMeta,
} from "./intel-primitives";

interface ContentIntelligencePanelProps {
  reports: ReportListItem[];
  tasks: LabTaskSnapshot[];
}

export const ContentIntelligencePanel = memo(function ContentIntelligencePanel({
  reports,
  tasks,
}: ContentIntelligencePanelProps) {
  const intel = useMemo(
    () => extractContentIntelligence(reports, tasks),
    [reports, tasks],
  );

  const hasData =
    intel.reports.length > 0 ||
    intel.hooks.length > 0 ||
    intel.captions.length > 0 ||
    intel.contentQueue.length > 0;

  if (!hasData) {
    return (
      <p className="facility-inspector-empty">
        No content pipeline yet — run the Content Agent to generate copy.
      </p>
    );
  }

  return (
    <div className="facility-intel-panel">
      {intel.contentQueue.length > 0 ? (
        <IntelSubsection label="Content Queue">
          <ul className="facility-inspector-list facility-lab-room-list">
            {intel.contentQueue.slice(0, 5).map((task) => (
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

      {intel.reports.length > 0 ? (
        <IntelSubsection label="Generated Content Reports">
          <div className="facility-intel-report-stack">
            {intel.reports.slice(0, 4).map((r) => (
              <IntelReportRow
                key={r.id}
                title={r.title}
                meta={reportMeta(r.confidence, r.createdAt, r.status)}
              />
            ))}
          </div>
        </IntelSubsection>
      ) : null}

      {intel.hooks.length > 0 ? (
        <IntelSubsection label="Hooks">
          <IntelList items={intel.hooks} />
        </IntelSubsection>
      ) : null}

      {intel.captions.length > 0 ? (
        <IntelSubsection label="Captions">
          <IntelList items={intel.captions} limit={4} />
        </IntelSubsection>
      ) : null}

      {intel.postIdeas.length > 0 ? (
        <IntelSubsection label="Post Ideas">
          <IntelList items={intel.postIdeas} />
        </IntelSubsection>
      ) : null}

      {intel.publishingStatus.length > 0 ? (
        <IntelSubsection label="Publishing Status">
          <ul className="facility-inspector-list facility-lab-room-list">
            {intel.publishingStatus.slice(0, 5).map((item) => (
              <li
                key={item.title}
                className="facility-inspector-list-item facility-lab-room-list-item"
              >
                <span>{item.title}</span>
                <span className="facility-inspector-meta">{item.status}</span>
              </li>
            ))}
          </ul>
        </IntelSubsection>
      ) : null}
    </div>
  );
});
