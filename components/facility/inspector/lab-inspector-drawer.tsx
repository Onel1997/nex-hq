"use client";

import { ExecutionTimeline } from "@/components/facility/inspector/execution-timeline";
import type { AgentId } from "@/lib/constants/agents";
import type { LabInspectorData, LabSnapshot } from "@/lib/facility/types";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { FlaskConical, Loader2, X } from "lucide-react";
import { memo } from "react";

interface LabInspectorDrawerProps {
  open: boolean;
  agentId: AgentId | null;
  lab: LabSnapshot | null;
  data: LabInspectorData | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

export const LabInspectorDrawer = memo(function LabInspectorDrawer({
  open,
  agentId,
  lab,
  data,
  loading,
  error,
  onClose,
}: LabInspectorDrawerProps) {
  const displayName = data?.agentName ?? lab?.label ?? agentId;
  const latestReport = data?.reports[0] ?? null;
  const activeTasks =
    data?.taskQueue.filter((t) => t.status !== "completed" && t.status !== "failed") ??
    [];

  return (
    <AnimatePresence>
      {open && agentId ? (
        <>
          <motion.button
            type="button"
            className="facility-inspector-backdrop"
            aria-label="Close laboratory"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="facility-inspector-drawer facility-lab-room"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="facility-lab-room-ambient" aria-hidden />

            <header className="facility-inspector-header facility-lab-room-header">
              <div className="facility-lab-room-title-block">
                <div className="facility-lab-room-badge">
                  <FlaskConical className="size-3.5" />
                  <span>Laboratory Chamber</span>
                </div>
                <h2 className="facility-inspector-title">{displayName}</h2>
                {data?.role ? (
                  <p className="facility-inspector-role">{data.role}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="facility-inspector-close"
                onClick={onClose}
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="facility-inspector-body">
              {loading && !data ? (
                <div className="facility-inspector-loading">
                  <Loader2 className="size-5 animate-spin" />
                  <span>Opening laboratory…</span>
                </div>
              ) : error ? (
                <p className="facility-inspector-error">{error}</p>
              ) : data ? (
                <>
                  <section className="facility-inspector-section facility-lab-room-section">
                    <h3 className="facility-inspector-section-title">
                      Current Mission
                    </h3>
                    <div className="facility-lab-room-card">
                      <p className="facility-inspector-text">
                        {data.currentTask?.title ?? "No active mission assigned"}
                      </p>
                      <div className="facility-inspector-status-row">
                        <span
                          className={cn(
                            "facility-inspector-status",
                            `facility-inspector-status-${data.opsState}`,
                          )}
                        >
                          {data.opsState}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section className="facility-inspector-section facility-lab-room-section">
                    <h3 className="facility-inspector-section-title">
                      Active Tasks
                    </h3>
                    {activeTasks.length === 0 ? (
                      <p className="facility-inspector-empty">No active tasks</p>
                    ) : (
                      <ul className="facility-inspector-list facility-lab-room-list">
                        {activeTasks.map((task) => (
                          <li
                            key={task.id}
                            className="facility-inspector-list-item facility-lab-room-list-item"
                          >
                            <span>{task.title}</span>
                            <span className="facility-inspector-meta">
                              {task.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="facility-inspector-section facility-lab-room-section">
                    <h3 className="facility-inspector-section-title">
                      Latest Report
                    </h3>
                    <div className="facility-lab-room-card">
                      {latestReport ? (
                        <>
                          <p className="facility-inspector-text">
                            {latestReport.title}
                          </p>
                          <span className="facility-inspector-meta">
                            {latestReport.status} ·{" "}
                            {Math.round(latestReport.confidence * 100)}%
                          </span>
                        </>
                      ) : (
                        <p className="facility-inspector-empty">
                          No reports submitted
                        </p>
                      )}
                    </div>
                  </section>

                  <section className="facility-inspector-section facility-lab-room-section">
                    <h3 className="facility-inspector-section-title">
                      Confidence
                    </h3>
                    <div className="facility-lab-room-confidence">
                      {data.confidence != null ? (
                        <>
                          <span className="facility-lab-room-confidence-value">
                            {Math.round(data.confidence * 100)}%
                          </span>
                          <div className="facility-lab-room-confidence-bar">
                            <div
                              className="facility-lab-room-confidence-fill"
                              style={{
                                width: `${Math.round(data.confidence * 100)}%`,
                              }}
                            />
                          </div>
                        </>
                      ) : (
                        <p className="facility-inspector-empty">
                          Confidence not yet established
                        </p>
                      )}
                    </div>
                  </section>

                  <section className="facility-inspector-section facility-lab-room-section">
                    <h3 className="facility-inspector-section-title">
                      Knowledge References
                    </h3>
                    {data.knowledgeRefs.length === 0 ? (
                      <p className="facility-inspector-empty">
                        No knowledge linked
                      </p>
                    ) : (
                      <ul className="facility-inspector-list facility-lab-room-list">
                        {data.knowledgeRefs.slice(0, 10).map((ref) => (
                          <li
                            key={`${ref.domain}-${ref.id}`}
                            className="facility-inspector-list-item facility-lab-room-list-item"
                          >
                            <span>{ref.title}</span>
                            <span className="facility-inspector-meta">
                              {ref.domain}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="facility-inspector-section facility-lab-room-section facility-lab-room-timeline">
                    <h3 className="facility-inspector-section-title">
                      Activity Timeline
                    </h3>
                    <ExecutionTimeline items={data.timeline} />
                  </section>
                </>
              ) : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
});
