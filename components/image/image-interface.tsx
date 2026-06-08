"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { ImageAsset } from "@/agents/image/types";
import { useT, useWorkspace } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2, Loader2, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface ImageResult {
  reportId: string;
  title: string;
  projectName: string;
  visualDirection: string;
  collectionStory: string;
  moodboard: string;
  campaignConcept: string;
  assets: ImageAsset[];
  confidence: number;
  sourceReportTitles: string[];
  contextRecordCount: number;
}

function AssetPreview({
  assets,
  label,
  moreLabel,
}: {
  assets: ImageAsset[];
  label: string;
  moreLabel: (count: string) => string;
}) {
  const preview = assets.slice(0, 4);

  return (
    <div className="space-y-3">
      <p className="text-label text-primary/80">
        {label} ({assets.length})
      </p>
      <ul className="space-y-4">
        {preview.map((asset) => (
          <li
            key={`${asset.assetName}-${asset.assetType}`}
            className="rounded-xl border border-border bg-muted/20 p-5 space-y-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">{asset.assetName}</p>
              <Badge variant="secondary" className="font-normal text-xs">
                {asset.assetType.replace(/_/g, " ")}
              </Badge>
              <Badge variant="outline" className="font-normal text-xs">
                {asset.platform}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {asset.dimensions}
              </span>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {asset.prompt}
            </p>
          </li>
        ))}
        {assets.length > 4 && (
          <li className="text-sm text-muted-foreground/80">
            {moreLabel(String(assets.length - 4))}
          </li>
        )}
      </ul>
    </div>
  );
}

export function ImageInterface() {
  const t = useT();
  const workspace = useWorkspace();
  const [brief, setBrief] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImageResult | null>(null);

  const examples = [
    t("image.examples.urbanEchoes"),
    t("image.examples.moodboardMockups"),
    t("image.examples.campaignVisuals"),
    t("image.examples.socialLookbook"),
  ];

  const runImage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setIsLoading(true);
      setError(null);
      setResult(null);

      try {
        const res = await fetch("/api/image/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brief: trimmed }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? t("image.errors.unexpected"));
        }

        setResult({
          reportId: data.reportId,
          title: data.title,
          projectName: data.projectName,
          visualDirection: data.visualDirection,
          collectionStory: data.collectionStory,
          moodboard: data.moodboard,
          campaignConcept: data.campaignConcept,
          assets: data.assets,
          confidence: data.confidence,
          sourceReportTitles: data.sourceReportTitles,
          contextRecordCount: data.contextRecordCount,
        });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runImage(brief);
  };

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

        <form onSubmit={handleSubmit} className="relative space-y-4">
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
            <p className="text-sm text-muted-foreground">
              {t("image.interface.poweredBy")}
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
        <div className="luxury-surface-elevated space-y-6 rounded-2xl p-8">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="mt-1 size-6 shrink-0 text-primary" />
            <div className="space-y-3">
              <p className="text-label text-primary">
                {t("image.interface.success")}
              </p>
              <h3 className="font-display text-3xl font-medium">
                {result.projectName}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("image.interface.contextRecords", {
                  count: String(result.contextRecordCount),
                })}
              </p>
              <Badge variant="outline" className="font-normal">
                {t("image.interface.phaseNote")}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("image.interface.visualDirection")}
            </p>
            <p className="text-base leading-relaxed text-muted-foreground">
              {result.visualDirection}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-label text-primary/80">
                {t("image.interface.collectionStory")}
              </p>
              <p className="text-base leading-relaxed text-muted-foreground">
                {result.collectionStory}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-label text-primary/80">
                {t("image.interface.campaignConcept")}
              </p>
              <p className="text-base leading-relaxed text-muted-foreground">
                {result.campaignConcept}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("image.interface.moodboard")}
            </p>
            <p className="text-base leading-relaxed text-muted-foreground">
              {result.moodboard}
            </p>
          </div>

          <AssetPreview
            assets={result.assets}
            label={t("image.interface.assets")}
            moreLabel={(count) =>
              t("image.interface.moreAssets", { count })
            }
          />

          {result.sourceReportTitles.length > 0 && (
            <div className="space-y-2">
              <p className="text-label text-primary/80">
                {t("image.interface.sources")}
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
                {t("image.interface.confidence")}
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
              {t("image.interface.viewReports")}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
