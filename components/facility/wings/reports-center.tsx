"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FacilityDepartmentShell } from "@/components/facility/facility-department-shell";
import type {
  ReportsCenterPayload,
  ReportsCenterReport,
  ReportsCenterType,
} from "@/lib/facility/reports-center-types";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Briefcase,
  Crown,
  FileText,
  Loader2,
  Palette,
  RefreshCw,
  ShoppingBag,
  Target,
  TrendingUp,
} from "lucide-react";

const STATUS_LABELS: Record<ReportsCenterReport["status"], string> = {
  approved: "Approved",
  pending_review: "Review",
  draft: "Draft",
  archived: "Archived",
  classified: "Classified",
};

const TYPE_ICONS: Record<
  ReportsCenterType,
  React.ComponentType<{ className?: string }>
> = {
  commerce: ShoppingBag,
  research: TrendingUp,
  design: Palette,
  marketing: Briefcase,
  ceo_briefing: Crown,
  mission_summary: Target,
};

export function ReportsCenter() {
  const { data, loading, error, refresh } = useReportsCenter();

  return (
    <FacilityDepartmentShell
      wingId="reports"
      title="Reports Center"
      icon={FileText}
      subtitle="Mission intelligence room — the strategic output layer of Milaene HQ"
      className="rc-shell"
      headerActions={
        <button
          type="button"
          className="rc-refresh"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Sync Reports
        </button>
      }
    >
      {loading && !data ? (
        <div className="rc-loading">
          <Loader2 className="size-8 animate-spin text-[var(--rc-accent)]" />
          <p>Opening briefing room…</p>
        </div>
      ) : error ? (
        <div className="rc-error">
          <p>{error}</p>
          <button type="button" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      ) : data ? (
        <ReportsBriefingRoom data={data} />
      ) : null}
    </FacilityDepartmentShell>
  );
}

function ReportsBriefingRoom({ data }: { data: ReportsCenterPayload }) {
  const [typeFilter, setTypeFilter] = useState<ReportsCenterType | "all">("all");
  const [selected, setSelected] = useState<ReportsCenterReport | null>(null);

  const filtered = useMemo(() => {
    if (typeFilter === "all") return data.reports;
    return data.reports.filter((r) => r.type === typeFilter);
  }, [data.reports, typeFilter]);

  const showCeoRow = typeFilter === "all";

  return (
    <div className="rc-room">
      <CommandBar bar={data.commandBar} />

      <div className="rc-type-bar">
        {data.types.map((type) => (
          <button
            key={type.id}
            type="button"
            className={cn(
              "rc-type-btn",
              typeFilter === type.id && "rc-type-btn-active",
            )}
            onClick={() => {
              setTypeFilter(type.id);
              setSelected(null);
            }}
          >
            {type.label}
            <span>{type.count}</span>
          </button>
        ))}
      </div>

      <div className="rc-layout">
        <div className="rc-main">
          {selected ? (
            <ReportPreview
              report={selected}
              onBack={() => setSelected(null)}
            />
          ) : (
            <>
              {showCeoRow ? (
                <section className="rc-ceo-section" aria-label="CEO Briefings">
                  <header className="rc-section-header">
                    <Crown className="size-4 text-[var(--rc-gold)]" />
                    <h2>CEO Briefings</h2>
                  </header>
                  <div className="rc-ceo-grid">
                    {data.ceoBriefings.map((report) => (
                      <ReportCard
                        key={report.id}
                        report={report}
                        featured
                        onSelect={() => setSelected(report)}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="rc-reports-section" aria-label="Reports">
                <header className="rc-section-header">
                  <FileText className="size-4" />
                  <h2>
                    {typeFilter === "all"
                      ? "Intelligence Reports"
                      : data.types.find((t) => t.id === typeFilter)?.label}
                  </h2>
                  <span>{filtered.length} reports</span>
                </header>

                {filtered.length === 0 ? (
                  <p className="rc-empty">No reports in this category</p>
                ) : (
                  <div className="rc-report-grid">
                    {filtered
                      .filter((r) => typeFilter !== "all" || !r.isCeoBriefing)
                      .map((report) => (
                        <ReportCard
                          key={report.id}
                          report={report}
                          featured={report.isCeoBriefing}
                          onSelect={() => setSelected(report)}
                        />
                      ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        <aside className="rc-side">
          <ActivityPanel feed={data.activityFeed} />
          <ExportPanel modules={data.exportModules} />
        </aside>
      </div>
    </div>
  );
}

function CommandBar({ bar }: { bar: ReportsCenterPayload["commandBar"] }) {
  const items = [
    { label: "Total Reports", value: bar.totalReports, glow: true },
    { label: "Approved", value: bar.approved },
    { label: "Pending Review", value: bar.pendingReview, alert: bar.pendingReview > 0 },
    { label: "CEO Briefings", value: bar.ceoBriefings, gold: true },
  ];

  return (
    <div className="rc-command-bar">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "rc-command-stat",
            item.glow && "rc-command-stat-glow",
            item.alert && "rc-command-stat-alert",
            item.gold && "rc-command-stat-gold",
          )}
        >
          <span className="rc-command-label">{item.label}</span>
          <span className="rc-command-value">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function ReportCard({
  report,
  featured = false,
  onSelect,
}: {
  report: ReportsCenterReport;
  featured?: boolean;
  onSelect: () => void;
}) {
  const Icon = TYPE_ICONS[report.type];

  return (
    <button
      type="button"
      className={cn(
        "rc-card",
        featured && "rc-card-featured",
        `rc-card-status-${report.status}`,
      )}
      onClick={onSelect}
    >
      <header className="rc-card-header">
        <span className="rc-card-type">
          <Icon className="size-3.5" />
          {report.department}
        </span>
        <span className={cn("rc-card-status", `rc-status-${report.status}`)}>
          {STATUS_LABELS[report.status]}
        </span>
      </header>

      <h3 className="rc-card-title">{report.title}</h3>

      <p className="rc-card-summary">{report.preview.executiveSummary}</p>

      <footer className="rc-card-footer">
        <span>{report.agent}</span>
        <span>{Math.round(report.confidence * 100)}% confidence</span>
        <span>
          {new Date(report.date).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      </footer>

      {report.tags.length > 0 ? (
        <div className="rc-card-tags">
          {report.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
    </button>
  );
}

function ReportPreview({
  report,
  onBack,
}: {
  report: ReportsCenterReport;
  onBack: () => void;
}) {
  const Icon = TYPE_ICONS[report.type];

  return (
    <article className="rc-preview">
      <button type="button" className="rc-preview-back" onClick={onBack}>
        <ArrowLeft className="size-3.5" />
        Back to reports
      </button>

      <header className="rc-preview-header">
        <div className="rc-preview-meta">
          <span className="rc-preview-type">
            <Icon className="size-4" />
            {report.department}
          </span>
          <span className={cn("rc-card-status", `rc-status-${report.status}`)}>
            {STATUS_LABELS[report.status]}
          </span>
        </div>
        <h2>{report.title}</h2>
        <div className="rc-preview-info">
          <span>{report.agent}</span>
          <span>{Math.round(report.confidence * 100)}% confidence</span>
          <span>
            {new Date(report.date).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
      </header>

      <div className="rc-preview-body">
        <PreviewSection title="Executive Summary">
          <p>{report.preview.executiveSummary}</p>
        </PreviewSection>

        <PreviewSection title="Key Findings">
          <ul>
            {report.preview.keyFindings.map((finding) => (
              <li key={finding}>{finding}</li>
            ))}
          </ul>
        </PreviewSection>

        <PreviewSection title="Recommendations">
          <ul>
            {report.preview.recommendations.map((rec) => (
              <li key={rec}>{rec}</li>
            ))}
          </ul>
        </PreviewSection>

        <div className="rc-preview-columns">
          <PreviewSection title="Linked Missions">
            {report.preview.linkedMissions.length > 0 ? (
              <ul className="rc-linked-list">
                {report.preview.linkedMissions.map((mission) => (
                  <li key={mission.id}>
                    <Target className="size-3.5" />
                    {mission.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rc-preview-muted">No linked missions</p>
            )}
          </PreviewSection>

          <PreviewSection title="Connected Departments">
            <div className="rc-dept-chips">
              {report.preview.connectedDepartments.map((dept) => (
                <span key={dept}>{dept}</span>
              ))}
            </div>
          </PreviewSection>
        </div>
      </div>
    </article>
  );
}

function PreviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rc-preview-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function ActivityPanel({
  feed,
}: {
  feed: ReportsCenterPayload["activityFeed"];
}) {
  return (
    <section className="rc-panel rc-activity">
      <header className="rc-panel-header">
        <TrendingUp className="size-4" />
        <h2>Activity Feed</h2>
      </header>
      <ul className="rc-activity-list">
        {feed.map((item) => (
          <li key={item.id} className={cn("rc-activity-item", `rc-activity-${item.kind}`)}>
            <span className="rc-activity-dot" />
            <div>
              <p>{item.message}</p>
              <span>
                {item.department} ·{" "}
                {new Date(item.timestamp).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ExportPanel({ modules }: { modules: string[] }) {
  return (
    <section className="rc-panel rc-export">
      <header className="rc-panel-header">
        <FileText className="size-4" />
        <h2>Export Module</h2>
      </header>
      <ul className="rc-export-list">
        {modules.map((module) => (
          <li key={module}>
            <span>{module}</span>
            <span className="rc-export-soon">Coming online</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function useReportsCenter() {
  const [data, setData] = useState<ReportsCenterPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/facility/reports");
      const body = (await res.json()) as ReportsCenterPayload & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to load Reports Center");
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Reports Center");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
