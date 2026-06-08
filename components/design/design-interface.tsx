"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type {
  DesignColor,
  DesignHeroProduct,
  DesignProduct,
} from "@/agents/design/types";
import { useT, useWorkspace } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2, Loader2, Palette } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface DesignResult {
  reportId: string;
  title: string;
  collectionName: string;
  collectionStory: string;
  colorPalette: DesignColor[];
  silhouettes: string[];
  productLineup: DesignProduct[];
  heroProducts: DesignHeroProduct[];
  materials: string[];
  designDirection: string;
  launchRecommendations: string[];
  confidence: number;
  sourceReportTitles: string[];
  contextRecordCount: number;
}

export function DesignInterface() {
  const t = useT();
  const workspace = useWorkspace();
  const [brief, setBrief] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DesignResult | null>(null);

  const examples = [
    t("design.examples.ss26Capsule"),
    t("design.examples.oversizedDrop"),
    t("design.examples.urbanLuxury"),
    t("design.examples.competitorDiff"),
  ];

  const runDesign = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setIsLoading(true);
      setError(null);
      setResult(null);

      try {
        const res = await fetch("/api/design/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brief: trimmed }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? t("design.errors.unexpected"));
        }

        setResult({
          reportId: data.reportId,
          title: data.title,
          collectionName: data.collectionName,
          collectionStory: data.collectionStory,
          colorPalette: data.colorPalette,
          silhouettes: data.silhouettes,
          productLineup: data.productLineup,
          heroProducts: data.heroProducts,
          materials: data.materials,
          designDirection: data.designDirection,
          launchRecommendations: data.launchRecommendations,
          confidence: data.confidence,
          sourceReportTitles: data.sourceReportTitles,
          contextRecordCount: data.contextRecordCount,
        });
        setBrief("");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("design.errors.unexpected"),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, t],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runDesign(brief);
  };

  return (
    <section className="space-y-10">
      <div className="command-interface overflow-hidden px-10 py-14 sm:px-14 sm:py-16">
        <div className="mb-8 space-y-2">
          <p className="text-label text-primary/80">
            {t("design.interface.label")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.command.activeWorkspace", {
              workspace: workspace.name,
            })}
          </p>
        </div>

        <h2 className="command-interface-headline mb-10 max-w-3xl">
          {t("design.interface.headline")}
        </h2>

        <form onSubmit={handleSubmit} className="relative space-y-4">
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder={t("design.interface.placeholder")}
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
                <Palette className="size-5" />
              )}
              {isLoading
                ? t("design.interface.running")
                : t("design.interface.submit")}
            </button>
            <p className="text-sm text-muted-foreground">
              {t("design.interface.poweredBy")}
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
        <p className="text-label">{t("design.interface.tryExamples")}</p>
        <div className="flex flex-wrap gap-3">
          {examples.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => runDesign(label)}
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
                {t("design.interface.success")}
              </p>
              <h3 className="font-display text-3xl font-medium">
                {result.title}
              </h3>
              <p className="text-sm font-medium text-primary/80">
                {t("design.interface.collectionName")}: {result.collectionName}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("design.interface.contextRecords", {
                  count: String(result.contextRecordCount),
                })}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("design.interface.collectionStory")}
            </p>
            <p className="text-base leading-relaxed text-muted-foreground">
              {result.collectionStory}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-label text-primary/80">
              {t("design.interface.colorPalette")}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {result.colorPalette.map((color) => (
                <div
                  key={`${color.name}-${color.role}`}
                  className="rounded-xl border border-border bg-muted/20 p-4"
                >
                  <div className="flex items-center gap-3">
                    {color.hex && (
                      <span
                        className="size-8 shrink-0 rounded-lg border border-border"
                        style={{ backgroundColor: color.hex }}
                      />
                    )}
                    <div>
                      <p className="font-medium text-foreground">{color.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {color.role}
                        {color.hex ? ` · ${color.hex}` : ""}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("design.interface.silhouettes")}
            </p>
            <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-5">
              {result.silhouettes.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 text-base text-muted-foreground"
                >
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary/50" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-label text-primary/80">
              {t("design.interface.productLineup")}
            </p>
            <ul className="space-y-3">
              {result.productLineup.map((product) => (
                <li
                  key={product.name}
                  className="rounded-xl border border-border bg-muted/20 p-5"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="font-medium text-foreground">{product.name}</p>
                    <Badge variant="secondary" className="font-normal">
                      {product.category}
                    </Badge>
                  </div>
                  <p className="mt-2 text-base text-muted-foreground">
                    {product.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-label text-primary/80">
              {t("design.interface.heroProducts")}
            </p>
            <ul className="space-y-3">
              {result.heroProducts.map((hero) => (
                <li
                  key={hero.name}
                  className="rounded-xl border border-primary/20 bg-primary/5 p-5"
                >
                  <p className="font-medium text-foreground">{hero.name}</p>
                  <p className="mt-2 text-base text-muted-foreground">
                    {hero.description}
                  </p>
                  <p className="mt-2 text-sm text-primary/80">{hero.rationale}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("design.interface.materials")}
            </p>
            <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-5">
              {result.materials.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 text-base text-muted-foreground"
                >
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary/50" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("design.interface.designDirection")}
            </p>
            <p className="text-base leading-relaxed text-muted-foreground">
              {result.designDirection}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("design.interface.launchRecommendations")}
            </p>
            <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-5">
              {result.launchRecommendations.map((item) => (
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

          {result.sourceReportTitles.length > 0 && (
            <div className="space-y-2">
              <p className="text-label text-primary/80">
                {t("design.interface.sources")}
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
                {t("design.interface.confidence")}
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
              {t("design.interface.viewReports")}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
