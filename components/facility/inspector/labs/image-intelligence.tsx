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
    intel.pendingAssets.length > 0 ||
    intel.generatedAssets.length > 0 ||
    intel.prompts.length > 0;

  if (!hasData) {
    return (
      <p className="facility-inspector-empty">
        No visual production yet — run the Image Agent to plan the creative studio shoot.
      </p>
    );
  }

  return (
    <div className="facility-intel-panel">
      {intel.visualDirection ? (
        <div className="facility-intel-highlight">
          <span className="facility-intel-highlight-label">Visual Direction</span>
          <span className="facility-intel-highlight-value facility-inspector-text">
            {intel.visualDirection}
          </span>
        </div>
      ) : null}

      {intel.reports.length > 0 ? (
        <IntelSubsection label="Production Reports">
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

      {intel.pendingAssets.length > 0 ? (
        <IntelSubsection label="Pending Assets">
          <ul className="facility-inspector-list facility-lab-room-list">
            {intel.pendingAssets.map((asset) => (
              <li
                key={`${asset.title}-${asset.assetType}`}
                className="facility-inspector-list-item facility-lab-room-list-item"
              >
                <span>{asset.title}</span>
                <span className="facility-inspector-meta" data-status={asset.status}>
                  {asset.productName} · {asset.assetType}
                </span>
              </li>
            ))}
          </ul>
        </IntelSubsection>
      ) : null}

      {intel.generatedAssets.length > 0 ? (
        <IntelSubsection label="Generated Assets">
          <ul className="facility-inspector-list facility-lab-room-list">
            {intel.generatedAssets.map((asset) => (
              <li
                key={`gen-${asset.title}`}
                className="facility-inspector-list-item facility-lab-room-list-item"
              >
                <span>{asset.title}</span>
                <span className="facility-inspector-meta" data-status={asset.status}>
                  {asset.assetType}
                </span>
              </li>
            ))}
          </ul>
        </IntelSubsection>
      ) : null}

      {intel.prompts.length > 0 ? (
        <IntelSubsection label="Shot Briefs">
          <div className="facility-intel-report-stack">
            {intel.prompts.slice(0, 4).map((p) => (
              <IntelReportRow
                key={`${p.title}-${p.productName}`}
                title={p.title}
                meta={p.productName}
                summary={p.prompt}
              />
            ))}
          </div>
        </IntelSubsection>
      ) : null}

      {intel.campaignVisuals.length > 0 ? (
        <IntelSubsection label="Campaign Visuals">
          <IntelList items={intel.campaignVisuals} />
        </IntelSubsection>
      ) : null}

      {intel.productVisuals.length > 0 ? (
        <IntelSubsection label="Product Visuals">
          <IntelList items={intel.productVisuals} />
        </IntelSubsection>
      ) : null}

      {intel.lookbookShots.length > 0 ? (
        <IntelSubsection label="Lookbook">
          <IntelList items={intel.lookbookShots} limit={6} />
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
