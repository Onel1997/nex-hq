"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type {
  MarketingBudgetItem,
  MarketingCalendarEntry,
  MarketingEmailPhase,
  MarketingKpi,
} from "@/agents/marketing/types";
import { useT, useWorkspace } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2, Loader2, Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface MarketingResult {
  reportId: string;
  title: string;
  launchStrategy: string;
  contentPillars: string[];
  tiktokIdeas: string[];
  instagramIdeas: string[];
  influencerStrategy: string;
  emailCampaignPlan: MarketingEmailPhase[];
  communityBuildingPlan: string;
  contentCalendar30Day: MarketingCalendarEntry[];
  launchKpis: MarketingKpi[];
  budgetAllocation: MarketingBudgetItem[];
  confidence: number;
  sourceReportTitles: string[];
  contextRecordCount: number;
}

function IdeaPreview({ ideas, label }: { ideas: string[]; label: string }) {
  const preview = ideas.slice(0, 5);
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {label} ({ideas.length})
      </p>
      <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-5">
        {preview.map((idea) => (
          <li
            key={idea}
            className="flex gap-3 text-base text-muted-foreground"
          >
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary/50" />
            {idea}
          </li>
        ))}
        {ideas.length > 5 && (
          <li className="text-sm text-muted-foreground/80">
            +{ideas.length - 5} weitere Ideen im gespeicherten Bericht
          </li>
        )}
      </ul>
    </div>
  );
}

export function MarketingInterface() {
  const t = useT();
  const workspace = useWorkspace();
  const [brief, setBrief] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MarketingResult | null>(null);

  const examples = [
    t("marketing.examples.ss26Launch"),
    t("marketing.examples.tiktokCampaign"),
    t("marketing.examples.influencerSeeding"),
    t("marketing.examples.emailSequence"),
  ];

  const runMarketing = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setIsLoading(true);
      setError(null);
      setResult(null);

      try {
        const res = await fetch("/api/marketing/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brief: trimmed }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? t("marketing.errors.unexpected"));
        }

        setResult({
          reportId: data.reportId,
          title: data.title,
          launchStrategy: data.launchStrategy,
          contentPillars: data.contentPillars,
          tiktokIdeas: data.tiktokIdeas,
          instagramIdeas: data.instagramIdeas,
          influencerStrategy: data.influencerStrategy,
          emailCampaignPlan: data.emailCampaignPlan,
          communityBuildingPlan: data.communityBuildingPlan,
          contentCalendar30Day: data.contentCalendar30Day,
          launchKpis: data.launchKpis,
          budgetAllocation: data.budgetAllocation,
          confidence: data.confidence,
          sourceReportTitles: data.sourceReportTitles,
          contextRecordCount: data.contextRecordCount,
        });
        setBrief("");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("marketing.errors.unexpected"),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, t],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runMarketing(brief);
  };

  return (
    <section className="space-y-10">
      <div className="command-interface overflow-hidden px-10 py-14 sm:px-14 sm:py-16">
        <div className="mb-8 space-y-2">
          <p className="text-label text-primary/80">
            {t("marketing.interface.label")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.command.activeWorkspace", {
              workspace: workspace.name,
            })}
          </p>
        </div>

        <h2 className="command-interface-headline mb-10 max-w-3xl">
          {t("marketing.interface.headline")}
        </h2>

        <form onSubmit={handleSubmit} className="relative space-y-4">
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder={t("marketing.interface.placeholder")}
            rows={4}
            disabled={isLoading}
            className={cn(
              "w-full resize-none rounded-2xl border border-border bg-background/40",
              "px-6 py-5 text-lg text-foreground placeholder:text-muted-foreground/60",
              "focus:outline-none focus:ring-2 focus:ring-primary/25",
              "disabled:opacity-60",
            )}
          />
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={isLoading || !brief.trim()}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3",
                "text-base font-medium text-primary-foreground transition-opacity",
                "disabled:opacity-40",
              )}
            >
              {isLoading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Megaphone className="size-5" />
              )}
              {isLoading
                ? t("marketing.interface.running")
                : t("marketing.interface.submit")}
            </button>
            <p className="text-sm text-muted-foreground">
              {t("marketing.interface.poweredBy")}
            </p>
          </div>
        </form>

        {error && (
          <p className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <p className="text-label">{t("marketing.interface.tryExamples")}</p>
        <div className="flex flex-wrap gap-3">
          {examples.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => runMarketing(label)}
              disabled={isLoading}
              className={cn(
                "rounded-full border border-border bg-card/40 px-6 py-3",
                "text-base text-muted-foreground transition-all duration-300",
                "hover:border-primary/30 hover:bg-primary/5 hover:text-foreground",
                "disabled:opacity-50",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {result && (
        <div className="luxury-surface-elevated space-y-6 rounded-2xl p-8">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="mt-1 size-6 shrink-0 text-primary" />
            <div className="space-y-3">
              <p className="text-label text-primary">
                {t("marketing.interface.success")}
              </p>
              <h3 className="font-display text-3xl font-medium">
                {result.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("marketing.interface.contextRecords", {
                  count: String(result.contextRecordCount),
                })}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("marketing.interface.launchStrategy")}
            </p>
            <p className="text-base leading-relaxed text-muted-foreground">
              {result.launchStrategy}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("marketing.interface.contentPillars")}
            </p>
            <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-5">
              {result.contentPillars.map((pillar) => (
                <li
                  key={pillar}
                  className="flex gap-3 text-base text-muted-foreground"
                >
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary/50" />
                  {pillar}
                </li>
              ))}
            </ul>
          </div>

          <IdeaPreview
            ideas={result.tiktokIdeas}
            label={t("marketing.interface.tiktokIdeas")}
          />
          <IdeaPreview
            ideas={result.instagramIdeas}
            label={t("marketing.interface.instagramIdeas")}
          />

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("marketing.interface.influencerStrategy")}
            </p>
            <p className="text-base leading-relaxed text-muted-foreground">
              {result.influencerStrategy}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-label text-primary/80">
              {t("marketing.interface.emailCampaignPlan")}
            </p>
            <ul className="space-y-3">
              {result.emailCampaignPlan.map((phase) => (
                <li
                  key={phase.phase}
                  className="rounded-xl border border-border bg-muted/20 p-5"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="font-medium text-foreground">{phase.phase}</p>
                    <Badge variant="secondary" className="font-normal">
                      {phase.subject}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-primary/80">{phase.objective}</p>
                  <p className="mt-2 text-base text-muted-foreground">
                    {phase.content}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("marketing.interface.communityBuildingPlan")}
            </p>
            <p className="text-base leading-relaxed text-muted-foreground">
              {result.communityBuildingPlan}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-label text-primary/80">
              {t("marketing.interface.contentCalendar")}
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {result.contentCalendar30Day.slice(0, 6).map((entry) => (
                <li
                  key={entry.day}
                  className="rounded-xl border border-border bg-muted/20 p-4 text-sm"
                >
                  <span className="font-medium text-foreground">
                    {t("marketing.interface.day")} {entry.day}:
                  </span>{" "}
                  {entry.title} · {entry.channel}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              +{result.contentCalendar30Day.length - 6} weitere Tage im Bericht
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-label text-primary/80">
              {t("marketing.interface.launchKpis")}
            </p>
            <ul className="space-y-3">
              {result.launchKpis.map((kpi) => (
                <li
                  key={kpi.metric}
                  className="rounded-xl border border-border bg-muted/20 p-4"
                >
                  <p className="font-medium text-foreground">{kpi.metric}</p>
                  <p className="text-sm text-primary/80">{kpi.target}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {kpi.rationale}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-label text-primary/80">
              {t("marketing.interface.budgetAllocation")}
            </p>
            <ul className="space-y-2">
              {result.budgetAllocation.map((item) => (
                <li
                  key={item.category}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-border bg-muted/20 p-4"
                >
                  <span className="font-medium text-foreground">
                    {item.category}
                  </span>
                  <span className="text-sm text-primary">{item.allocation}</span>
                  <p className="w-full text-sm text-muted-foreground">
                    {item.rationale}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {result.sourceReportTitles.length > 0 && (
            <div className="space-y-2">
              <p className="text-label text-primary/80">
                {t("marketing.interface.sources")}
              </p>
              <div className="flex flex-wrap gap-2">
                {result.sourceReportTitles.map((title) => (
                  <Badge key={title} variant="secondary" className="font-normal">
                    {title}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {t("marketing.interface.confidence")}
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
              {t("marketing.interface.viewReports")}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
