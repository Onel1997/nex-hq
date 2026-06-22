"use client";

import type { LabInspectorData } from "@/lib/facility/types";
import { extractResearchIntelligence } from "@/lib/facility/lab-intelligence";
import { useMemo } from "react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface ResearchHeroStatusProps {
  data: LabInspectorData | null;
  isLoading?: boolean;
  integrated?: boolean;
}

export function ResearchHeroStatus({
  data,
  isLoading,
  integrated = false,
}: ResearchHeroStatusProps) {
  const t = useT();

  const intel = useMemo(
    () =>
      data?.fullReports
        ? extractResearchIntelligence(data.fullReports)
        : null,
    [data?.fullReports],
  );

  const savedReports = data?.metrics.reportCount ?? 4;
  const activeTrends =
    intel?.reports.filter((r) => r.reportType === "trend").length ?? 2;
  const runningCompetitor =
    intel?.competitorReports.filter(
      (r) => r.status !== "approved" && r.status !== "rejected",
    ).length ?? 1;
  const knowledgeOnline = data ? t("research.heroStatus.knowledgeOnline") : null;

  const items = [
    isLoading
      ? t("research.heroStatus.loading")
      : t("research.heroStatus.savedReports", {
          count: String(savedReports),
        }),
    isLoading
      ? null
      : t("research.heroStatus.activeTrends", {
          count: String(activeTrends),
        }),
    isLoading
      ? null
      : t("research.heroStatus.competitorRunning", {
          count: String(runningCompetitor || 1),
        }),
    isLoading ? null : knowledgeOnline ?? t("research.heroStatus.knowledgeOnline"),
  ].filter(Boolean) as string[];

  return (
    <aside
      className={cn(
        "research-hero-status",
        integrated && "research-hero-status-integrated",
      )}
      aria-label={t("research.heroStatus.label")}
    >
      <p className="research-hero-status-label">
        {t("research.heroStatus.label")}
      </p>
      <ul className="research-hero-status-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </aside>
  );
}
