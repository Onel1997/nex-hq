"use client";

import Link from "next/link";
import { memo } from "react";
import type { LabReportDetail } from "@/lib/facility/types";
import { formatInspectorDate } from "@/lib/facility/lab-intelligence";

interface AgentReportListProps {
  reports: LabReportDetail[];
  limit?: number;
}

export const AgentReportList = memo(function AgentReportList({
  reports,
  limit = 6,
}: AgentReportListProps) {
  const visible = reports.slice(0, limit);

  if (visible.length === 0) {
    return null;
  }

  return (
    <ul className="facility-inspector-list facility-lab-room-list">
      {visible.map((report) => (
        <li
          key={report.id}
          className="facility-inspector-list-item facility-lab-room-list-item"
        >
          <Link href={`/reports?highlight=${report.id}`} className="facility-agent-report-link">
            {report.title}
          </Link>
          <span className="facility-inspector-meta">
            {report.status} · {Math.round(report.confidence * 100)}% ·{" "}
            {formatInspectorDate(report.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
});
