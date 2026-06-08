"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getAgentCatalog,
  getReportCategoryLabels,
  getReportStatusLabel,
} from "@/lib/i18n/data";
import type { ReportListItem } from "@/lib/mock/reports";
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

const STATUS_STYLES: Record<ReportListItem["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-primary/10 text-primary",
  approved: "bg-primary/15 text-primary",
  archived: "bg-muted text-muted-foreground",
};

function ReportCard({
  report,
  categoryLabel,
  agentName,
  statusLabel,
}: {
  report: ReportListItem;
  categoryLabel: string;
  agentName: string;
  statusLabel: string;
}) {
  const CategoryIcon = CATEGORY_ICONS[report.category];

  return (
    <div className="luxury-surface rounded-2xl p-8 transition-colors hover:border-primary/15">
      <div className="flex items-start gap-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CategoryIcon className="size-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-2xl font-medium leading-snug">
                {report.title}
              </h3>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                {report.summary}
              </p>
            </div>
            <Badge
              variant="secondary"
              className={cn("shrink-0 text-sm font-normal", STATUS_STYLES[report.status])}
            >
              {statusLabel}
            </Badge>
          </div>

          {report.highlights && report.highlights.length > 0 && (
            <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-5">
              {report.highlights.map((h) => (
                <li
                  key={h}
                  className="flex gap-3 text-base text-muted-foreground"
                >
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary/50" />
                  {h}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4 text-sm text-muted-foreground">
            <Badge variant="outline" className="font-normal">
              {categoryLabel}
            </Badge>
            <span>{agentName}</span>
            {report.drop && <span>{report.drop}</span>}
            <div className="ml-auto flex items-center gap-3">
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
}: {
  reports: ReportListItem[];
  categoryLabels: ReturnType<typeof getReportCategoryLabels>;
  agentNames: Record<string, string>;
  getStatusLabel: (status: ReportListItem["status"]) => string;
  emptyLabel: string;
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
  const agentCatalog = getAgentCatalog(locale);
  const agentNames = Object.fromEntries(
    Object.values(agentCatalog).map((a) => [a.id, a.name]),
  );
  const getStatusLabel = (status: ReportListItem["status"]) =>
    getReportStatusLabel(locale, status);

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
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
