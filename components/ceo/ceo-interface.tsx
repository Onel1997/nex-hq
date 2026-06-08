"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { CeoNextStep } from "@/agents/ceo/types";
import { useLocale, useT, useWorkspace } from "@/lib/i18n";
import { getCeoPriorityLabels } from "@/lib/i18n/data";
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2, Crown, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface CeoResult {
  reportId: string;
  title: string;
  executiveSummary: string;
  keyInsights: string[];
  strategicOpportunities: string[];
  risks: string[];
  nextSteps: CeoNextStep[];
  confidence: number;
  sourceReportTitles: string[];
  contextRecordCount: number;
}

const PRIORITY_STYLES: Record<CeoNextStep["priority"], string> = {
  high: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  medium:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  low: "border-border bg-muted/40 text-muted-foreground",
};

export function CeoInterface() {
  const t = useT();
  const locale = useLocale();
  const workspace = useWorkspace();
  const priorityLabels = getCeoPriorityLabels(locale);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CeoResult | null>(null);

  const examples = [
    t("ceo.examples.opportunities"),
    t("ceo.examples.nextCollection"),
    t("ceo.examples.trends2026"),
    t("ceo.examples.differentiateRepresent"),
  ];

  const runCeo = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setIsLoading(true);
      setError(null);
      setResult(null);

      try {
        const res = await fetch("/api/ceo/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? t("ceo.errors.unexpected"));
        }

        setResult({
          reportId: data.reportId,
          title: data.title,
          executiveSummary: data.executiveSummary,
          keyInsights: data.keyInsights,
          strategicOpportunities: data.strategicOpportunities,
          risks: data.risks,
          nextSteps: data.nextSteps,
          confidence: data.confidence,
          sourceReportTitles: data.sourceReportTitles,
          contextRecordCount: data.contextRecordCount,
        });
        setQuestion("");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("ceo.errors.unexpected"),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, t],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runCeo(question);
  };

  return (
    <section className="space-y-10">
      <div className="command-interface overflow-hidden px-10 py-14 sm:px-14 sm:py-16">
        <div className="mb-8 space-y-2">
          <p className="text-label text-primary/80">
            {t("ceo.interface.label")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.command.activeWorkspace", {
              workspace: workspace.name,
            })}
          </p>
        </div>

        <h2 className="command-interface-headline mb-10 max-w-3xl">
          {t("ceo.interface.headline")}
        </h2>

        <form onSubmit={handleSubmit} className="relative space-y-4">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t("ceo.interface.placeholder")}
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
              disabled={isLoading || !question.trim()}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3",
                "text-base font-medium text-primary-foreground transition-opacity",
                "disabled:opacity-40",
              )}
            >
              {isLoading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Crown className="size-5" />
              )}
              {isLoading
                ? t("ceo.interface.running")
                : t("ceo.interface.submit")}
            </button>
            <p className="text-sm text-muted-foreground">
              {t("ceo.interface.poweredBy")}
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
        <p className="text-label">{t("ceo.interface.tryExamples")}</p>
        <div className="flex flex-wrap gap-3">
          {examples.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => runCeo(label)}
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
                {t("ceo.interface.success")}
              </p>
              <h3 className="font-display text-3xl font-medium">
                {result.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("ceo.interface.contextRecords", {
                  count: String(result.contextRecordCount),
                })}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("ceo.interface.executiveSummary")}
            </p>
            <p className="text-base leading-relaxed text-muted-foreground">
              {result.executiveSummary}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("ceo.interface.keyInsights")}
            </p>
            <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-5">
              {result.keyInsights.map((insight) => (
                <li
                  key={insight}
                  className="flex gap-3 text-base text-muted-foreground"
                >
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary/50" />
                  {insight}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("ceo.interface.strategicOpportunities")}
            </p>
            <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-5">
              {result.strategicOpportunities.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 text-base text-muted-foreground"
                >
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-emerald-500/50" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("ceo.interface.risks")}
            </p>
            <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-5">
              {result.risks.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 text-base text-muted-foreground"
                >
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-rose-500/50" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-label text-primary/80">
              {t("ceo.interface.nextSteps")}
            </p>
            <ul className="space-y-3">
              {result.nextSteps.map((step) => (
                <li
                  key={step.action}
                  className="rounded-xl border border-border bg-muted/20 p-5"
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <Badge
                      variant="outline"
                      className={cn("shrink-0 font-normal", PRIORITY_STYLES[step.priority])}
                    >
                      {priorityLabels[step.priority]}
                    </Badge>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-base text-foreground">{step.action}</p>
                      {step.rationale && (
                        <p className="text-sm text-muted-foreground">
                          {step.rationale}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {result.sourceReportTitles.length > 0 && (
            <div className="space-y-2">
              <p className="text-label text-primary/80">
                {t("ceo.interface.sources")}
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
                {t("ceo.interface.confidence")}
              </span>
              <Progress value={result.confidence * 100} className="h-1 w-20" />
              <span className="tabular-nums text-sm">
                {Math.round(result.confidence * 100)}%
              </span>
            </div>
            <Link
              href="/reports"
              className="inline-flex items-center gap-2 text-base text-primary hover:underline"
            >
              {t("ceo.interface.viewReports")}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
