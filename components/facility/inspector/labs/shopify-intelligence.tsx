"use client";

import { memo, useMemo } from "react";
import type { ReportListItem } from "@/lib/mock/reports";
import {
  IntelList,
  IntelReportRow,
  IntelSubsection,
  reportMeta,
} from "./intel-primitives";

interface ShopifyIntelligencePanelProps {
  reports: ReportListItem[];
}

export const ShopifyIntelligencePanel = memo(function ShopifyIntelligencePanel({
  reports,
}: ShopifyIntelligencePanelProps) {
  const items = useMemo(
    () =>
      reports.map((r) => ({
        id: r.id,
        title: r.title,
        confidence: r.confidence,
        createdAt: r.createdAt,
        status: r.status,
        collection: r.shopifyReport?.collectionName,
        products: r.shopifyReport?.products ?? [],
        checklist: r.shopifyReport?.launchChecklist ?? [],
      })),
    [reports],
  );

  const hasReportData = items.some(
    (i) => i.collection || i.products.length > 0 || i.checklist.length > 0,
  );

  if (!hasReportData) {
    return null;
  }

  return (
    <div className="facility-intel-panel">
      <IntelSubsection label="Storefront Reports">
        <div className="facility-intel-report-stack">
          {items.slice(0, 3).map((r) => (
            <IntelReportRow
              key={r.id}
              title={r.title}
              meta={reportMeta(r.confidence, r.createdAt, r.status)}
            />
          ))}
        </div>
      </IntelSubsection>

      {items[0]?.collection ? (
        <IntelSubsection label="Current Collection">
          <p className="facility-inspector-text">{items[0].collection}</p>
        </IntelSubsection>
      ) : null}

      {items.some((i) => i.products.length > 0) ? (
        <IntelSubsection label="Draft Products">
          <ul className="facility-inspector-list facility-lab-room-list">
            {items
              .flatMap((i) => i.products)
              .slice(0, 6)
              .map((p) => (
                <li
                  key={p.productName}
                  className="facility-inspector-list-item facility-lab-room-list-item"
                >
                  <span>{p.productName}</span>
                  <span className="facility-inspector-meta">{p.suggestedPrice}</span>
                </li>
              ))}
          </ul>
        </IntelSubsection>
      ) : null}

      {items.some((i) => i.checklist.length > 0) ? (
        <IntelSubsection label="Launch Checklist">
          <IntelList items={items.flatMap((i) => i.checklist).slice(0, 6)} />
        </IntelSubsection>
      ) : null}
    </div>
  );
});
