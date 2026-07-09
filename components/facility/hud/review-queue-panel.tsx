"use client";

import Link from "next/link";
import type { ReviewQueueItem } from "@/lib/facility/types";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronRight, ClipboardList } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { memo, useEffect, useRef, useState } from "react";

interface ReviewQueuePanelProps {
  items: ReviewQueueItem[];
  startupReady?: boolean;
}

function formatAgentLabel(agentId: string): string {
  return agentId.charAt(0).toUpperCase() + agentId.slice(1);
}

const ReviewRow = memo(function ReviewRow({
  item,
  isNew,
}: {
  item: ReviewQueueItem;
  isNew: boolean;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -12, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      className={cn("facility-review-item", isNew && "facility-review-item-new")}
    >
      {isNew && <span className="facility-review-arrival-flash" aria-hidden />}
      <div className="facility-review-item-meta">
        <span className="facility-review-agent">{formatAgentLabel(item.agentId)}</span>
      </div>
      <p className="facility-review-item-title">{item.title}</p>
      <Link
        href={`/reports?highlight=${item.reportId}`}
        className="facility-review-link"
        onClick={(e) => e.stopPropagation()}
      >
        Review
        <ArrowRight className="size-3" />
      </Link>
    </motion.li>
  );
});

export function ReviewQueuePanel({
  items,
  startupReady = true,
}: ReviewQueuePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [newReviewPulse, setNewReviewPulse] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());
  const newIds = new Set<string>();
  let hasNew = false;

  for (const item of items) {
    if (!seenRef.current.has(item.reportId)) {
      if (seenRef.current.size > 0) {
        newIds.add(item.reportId);
        hasNew = true;
      }
      seenRef.current.add(item.reportId);
    }
  }

  useEffect(() => {
    if (!hasNew) return;
    setNewReviewPulse(true);
    const t = setTimeout(() => setNewReviewPulse(false), 1600);
    return () => clearTimeout(t);
  }, [hasNew, items.length]);

  const pending = items.length > 0;

  return (
    <motion.aside
      className={cn(
        "facility-review-rail",
        expanded && "facility-review-rail-expanded",
        newReviewPulse && "facility-review-rail-pulse",
        pending && "facility-review-rail-active",
      )}
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: startupReady ? 1 : 0, x: startupReady ? 0 : -16 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      <button
        type="button"
        className="facility-review-rail-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse review queue" : "Expand review queue"}
      >
        {expanded ? (
          <ChevronRight className="size-4" />
        ) : (
          <div className="facility-review-rail-collapsed">
            <span className="facility-review-rail-label">
              <span
                className={cn(
                  "facility-review-rail-status-dot",
                  pending && "facility-review-rail-status-dot-active",
                )}
              />
              REVIEW
            </span>
            <span
              className={cn(
                "facility-review-rail-count",
                newReviewPulse && "facility-review-rail-count-pulse",
              )}
            >
              {items.length}
            </span>
            {newReviewPulse && (
              <span className="facility-review-rail-pulse-ring" aria-hidden />
            )}
          </div>
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="facility-review-rail-body"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="facility-review-rail-header">
              <ClipboardList className="facility-review-rail-icon" strokeWidth={1.75} />
              <h2 className="facility-panel-title">Review Queue</h2>
              <span className="facility-panel-count">{items.length}</span>
            </div>

            <div className="facility-review-rail-scroll">
              {items.length === 0 ? (
                <p className="facility-panel-empty">No reports awaiting review</p>
              ) : (
                <ul className="facility-review-list">
                  <AnimatePresence initial={false}>
                    {items.map((item) => (
                      <ReviewRow
                        key={item.reportId}
                        item={item}
                        isNew={newIds.has(item.reportId)}
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
