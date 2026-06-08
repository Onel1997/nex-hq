"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { ShopifyProduct } from "@/agents/shopify/types";
import { useT, useWorkspace } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2, Loader2, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface ShopifyResult {
  reportId: string;
  title: string;
  collectionName: string;
  collectionDescription: string;
  collectionSeoTitle: string;
  collectionSeoDescription: string;
  products: ShopifyProduct[];
  collectionsToCreate: string[];
  navigationRecommendations: string[];
  homepageRecommendations: string[];
  launchChecklist: string[];
  storefrontWarnings: string[];
  confidence: number;
  sourceReportTitles: string[];
  contextRecordCount: number;
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-5">
      {items.map((item) => (
        <li
          key={item}
          className="flex gap-3 text-base text-muted-foreground"
        >
          <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary/50" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function WarningList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
      {items.map((item) => (
        <li
          key={item}
          className="flex gap-3 text-base text-muted-foreground"
        >
          <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-amber-500/60" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export function ShopifyInterface() {
  const t = useT();
  const workspace = useWorkspace();
  const [brief, setBrief] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShopifyResult | null>(null);

  const examples = [
    t("shopify.examples.ss26Storefront"),
    t("shopify.examples.hoodieDrop"),
    t("shopify.examples.collectionLaunch"),
    t("shopify.examples.pricingSync"),
  ];

  const runShopify = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setIsLoading(true);
      setError(null);
      setResult(null);

      try {
        const res = await fetch("/api/shopify/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brief: trimmed }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? t("shopify.errors.unexpected"));
        }

        setResult({
          reportId: data.reportId,
          title: data.title,
          collectionName: data.collectionName,
          collectionDescription: data.collectionDescription,
          collectionSeoTitle: data.collectionSeoTitle,
          collectionSeoDescription: data.collectionSeoDescription,
          products: data.products,
          collectionsToCreate: data.collectionsToCreate,
          navigationRecommendations: data.navigationRecommendations,
          homepageRecommendations: data.homepageRecommendations,
          launchChecklist: data.launchChecklist,
          storefrontWarnings: data.storefrontWarnings,
          confidence: data.confidence,
          sourceReportTitles: data.sourceReportTitles,
          contextRecordCount: data.contextRecordCount,
        });
        setBrief("");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("shopify.errors.unexpected"),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, t],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runShopify(brief);
  };

  return (
    <section className="space-y-10">
      <div className="command-interface overflow-hidden px-10 py-14 sm:px-14 sm:py-16">
        <div className="mb-8 space-y-2">
          <p className="text-label text-primary/80">
            {t("shopify.interface.label")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.command.activeWorkspace", {
              workspace: workspace.name,
            })}
          </p>
        </div>

        <h2 className="command-interface-headline mb-10 max-w-3xl">
          {t("shopify.interface.headline")}
        </h2>

        <form onSubmit={handleSubmit} className="relative space-y-4">
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder={t("shopify.interface.placeholder")}
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
                <ShoppingBag className="size-5" />
              )}
              {isLoading
                ? t("shopify.interface.running")
                : t("shopify.interface.submit")}
            </button>
            <p className="text-sm text-muted-foreground">
              {t("shopify.interface.poweredBy")}
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
        <p className="text-label">{t("shopify.interface.tryExamples")}</p>
        <div className="flex flex-wrap gap-3">
          {examples.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => runShopify(label)}
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
                {t("shopify.interface.success")}
              </p>
              <h3 className="font-display text-3xl font-medium">
                {result.title}
              </h3>
              <p className="text-sm font-medium text-primary/80">
                {t("shopify.interface.collectionName")}: {result.collectionName}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("shopify.interface.contextRecords", {
                  count: String(result.contextRecordCount),
                })}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("shopify.interface.collectionDescription")}
            </p>
            <p className="text-base leading-relaxed text-muted-foreground">
              {result.collectionDescription}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("shopify.interface.collectionSeo")}
            </p>
            <div className="rounded-xl border border-border bg-muted/20 p-5 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                {t("shopify.interface.seoTitle")}: {result.collectionSeoTitle}
              </p>
              <p className="mt-2">
                {t("shopify.interface.seoDescription")}:{" "}
                {result.collectionSeoDescription}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-label text-primary/80">
              {t("shopify.interface.products")}{" "}
              <span className="text-muted-foreground">
                ({t("shopify.interface.productCount", {
                  count: String(result.products.length),
                })})
              </span>
            </p>
            <ul className="space-y-4">
              {result.products.map((product) => (
                <li
                  key={product.productName}
                  className="rounded-xl border border-border bg-muted/20 p-5"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="font-medium text-foreground">
                      {product.productName}
                    </p>
                    <Badge variant="secondary" className="font-normal">
                      {product.category}
                    </Badge>
                    <Badge variant="outline" className="font-normal">
                      {product.suggestedPrice}
                    </Badge>
                  </div>
                  <p className="mt-2 text-base text-muted-foreground">
                    {product.shortDescription}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {product.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="font-normal">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  {product.variants.length > 0 && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {t("shopify.interface.variants")}:{" "}
                      {product.variants
                        .map(
                          (v) =>
                            `${v.optionName} (${v.optionValues.join(", ")})`,
                        )
                        .join(" · ")}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-primary/80">
                    {t("shopify.interface.inventory")}:{" "}
                    {product.inventoryRecommendation}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("shopify.interface.collectionsToCreate")}
            </p>
            <BulletList items={result.collectionsToCreate} />
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("shopify.interface.navigationRecommendations")}
            </p>
            <BulletList items={result.navigationRecommendations} />
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("shopify.interface.homepageRecommendations")}
            </p>
            <BulletList items={result.homepageRecommendations} />
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("shopify.interface.launchChecklist")}
            </p>
            <BulletList items={result.launchChecklist} />
          </div>

          <div className="space-y-2">
            <p className="text-label text-primary/80">
              {t("shopify.interface.storefrontWarnings")}
            </p>
            <WarningList items={result.storefrontWarnings} />
          </div>

          {result.sourceReportTitles.length > 0 && (
            <div className="space-y-2">
              <p className="text-label text-primary/80">
                {t("shopify.interface.sources")}
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
                {t("shopify.interface.confidence")}
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
              {t("shopify.interface.viewReports")}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
