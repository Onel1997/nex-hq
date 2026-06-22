"use client";

import type { LabInspectorData } from "@/lib/facility/types";
import { useT } from "@/lib/i18n";
import { useMemo } from "react";

interface ResearchIntelligenceFeedProps {
  data: LabInspectorData | null;
}

type FeedKind = "trend_detected" | "competitor_updated" | "consumer_signal";

const DEMO_FEED: Array<{ id: string; time: string; kind: FeedKind }> = [
  { id: "f1", time: "23:10", kind: "trend_detected" },
  { id: "f2", time: "22:45", kind: "competitor_updated" },
  { id: "f3", time: "22:30", kind: "consumer_signal" },
  { id: "f4", time: "21:58", kind: "trend_detected" },
  { id: "f5", time: "21:12", kind: "competitor_updated" },
];

function mapTimelineToFeedKind(type: string): FeedKind {
  if (type.includes("trend")) return "trend_detected";
  if (type.includes("competitor") || type.includes("report")) {
    return "competitor_updated";
  }
  return "consumer_signal";
}

export function ResearchIntelligenceFeed({ data }: ResearchIntelligenceFeedProps) {
  const t = useT();

  const items = useMemo(() => {
    if (data?.timeline.length) {
      return data.timeline.slice(0, 8).map((item) => ({
        id: item.id,
        time: item.time,
        kind: mapTimelineToFeedKind(item.type),
      }));
    }
    return DEMO_FEED;
  }, [data?.timeline]);

  return (
    <footer
      className="workspace-timeline research-intelligence-feed"
      aria-label={t("research.feed.label")}
    >
      <div className="workspace-timeline-header">
        <span className="workspace-timeline-label">
          {t("research.feed.label")}
        </span>
      </div>
      <div className="workspace-timeline-body">
        <ol className="research-feed-track">
          {items.map((item) => (
            <li key={item.id} className="research-feed-item">
              <span className="research-feed-time">{item.time}</span>
              <span className="research-feed-dot" aria-hidden />
              <span className="research-feed-label">
                {t(`research.feed.events.${item.kind}`)}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </footer>
  );
}
