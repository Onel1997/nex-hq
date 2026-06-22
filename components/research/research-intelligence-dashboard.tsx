"use client";

import { useMemo } from "react";
import type { LabInspectorData } from "@/lib/facility/types";
import { extractResearchIntelligence } from "@/lib/facility/lab-intelligence";
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

const MARKET_SIGNAL_KEYS = [
  "streetwearRising",
  "earthTones",
  "oversizedDemand",
  "premiumExpanding",
] as const;

const TREND_ALERT_KEYS = [
  { key: "oversizedDemand", direction: "up" as const, value: "+18%" },
  { key: "earthTonesRising", direction: "up" as const },
  { key: "premiumGrowth", direction: "up" as const },
  { key: "slimFitDeclining", direction: "down" as const },
] as const;

const DEMO_TREND_REPORTS = [
  { titleKey: "premiumStreetwear", score: 92 },
  { titleKey: "oversizedGrowth", score: 87 },
  { titleKey: "colorTrends", score: 78 },
] as const;

const COMPETITORS = [
  {
    name: "Corteiz",
    status: "watching" as const,
    trendKey: "corteizTrend",
    signalKey: "corteizSignal",
  },
  {
    name: "Represent",
    status: "tracked" as const,
    trendKey: "representTrend",
    signalKey: "representSignal",
  },
  {
    name: "Fear of God",
    status: "analyzing" as const,
    trendKey: "fogTrend",
    signalKey: "fogSignal",
  },
  {
    name: "Essentials",
    status: "stable" as const,
    trendKey: "essentialsTrend",
    signalKey: "essentialsSignal",
  },
  {
    name: "Cole Buxton",
    status: "watching" as const,
    trendKey: "coleBuxtonTrend",
    signalKey: "coleBuxtonSignal",
  },
] as const;

const DEMO_INSIGHTS = [
  "insightOversized",
  "insightEarthTones",
  "insightPremium",
] as const;

export function ResearchIntelligenceDashboard({
  data,
}: ResearchIntelligenceDashboardProps) {
  const t = useT();

  const intel = useMemo(
    () =>
      data?.fullReports
        ? extractResearchIntelligence(data.fullReports)
        : null,
    [data?.fullReports],
  );

  const trendReports =
    intel?.reports.filter((r) => r.reportType === "trend") ?? [];
  const competitorCount = intel?.competitorReports.length ?? 5;
  const signalCount = intel?.streetwearInsights.length ?? 8;
  const knowledgeCount =
    intel?.reports.length ?? data?.metrics.reportCount ?? 14;

  const featuredTrendReports =
    trendReports.length > 0
      ? trendReports.slice(0, 3).map((r) => ({
          title: r.title,
          score: Math.round((r.confidence ?? 0.75) * 100),
        }))
      : DEMO_TREND_REPORTS.map((item) => ({
          title: t(`research.dashboard.reports.${item.titleKey}`),
          score: item.score,
        }));

  const recentReports =
    intel && intel.reports.length > 0
      ? intel.reports.slice(0, 3).map((r) => r.title)
      : DEMO_TREND_REPORTS.map((item) =>
          t(`research.dashboard.reports.${item.titleKey}`),
        );

  const savedInsights =
    intel && intel.streetwearInsights.length > 0
      ? intel.streetwearInsights.slice(0, 3)
      : DEMO_INSIGHTS.map((key) =>
          t(`research.dashboard.knowledge.insights.${key}`),
        );

  const lastAnalysis =
    intel?.reports[0]?.title ??
    data?.reports[0]?.title ??
    t("research.dashboard.knowledge.lastAnalysisDefault");

  return (
    <div
      className="research-intel-dashboard"
      aria-label={t("research.dashboard.label")}
    >
      {/* Market Signals — unchanged */}
      <section className="research-dash-section">
        <h3 className="research-dash-section-title">
          {t("research.dashboard.marketSignals")}
        </h3>
        <div className="research-signal-row">
          {MARKET_SIGNAL_KEYS.map((key) => (
            <div key={key} className="research-signal-card">
              <Radio className="research-signal-icon size-3.5" aria-hidden />
              <span className="research-signal-label">
                {t(`research.dashboard.signals.${key}`)}
              </span>
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
          {TREND_ALERT_KEYS.map((alert) => (
            <li key={alert.key} className="research-trend-alert-item">
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
                {t(`research.dashboard.trendAlerts.${alert.key}`)}
                {"value" in alert ? (
                  <span className="research-trend-alert-value">
                    {" "}
                    {alert.value}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Intelligence Grid — asymmetric observatory layout */}
      <section className="research-dash-section">
        <h3 className="research-dash-section-title">
          {t("research.dashboard.intelligenceGrid")}
        </h3>
        <div className="research-intel-grid-v4">
          {/* Featured Trend Reports */}
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
                    count: String(trendReports.length || 3),
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

          {/* Competitor Watch — unchanged structure */}
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

          {/* Consumer Signals — smaller */}
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

          {/* Knowledge Base — expanded observatory memory */}
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

      {/* Competitor Monitor — unchanged */}
      <section className="research-dash-section">
        <h3 className="research-dash-section-title">
          {t("research.dashboard.competitorMonitor")}
        </h3>
        <ul className="research-competitor-list">
          {COMPETITORS.map((competitor) => (
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
                    {t(
                      `research.dashboard.competitorIntel.${competitor.trendKey}`,
                    )}
                  </span>
                  <span className="research-competitor-signal">
                    {t(
                      `research.dashboard.competitorIntel.${competitor.signalKey}`,
                    )}
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
