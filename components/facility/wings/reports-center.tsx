"use client";

import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import {
  buildDesignMissionFromHandoff,
  getDesignMissionForReport,
  saveDesignMission,
} from "@/lib/design/design-mission-store";
import { AGENT_STUDIO_NAMES } from "@/lib/workspace/agent-routes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FacilityDepartmentShell } from "@/components/facility/facility-department-shell";
import type {
  ReportsCenterAgentTab,
  ReportsCenterDesignConceptSummary,
  ReportsCenterDesignResearch,
  ReportsCenterPayload,
  ReportsCenterReport,
  ReportsCenterSource,
} from "@/lib/facility/reports-center-types";
import { REPORT_SOURCE_LABELS } from "@/lib/reports/report-source";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Archive,
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

const AGENT_TAB_ICONS: Record<
  ReportsCenterAgentTab,
  React.ComponentType<{ className?: string }>
> = {
  research: TrendingUp,
  design: Palette,
  marketing: Briefcase,
  commerce: ShoppingBag,
  ceo: Crown,
};

export function ReportsCenter() {
  const { data, loading, error, refresh } = useReportsCenter();

  return (
    <FacilityDepartmentShell
      wingId="reports"
      title="Reports Center"
      icon={FileText}
      subtitle="Milaene intelligence layer — live agent output only by default"
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
  const [agentTab, setAgentTab] = useState<ReportsCenterAgentTab | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<ReportsCenterSource | "all">("live");
  const [showLegacyArchive, setShowLegacyArchive] = useState(false);
  const [selected, setSelected] = useState<ReportsCenterReport | null>(null);

  const filtered = useMemo(() => {
    let base: ReportsCenterReport[];

    if (showLegacyArchive) {
      base = data.legacyArchive;
    } else if (sourceFilter === "all") {
      base = [...data.reports, ...data.legacyArchive];
    } else if (sourceFilter === "live") {
      base = data.reports;
    } else {
      base = data.legacyArchive.filter((report) => report.source === sourceFilter);
    }

    if (agentTab === "all") return base;
    return base.filter((report) => report.agentTab === agentTab);
  }, [data.reports, data.legacyArchive, agentTab, sourceFilter, showLegacyArchive]);

  return (
    <div className="rc-room">
      <CommandBar bar={data.commandBar} />

      <div className="rc-filter-row">
        <div className="rc-type-bar" role="tablist" aria-label="Agent tabs">
          {data.agentTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              className={cn(
                "rc-type-btn",
                agentTab === tab.id && "rc-type-btn-active",
              )}
              onClick={() => {
                setAgentTab(tab.id);
                setSelected(null);
              }}
            >
              {tab.label}
              <span>{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="rc-source-bar" role="tablist" aria-label="Source filters">
          {data.sourceFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={cn(
                "rc-source-btn",
                sourceFilter === filter.id && "rc-source-btn-active",
                filter.id === "live" && "rc-source-btn-live",
              )}
              onClick={() => {
                setSourceFilter(filter.id);
                setShowLegacyArchive(false);
                setSelected(null);
              }}
            >
              {filter.label}
              <span>{filter.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rc-archive-bar">
        <button
          type="button"
          className={cn("rc-archive-toggle", showLegacyArchive && "rc-archive-toggle-active")}
          onClick={() => {
            setShowLegacyArchive((open) => !open);
            setSelected(null);
          }}
        >
          <Archive className="size-3.5" />
          Archive Legacy Reports
          <span>{data.legacyArchive.length}</span>
        </button>
        {sourceFilter === "live" && !showLegacyArchive ? (
          <p className="rc-archive-hint">
            Showing live intelligence only — seed, demo and legacy hidden.
          </p>
        ) : null}
      </div>

      <div className="rc-layout">
        <div className="rc-main">
          {selected ? (
            <ReportPreview
              report={selected}
              onBack={() => setSelected(null)}
            />
          ) : (
            <section className="rc-reports-section" aria-label="Reports">
              <header className="rc-section-header">
                <FileText className="size-4" />
                <h2>
                  {showLegacyArchive
                    ? "Legacy Archive"
                    : sourceFilter === "live"
                      ? "Live Intelligence"
                      : `${REPORT_SOURCE_LABELS[sourceFilter as ReportsCenterSource] ?? "All"} Reports`}
                </h2>
                <span>{filtered.length} reports</span>
              </header>

              {filtered.length === 0 ? (
                <div className="rc-empty">
                  <p>No live reports in this view.</p>
                  {data.legacyArchive.length > 0 ? (
                    <button
                      type="button"
                      className="rc-archive-link"
                      onClick={() => setShowLegacyArchive(true)}
                    >
                      Browse {data.legacyArchive.length} archived reports
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="rc-report-grid">
                  {filtered.map((report) => (
                    <ReportCard
                      key={report.id}
                      report={report}
                      onSelect={() => setSelected(report)}
                    />
                  ))}
                </div>
              )}
            </section>
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
    { label: "Live Reports", value: bar.liveReports, glow: true },
    { label: "Approved", value: bar.approved },
    { label: "Pending Review", value: bar.pendingReview, alert: bar.pendingReview > 0 },
    { label: "Legacy Archived", value: bar.legacyArchived, muted: true },
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
            item.muted && "rc-command-stat-muted",
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
  onSelect,
}: {
  report: ReportsCenterReport;
  onSelect: () => void;
}) {
  const Icon = AGENT_TAB_ICONS[report.agentTab];

  return (
    <button
      type="button"
      className={cn("rc-card", `rc-card-status-${report.status}`, `rc-card-source-${report.source}`)}
      onClick={onSelect}
    >
      <header className="rc-card-header">
        <span className="rc-card-type">
          <Icon className="size-3.5" />
          {report.department}
        </span>
        <span className={cn("rc-card-source", `rc-source-${report.source}`)}>
          {REPORT_SOURCE_LABELS[report.source]}
        </span>
      </header>

      <h3 className="rc-card-title">{report.title}</h3>

      <p className="rc-card-summary">{report.preview.executiveSummary}</p>

      <footer className="rc-card-footer">
        <span className={cn("rc-card-status", `rc-status-${report.status}`)}>
          {STATUS_LABELS[report.status]}
        </span>
        <span>{report.agent}</span>
        <span>{Math.round(report.confidence * 100)}%</span>
        <span>
          {new Date(report.date).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      </footer>

      {report.tags.length > 0 || report.designResearch?.designCount ? (
        <div className="rc-card-tags">
          {report.designResearch?.designCount ? (
            <span>{report.designResearch.designCount} designs</span>
          ) : null}
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
  const Icon = AGENT_TAB_ICONS[report.agentTab];
  const designResearch = report.designResearch;
  const hasStructuredDesign =
    designResearch?.hasDesignResearch && designResearch.designs.length > 0;
  const displayTitle =
    designResearch?.collection?.name?.trim() || report.title;
  const connectedToDesignStudio = report.preview.connectedDepartments.includes(
    AGENT_STUDIO_NAMES.designer,
  );
  const canHandoffToDesign =
    report.agentTab === "research" ||
    hasStructuredDesign ||
    connectedToDesignStudio;

  return (
    <article className="rc-preview">
      <button type="button" className="rc-preview-back" onClick={onBack}>
        <ArrowLeft className="size-3.5" />
        Back to reports
      </button>

      <header className="rc-preview-header">
        <div className="rc-preview-header-row">
          <div className="rc-preview-header-main">
            <div className="rc-preview-meta">
              <span className="rc-preview-type">
                <Icon className="size-4" />
                {report.department}
              </span>
              <span className={cn("rc-card-source", `rc-source-${report.source}`)}>
                {REPORT_SOURCE_LABELS[report.source]}
              </span>
              <span className={cn("rc-card-status", `rc-status-${report.status}`)}>
                {STATUS_LABELS[report.status]}
              </span>
            </div>
            <h2>{displayTitle}</h2>
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
          </div>

          {canHandoffToDesign ? (
            <div className="rc-preview-header-actions">
              <DesignStudioHandoffButton
                reportId={report.reportId}
                hasStructuredDesign={hasStructuredDesign}
                mode={hasStructuredDesign ? "all" : undefined}
                label="Send to Design Studio"
                openLabel="Open in Design Studio"
                variant="primary"
                navigateOnSuccess
              />
            </div>
          ) : null}
        </div>
      </header>

      {process.env.NODE_ENV === "development" ? (
        <DesignResearchDebugPanel
          reportId={report.reportId}
          designResearch={designResearch}
        />
      ) : null}

      <div className="rc-preview-body">
        {hasStructuredDesign && designResearch ? (
          <DesignResearchPreview
            reportId={report.reportId}
            designResearch={designResearch}
            displayTitle={displayTitle}
          />
        ) : (
          <>
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
                {connectedToDesignStudio ? (
                  <div className="rc-dept-handoff">
                    <DesignStudioHandoffButton
                      reportId={report.reportId}
                      hasStructuredDesign={hasStructuredDesign}
                      mode={hasStructuredDesign ? "all" : undefined}
                      label="Send to Design Studio"
                      openLabel="Open in Design Studio"
                      variant="primary"
                      navigateOnSuccess
                    />
                  </div>
                ) : null}
              </PreviewSection>
            </div>
          </>
        )}
      </div>
    </article>
  );
}

function DesignResearchDebugPanel({
  reportId,
  designResearch,
}: {
  reportId: string;
  designResearch?: ReportsCenterDesignResearch;
}) {
  return (
    <div className="rc-design-debug" aria-label="Design research debug">
      <span>Report ID: {reportId}</span>
      <span>
        Has designResearch: {designResearch?.hasDesignResearch ? "true" : "false"}
      </span>
      <span>Design count: {designResearch?.designCount ?? 0}</span>
    </div>
  );
}

function DesignResearchPreview({
  reportId,
  designResearch,
  displayTitle,
}: {
  reportId: string;
  designResearch: ReportsCenterDesignResearch;
  displayTitle: string;
}) {
  const collection = designResearch.collection;
  const collectionLabel = collection?.name?.trim() || displayTitle;

  return (
    <section className="rc-design-research" aria-label="Design collection">
      <header className="rc-design-research-header">
        <div>
          <h3>Design Collection</h3>
          <p className="rc-design-collection-name">{collectionLabel}</p>
        </div>
        <DesignStudioHandoffButton
          reportId={reportId}
          mode="all"
          label="Send full collection to Design Studio"
          variant="collection"
        />
      </header>

      {collection ? (
        <div className="rc-design-collection-overview">
          {collection.campaignTheme ? (
            <p>
              <strong>Campaign theme:</strong> {collection.campaignTheme}
            </p>
          ) : null}
          {collection.heroDesignId ? (
            <p>
              <strong>Hero design ID:</strong>{" "}
              <code>{collection.heroDesignId}</code>
            </p>
          ) : null}
          {collection.mood ? (
            <p>
              <strong>Mood:</strong> {collection.mood}
            </p>
          ) : null}
          {collection.philosophy ? (
            <p>
              <strong>Philosophy:</strong> {collection.philosophy}
            </p>
          ) : null}
          {collection.story ? (
            <p>
              <strong>Story:</strong> {collection.story}
            </p>
          ) : null}
          {collection.collectionScore != null ? (
            <p>
              <strong>Collection score:</strong> {collection.collectionScore}%
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rc-design-grid">
        {designResearch.designs.map((design) => (
          <DesignConceptCard
            key={design.designId}
            reportId={reportId}
            design={design}
          />
        ))}
      </div>
    </section>
  );
}

function DesignConceptCard({
  reportId,
  design,
}: {
  reportId: string;
  design: ReportsCenterDesignConceptSummary;
}) {
  return (
    <article
      className={cn("rc-design-card", design.isHero && "rc-design-card-hero")}
    >
      <header className="rc-design-card-header">
        <div>
          <h4>{design.title}</h4>
          <p className="rc-design-card-meta">
            <code>{design.designId}</code>
            <span>{design.collectionRole}</span>
            {design.isHero ? <span className="rc-design-hero-badge">Hero</span> : null}
          </p>
        </div>
        <DesignStudioHandoffButton
          reportId={reportId}
          designId={design.designId}
          label="Send to Design Studio"
          variant="design"
        />
      </header>

      <dl className="rc-design-spec-grid">
        <div>
          <dt>Product</dt>
          <dd>{design.product}</dd>
        </div>
        <div>
          <dt>Color</dt>
          <dd>{design.color}</dd>
        </div>
        <div>
          <dt>Print area</dt>
          <dd>{design.printArea}</dd>
        </div>
        <div>
          <dt>Placement</dt>
          <dd>{design.placement}</dd>
        </div>
        <div>
          <dt>Dimensions</dt>
          <dd>{design.dimensions}</dd>
        </div>
        <div>
          <dt>Production</dt>
          <dd>{design.productionMethod}</dd>
        </div>
        <div>
          <dt>DNA score</dt>
          <dd>{design.dnaScore}%</dd>
        </div>
        {design.commercialScore != null ? (
          <div>
            <dt>Commercial score</dt>
            <dd>{design.commercialScore}%</dd>
          </div>
        ) : null}
        {design.campaignPotential ? (
          <div>
            <dt>Campaign potential</dt>
            <dd className="rc-design-capitalize">{design.campaignPotential}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

function DesignStudioHandoffButton({
  reportId,
  designId,
  mode,
  label,
  openLabel = "Open in Design Studio",
  variant = "design",
  navigateOnSuccess = false,
  hasStructuredDesign = false,
}: {
  reportId: string;
  designId?: string;
  mode?: "all";
  label: string;
  openLabel?: string;
  variant?: "design" | "collection" | "primary";
  navigateOnSuccess?: boolean;
  hasStructuredDesign?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existingMission, setExistingMission] = useState(false);

  useEffect(() => {
    setExistingMission(Boolean(getDesignMissionForReport(reportId)));
  }, [reportId]);

  const showOpenLabel = existingMission || hasStructuredDesign;
  const buttonLabel = showOpenLabel ? openLabel : label;

  const handleClick = async () => {
    if (existingMission && navigateOnSuccess) {
      router.push("/agents/design");
      return;
    }

    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const body =
        mode === "all"
          ? { reportId, mode: "all" as const }
          : designId
            ? { reportId, designId }
            : { reportId };

      const res = await fetch("/api/design/from-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        reportId?: string;
        brainRecordId?: string;
        reportTitle?: string;
        collectionName?: string;
        brief?: DesignStudioBrief;
        briefs?: DesignStudioBrief[];
      };

      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Design Studio handoff failed");
      }

      if (mode === "all") {
        const briefs = data.briefs ?? [];
        const count = briefs.length;
        if (count > 0 && data.reportId && data.reportTitle) {
          saveDesignMission(
            buildDesignMissionFromHandoff({
              reportId: data.reportId,
              brainRecordId: data.brainRecordId,
              reportTitle: data.reportTitle,
              collectionName: data.collectionName,
              brief: briefs[0],
              allBriefs: briefs,
            }),
          );
        }
        setMessage(`Sent ${count} design brief${count === 1 ? "" : "s"} to Design Studio`);
      } else {
        if (data.brief && data.reportId && data.reportTitle) {
          saveDesignMission(
            buildDesignMissionFromHandoff({
              reportId: data.reportId,
              brainRecordId: data.brainRecordId,
              reportTitle: data.reportTitle,
              collectionName: data.collectionName,
              brief: data.brief,
            }),
          );
        }
        setMessage(
          data.brief?.title
            ? `Sent "${data.brief.title}" to Design Studio`
            : "Sent to Design Studio",
        );
      }

      if (navigateOnSuccess) {
        router.push("/agents/design");
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Design Studio handoff failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="rc-handoff-wrap">
        <button
          type="button"
          className={cn(
            "rc-handoff-btn",
            variant === "collection" && "rc-handoff-btn-collection",
            (variant === "primary" || showOpenLabel) && "rc-handoff-btn-primary",
          )}
          onClick={() => void handleClick()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Palette className="size-3.5" />
          )}
          {loading ? "Sending to Design Studio..." : buttonLabel}
          {!loading ? <ArrowRight className="size-3.5" /> : null}
        </button>
        {message && !navigateOnSuccess ? (
          <p className="rc-handoff-success">{message}</p>
        ) : null}
        {error && !navigateOnSuccess ? (
          <p className="rc-handoff-error">{error}</p>
        ) : null}
      </div>
      {error && navigateOnSuccess ? (
        <div className="rc-handoff-toast" role="alert">
          {error}
        </div>
      ) : null}
    </>
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
