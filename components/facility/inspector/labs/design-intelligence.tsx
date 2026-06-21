"use client";

import { memo, useMemo } from "react";
import type { ReportListItem } from "@/lib/mock/reports";
import { extractDesignIntelligence } from "@/lib/facility/lab-intelligence";
import {
  IntelList,
  IntelReportRow,
  IntelSubsection,
  reportMeta,
} from "./intel-primitives";

interface DesignIntelligencePanelProps {
  reports: ReportListItem[];
}

export const DesignIntelligencePanel = memo(function DesignIntelligencePanel({
  reports,
}: DesignIntelligencePanelProps) {
  const intel = useMemo(() => extractDesignIntelligence(reports), [reports]);

  const hasData =
    intel.reports.length > 0 ||
    intel.collectionConcepts.length > 0 ||
    intel.moodboardColors.length > 0;

  if (!hasData) {
    return (
      <p className="facility-inspector-empty">
        No creative direction yet — run the Design Agent to develop a collection concept.
      </p>
    );
  }

  return (
    <div className="facility-intel-panel">
      {intel.currentCollection ? (
        <div className="facility-intel-highlight">
          <span className="facility-intel-highlight-label">Current Collection</span>
          <span className="facility-intel-highlight-value">
            {intel.currentCollection}
            {intel.collectionConcepts[0]?.season
              ? ` · ${intel.collectionConcepts[0].season}`
              : ""}
          </span>
          {intel.collectionConcepts[0]?.theme ? (
            <span className="facility-inspector-meta">
              {intel.collectionConcepts[0].theme}
            </span>
          ) : null}
        </div>
      ) : null}

      {intel.confidence != null ? (
        <div className="facility-lab-room-confidence">
          <span className="facility-lab-room-confidence-value">
            {Math.round(intel.confidence * 100)}%
          </span>
          <div className="facility-lab-room-confidence-bar">
            <div
              className="facility-lab-room-confidence-fill"
              style={{ width: `${Math.round(intel.confidence * 100)}%` }}
            />
          </div>
          <span className="facility-inspector-meta">Confidence</span>
        </div>
      ) : null}

      {intel.stylingDirection ? (
        <IntelSubsection label="Creative Direction">
          <p className="facility-inspector-text">{intel.stylingDirection}</p>
        </IntelSubsection>
      ) : null}

      {intel.collectionStory ? (
        <IntelSubsection label="Collection Story">
          <p className="facility-inspector-text">{intel.collectionStory}</p>
        </IntelSubsection>
      ) : null}

      {intel.mood ? (
        <IntelSubsection label="Mood">
          <p className="facility-inspector-text">{intel.mood}</p>
        </IntelSubsection>
      ) : null}

      {intel.moodboardColors.length > 0 ? (
        <IntelSubsection label="Color Palette">
          <div className="facility-intel-palette">
            {intel.moodboardColors.slice(0, 8).map((color) => (
              <div key={`${color.name}-${color.role}`} className="facility-intel-palette-swatch">
                <span
                  className="facility-intel-palette-dot"
                  style={{ background: color.hex ?? "#22D3EE" }}
                />
                <span className="facility-intel-palette-name">{color.name}</span>
                <span className="facility-inspector-meta">{color.role}</span>
              </div>
            ))}
          </div>
        </IntelSubsection>
      ) : null}

      {intel.products.length > 0 ? (
        <IntelSubsection label="Products">
          <ul className="facility-inspector-list facility-lab-room-list">
            {intel.products.slice(0, 8).map((product) => (
              <li
                key={`${product.name}-${product.color}`}
                className="facility-inspector-list-item facility-lab-room-list-item"
              >
                <span>
                  {product.name}
                  <span className="facility-inspector-meta"> · {product.priority}</span>
                </span>
                <span className="facility-inspector-meta">
                  {product.material} · {product.color} · {product.pricePosition}
                </span>
              </li>
            ))}
          </ul>
        </IntelSubsection>
      ) : null}

      {intel.visualReferences.length > 0 ? (
        <IntelSubsection label="Visual References">
          <IntelList items={intel.visualReferences} />
        </IntelSubsection>
      ) : null}

      {intel.reports.length > 0 ? (
        <IntelSubsection label="Latest Design Reports">
          <div className="facility-intel-report-stack">
            {intel.reports.slice(0, 3).map((r) => (
              <IntelReportRow
                key={r.id}
                title={r.title}
                meta={reportMeta(r.confidence, r.createdAt, r.status)}
              />
            ))}
          </div>
        </IntelSubsection>
      ) : null}
    </div>
  );
});
