"use client";

import Link from "next/link";
import { memo } from "react";
import type { KnowledgeRef, LabReportDetail, LabTaskSnapshot } from "@/lib/facility/types";

interface AgentMemoryPanelProps {
  reports: LabReportDetail[];
  tasks: LabTaskSnapshot[];
  knowledgeRefs: KnowledgeRef[];
}

export const AgentMemoryPanel = memo(function AgentMemoryPanel({
  reports,
  tasks,
  knowledgeRefs,
}: AgentMemoryPanelProps) {
  return (
    <div className="facility-memory-panel">
      {reports.length > 0 ? (
        <ul className="facility-inspector-list facility-lab-room-list">
          {reports.slice(0, 5).map((report) => (
            <li
              key={report.id}
              className="facility-inspector-list-item facility-lab-room-list-item"
            >
              <Link href={`/reports?highlight=${report.id}`}>
                {report.title}
              </Link>
              <span className="facility-inspector-meta">
                {report.status} · reports
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {tasks.length > 0 ? (
        <ul className="facility-inspector-list facility-lab-room-list">
          {tasks.slice(0, 4).map((task) => (
            <li
              key={task.id}
              className="facility-inspector-list-item facility-lab-room-list-item"
            >
              <span>{task.title}</span>
              <span className="facility-inspector-meta">{task.status} · tasks</span>
            </li>
          ))}
        </ul>
      ) : null}

      {knowledgeRefs.length > 0 ? (
        <ul className="facility-inspector-list facility-lab-room-list">
          {knowledgeRefs.slice(0, 6).map((ref) => (
            <li
              key={`${ref.domain}-${ref.id}`}
              className="facility-inspector-list-item facility-lab-room-list-item"
            >
              <span>{ref.title}</span>
              <span className="facility-inspector-meta">{ref.domain}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
});
