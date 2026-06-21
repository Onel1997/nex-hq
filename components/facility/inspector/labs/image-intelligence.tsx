"use client";

import { memo, useMemo } from "react";
import type { ReportListItem } from "@/lib/mock/reports";
import { extractImageIntelligence } from "@/lib/facility/lab-intelligence";
import {
  IntelList,
  IntelReportRow,
  IntelSubsection,
  reportMeta,
} from "./intel-primitives";

interface ImageIntelligencePanelProps {
  reports: ReportListItem[];
}

export const ImageIntelligencePanel = memo(function ImageIntelligencePanel({
  reports,
}: ImageIntelligencePanelProps) {
  const intel = useMemo(() => extractImageIntelligence(reports), [reports]);

  const hasData =
    intel.reports.length > 0 ||
    intel.assets.length > 0 ||
    intel.prompts.length > 0;

  if (!hasData) {
    return (
      <p className="facility-inspector-empty">
        No visual assets yet — run the Image Agent to generate prompts and assets.
      </p>
    );
  }

  return (
    <div className="facility-intel-panel">
      {intel.reports.length > 0 ? (
        <IntelSubsection label="Image Reports">
          <div className="facility-intel-report-stack">
            {intel.reports.slice(0, 4).map((r) => (
              <IntelReportRow
                key={r.id}
                title={r.title}
                meta={`${reportMeta(r.confidence, r.createdAt, r.status)} · ${r.assetCount} assets`}
              />
            ))}
          </div>
        </IntelSubsection>
      ) : null}

      {intel.prompts.length > 0 ? (
        <IntelSubsection label="Generated Prompts">
          <div className="facility-intel-report-stack">
            {intel.prompts.slice(0, 4).map((p) => (
              <IntelReportRow
                key={p.title}
                title={p.title}
                meta="prompt"
                summary={p.prompt}
              />
            ))}
          </div>
        </IntelSubsection>
      ) : null}

      {intel.assets.length > 0 ? (
        <IntelSubsection label="Assets">
          <ul className="facility-inspector-list facility-lab-room-list">
            {intel.assets.slice(0, 6).map((asset) => (
              <li
                key={asset.title}
                className="facility-inspector-list-item facility-lab-room-list-item"
              >
                <span>{asset.title}</span>
                <span className="facility-inspector-meta">
                  {asset.type} · {asset.status}
                </span>
              </li>
            ))}
          </ul>
        </IntelSubsection>
      ) : null}

      {intel.campaignVisuals.length > 0 ? (
        <IntelSubsection label="Campaign Visuals">
          <IntelList items={intel.campaignVisuals} />
        </IntelSubsection>
      ) : null}

      {intel.productImages.length > 0 ? (
        <IntelSubsection label="Product Images">
          <IntelList items={intel.productImages} />
        </IntelSubsection>
      ) : null}

      {intel.generationStatus.length > 0 ? (
        <IntelSubsection label="Generation Status">
          <ul className="facility-inspector-list facility-lab-room-list">
            {intel.generationStatus.slice(0, 6).map((item) => (
              <li
                key={item.name}
                className="facility-inspector-list-item facility-lab-room-list-item"
              >
                <span>{item.name}</span>
                <span className="facility-inspector-meta" data-status={item.status}>
                  {item.status}
                </span>
              </li>
            ))}
          </ul>
        </IntelSubsection>
      ) : null}
    </div>
  );
});
