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
  ChevronLeft,
  Crown,
  FileText,
  Radio,
  ShieldAlert,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { memo, useEffect, useRef, useState } from "react";

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
      initial={{ opacity: 0, x: 12, scale: 0.96 }}
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
  const [expanded, setExpanded] = useState(false);
  const [newEventPulse, setNewEventPulse] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());
  const newIds = new Set<string>();
  let hasNew = false;

  for (const event of events) {
    if (!seenRef.current.has(event.id)) {
      if (seenRef.current.size > 0) {
        newIds.add(event.id);
        hasNew = true;
      }
      seenRef.current.add(event.id);
    }
  }

  useEffect(() => {
    if (!hasNew) return;
    setNewEventPulse(true);
    const t = setTimeout(() => setNewEventPulse(false), 1600);
    return () => clearTimeout(t);
  }, [hasNew, events.length]);

  return (
    <motion.aside
      className={cn(
        "facility-ops-rail",
        expanded && "facility-ops-rail-expanded",
        newEventPulse && "facility-ops-rail-pulse",
      )}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: startupReady ? 1 : 0, x: startupReady ? 0 : 16 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      <button
        type="button"
        className="facility-ops-rail-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse operations feed" : "Expand operations feed"}
      >
        {expanded ? (
          <ChevronLeft className="size-4" />
        ) : (
          <div className="facility-ops-rail-collapsed">
            <span className="facility-ops-rail-live">
              <span className="facility-ops-live-dot" />
              LIVE
            </span>
            <span
              className={cn(
                "facility-ops-rail-count",
                newEventPulse && "facility-ops-rail-count-pulse",
              )}
            >
              {events.length}
            </span>
            <span className="facility-ops-rail-pulse-ring" aria-hidden />
          </div>
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="facility-ops-rail-body"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="facility-ops-rail-header">
              <Radio className="facility-ops-panel-icon" strokeWidth={1.75} />
              <h2 className="facility-panel-title">Operations</h2>
              <span className="facility-panel-count">{events.length}</span>
            </div>

            <div className="facility-ops-rail-scroll">
              {events.length === 0 ? (
                <p className="facility-panel-empty">Neural channels quiet…</p>
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
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}
