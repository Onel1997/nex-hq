"use client";

import { useT } from "@/lib/i18n";

const INDICATOR_KEYS = [
  "trendEngine",
  "knowledgeBase",
  "consumerSignals",
  "marketScan",
] as const;

export function ResearchMicroIndicators() {
  const t = useT();

  return (
    <div className="research-micro-indicators" aria-label={t("research.indicators.label")}>
      {INDICATOR_KEYS.map((key) => (
        <span key={key} className="research-micro-badge">
          <span className="research-micro-badge-dot" aria-hidden />
          {t(`research.indicators.${key}`)}
        </span>
      ))}
    </div>
  );
}
