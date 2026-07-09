"use client";

import { memo, useMemo } from "react";
import type { ReportListItem } from "@/lib/mock/reports";
import { extractResearchIntelligence } from "@/lib/facility/lab-intelligence";
import {
  IntelList,
  IntelReportRow,
  IntelSubsection,
  reportMeta,
} from "./intel-primitives";

interface ResearchIntelligencePanelProps {
  reports: ReportListItem[];
}

export const ResearchIntelligencePanel = memo(function ResearchIntelligencePanel({
  reports,
}: ResearchIntelligencePanelProps) {
  const intel = useMemo(() => extractResearchIntelligence(reports), [reports]);

  const hasData =
    intel.reports.length > 0 ||
    intel.trendAnalyses.length > 0 ||
    intel.competitorReports.length > 0 ||
    intel.streetwearInsights.length > 0;

  if (!hasData) {
    return (
      <p className="facility-inspector-empty">
        No research intelligence yet — run the Research Agent to generate reports.
      </p>
    );
  }

  return (
    <div className="facility-intel-panel">
      {intel.reports.length > 0 ? (
        <IntelSubsection label="Latest Research Reports">
          <div className="facility-intel-report-stack">
            {intel.reports.slice(0, 4).map((r) => (
              <IntelReportRow
                key={r.id}
                title={r.title}
                meta={reportMeta(r.confidence, r.createdAt, r.status)}
                summary={r.summary}
              />
            ))}
          </div>
        </IntelSubsection>
      ) : null}

      {intel.trendAnalyses.length > 0 ? (
        <IntelSubsection label="Trend Analyses">
          <IntelList items={intel.trendAnalyses} />
        </IntelSubsection>
      ) : null}

      {intel.competitorReports.length > 0 ? (
        <IntelSubsection label="Competitor Reports">
          <div className="facility-intel-report-stack">
            {intel.competitorReports.slice(0, 3).map((r) => (
              <IntelReportRow
                key={r.id}
                title={r.title}
                meta={reportMeta(r.confidence, r.createdAt, r.status)}
              />
            ))}
          </div>
        </IntelSubsection>
      ) : null}

      {intel.streetwearInsights.length > 0 ? (
        <IntelSubsection label="Streetwear Insights">
          <IntelList items={intel.streetwearInsights} />
        </IntelSubsection>
      ) : null}

      {intel.colorDirections.length > 0 ? (
        <IntelSubsection label="Color Directions">
          <IntelList items={intel.colorDirections} />
        </IntelSubsection>
      ) : null}
    </div>
  );
});
