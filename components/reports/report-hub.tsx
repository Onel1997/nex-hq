"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getAgentCatalog,
  getReportCategoryLabels,
  getReportStatusLabel,
  getResearchReportTypeLabels,
} from "@/lib/i18n/data";
import type { ReportListItem } from "@/lib/mock/reports";
import type { ResearchReportType } from "@/brain/domains/reports";
import { useDictionary, useLocale, useT, useWorkspace } from "@/lib/i18n";
import { SectionHeading } from "@/components/shared/section-heading";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Megaphone,
  Palette,
  Search,
  Settings2,
} from "lucide-react";

const CATEGORY_ICONS = {
  research: Search,
  design: Palette,
  marketing: Megaphone,
  operations: Settings2,
} as const;

const REPORT_TYPE_STYLES: Record<ResearchReportType, string> = {
  competitor: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  trend: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  pricing: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  audience: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  design: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

const STATUS_STYLES: Record<ReportListItem["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-primary/10 text-primary",
  approved: "bg-primary/15 text-primary",
  archived: "bg-muted text-muted-foreground",
};

function ReportSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <p className="text-label text-primary/80">{label}</p>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-5">
      {items.map((item) => (
        <li
          key={item}
          className="flex gap-3 text-base text-muted-foreground"
        >
          <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary/50" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function ReportCard({
  report,
  categoryLabel,
  agentName,
  statusLabel,
  reportTypeLabels,
  sectionLabels,
}: {
  report: ReportListItem;
  categoryLabel: string;
  agentName: string;
  statusLabel: string;
  reportTypeLabels: Record<ResearchReportType, string>;
  sectionLabels: {
    executiveSummary: string;
    keyFindings: string;
    recommendations: string;
    confidence: string;
  };
}) {
  const CategoryIcon = CATEGORY_ICONS[report.category];
  const executiveSummary = report.executiveSummary ?? report.summary;
  const keyFindings = report.highlights ?? [];
  const recommendations = report.recommendations ?? [];

  return (
    <div className="luxury-surface rounded-2xl p-8 transition-colors hover:border-primary/15">
      <div className="flex items-start gap-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CategoryIcon className="size-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {report.reportType && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-normal",
                      REPORT_TYPE_STYLES[report.reportType],
                    )}
                  >
                    {reportTypeLabels[report.reportType]}
                  </Badge>
                )}
                <Badge variant="outline" className="font-normal">
                  {categoryLabel}
                </Badge>
              </div>
              <h3 className="font-display text-2xl font-medium leading-snug">
                {report.title}
              </h3>
            </div>
            <Badge
              variant="secondary"
              className={cn("shrink-0 text-sm font-normal", STATUS_STYLES[report.status])}
            >
              {statusLabel}
            </Badge>
          </div>

          <ReportSection label={sectionLabels.executiveSummary}>
            <p className="text-base leading-relaxed text-muted-foreground">
              {executiveSummary}
            </p>
          </ReportSection>

          {keyFindings.length > 0 && (
            <ReportSection label={sectionLabels.keyFindings}>
              <BulletList items={keyFindings} />
            </ReportSection>
          )}

          {recommendations.length > 0 && (
            <ReportSection label={sectionLabels.recommendations}>
              <BulletList items={recommendations} />
            </ReportSection>
          )}

          <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4 text-sm text-muted-foreground">
            <span>{agentName}</span>
            {report.drop && <span>{report.drop}</span>}
            <div className="ml-auto flex items-center gap-3">
              <span className="text-label text-primary/70">
                {sectionLabels.confidence}
              </span>
              <Progress value={report.confidence * 100} className="h-1 w-20" />
              <span className="tabular-nums">
                {Math.round(report.confidence * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportList({
  reports,
  categoryLabels,
  agentNames,
  getStatusLabel,
  emptyLabel,
  reportTypeLabels,
  sectionLabels,
}: {
  reports: ReportListItem[];
  categoryLabels: ReturnType<typeof getReportCategoryLabels>;
  agentNames: Record<string, string>;
  getStatusLabel: (status: ReportListItem["status"]) => string;
  emptyLabel: string;
  reportTypeLabels: Record<ResearchReportType, string>;
  sectionLabels: {
    executiveSummary: string;
    keyFindings: string;
    recommendations: string;
    confidence: string;
  };
}) {
  if (reports.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-20 text-center text-base text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {reports.map((report) => (
        <ReportCard
          key={report.id}
          report={report}
          categoryLabel={categoryLabels[report.category]}
          agentName={agentNames[report.agentId]}
          statusLabel={getStatusLabel(report.status)}
          reportTypeLabels={reportTypeLabels}
          sectionLabels={sectionLabels}
        />
      ))}
    </div>
  );
}

export function ReportHub() {
  const locale = useLocale();
  const t = useT();
  const workspace = useWorkspace();
  const { common, reports: reportsCopy } = useDictionary();
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categoryLabels = getReportCategoryLabels(locale);
  const reportTypeLabels = getResearchReportTypeLabels(locale);
  const agentCatalog = getAgentCatalog(locale);
  const agentNames = Object.fromEntries(
    Object.values(agentCatalog).map((a) => [a.id, a.name]),
  );
  const getStatusLabel = (status: ReportListItem["status"]) =>
    getReportStatusLabel(locale, status);
  const sectionLabels = reportsCopy.hub.sections;

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/reports");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? t("research.errors.unexpected"));
      }

      setReports(data.reports ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("research.errors.unexpected"),
      );
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadReports();
  }, [loadReports, workspace.slug]);

  const categories = ["all", "research", "design", "marketing"] as const;

  const counts: Record<(typeof categories)[number], number> = {
    all: reports.length,
    research: reports.filter((r) => r.category === "research").length,
    design: reports.filter((r) => r.category === "design").length,
    marketing: reports.filter((r) => r.category === "marketing").length,
  };

  return (
    <div className="space-y-10">
      <SectionHeading
        label={reportsCopy.hub.label}
        title={reportsCopy.hub.title}
        description={reportsCopy.hub.description}
        action={
          <p className="text-sm text-muted-foreground">
            {t("dashboard.command.activeWorkspace", {
              workspace: workspace.name,
            })}
          </p>
        }
      />

      {isLoading && (
        <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-base">{t("research.interface.running")}</span>
        </div>
      )}

      {error && !isLoading && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!isLoading && (
        <Tabs defaultValue="all" className="space-y-8">
          <TabsList className="h-12 bg-muted/30 p-1">
            {categories.map((cat) => (
              <TabsTrigger key={cat} value={cat} className="gap-2 px-5 text-base">
                {cat === "all" ? common.reportCategory.all : categoryLabels[cat]}
                <span className="text-sm text-muted-foreground">{counts[cat]}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((cat) => (
            <TabsContent key={cat} value={cat}>
              <ReportList
                reports={
                  cat === "all"
                    ? reports
                    : reports.filter((r) => r.category === cat)
                }
                categoryLabels={categoryLabels}
                agentNames={agentNames}
                getStatusLabel={getStatusLabel}
                emptyLabel={reportsCopy.hub.empty}
                reportTypeLabels={reportTypeLabels}
                sectionLabels={sectionLabels}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
