"use client";

import type { LabInspectorData } from "@/lib/facility/types";
import { useResearchBrain } from "@/components/research/use-research-brain";
import { useT } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";

interface ResearchIntelligenceFeedProps {
  data: LabInspectorData | null;
}

const ROTATE_MS = 4500;

export function ResearchIntelligenceFeed({ data }: ResearchIntelligenceFeedProps) {
  const t = useT();
  const { snapshot } = useResearchBrain();
  const [activeIndex, setActiveIndex] = useState(0);

  const signals = useMemo(() => {
    if (snapshot?.signals.length) {
      return snapshot.signals;
    }

    if (data?.timeline.length) {
      return data.timeline.slice(0, 8).map((item) => ({
        id: item.id,
        time: item.time,
        category: item.type.includes("trend")
          ? ("trend" as const)
          : item.type.includes("competitor")
            ? ("competitor" as const)
            : ("product" as const),
        message: item.label ?? item.type,
      }));
    }

    return [
      {
        id: "demo-1",
        time: "23:10",
        category: "trend" as const,
        message: "Earth tones rising.",
      },
      {
        id: "demo-2",
        time: "22:45",
        category: "competitor" as const,
        message: "Represent launched new capsule.",
      },
      {
        id: "demo-3",
        time: "22:30",
        category: "opportunity" as const,
        message: "Premium embroidery line.",
      },
      {
        id: "demo-4",
        time: "21:58",
        category: "product" as const,
        message: "Faith Tee sold 8 units.",
      },
    ];
  }, [snapshot?.signals, data?.timeline]);

  useEffect(() => {
    if (signals.length <= 1) return;

    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % signals.length);
    }, ROTATE_MS);

    return () => window.clearInterval(timer);
  }, [signals.length]);

  const visibleSignals = useMemo(() => {
    const count = Math.min(5, signals.length);
    const items = [];
    for (let i = 0; i < count; i++) {
      const idx = (activeIndex + i) % signals.length;
      items.push(signals[idx]);
    }
    return items;
  }, [signals, activeIndex]);

  return (
    <footer
      className="workspace-timeline research-intelligence-feed"
      aria-label={t("research.feed.label")}
      aria-live="polite"
    >
      <div className="workspace-timeline-header">
        <span className="workspace-timeline-label">
          {t("research.feed.label")}
        </span>
        <span className="research-feed-live-dot" aria-hidden />
      </div>
      <div className="workspace-timeline-body">
        <ol className="research-feed-track">
          {visibleSignals.map((item) => (
            <li key={item.id} className="research-feed-item">
              <span className="research-feed-time">{item.time}</span>
              <span className="research-feed-dot" aria-hidden />
              <span className="research-feed-label">
                <span className="research-feed-category">
                  {t(`research.feed.categories.${item.category}`)}:
                </span>{" "}
                {item.message}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </footer>
  );
}
