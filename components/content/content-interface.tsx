"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type {
  ContentEmailSequence,
  ContentLandingPageCopy,
  ContentProductCopy,
  ContentSmsCampaign,
  ContentSocialContent,
} from "@/agents/content/types";
import { useT, useWorkspace } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2, Loader2, PenLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface ContentResult {
  reportId: string;
  title: string;
  brandNarrative: string;
  landingPageCopy: ContentLandingPageCopy;
  productCopy: ContentProductCopy[];
  emailSequence: ContentEmailSequence;
  socialContent: ContentSocialContent;
  smsCampaign: ContentSmsCampaign;
  confidence: number;
  sourceReportTitles: string[];
  contextRecordCount: number;
}

function CaptionPreview({
  items,
  label,
  moreLabel,
}: {
  items: string[];
  label: string;
  moreLabel: (count: string) => string;
}) {
  const preview = items.slice(0, 5);
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {label} ({items.length})
      </p>
      <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-5">
        {preview.map((item) => (
          <li
            key={item}
            className="flex gap-3 text-base text-muted-foreground"
          >
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary/50" />
            {item}
          </li>
        ))}
        {items.length > 5 && (
          <li className="text-sm text-muted-foreground/80">
            {moreLabel(String(items.length - 5))}
          </li>
        )}
      </ul>
    </div>
  );
}

export function ContentInterface() {
  const t = useT();
  const workspace = useWorkspace();
  const [brief, setBrief] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ContentResult | null>(null);

  const examples = [
    t("content.examples.ss26Content"),
    t("content.examples.landingPage"),
    t("content.examples.emailSocial"),
    t("content.examples.productDescriptions"),
  ];

  const runContent = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setIsLoading(true);
      setError(null);
      setResult(null);

      try {
        const res = await fetch("/api/content/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brief: trimmed }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? t("content.errors.unexpected"));
        }

        setResult({
          reportId: data.reportId,
          title: data.title,
          brandNarrative: data.brandNarrative,
          landingPageCopy: data.landingPageCopy,
          productCopy: data.productCopy,
          emailSequence: data.emailSequence,
          socialContent: data.socialContent,
          smsCampaign: data.smsCampaign,
          confidence: data.confidence,
          sourceReportTitles: data.sourceReportTitles,
          contextRecordCount: data.contextRecordCount,
        });
        setBrief("");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("content.errors.unexpected"),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, t],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runContent(brief);
  };

  return (
    <section className="space-y-10">
      <div className="command-interface overflow-hidden px-10 py-14 sm:px-14 sm:py-16">
        <div className="mb-8 space-y-2">
          <p className="text-label text-primary/80">
            {t("content.interface.label")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.command.activeWorkspace", {
              workspace: workspace.name,
            })}
          </p>
        </div>

        <h2 className="command-interface-headline mb-10 max-w-3xl">
          {t("content.interface.headline")}
        </h2>

        <form onSubmit={handleSubmit} className="relative space-y-4">
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder={t("content.interface.placeholder")}
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
                <PenLine className="size-5" />
              )}
              {isLoading
                ? t("content.interface.running")
                : t("content.interface.submit")}
            </button>
            <p className="text-sm text-muted-foreground">
              {t("content.interface.poweredBy")}
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
        <p className="text-label">{t("content.interface.tryExamples")}</p>
        <div className="flex flex-wrap gap-3">
          {examples.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => runContent(label)}
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
                {t("content.interface.success")}
              </p>
              <h3 className="font-display text-3xl font-medium">
                {result.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("content.interface.contextRecords", {
                  count: String(result.contextRecordCount),
                })}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("content.interface.brandNarrative")}
            </p>
            <p className="text-base leading-relaxed text-muted-foreground">
              {result.brandNarrative}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-label text-primary/80">
              {t("content.interface.landingPage")}
            </p>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 space-y-3">
              <p className="font-display text-2xl font-medium text-foreground">
                {result.landingPageCopy.heroHeadline}
              </p>
              <p className="text-lg text-muted-foreground">
                {result.landingPageCopy.heroSubheadline}
              </p>
              <p className="text-base leading-relaxed text-muted-foreground">
                {result.landingPageCopy.brandStory}
              </p>
              <p className="text-base leading-relaxed text-muted-foreground">
                {result.landingPageCopy.collectionIntroduction}
              </p>
              <Badge className="font-normal">{result.landingPageCopy.cta}</Badge>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-label text-primary/80">
              {t("content.interface.productCopy")}{" "}
              <span className="text-muted-foreground">
                ({t("content.interface.productCount", {
                  count: String(result.productCopy.length),
                })})
              </span>
            </p>
            <ul className="space-y-4">
              {result.productCopy.map((product) => (
                <li
                  key={product.productName}
                  className="rounded-xl border border-border bg-muted/20 p-5"
                >
                  <p className="font-medium text-foreground">
                    {product.productName}
                  </p>
                  <p className="mt-2 text-base text-muted-foreground">
                    {product.shortDescription}
                  </p>
                  <ul className="mt-3 space-y-1">
                    {product.featureBullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex gap-2 text-sm text-muted-foreground"
                      >
                        <span className="text-primary">·</span>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-label text-primary/80">
              {t("content.interface.emailSequence")}
            </p>
            <ul className="space-y-3">
              {(
                [
                  ["teaserEmail", result.emailSequence.teaserEmail],
                  ["revealEmail", result.emailSequence.revealEmail],
                  ["countdownEmail", result.emailSequence.countdownEmail],
                  ["launchEmail", result.emailSequence.launchEmail],
                ] as const
              ).map(([key, body]) => (
                <li
                  key={key}
                  className="rounded-xl border border-border bg-muted/20 p-4"
                >
                  <p className="font-medium text-foreground">
                    {t(`content.interface.${key}`)}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                    {body}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <CaptionPreview
            items={result.socialContent.instagramCaptions}
            label={t("content.interface.instagramCaptions")}
            moreLabel={(count) =>
              t("content.interface.moreCaptions", { count })
            }
          />

          <CaptionPreview
            items={result.socialContent.tiktokHooks}
            label={t("content.interface.tiktokHooks")}
            moreLabel={(count) =>
              t("content.interface.moreCaptions", { count })
            }
          />

          <div className="space-y-3">
            <p className="text-label text-primary/80">
              {t("content.interface.smsCampaign")}
            </p>
            <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-5">
              {(
                [
                  ["teaserSms", result.smsCampaign.teaserSms],
                  ["countdownSms", result.smsCampaign.countdownSms],
                  ["launchSms", result.smsCampaign.launchSms],
                ] as const
              ).map(([key, message]) => (
                <li key={key} className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {t(`content.interface.${key}`)}:
                  </span>{" "}
                  {message}
                </li>
              ))}
            </ul>
          </div>

          {result.sourceReportTitles.length > 0 && (
            <div className="space-y-2">
              <p className="text-label text-primary/80">
                {t("content.interface.sources")}
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
                {t("content.interface.confidence")}
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
              {t("content.interface.viewReports")}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
