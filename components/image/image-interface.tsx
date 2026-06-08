"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type {
  ImageCampaignVisual,
  ImageLandingPageAsset,
  ImageMoodboardSection,
  ImageProductMockup,
  ImageProductionChecklistItem,
} from "@/agents/image/types";
import { useT, useWorkspace } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2, Loader2, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface ImageResult {
  reportId: string;
  title: string;
  projectName: string;
  moodboard: ImageMoodboardSection;
  productMockups: ImageProductMockup[];
  campaignVisuals: ImageCampaignVisual[];
  landingPageAssets: ImageLandingPageAsset[];
  productionChecklist: ImageProductionChecklistItem[];
  confidence: number;
  sourceReportTitles: string[];
  contextRecordCount: number;
}

function PromptPreview({ label, prompt }: { label: string; prompt: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-muted-foreground line-clamp-3">{prompt}</p>
    </div>
  );
}

function VisualAssetCard({
  name,
  badge,
  meta,
  description,
  prompts,
}: {
  name: string;
  badge: string;
  meta?: string;
  description: string;
  prompts: { midjourney: string; openai: string; flux: string };
}) {
  return (
    <li className="rounded-xl border border-border bg-muted/20 p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-foreground">{name}</p>
        <Badge variant="secondary" className="font-normal text-xs">
          {badge}
        </Badge>
        {meta && (
          <span className="text-xs text-muted-foreground">{meta}</span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <PromptPreview label="Midjourney" prompt={prompts.midjourney} />
        <PromptPreview label="OpenAI" prompt={prompts.openai} />
        <PromptPreview label="Flux" prompt={prompts.flux} />
      </div>
    </li>
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
          const parts = [data.error ?? t("image.errors.unexpected")];
          if (data.missingReportTypes?.length) {
            parts.push(
              `Fehlend: ${(data.missingReportTypes as string[]).join(", ")}`,
            );
          }
          if (data.primaryReportCounts) {
            parts.push(
              `Gefunden — CEO: ${data.primaryReportCounts["ceo-report"] ?? 0}, Design: ${data.primaryReportCounts["design-report"] ?? 0}, Content: ${data.primaryReportCounts["content-report"] ?? 0}, Marketing: ${data.primaryReportCounts["marketing-report"] ?? 0}`,
            );
          }
          throw new Error(parts.join(" · "));
        }

        setResult({
          reportId: data.reportId,
          title: data.title,
          projectName: data.projectName,
          moodboard: data.moodboard,
          productMockups: data.productMockups,
          campaignVisuals: data.campaignVisuals,
          landingPageAssets: data.landingPageAssets,
          productionChecklist: data.productionChecklist,
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
        <div className="luxury-surface-elevated space-y-8 rounded-2xl p-8">
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

          <div className="space-y-3">
            <p className="text-label text-primary/80">
              {t("image.interface.moodboardSection")}
            </p>
            <p className="text-base leading-relaxed text-muted-foreground">
              {result.moodboard.visualDirection}
            </p>
            <div className="flex flex-wrap gap-2">
              {result.moodboard.aestheticKeywords.map((keyword) => (
                <Badge key={keyword} variant="secondary" className="font-normal">
                  {keyword}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {result.moodboard.photographyStyle}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-label text-primary/80">
              {t("image.interface.productMockups")} ({result.productMockups.length})
            </p>
            <ul className="space-y-4">
              {result.productMockups.slice(0, 4).map((asset) => (
                <VisualAssetCard
                  key={`${asset.name}-${asset.conceptType}`}
                  name={asset.name}
                  badge={asset.conceptType.replace(/_/g, " ")}
                  meta={asset.dimensions}
                  description={asset.description}
                  prompts={asset.prompts}
                />
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-label text-primary/80">
              {t("image.interface.campaignVisuals")} ({result.campaignVisuals.length})
            </p>
            <ul className="space-y-4">
              {result.campaignVisuals.slice(0, 4).map((asset) => (
                <VisualAssetCard
                  key={`${asset.name}-${asset.conceptType}`}
                  name={asset.name}
                  badge={asset.platform}
                  description={asset.description}
                  prompts={asset.prompts}
                />
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-label text-primary/80">
              {t("image.interface.productionChecklist")} ({result.productionChecklist.length})
            </p>
            <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-5 text-sm text-muted-foreground">
              {result.productionChecklist.slice(0, 8).map((item) => (
                <li key={item.assetName}>
                  [{item.priority.toUpperCase()}] {item.assetName} · {item.platform} — {item.purpose}
                </li>
              ))}
            </ul>
          </div>

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
