"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useT, useWorkspace } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2, Loader2, Search } from "lucide-react";

interface ResearchResult {
  reportId: string;
  title: string;
  summary: string;
  keyFindings: string[];
  confidence: number;
  savedDomains: string[];
}

export function ResearchInterface() {
  const t = useT();
  const workspace = useWorkspace();
  const [request, setRequest] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchResult | null>(null);

  const examples = [
    t("research.examples.represent"),
    t("research.examples.corteiz"),
    t("research.examples.summerTrends"),
    t("research.examples.oversized"),
    t("research.examples.luxuryPricing"),
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
          summary: data.summary,
          keyFindings: data.keyFindings,
          confidence: data.confidence,
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
    <section className="space-y-10">
      <div className="command-interface overflow-hidden px-10 py-14 sm:px-14 sm:py-16">
        <div className="mb-8 space-y-2">
          <p className="text-label text-primary/80">
            {t("research.interface.label")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.command.activeWorkspace", {
              workspace: workspace.name,
            })}
          </p>
        </div>

        <h2 className="command-interface-headline mb-10 max-w-3xl">
          {t("research.interface.headline")}
        </h2>

        <form onSubmit={handleSubmit} className="relative space-y-4">
          <textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder={t("research.interface.placeholder")}
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
              disabled={isLoading || !request.trim()}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3",
                "text-base font-medium text-primary-foreground transition-opacity",
                "disabled:opacity-40",
              )}
            >
              {isLoading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Search className="size-5" />
              )}
              {isLoading
                ? t("research.interface.running")
                : t("research.interface.submit")}
            </button>
            <p className="text-sm text-muted-foreground">
              {t("research.interface.poweredBy")}
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
        <p className="text-label">{t("research.interface.tryExamples")}</p>
        <div className="flex flex-wrap gap-3">
          {examples.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => runResearch(label)}
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
            <div className="space-y-2">
              <p className="text-label text-primary">
                {t("research.interface.success")}
              </p>
              <h3 className="font-display text-3xl font-medium">
                {result.title}
              </h3>
              <p className="text-base leading-relaxed text-muted-foreground">
                {result.summary}
              </p>
            </div>
          </div>

          <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-5">
            {result.keyFindings.map((finding) => (
              <li
                key={finding}
                className="flex gap-3 text-base text-muted-foreground"
              >
                <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary/50" />
                {finding}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
            <p className="text-sm text-muted-foreground">
              {t("research.interface.savedDomains", {
                domains: result.savedDomains.join(", "),
              })}
            </p>
            <Link
              href="/reports"
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
