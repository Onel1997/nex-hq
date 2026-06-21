"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FacilityDepartmentShell } from "@/components/facility/facility-department-shell";
import type { ReportListItem } from "@/lib/mock/reports";
import { cn } from "@/lib/utils";
import { FileText, Loader2 } from "lucide-react";

type ReportWingCategory =
  | "commerce"
  | "design"
  | "research"
  | "marketing"
  | "all";

const WING_TABS: Array<{ id: ReportWingCategory; label: string }> = [
  { id: "all", label: "All Reports" },
  { id: "commerce", label: "Commerce" },
  { id: "design", label: "Design" },
  { id: "research", label: "Research" },
  { id: "marketing", label: "Marketing" },
];

const CATEGORY_STAMP: Record<string, string> = {
  commerce: "COMMERCE INTEL",
  design: "DESIGN INTEL",
  research: "RESEARCH INTEL",
  marketing: "MARKETING INTEL",
  content: "CONTENT INTEL",
  image: "IMAGE INTEL",
  operations: "OPS INTEL",
};

export function ReportsCenter() {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ReportWingCategory>("all");

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports");
      if (!res.ok) throw new Error("Failed to load reports");
      const body = (await res.json()) as ReportListItem[];
      setReports(body);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const filtered = useMemo(() => {
    if (tab === "all") return reports;
    return reports.filter((r) => r.category === tab);
  }, [reports, tab]);

  return (
    <FacilityDepartmentShell
      wingId="reports"
      title="Reports Center"
      icon={FileText}
      subtitle="Classified intelligence documents from every department"
      headerActions={
        <button
          type="button"
          className="facility-dept-action"
          onClick={() => void loadReports()}
          disabled={loading}
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Refresh
        </button>
      }
    >
      <div className="facility-reports-tabs">
        {WING_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={cn(
              "facility-reports-tab",
              tab === t.id && "facility-reports-tab-active",
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && reports.length === 0 ? (
        <div className="facility-wing-loading">
          <Loader2 className="size-8 animate-spin" />
          <p>Decrypting report archive…</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="facility-wing-empty">No reports in this category</p>
      ) : (
        <div className="facility-reports-grid">
          {filtered.map((report) => (
            <article
              key={report.id}
              className={cn(
                "facility-report-doc",
                `facility-report-doc-${report.status}`,
              )}
            >
              <header className="facility-report-doc-header">
                <span className="facility-report-stamp">
                  {CATEGORY_STAMP[report.category] ?? "CLASSIFIED"}
                </span>
                <span className="facility-report-status">{report.status}</span>
              </header>

              <h3 className="facility-report-title">{report.title}</h3>

              {report.summary ? (
                <p className="facility-report-summary">{report.summary}</p>
              ) : null}

              <footer className="facility-report-footer">
                <span>{report.agentId?.toUpperCase() ?? "HQ"}</span>
                <span>
                  {Math.round(report.confidence * 100)}% confidence
                </span>
                <span>
                  {new Date(report.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </footer>

              <div className="facility-report-classification">EYES ONLY</div>
            </article>
          ))}
        </div>
      )}
    </FacilityDepartmentShell>
  );
}
