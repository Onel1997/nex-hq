"use client";

import { useMemo } from "react";
import type { LabInspectorData } from "@/lib/facility/types";
import { extractResearchIntelligence } from "@/lib/facility/lab-intelligence";
import { useResearchBrain } from "@/components/research/use-research-brain";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Eye,
  Radio,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

interface ResearchIntelligenceDashboardProps {
  data: LabInspectorData | null;
  isLoading?: boolean;
}

export function ResearchIntelligenceDashboard({
  data,
}: ResearchIntelligenceDashboardProps) {
  const t = useT();
  const { snapshot: brain } = useResearchBrain();

  const intel = useMemo(
    () =>
      data?.fullReports
        ? extractResearchIntelligence(data.fullReports)
        : null,
    [data?.fullReports],
  );

  const trendScores = brain?.trendScores ?? [];
  const competitors = brain?.competitors ?? [];
  const knowledge = brain?.knowledge;
  const marketSignals = brain?.marketSignals ?? [];

  const trendReports =
    intel?.reports.filter((r) => r.reportType === "trend") ?? [];
  const competitorCount =
    knowledge?.competitorCount ?? intel?.competitorReports.length ?? competitors.length;
  const signalCount = knowledge?.signalCount ?? brain?.signals.length ?? 8;
  const knowledgeCount =
    knowledge?.reportCount ?? intel?.reports.length ?? data?.metrics.reportCount ?? 14;

  const featuredTrendReports =
    trendReports.length > 0
      ? trendReports.slice(0, 3).map((r) => ({
          title: r.title,
          score: Math.round((r.confidence ?? 0.75) * 100),
        }))
      : trendScores.slice(0, 3).map((trend) => ({
          title: trend.label,
          score: trend.dnaMatch,
        }));

  const recentReports =
    knowledge?.recentlyUsed ??
    (intel && intel.reports.length > 0
      ? intel.reports.slice(0, 3).map((r) => r.title)
      : featuredTrendReports.map((r) => r.title));

  const savedInsights =
    knowledge?.savedInsights ??
    (intel && intel.streetwearInsights.length > 0
      ? intel.streetwearInsights.slice(0, 3)
      : brain?.market.trends.slice(0, 3) ?? []);

  const lastAnalysis =
    knowledge?.lastAnalysis ??
    intel?.reports[0]?.title ??
    data?.reports[0]?.title ??
    t("research.dashboard.knowledge.lastAnalysisDefault");

  const trendAlerts =
    trendScores.length > 0
      ? trendScores.slice(0, 4)
      : [];

  return (
    <div
      className="research-intel-dashboard"
      aria-label={t("research.dashboard.label")}
    >
      {/* Market Signals */}
      <section className="research-dash-section">
        <h3 className="research-dash-section-title">
          {t("research.dashboard.marketSignals")}
        </h3>
        <div className="research-signal-row">
          {(marketSignals.length > 0
            ? marketSignals
            : [
                { id: "streetwear", label: t("research.dashboard.signals.streetwearRising"), active: true },
                { id: "earth", label: t("research.dashboard.signals.earthTones"), active: true },
                { id: "oversized", label: t("research.dashboard.signals.oversizedDemand"), active: true },
                { id: "premium", label: t("research.dashboard.signals.premiumExpanding"), active: true },
              ]
          ).map((signal) => (
            <div
              key={signal.id}
              className={cn(
                "research-signal-card",
                signal.active && "research-signal-card-active",
              )}
            >
              <Radio className="research-signal-icon size-3.5" aria-hidden />
              <span className="research-signal-label">{signal.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Live Trend Alerts */}
      <section className="research-dash-section">
        <h3 className="research-dash-section-title">
          {t("research.dashboard.liveTrendAlerts")}
        </h3>
        <ul className="research-trend-alerts">
          {trendAlerts.map((alert) => (
            <li key={alert.id} className="research-trend-alert-item">
              {alert.direction === "up" ? (
                <TrendingUp
                  className="research-trend-alert-icon research-trend-alert-icon-up size-3.5"
                  aria-hidden
                />
              ) : (
                <TrendingDown
                  className="research-trend-alert-icon research-trend-alert-icon-down size-3.5"
                  aria-hidden
                />
              )}
              <span className="research-trend-alert-label">
                {alert.label}
                <span className="research-trend-alert-value">
                  {" "}
                  {alert.change >= 0 ? "+" : ""}
                  {alert.change}%
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Intelligence Grid */}
      <section className="research-dash-section">
        <h3 className="research-dash-section-title">
          {t("research.dashboard.intelligenceGrid")}
        </h3>
        <div className="research-intel-grid-v4">
          <div className="research-intel-grid-trend research-intel-featured-card">
            <div className="research-intel-featured-head">
              <div className="research-intel-grid-icon-wrap">
                <TrendingUp
                  className="research-intel-grid-icon size-4"
                  aria-hidden
                />
              </div>
              <div>
                <p className="research-intel-grid-title">
                  {t("research.dashboard.grid.trendReports")}
                </p>
                <p className="research-intel-grid-meta">
                  {t("research.dashboard.gridTrendMeta", {
                    count: String(knowledge?.trendReportCount ?? (trendReports.length || 3)),
                  })}
                </p>
              </div>
            </div>
            <ul className="research-trend-report-list">
              {featuredTrendReports.map((report) => (
                <li key={report.title} className="research-trend-report-item">
                  <span className="research-trend-report-name">
                    {report.title}
                  </span>
                  <span className="research-trend-score">
                    {report.score}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="research-intel-grid-competitor research-intel-grid-cell">
            <div className="research-intel-grid-icon-wrap">
              <Eye className="research-intel-grid-icon size-4" aria-hidden />
            </div>
            <div className="research-intel-grid-text">
              <p className="research-intel-grid-title">
                {t("research.dashboard.grid.competitorWatch")}
              </p>
              <p className="research-intel-grid-meta">
                {t("research.dashboard.gridCompetitorMeta", {
                  count: String(competitorCount),
                })}
              </p>
            </div>
          </div>

          <div className="research-intel-grid-consumer research-intel-grid-cell research-intel-grid-cell-compact">
            <div className="research-intel-grid-icon-wrap research-intel-grid-icon-wrap-sm">
              <Users className="research-intel-grid-icon size-3.5" aria-hidden />
            </div>
            <div className="research-intel-grid-text">
              <p className="research-intel-grid-title research-intel-grid-title-sm">
                {t("research.dashboard.grid.consumerSignals")}
              </p>
              <p className="research-intel-grid-meta">
                {t("research.dashboard.gridConsumerMeta", {
                  count: String(signalCount),
                })}
              </p>
            </div>
          </div>

          <div className="research-intel-grid-knowledge research-intel-knowledge-card">
            <div className="research-intel-knowledge-head">
              <div className="research-intel-grid-icon-wrap research-intel-grid-icon-wrap-sm">
                <BookOpen
                  className="research-intel-grid-icon size-3.5"
                  aria-hidden
                />
              </div>
              <div>
                <p className="research-intel-grid-title research-intel-grid-title-sm">
                  {t("research.dashboard.grid.knowledgeBase")}
                </p>
                <p className="research-intel-grid-meta">
                  {t("research.dashboard.gridKnowledgeMeta", {
                    count: String(knowledgeCount),
                  })}
                </p>
              </div>
            </div>
            <div className="research-knowledge-columns">
              <div className="research-knowledge-col">
                <p className="research-knowledge-col-label">
                  {t("research.dashboard.knowledge.recentReports")}
                </p>
                <ul className="research-knowledge-list">
                  {recentReports.map((title) => (
                    <li key={title}>{title}</li>
                  ))}
                </ul>
              </div>
              <div className="research-knowledge-col">
                <p className="research-knowledge-col-label">
                  {t("research.dashboard.knowledge.savedInsights")}
                </p>
                <ul className="research-knowledge-list">
                  {savedInsights.map((insight) => (
                    <li key={insight}>{insight}</li>
                  ))}
                </ul>
              </div>
              <div className="research-knowledge-col">
                <p className="research-knowledge-col-label">
                  {t("research.dashboard.knowledge.lastAnalysis")}
                </p>
                <p className="research-knowledge-last">{lastAnalysis}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Competitor Monitor */}
      <section className="research-dash-section">
        <h3 className="research-dash-section-title">
          {t("research.dashboard.competitorMonitor")}
        </h3>
        <ul className="research-competitor-list">
          {competitors.map((competitor) => (
            <li key={competitor.name} className="research-competitor-item">
              <div className="research-competitor-main">
                <div className="research-competitor-head">
                  <span className="research-competitor-name">
                    {competitor.name}
                  </span>
                  <span
                    className={cn(
                      "research-status-badge",
                      `research-status-badge-${competitor.status}`,
                    )}
                  >
                    {t(
                      `research.dashboard.competitorStatus.${competitor.status}`,
                    )}
                  </span>
                </div>
                <div className="research-competitor-intel">
                  <span className="research-competitor-trend">
                    {competitor.trendChange}
                  </span>
                  <span className="research-competitor-signal">
                    {competitor.signal}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
