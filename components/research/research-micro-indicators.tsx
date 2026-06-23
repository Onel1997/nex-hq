"use client";

import { useResearchBrain } from "@/components/research/use-research-brain";
import { useT } from "@/lib/i18n";

const INDICATOR_KEYS = [
  "trendEngine",
  "knowledgeBase",
  "consumerSignals",
  "marketScan",
] as const;

export function ResearchMicroIndicators() {
  const t = useT();
  const { snapshot } = useResearchBrain();

  const labels: Record<(typeof INDICATOR_KEYS)[number], string> = {
    trendEngine: snapshot?.trendScores.length
      ? t("research.indicators.trendEngineLive", {
          count: String(snapshot.trendScores.length),
        })
      : t("research.indicators.trendEngine"),
    knowledgeBase: snapshot?.knowledge.reportCount
      ? t("research.indicators.knowledgeBaseLive", {
          count: String(snapshot.knowledge.reportCount),
        })
      : t("research.indicators.knowledgeBase"),
    consumerSignals: snapshot?.signals.length
      ? t("research.indicators.consumerSignalsLive", {
          count: String(snapshot.signals.length),
        })
      : t("research.indicators.consumerSignals"),
    marketScan: snapshot?.commerceConnected
      ? t("research.indicators.marketScanLive")
      : t("research.indicators.marketScan"),
  };

  return (
    <div className="research-micro-indicators" aria-label={t("research.indicators.label")}>
      {INDICATOR_KEYS.map((key) => (
        <span key={key} className="research-micro-badge">
          <span className="research-micro-badge-dot" aria-hidden />
          {labels[key]}
        </span>
      ))}
    </div>
  );
}
