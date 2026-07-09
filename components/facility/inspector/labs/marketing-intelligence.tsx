"use client";

import { memo, useMemo } from "react";
import type { ReportListItem } from "@/lib/mock/reports";
import { extractMarketingIntelligence } from "@/lib/facility/lab-intelligence";
import {
  IntelList,
  IntelReportRow,
  IntelSubsection,
  reportMeta,
} from "./intel-primitives";

interface MarketingIntelligencePanelProps {
  reports: ReportListItem[];
}

export const MarketingIntelligencePanel = memo(function MarketingIntelligencePanel({
  reports,
}: MarketingIntelligencePanelProps) {
  const intel = useMemo(() => extractMarketingIntelligence(reports), [reports]);

  const hasData =
    intel.reports.length > 0 ||
    intel.launchPlans.length > 0 ||
    intel.strategies.length > 0;

  if (!hasData) {
    return (
      <p className="facility-inspector-empty">
        No campaign data yet — run the Marketing Agent to build launch plans.
      </p>
    );
  }

  return (
    <div className="facility-intel-panel">
      {intel.reports.length > 0 ? (
        <IntelSubsection label="Campaign Reports">
          <div className="facility-intel-report-stack">
            {intel.reports.slice(0, 4).map((r) => (
              <IntelReportRow
                key={r.id}
                title={r.title}
                meta={reportMeta(r.confidence, r.createdAt, r.status)}
              />
            ))}
          </div>
        </IntelSubsection>
      ) : null}

      {intel.launchPlans.length > 0 ? (
        <IntelSubsection label="Launch Plans">
          <IntelList items={intel.launchPlans} limit={3} />
        </IntelSubsection>
      ) : null}

      {intel.targetAudiences.length > 0 ? (
        <IntelSubsection label="Target Audiences">
          <IntelList items={intel.targetAudiences} limit={3} />
        </IntelSubsection>
      ) : null}

      {intel.strategies.length > 0 ? (
        <IntelSubsection label="Marketing Strategies">
          <IntelList items={intel.strategies} />
        </IntelSubsection>
      ) : null}

      {intel.contentInitiatives.length > 0 ? (
        <IntelSubsection label="Content Initiatives">
          <ul className="facility-intel-list">
            {intel.contentInitiatives.map((item) => (
              <li key={`${item.day}-${item.title}`} className="facility-intel-list-item">
                Day {item.day} · {item.title}
                <span className="facility-inspector-meta">{item.channel}</span>
              </li>
            ))}
          </ul>
        </IntelSubsection>
      ) : null}
    </div>
  );
});
