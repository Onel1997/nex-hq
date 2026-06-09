"use client";

import Link from "next/link";
import type { ReviewQueueItem } from "@/lib/facility/types";
import { ArrowRight } from "lucide-react";

interface ReviewQueuePanelProps {
  items: ReviewQueueItem[];
}

function formatAgentLabel(agentId: string): string {
  return agentId.charAt(0).toUpperCase() + agentId.slice(1);
}

export function ReviewQueuePanel({ items }: ReviewQueuePanelProps) {
  return (
    <aside className="facility-side-panel facility-review-panel">
      <div className="facility-panel-header">
        <h2 className="facility-panel-title">Review Queue</h2>
        <span className="facility-panel-count">{items.length}</span>
      </div>

      <div className="facility-panel-body">
        {items.length === 0 ? (
          <p className="facility-panel-empty">No reports awaiting review</p>
        ) : (
          <ul className="facility-review-list">
            {items.map((item) => (
              <li key={item.reportId} className="facility-review-item">
                <div className="facility-review-meta">
                  <span className="facility-review-agent">
                    {formatAgentLabel(item.agentId)}
                  </span>
                  <span className="facility-review-status">pending_review</span>
                </div>
                <p className="facility-review-title">{item.title}</p>
                <Link
                  href={`/reports?highlight=${item.reportId}`}
                  className="facility-review-link"
                >
                  Review
                  <ArrowRight className="size-3" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
