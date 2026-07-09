"use client";

import { memo } from "react";
import { formatInspectorDate } from "@/lib/facility/lab-intelligence";
import { cn } from "@/lib/utils";

interface IntelListProps {
  items: string[];
  limit?: number;
  className?: string;
}

export const IntelList = memo(function IntelList({
  items,
  limit = 6,
  className,
}: IntelListProps) {
  const visible = items.slice(0, limit);
  if (visible.length === 0) return null;

  return (
    <ul className={cn("facility-intel-list", className)}>
      {visible.map((item, i) => (
        <li key={`${item.slice(0, 24)}-${i}`} className="facility-intel-list-item">
          {item}
        </li>
      ))}
    </ul>
  );
});

interface IntelReportRowProps {
  title: string;
  meta: string;
  summary?: string;
}

export const IntelReportRow = memo(function IntelReportRow({
  title,
  meta,
  summary,
}: IntelReportRowProps) {
  return (
    <div className="facility-intel-report-row">
      <div className="facility-intel-report-header">
        <span className="facility-intel-report-title">{title}</span>
        <span className="facility-inspector-meta">{meta}</span>
      </div>
      {summary ? (
        <p className="facility-intel-report-summary">{summary}</p>
      ) : null}
    </div>
  );
});

interface IntelSubsectionProps {
  label: string;
  children: React.ReactNode;
}

export const IntelSubsection = memo(function IntelSubsection({
  label,
  children,
}: IntelSubsectionProps) {
  return (
    <div className="facility-intel-subsection">
      <h4 className="facility-intel-subsection-label">{label}</h4>
      {children}
    </div>
  );
});

export function reportMeta(confidence: number, createdAt: string, status: string): string {
  return `${status} · ${Math.round(confidence * 100)}% · ${formatInspectorDate(createdAt)}`;
}
