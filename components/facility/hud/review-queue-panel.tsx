"use client";

import Link from "next/link";
import type { ReviewQueueItem } from "@/lib/facility/types";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronDown, ChevronUp, ClipboardList } from "lucide-react";
import { useState } from "react";

interface ReviewQueuePanelProps {
  items: ReviewQueueItem[];
}

const VISIBLE_COUNT = 3;

function formatAgentLabel(agentId: string): string {
  return agentId.charAt(0).toUpperCase() + agentId.slice(1);
}

export function ReviewQueuePanel({ items }: ReviewQueuePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? items : items.slice(0, VISIBLE_COUNT);
  const hiddenCount = Math.max(0, items.length - VISIBLE_COUNT);

  return (
    <aside
      className={cn(
        "facility-review-dock",
        expanded && "facility-review-dock-expanded",
      )}
    >
      <button
        type="button"
        className="facility-review-dock-header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="facility-review-dock-title-row">
          <ClipboardList className="facility-review-dock-icon" />
          <span className="facility-review-dock-title">Review Queue</span>
        </div>
        <div className="facility-review-dock-meta">
          <span className="facility-review-dock-count">
            {items.length} pending
          </span>
          {items.length > VISIBLE_COUNT ? (
            expanded ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )
          ) : null}
        </div>
      </button>

      <div className="facility-review-dock-body">
        {items.length === 0 ? (
          <p className="facility-review-dock-empty">No reports awaiting review</p>
        ) : (
          <>
            <ul className="facility-review-dock-list">
              {visibleItems.map((item) => (
                <li key={item.reportId} className="facility-review-dock-item">
                  <div className="facility-review-dock-item-meta">
                    <span className="facility-review-dock-agent">
                      {formatAgentLabel(item.agentId)}
                    </span>
                  </div>
                  <p className="facility-review-dock-item-title">{item.title}</p>
                  <Link
                    href={`/reports?highlight=${item.reportId}`}
                    className="facility-review-dock-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Review
                    <ArrowRight className="size-3" />
                  </Link>
                </li>
              ))}
            </ul>
            {!expanded && hiddenCount > 0 ? (
              <button
                type="button"
                className="facility-review-dock-more"
                onClick={() => setExpanded(true)}
              >
                +{hiddenCount} more reviews
              </button>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}
