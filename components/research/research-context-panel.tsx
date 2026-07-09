"use client";

import type { LabInspectorData } from "@/lib/facility/types";
import { extractResearchIntelligence } from "@/lib/facility/lab-intelligence";
import { useResearchBrain } from "@/components/research/use-research-brain";
import { useT } from "@/lib/i18n";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";

interface ResearchContextPanelProps {
  data: LabInspectorData | null;
  loading: boolean;
}

export function ResearchContextPanel({
  data,
  loading,
}: ResearchContextPanelProps) {
  const t = useT();
  const { snapshot: brain } = useResearchBrain();

  const intel = useMemo(
    () =>
      data?.fullReports
        ? extractResearchIntelligence(data.fullReports)
        : null,
    [data?.fullReports],
  );

  const signalConfidence =
    intel?.confidence != null
      ? Math.round(intel.confidence * 100)
      : data?.confidence != null
        ? Math.round(data.confidence * 100)
        : brain?.opportunities[0]?.confidence ?? 87;

  const activeTrends =
    intel?.reports.filter((r) => r.reportType === "trend").length ??
    brain?.market.trends.length ??
    2;
  const reportsStored =
    data?.metrics.reportCount ?? brain?.pod.availableProducts ?? 4;
  const competitorsTracked =
    intel?.competitorReports.length ?? brain?.competitors.length ?? 5;

  const metrics = [
    {
      label: t("research.context.signalConfidence"),
      value: `${signalConfidence}%`,
      highlight: true,
    },
    {
      label: t("research.context.activeTrends"),
      value: String(activeTrends),
    },
    {
      label: t("research.context.reportsStored"),
      value: String(reportsStored),
    },
    {
      label: t("research.context.competitorsTracked"),
      value: String(competitorsTracked),
    },
  ];

  return (
    <aside
      className="workspace-context research-context-panel"
      aria-label={t("research.context.label")}
    >
      <header className="workspace-context-header">
        <h2 className="workspace-context-title">{t("research.context.label")}</h2>
      </header>

      <div className="workspace-context-body">
        {loading && !data ? (
          <div className="workspace-context-loading">
            <Loader2 className="size-4 animate-spin" />
            <span>{t("research.heroStatus.loading")}</span>
          </div>
        ) : (
          <>
            <div className="research-context-pulse">
              <span className="research-context-pulse-dot" aria-hidden />
              <span>{t("research.context.live")}</span>
            </div>

            {brain ? (
              <div className="research-context-brand">
                <p className="workspace-context-block-label">
                  {t("research.context.brandDna")}
                </p>
                <p className="research-context-brand-positioning">
                  {brain.brand.positioning}
                </p>
                <div className="research-context-brand-colors">
                  {brain.brand.colors.slice(0, 4).map((color) => (
                    <span key={color} className="research-brand-color-tag">
                      {color}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <ul className="research-context-metrics">
              {metrics.map((metric) => (
                <li key={metric.label} className="research-context-metric">
                  <span className="research-context-metric-label">
                    {metric.label}
                  </span>
                  <span
                    className={
                      metric.highlight
                        ? "research-context-metric-value research-context-metric-highlight"
                        : "research-context-metric-value"
                    }
                  >
                    {metric.value}
                  </span>
                </li>
              ))}
            </ul>

            {brain?.pod.primarySupplier ? (
              <div className="workspace-context-block">
                <p className="workspace-context-block-label">
                  {t("research.context.podSupplier")}
                </p>
                <p className="workspace-context-block-text">
                  {brain.pod.primarySupplier}
                </p>
              </div>
            ) : null}

            {brain?.signals[0] ? (
              <div className="workspace-context-block research-context-latest">
                <p className="workspace-context-block-label">
                  {t("research.context.latestSignal")}
                </p>
                <p className="workspace-context-block-text">
                  {brain.signals[0].message}
                </p>
              </div>
            ) : data?.reports[0] ? (
              <div className="workspace-context-block research-context-latest">
                <p className="workspace-context-block-label">
                  {t("research.context.latestSignal")}
                </p>
                <p className="workspace-context-block-text">
                  {data.reports[0].title}
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}
