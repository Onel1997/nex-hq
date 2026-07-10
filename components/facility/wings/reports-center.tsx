"use client";

import type { DesignStudioBrief, IntelligenceHandoffContext } from "@/agents/design/studio-brief";
import {
  buildDesignMissionFromHandoff,
  getDesignMissionForReport,
  saveDesignMission,
} from "@/lib/design/design-mission-store";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FacilityDepartmentShell } from "@/components/facility/facility-department-shell";
import { useDictionary } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
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
  const { facility } = useDictionary();
  const rc = facility.reportsCenter;
  const shared = facility.shared;

  return (
    <FacilityDepartmentShell
      wingId="reports"
      title={rc.title}
      icon={FileText}
      subtitle={rc.subtitle}
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
          {shared.syncReports}
        </button>
      }
    >
      {loading && !data ? (
        <div className="rc-loading">
          <Loader2 className="size-8 animate-spin text-[var(--rc-accent)]" />
          <p>{rc.openingBriefing}</p>
        </div>
      ) : error ? (
        <div className="rc-error">
          <p>{error}</p>
          <button type="button" onClick={() => void refresh()}>
            {shared.retry}
          </button>
        </div>
      ) : data ? (
        <ReportsBriefingRoom data={data} />
      ) : null}
    </FacilityDepartmentShell>
  );
}

function ReportsBriefingRoom({ data }: { data: ReportsCenterPayload }) {
  const { facility } = useDictionary();
  const rc = facility.reportsCenter;
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
        <div className="rc-type-bar" role="tablist" aria-label={rc.agentTabsAria}>
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

        <div className="rc-source-bar" role="tablist" aria-label={rc.sourceFiltersAria}>
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
          {rc.archiveLegacy}
          <span>{data.legacyArchive.length}</span>
        </button>
        {sourceFilter === "live" && !showLegacyArchive ? (
          <p className="rc-archive-hint">{rc.liveOnlyHint}</p>
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
            <section className="rc-reports-section" aria-label={rc.reportsSectionAria}>
              <header className="rc-section-header">
                <FileText className="size-4" />
                <h2>
                  {showLegacyArchive
                    ? rc.legacyArchive
                    : sourceFilter === "live"
                      ? rc.liveIntelligence
                      : sourceFilter === "all"
                        ? rc.allReports
                        : `${REPORT_SOURCE_LABELS[sourceFilter as ReportsCenterSource] ?? rc.filterAll} ${rc.reportsSectionAria}`}
                </h2>
                <span>{rc.reportsCount.replace("{count}", String(filtered.length))}</span>
              </header>

              {filtered.length === 0 ? (
                <div className="rc-empty">
                  <p>{rc.noLiveReports}</p>
                  {data.legacyArchive.length > 0 ? (
                    <button
                      type="button"
                      className="rc-archive-link"
                      onClick={() => setShowLegacyArchive(true)}
                    >
                      {rc.browseArchived.replace(
                        "{count}",
                        String(data.legacyArchive.length),
                      )}
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
  const { facility } = useDictionary();
  const rc = facility.reportsCenter;
  const items = [
    { label: rc.liveReports, value: bar.liveReports, glow: true },
    { label: rc.approved, value: bar.approved },
    { label: rc.pendingReview, value: bar.pendingReview, alert: bar.pendingReview > 0 },
    { label: rc.legacyArchived, value: bar.legacyArchived, muted: true },
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
  const { facility } = useDictionary();
  const statusLabels = facility.shared.reportStatus;
  const rc = facility.reportsCenter;
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
          {statusLabels[report.status]}
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
            <span>{rc.designsCount.replace("{count}", String(report.designResearch.designCount))}</span>
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
  const { facility } = useDictionary();
  const rc = facility.reportsCenter;
  const statusLabels = facility.shared.reportStatus;
  const Icon = AGENT_TAB_ICONS[report.agentTab];
  const designResearch = report.designResearch;
  const hasStructuredDesign =
    designResearch?.hasDesignResearch && designResearch.designs.length > 0;
  const displayTitle =
    designResearch?.collection?.name?.trim() || report.title;
  const shouldShowDesignHandoff = true;
  const existingMission = Boolean(getDesignMissionForReport(report.reportId));

  useEffect(() => {
    console.log("[ReportPreview] design handoff", {
      componentName: "ReportPreview",
      reportId: report.reportId,
      shouldShowDesignHandoff,
      buttonRendered: shouldShowDesignHandoff,
      agentTab: report.agentTab,
      source: report.source,
      hasStructuredDesign,
      designCount: designResearch?.designCount ?? 0,
      connectedDepartments: report.preview.connectedDepartments,
      existingMission,
    });
  }, [
    report.reportId,
    report.agentTab,
    report.source,
    report.preview.connectedDepartments,
    hasStructuredDesign,
    designResearch?.designCount,
    existingMission,
  ]);

  return (
    <article className="rc-preview">
      <button type="button" className="rc-preview-back" onClick={onBack}>
        <ArrowLeft className="size-3.5" />
        Zurück zu Berichten
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
                {statusLabels[report.status]}
              </span>
            </div>
            <h2>{displayTitle}</h2>
            <p className="rc-handoff-debug-marker" aria-hidden="true">
              HANDOFF UI ACTIVE
            </p>
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

          <div className="rc-preview-header-actions">
            <DesignStudioHandoffButton
              reportId={report.reportId}
              label={rc.sendToDesignStudio}
              openLabel={rc.openInDesignStudio}
              variant="primary"
              navigateOnSuccess
            />
          </div>
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
            <PreviewSection title={rc.executiveSummary}>
              <p>{report.preview.executiveSummary}</p>
            </PreviewSection>

            <PreviewSection title={rc.keyFindings}>
              <ul>
                {report.preview.keyFindings.map((finding) => (
                  <li key={finding}>{finding}</li>
                ))}
              </ul>
            </PreviewSection>

            <PreviewSection title={rc.recommendations}>
              <ul>
                {report.preview.recommendations.map((rec) => (
                  <li key={rec}>{rec}</li>
                ))}
              </ul>
            </PreviewSection>

            <div className="rc-preview-columns">
              <PreviewSection title={rc.linkedMissions}>
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
                  <p className="rc-preview-muted">{rc.noLinkedMissions}</p>
                )}
              </PreviewSection>

              <PreviewSection title={rc.connectedDepartments}>
                <div className="rc-dept-chips">
                  {report.preview.connectedDepartments.map((dept) => (
                    <span key={dept}>{dept}</span>
                  ))}
                </div>
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
  const { facility } = useDictionary();
  const rc = facility.reportsCenter;
  const collection = designResearch.collection;
  const collectionLabel = collection?.name?.trim() || displayTitle;

  return (
    <section className="rc-design-research" aria-label={rc.designCollection}>
      <header className="rc-design-research-header">
        <div>
          <h3>{rc.designCollection}</h3>
          <p className="rc-design-collection-name">{collectionLabel}</p>
        </div>
        <DesignStudioHandoffButton
          reportId={reportId}
          mode="all"
          label={rc.sendFullCollection}
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
  const { facility } = useDictionary();
  const rc = facility.reportsCenter;
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
            {design.isHero ? <span className="rc-design-hero-badge">{rc.heroBadge}</span> : null}
          </p>
        </div>
        <DesignStudioHandoffButton
          reportId={reportId}
          designId={design.designId}
          label={rc.sendToDesignStudio}
          variant="design"
        />
      </header>

      <dl className="rc-design-spec-grid">
        <div>
          <dt>{rc.specProduct}</dt>
          <dd>{design.product}</dd>
        </div>
        <div>
          <dt>{rc.specColor}</dt>
          <dd>{design.color}</dd>
        </div>
        <div>
          <dt>{rc.specPrintArea}</dt>
          <dd>{design.printArea}</dd>
        </div>
        <div>
          <dt>{rc.specPlacement}</dt>
          <dd>{design.placement}</dd>
        </div>
        <div>
          <dt>{rc.specDimensions}</dt>
          <dd>{design.dimensions}</dd>
        </div>
        <div>
          <dt>{rc.specProduction}</dt>
          <dd>{design.productionMethod}</dd>
        </div>
        <div>
          <dt>{rc.specDnaScore}</dt>
          <dd>{design.dnaScore}%</dd>
        </div>
        {design.commercialScore != null ? (
          <div>
            <dt>{rc.specCommercialScore}</dt>
            <dd>{design.commercialScore}%</dd>
          </div>
        ) : null}
        {design.campaignPotential ? (
          <div>
            <dt>{rc.specCampaignPotential}</dt>
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
  openLabel,
  variant = "design",
  navigateOnSuccess = false,
}: {
  reportId: string;
  designId?: string;
  mode?: "all";
  label: string;
  openLabel?: string;
  variant?: "design" | "collection" | "primary";
  navigateOnSuccess?: boolean;
}) {
  const router = useRouter();
  const { facility } = useDictionary();
  const shared = facility.shared;
  const rc = facility.reportsCenter;
  const resolvedOpenLabel = openLabel ?? rc.openInDesignStudio;
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existingMission, setExistingMission] = useState(false);

  useEffect(() => {
    const mission = Boolean(getDesignMissionForReport(reportId));
    setExistingMission(mission);
    console.log("[DesignStudioHandoffButton]", {
      componentName: "DesignStudioHandoffButton",
      reportId,
      existingMission: mission,
      buttonRendered: true,
      buttonLabel: mission ? resolvedOpenLabel : label,
    });
  }, [reportId, resolvedOpenLabel, label]);

  const buttonLabel = existingMission ? resolvedOpenLabel : label;

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
        intelligenceContext?: IntelligenceHandoffContext;
        brief?: DesignStudioBrief;
        briefs?: DesignStudioBrief[];
      };

      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? shared.designStudioHandoffFailed);
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
              intelligenceContext: data.intelligenceContext,
              brief: briefs[0],
              allBriefs: briefs,
            }),
          );
        }
        setMessage(
          shared.sentCountDesignBriefs.replace("{count}", String(count)),
        );
      } else {
        if (data.brief && data.reportId && data.reportTitle) {
          saveDesignMission(
            buildDesignMissionFromHandoff({
              reportId: data.reportId,
              brainRecordId: data.brainRecordId,
              reportTitle: data.reportTitle,
              collectionName: data.collectionName,
              intelligenceContext: data.intelligenceContext,
              brief: data.brief,
            }),
          );
        }
        setMessage(
          data.brief?.title
            ? shared.sentDesignBriefNamed.replace("{title}", data.brief.title)
            : shared.sentToDesignStudio,
        );
      }

      if (navigateOnSuccess) {
        router.push("/agents/design");
        return;
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : shared.designStudioHandoffFailed,
      );
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
            (variant === "primary" || existingMission) && "rc-handoff-btn-primary",
          )}
          onClick={() => void handleClick()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Palette className="size-3.5" />
          )}
          {loading ? shared.sendingToDesignStudio : buttonLabel}
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
  const { facility } = useDictionary();
  const rc = facility.reportsCenter;
  return (
    <section className="rc-panel rc-activity">
      <header className="rc-panel-header">
        <TrendingUp className="size-4" />
        <h2>{rc.activityFeed}</h2>
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
  const { facility } = useDictionary();
  const rc = facility.reportsCenter;
  return (
    <section className="rc-panel rc-export">
      <header className="rc-panel-header">
        <FileText className="size-4" />
        <h2>{rc.exportModule}</h2>
      </header>
      <ul className="rc-export-list">
        {modules.map((module) => (
          <li key={module}>
            <span>{module}</span>
            <span className="rc-export-soon">{rc.comingOnline}</span>
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
      if (!res.ok) throw new Error(body.error ?? getDictionary(DEFAULT_LOCALE).facility.reportsCenter.failedToLoad);
      setData(body);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : getDictionary(DEFAULT_LOCALE).facility.reportsCenter.failedToLoad,
      );
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
