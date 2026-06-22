"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { ResearchReportType } from "@/brain/domains/reports";
import { ResearchHeroStatus } from "@/components/research/research-hero-status";
import { ResearchIntelligenceBrain } from "@/components/research/research-intelligence-brain";
import { ResearchIntelligenceDashboard } from "@/components/research/research-intelligence-dashboard";
import { ResearchMicroIndicators } from "@/components/research/research-micro-indicators";
import { useResearchBrain } from "@/components/research/use-research-brain";
import { useWorkspaceContext } from "@/components/workspace/use-workspace-context";
import { getResearchReportTypeLabels } from "@/lib/i18n/data";
import { useLocale, useT, useWorkspace } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface ResearchResult {
  reportId: string;
  title: string;
  executiveSummary: string;
  keyFindings: string[];
  recommendations: string[];
  confidence: number;
  reportType: ResearchReportType;
  savedDomains: string[];
}

const REPORT_TYPE_STYLES: Record<ResearchReportType, string> = {
  competitor: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  trend: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  pricing: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  audience: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  design: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

export function ResearchInterface() {
  const t = useT();
  const locale = useLocale();
  const workspace = useWorkspace();
  const reportTypeLabels = getResearchReportTypeLabels(locale);
  const { data: contextData, loading: contextLoading } =
    useWorkspaceContext("research");
  const { snapshot: brainSnapshot, loading: brainLoading } = useResearchBrain();
  const [request, setRequest] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchResult | null>(null);

  const missions = [
    {
      label: t("research.missions.summerTrends"),
      action: t("research.missions.summerTrendsAction"),
    },
    {
      label: t("research.missions.competitors"),
      action: t("research.missions.competitorsAction"),
    },
    {
      label: t("research.missions.audience"),
      action: t("research.missions.audienceAction"),
    },
    {
      label: t("research.missions.streetwear"),
      action: t("research.missions.streetwearAction"),
    },
    {
      label: t("research.missions.productOpportunities"),
      action: t("research.missions.productOpportunitiesAction"),
    },
  ];

  const runResearch = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setIsLoading(true);
      setError(null);
      setResult(null);

      try {
        const res = await fetch("/api/research/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request: trimmed }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? t("research.errors.unexpected"));
        }

        setResult({
          reportId: data.reportId,
          title: data.title,
          executiveSummary: data.executiveSummary,
          keyFindings: data.keyFindings,
          recommendations: data.recommendations,
          confidence: data.confidence,
          reportType: data.reportType,
          savedDomains: data.savedDomains,
        });
        setRequest("");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("research.errors.unexpected"),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, t],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runResearch(request);
  };

  return (
    <section className="research-hq-bridge space-y-7">
      <ResearchMicroIndicators />

      <div className="command-interface research-hero-observatory overflow-hidden">
        <div className="research-hero-observatory-grid">
          <div className="research-hero-observatory-main">
            <div className="research-hero-observatory-meta">
              <p className="text-label text-primary/80">
                {t("research.interface.label")}
              </p>
              <span className="research-hero-observatory-divider" aria-hidden>
                ·
              </span>
              <p className="text-sm text-muted-foreground">
                {workspace.name}
              </p>
            </div>

            <h2 className="command-interface-headline research-hero-observatory-headline">
              {t("research.interface.headline")}
            </h2>

            <form onSubmit={handleSubmit} className="research-hero-observatory-form">
              <textarea
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                placeholder={t("research.interface.placeholder")}
                rows={2}
                disabled={isLoading}
                className={cn(
                  "research-hero-observatory-input w-full resize-none rounded-xl border border-border",
                  "bg-background/40 px-4 py-2.5 text-base text-foreground",
                  "placeholder:text-muted-foreground/60",
                  "focus:outline-none focus:ring-2 focus:ring-primary/25",
                  "disabled:opacity-60",
                )}
              />
              <div className="research-hero-observatory-actions">
                <button
                  type="submit"
                  disabled={isLoading || !request.trim()}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2",
                    "text-sm font-medium text-primary-foreground transition-opacity",
                    "disabled:opacity-40",
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )}
                  {isLoading
                    ? t("research.interface.running")
                    : t("research.interface.submit")}
                </button>
                <p className="text-xs text-muted-foreground">
                  {t("research.interface.poweredBy")}
                </p>
              </div>
            </form>

            {error && (
              <p className="research-hero-observatory-error rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}
          </div>

          <ResearchHeroStatus
            data={contextData}
            isLoading={contextLoading}
            integrated
          />
        </div>
      </div>

      <ResearchIntelligenceDashboard
        data={contextData}
        isLoading={contextLoading}
      />

      <ResearchIntelligenceBrain
        snapshot={brainSnapshot}
        loading={brainLoading}
      />

      <div className="space-y-3">
        <p className="text-label">{t("research.missions.label")}</p>
        <div className="flex flex-wrap gap-2">
          {missions.map(({ label, action }) => (
            <button
              key={label}
              type="button"
              onClick={() => runResearch(action)}
              disabled={isLoading}
              className="research-intelligence-mission research-intelligence-mission-compact"
            >
              <span className="research-intelligence-mission-dot" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      {result && (
        <div className="research-result-surface luxury-surface-elevated space-y-6 rounded-2xl p-8">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="mt-1 size-6 shrink-0 text-primary" />
            <div className="space-y-3">
              <p className="text-label text-primary">
                {t("research.interface.success")}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "font-normal",
                    REPORT_TYPE_STYLES[result.reportType],
                  )}
                >
                  {reportTypeLabels[result.reportType]}
                </Badge>
              </div>
              <h3 className="font-display text-3xl font-medium">
                {result.title}
              </h3>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("research.interface.executiveSummary")}
            </p>
            <p className="text-base leading-relaxed text-muted-foreground">
              {result.executiveSummary}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("research.interface.keyFindings")}
            </p>
            <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-5">
              {result.keyFindings.map((finding) => (
                <li
                  key={finding}
                  className="flex gap-3 text-base text-muted-foreground"
                >
                  <span className="research-bullet-dot mt-2.5 size-1.5 shrink-0 rounded-full" />
                  {finding}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("research.interface.recommendations")}
            </p>
            <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-5">
              {result.recommendations.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 text-base text-muted-foreground"
                >
                  <span className="research-bullet-dot mt-2.5 size-1.5 shrink-0 rounded-full" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
            <p className="text-sm text-muted-foreground">
              {t("research.interface.savedDomains", {
                domains: result.savedDomains.join(", "),
              })}
            </p>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {t("research.interface.confidence")}
              </span>
              <Progress value={result.confidence * 100} className="h-1 w-20" />
              <span className="tabular-nums text-sm">
                {Math.round(result.confidence * 100)}%
              </span>
            </div>
            <Link
              href="/facility/reports"
              className="inline-flex items-center gap-2 text-base text-primary hover:underline"
            >
              {t("research.interface.viewReports")}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
