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
      <section className="facility-inspector-section">
        <h3 className="facility-inspector-section-title">Recent Reports</h3>
        {reports.length === 0 ? (
          <p className="facility-inspector-empty">No reports yet</p>
        ) : (
          <ul className="facility-inspector-list">
            {reports.map((report) => (
              <li key={report.id} className="facility-inspector-list-item">
                <Link href={`/reports?highlight=${report.id}`}>
                  {report.title}
                </Link>
                <span className="facility-inspector-meta">
                  {report.status} · {Math.round(report.confidence * 100)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="facility-inspector-section">
        <h3 className="facility-inspector-section-title">Recent Tasks</h3>
        {tasks.length === 0 ? (
          <p className="facility-inspector-empty">No tasks yet</p>
        ) : (
          <ul className="facility-inspector-list">
            {tasks.slice(0, 6).map((task) => (
              <li key={task.id} className="facility-inspector-list-item">
                <span>{task.title}</span>
                <span className="facility-inspector-meta">{task.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="facility-inspector-section">
        <h3 className="facility-inspector-section-title">Knowledge References</h3>
        {knowledgeRefs.length === 0 ? (
          <p className="facility-inspector-empty">No knowledge linked</p>
        ) : (
          <ul className="facility-inspector-list">
            {knowledgeRefs.map((ref) => (
              <li key={`${ref.domain}-${ref.id}`} className="facility-inspector-list-item">
                <span>{ref.title}</span>
                <span className="facility-inspector-meta">{ref.domain}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
});
