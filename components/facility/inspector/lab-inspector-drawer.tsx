"use client";

import { AgentMemoryPanel } from "@/components/facility/inspector/agent-memory-panel";
import { ExecutionTimeline } from "@/components/facility/inspector/execution-timeline";
import type { AgentId } from "@/lib/constants/agents";
import type { LabInspectorData, LabSnapshot } from "@/lib/facility/types";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
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

  return (
    <AnimatePresence>
      {open && agentId ? (
        <>
          <motion.button
            type="button"
            className="facility-inspector-backdrop"
            aria-label="Close inspector"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="facility-inspector-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <header className="facility-inspector-header">
              <div>
                <p className="facility-inspector-label">Lab Inspector</p>
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
                  <span>Loading lab data…</span>
                </div>
              ) : error ? (
                <p className="facility-inspector-error">{error}</p>
              ) : data ? (
                <>
                  <section className="facility-inspector-section">
                    <h3 className="facility-inspector-section-title">Status</h3>
                    <div className="facility-inspector-status-row">
                      <span
                        className={cn(
                          "facility-inspector-status",
                          `facility-inspector-status-${data.opsState}`,
                        )}
                      >
                        {data.opsState}
                      </span>
                      {data.confidence != null ? (
                        <span className="facility-inspector-confidence">
                          Confidence {Math.round(data.confidence * 100)}%
                        </span>
                      ) : null}
                    </div>
                  </section>

                  <section className="facility-inspector-section">
                    <h3 className="facility-inspector-section-title">
                      Current Task
                    </h3>
                    <p className="facility-inspector-text">
                      {data.currentTask?.title ?? "No active task"}
                    </p>
                  </section>

                  <section className="facility-inspector-section">
                    <h3 className="facility-inspector-section-title">
                      Task Queue
                    </h3>
                    {data.taskQueue.length === 0 ? (
                      <p className="facility-inspector-empty">Queue empty</p>
                    ) : (
                      <ul className="facility-inspector-list">
                        {data.taskQueue.map((task) => (
                          <li
                            key={task.id}
                            className="facility-inspector-list-item"
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

                  <section className="facility-inspector-section">
                    <h3 className="facility-inspector-section-title">
                      Activity Timeline
                    </h3>
                    <ExecutionTimeline items={data.timeline} />
                  </section>

                  <AgentMemoryPanel
                    reports={data.reports}
                    tasks={data.taskQueue}
                    knowledgeRefs={data.knowledgeRefs}
                  />
                </>
              ) : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
});
