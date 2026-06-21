"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ImageProjectWorkspace } from "@/components/image/image-project-workspace";
import { useT, useWorkspace } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2, Loader2, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ImageInterface() {
  const t = useT();
  const workspace = useWorkspace();
  const [brief, setBrief] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof runImageRequest>
  > | null>(null);

  async function runImageRequest(text: string) {
    const res = await fetch("/api/image/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief: text }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? t("image.errors.unexpected"));
    }
    return data;
  }

  const runImage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setIsLoading(true);
      setError(null);
      setResult(null);

      try {
        const data = await runImageRequest(trimmed);
        setResult(data);
        setBrief("");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("image.errors.unexpected"),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, t],
  );

  const examples = [
    t("image.examples.urbanEchoes"),
    t("image.examples.corePackage"),
    t("image.examples.campaignVisuals"),
  ];

  return (
    <section className="space-y-10">
      <div className="command-interface overflow-hidden px-10 py-14 sm:px-14 sm:py-16">
        <div className="mb-8 space-y-2">
          <p className="text-label text-primary/80">
            {t("image.interface.label")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.command.activeWorkspace", {
              workspace: workspace.name,
            })}
          </p>
        </div>

        <h2 className="command-interface-headline mb-10 max-w-3xl">
          {t("image.interface.headline")}
        </h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runImage(brief);
          }}
          className="relative space-y-4"
        >
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder={t("image.interface.placeholder")}
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
                <Wand2 className="size-5" />
              )}
              {isLoading
                ? t("image.interface.running")
                : t("image.interface.submit")}
            </button>
          </div>
        </form>

        {error && (
          <p className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <p className="text-label">{t("image.interface.tryExamples")}</p>
        <div className="flex flex-wrap gap-3">
          {examples.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => runImage(label)}
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
        <div className="luxury-surface-elevated space-y-8 rounded-2xl p-8">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="mt-1 size-6 shrink-0 text-primary" />
            <div className="space-y-3">
              <p className="text-label text-primary">
                {t("image.interface.success")}
              </p>
              <Badge variant="outline" className="font-normal">
                {t("image.interface.phaseNote")}
              </Badge>
            </div>
          </div>

          <ImageProjectWorkspace
            reportId={result.reportId}
            reportRecordId={result.reportRecordId}
            projectName={result.projectName}
            visualDirection={result.visualDirection}
            moodboard={result.moodboard}
            palette={result.palette}
            productionAssets={result.productionAssets}
            lookbookShots={result.lookbookShots}
            confidence={result.confidence}
            sourceReportTitles={result.sourceReportTitles}
          />

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
            <Link
              href={`/projects/${result.reportRecordId}`}
              className="inline-flex items-center gap-2 text-base text-primary hover:underline"
            >
              {t("image.interface.openProject")}
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/facility/reports"
              className="inline-flex items-center gap-2 text-base text-muted-foreground hover:text-foreground"
            >
              {t("image.interface.viewReports")}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
