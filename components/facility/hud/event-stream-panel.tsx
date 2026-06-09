"use client";

import type {
  FacilityEvent,
  FacilityEventCategory,
  FacilityEventPriority,
} from "@/lib/facility/types";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Bot,
  Crown,
  FileText,
  Radio,
  ShieldAlert,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { memo, useRef } from "react";

interface EventStreamPanelProps {
  events: FacilityEvent[];
  startupReady?: boolean;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function deriveCategory(event: FacilityEvent): FacilityEventCategory {
  if (event.category) return event.category;
  if (event.type.startsWith("ceo.")) return "ceo";
  if (event.type.startsWith("report.")) return "report";
  if (event.type.startsWith("task.")) return "task";
  return "system";
}

function derivePriority(event: FacilityEvent): FacilityEventPriority {
  if (event.priority) return event.priority;
  if (
    event.type.includes("final_report") ||
    event.type === "report.approved"
  ) {
    return "critical";
  }
  if (
    event.type.includes("failed") ||
    event.type === "report.rejected"
  ) {
    return "high";
  }
  return "normal";
}

const SEVERITY_LABELS: Record<FacilityEventPriority, string> = {
  normal: "INFO",
  high: "ALERT",
  critical: "CRITICAL",
};

const CATEGORY_META: Record<
  FacilityEventCategory,
  { icon: LucideIcon; color: string; label: string }
> = {
  task: { icon: Zap, color: "#22D3EE", label: "TASK" },
  report: { icon: FileText, color: "#22C55E", label: "REPORT" },
  ceo: { icon: Crown, color: "#FFD166", label: "CEO" },
  delegation: { icon: Radio, color: "#3B82F6", label: "DELEGATE" },
  system: { icon: Bot, color: "#7E8CA3", label: "SYS" },
};

const EventRow = memo(function EventRow({
  event,
  isNew,
}: {
  event: FacilityEvent;
  isNew: boolean;
}) {
  const category = deriveCategory(event);
  const priority = derivePriority(event);
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: 20, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      className={cn(
        "facility-ops-item",
        `facility-ops-${category}`,
        `facility-ops-severity-${priority}`,
        isNew && "facility-ops-new",
      )}
    >
      {isNew && <span className="facility-ops-arrival-flash" aria-hidden />}
      <div className="facility-ops-row-top">
        <span className="facility-ops-severity">{SEVERITY_LABELS[priority]}</span>
        <span className="facility-ops-time">{formatTime(event.timestamp)}</span>
      </div>
      <div className="facility-ops-row-header">
        <span className="facility-ops-icon-wrap" style={{ color: meta.color }}>
          <Icon className="facility-ops-icon" strokeWidth={1.75} />
        </span>
        <span className="facility-ops-category">{meta.label}</span>
      </div>
      <p className="facility-ops-summary">{event.summary}</p>
      {priority === "high" && (
        <AlertTriangle className="facility-ops-alert-icon" strokeWidth={1.5} />
      )}
      {priority === "critical" && (
        <ShieldAlert className="facility-ops-critical-icon" strokeWidth={1.5} />
      )}
    </motion.li>
  );
});

export function EventStreamPanel({
  events,
  startupReady = true,
}: EventStreamPanelProps) {
  const seenRef = useRef<Set<string>>(new Set());
  const newIds = new Set<string>();

  for (const event of events) {
    if (!seenRef.current.has(event.id)) {
      if (seenRef.current.size > 0) newIds.add(event.id);
      seenRef.current.add(event.id);
    }
  }

  return (
    <motion.aside
      className="facility-side-panel facility-ops-panel"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: startupReady ? 1 : 0, x: startupReady ? 0 : 20 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      <div className="facility-panel-header">
        <div className="facility-ops-panel-title-wrap">
          <Radio className="facility-ops-panel-icon" strokeWidth={1.75} />
          <h2 className="facility-panel-title">Operations Feed</h2>
        </div>
        <span className="facility-panel-count facility-ops-live">
          <span className="facility-ops-live-dot" />
          LIVE
        </span>
      </div>

      <div className="facility-panel-body">
        {events.length === 0 ? (
          <p className="facility-panel-empty">Scanning neural channels…</p>
        ) : (
          <ul className="facility-ops-list">
            <AnimatePresence initial={false}>
              {events.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  isNew={newIds.has(event.id)}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </motion.aside>
  );
}
