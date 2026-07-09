"use client";

import { memo } from "react";
import type { TimelineItem } from "@/lib/facility/types";

interface ExecutionTimelineProps {
  items: TimelineItem[];
}

export const ExecutionTimeline = memo(function ExecutionTimeline({
  items,
}: ExecutionTimelineProps) {
  if (items.length === 0) {
    return (
      <p className="facility-inspector-empty">No recent activity for this lab</p>
    );
  }

  return (
    <ol className="facility-timeline">
      {items.map((item) => (
        <li key={item.id} className="facility-timeline-item">
          <span className="facility-timeline-time">{item.time}</span>
          <span className="facility-timeline-dot" />
          <div className="facility-timeline-content">
            <span className="facility-timeline-type">{item.type}</span>
            <p className="facility-timeline-label">{item.label}</p>
          </div>
        </li>
      ))}
    </ol>
  );
});
