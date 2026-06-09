"use client";

import type { FacilityEvent } from "@/lib/facility/types";

interface EventStreamPanelProps {
  events: FacilityEvent[];
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function EventStreamPanel({ events }: EventStreamPanelProps) {
  return (
    <aside className="facility-side-panel facility-event-panel">
      <div className="facility-panel-header">
        <h2 className="facility-panel-title">Event Stream</h2>
        <span className="facility-panel-count">{events.length}</span>
      </div>

      <div className="facility-panel-body">
        {events.length === 0 ? (
          <p className="facility-panel-empty">No recent events</p>
        ) : (
          <ul className="facility-event-list">
            {events.map((event) => (
              <li key={event.id} className="facility-event-item">
                <span className="facility-event-time">
                  {formatTime(event.timestamp)}
                </span>
                <span className="facility-event-type">{event.type}</span>
                <p className="facility-event-summary">{event.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
