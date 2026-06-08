"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getAgentCatalog,
  getCeoPriorityLabels,
  getCeoReportTypeLabel,
  getDesignReportTypeLabel,
  getMarketingReportTypeLabel,
  getShopifyReportTypeLabel,
  getContentReportTypeLabel,
  getImageReportTypeLabel,
  getReportCategoryLabels,
  getReportStatusLabel,
  getResearchReportTypeLabels,
} from "@/lib/i18n/data";
import type { ReportListItem } from "@/lib/mock/reports";
import type {
  CeoStepPriority,
  ResearchReportType,
} from "@/brain/domains/reports";
import { useDictionary, useLocale, useT, useWorkspace } from "@/lib/i18n";
import { SectionHeading } from "@/components/shared/section-heading";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Megaphone,
  Palette,
  Search,
  Settings2,
  ShoppingBag,
  PenLine,
  Wand2,
} from "lucide-react";

const CATEGORY_ICONS = {
  research: Search,
  design: Palette,
  marketing: Megaphone,
  commerce: ShoppingBag,
  content: PenLine,
  image: Wand2,
  operations: Settings2,
} as const;

const REPORT_TYPE_STYLES: Record<ResearchReportType, string> = {
  competitor: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  trend: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  pricing: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  audience: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  design: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

const CEO_REPORT_STYLE =
  "border-primary/30 bg-primary/10 text-primary";

const DESIGN_REPORT_STYLE =
  "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

const MARKETING_REPORT_STYLE =
  "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300";

const SHOPIFY_REPORT_STYLE =
  "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300";

const CONTENT_REPORT_STYLE =
  "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300";

const IMAGE_REPORT_STYLE =
  "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300";

const PRIORITY_STYLES: Record<CeoStepPriority, string> = {
  high: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  medium:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  low: "border-border bg-muted/40 text-muted-foreground",
};

const STATUS_STYLES: Record<ReportListItem["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-primary/10 text-primary",
  approved: "bg-primary/15 text-primary",
  archived: "bg-muted text-muted-foreground",
};

function ReportSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <p className="text-label text-primary/80">{label}</p>
      {children}
    </div>
  );
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

function ReportCard({
  report,
  categoryLabel,
  agentName,
  statusLabel,
  reportTypeLabels,
  ceoReportTypeLabel,
  designReportTypeLabel,
  marketingReportTypeLabel,
  shopifyReportTypeLabel,
  contentReportTypeLabel,
  imageReportTypeLabel,
  priorityLabels,
  sectionLabels,
}: {
  report: ReportListItem;
  categoryLabel: string;
  agentName: string;
  statusLabel: string;
  reportTypeLabels: Record<ResearchReportType, string>;
  ceoReportTypeLabel: string;
  designReportTypeLabel: string;
  marketingReportTypeLabel: string;
  shopifyReportTypeLabel: string;
  contentReportTypeLabel: string;
  imageReportTypeLabel: string;
  priorityLabels: Record<CeoStepPriority, string>;
  sectionLabels: {
    executiveSummary: string;
    keyFindings: string;
    keyInsights: string;
    recommendations: string;
    strategicOpportunities: string;
    risks: string;
    nextSteps: string;
    collectionName: string;
    collectionStory: string;
    colorPalette: string;
    silhouettes: string;
    productLineup: string;
    heroProducts: string;
    materials: string;
    designDirection: string;
    launchRecommendations: string;
    launchStrategy: string;
    contentPillars: string;
    tiktokIdeas: string;
    instagramIdeas: string;
    influencerStrategy: string;
    emailCampaignPlan: string;
    communityBuildingPlan: string;
    contentCalendar: string;
    launchKpis: string;
    budgetAllocation: string;
    collectionDescription: string;
    collectionSeo: string;
    products: string;
    collectionsToCreate: string;
    navigationRecommendations: string;
    homepageRecommendations: string;
    launchChecklist: string;
    storefrontWarnings: string;
    brandNarrative: string;
    landingPage: string;
    heroHeadline: string;
    productCopy: string;
    emailSequence: string;
    socialContent: string;
    instagramCaptions: string;
    tiktokHooks: string;
    storyIdeas: string;
    launchPosts: string;
    smsCampaign: string;
    confidence: string;
    projectName: string;
    visualDirection: string;
    moodboard: string;
    campaignConcept: string;
    assets: string;
    assetPrompt: string;
    assetType: string;
    assetPlatform: string;
    assetDimensions: string;
  };
}) {
  const CategoryIcon = CATEGORY_ICONS[report.category];
  const isCeoReport = report.reportType === "ceo-report";
  const isDesignReport = report.reportType === "design-report";
  const isMarketingReport = report.reportType === "marketing-report";
  const isShopifyReport = report.reportType === "shopify-report";
  const isContentReport = report.reportType === "content-report";
  const isImageReport = report.reportType === "image-report";
  const researchReportType =
    report.reportType &&
    report.reportType !== "ceo-report" &&
    report.reportType !== "design-report" &&
    report.reportType !== "marketing-report" &&
    report.reportType !== "shopify-report" &&
    report.reportType !== "content-report" &&
    report.reportType !== "image-report"
      ? report.reportType
      : undefined;
  const design = report.designReport;
  const marketing = report.marketingReport;
  const shopify = report.shopifyReport;
  const content = report.contentReport;
  const image = report.imageReport;
  const executiveSummary = report.executiveSummary ?? report.summary;
  const keyFindings = report.highlights ?? [];
  const recommendations = report.recommendations ?? [];
  const opportunities = report.opportunities ?? [];
  const risks = report.risks ?? [];
  const nextSteps = report.nextSteps ?? [];

  return (
    <div className="luxury-surface rounded-2xl p-8 transition-colors hover:border-primary/15">
      <div className="flex items-start gap-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CategoryIcon className="size-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {report.reportType && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-normal",
                      isCeoReport
                        ? CEO_REPORT_STYLE
                        : isDesignReport
                          ? DESIGN_REPORT_STYLE
                          : isMarketingReport
                            ? MARKETING_REPORT_STYLE
                            : isShopifyReport
                              ? SHOPIFY_REPORT_STYLE
                              : isContentReport
                                ? CONTENT_REPORT_STYLE
                                : isImageReport
                                  ? IMAGE_REPORT_STYLE
                                  : researchReportType
                              ? REPORT_TYPE_STYLES[researchReportType]
                              : undefined,
                    )}
                  >
                    {isCeoReport
                      ? ceoReportTypeLabel
                      : isDesignReport
                        ? designReportTypeLabel
                        : isMarketingReport
                          ? marketingReportTypeLabel
                          : isShopifyReport
                            ? shopifyReportTypeLabel
                            : isContentReport
                              ? contentReportTypeLabel
                              : isImageReport
                                ? imageReportTypeLabel
                                : researchReportType
                            ? reportTypeLabels[researchReportType]
                            : report.reportType}
                  </Badge>
                )}
                <Badge variant="outline" className="font-normal">
                  {categoryLabel}
                </Badge>
              </div>
              <h3 className="font-display text-2xl font-medium leading-snug">
                {report.title}
              </h3>
            </div>
            <Badge
              variant="secondary"
              className={cn("shrink-0 text-sm font-normal", STATUS_STYLES[report.status])}
            >
              {statusLabel}
            </Badge>
          </div>

          {isImageReport && image ? (
            <>
              <ReportSection label={sectionLabels.visualDirection}>
                <p className="text-base leading-relaxed text-muted-foreground">
                  {image.visualDirection}
                </p>
              </ReportSection>

              <ReportSection label={sectionLabels.collectionStory}>
                <p className="text-base leading-relaxed text-muted-foreground">
                  {image.collectionStory}
                </p>
              </ReportSection>

              <ReportSection label={sectionLabels.moodboard}>
                <p className="text-base leading-relaxed text-muted-foreground">
                  {image.moodboard}
                </p>
              </ReportSection>

              <ReportSection label={sectionLabels.campaignConcept}>
                <p className="text-base leading-relaxed text-muted-foreground">
                  {image.campaignConcept}
                </p>
              </ReportSection>

              {image.assets.length > 0 && (
                <ReportSection label={sectionLabels.assets}>
                  <ul className="space-y-3">
                    {image.assets.slice(0, 6).map((asset) => (
                      <li
                        key={`${asset.assetName}-${asset.assetType}`}
                        className="rounded-xl border border-border bg-muted/20 p-4 space-y-2"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">
                            {asset.assetName}
                          </p>
                          <Badge variant="secondary" className="font-normal text-xs">
                            {asset.assetType.replace(/_/g, " ")}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {asset.platform} · {asset.dimensions}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {asset.prompt}
                        </p>
                      </li>
                    ))}
                  </ul>
                </ReportSection>
              )}
            </>
          ) : isContentReport && content ? (
            <>
              <ReportSection label={sectionLabels.brandNarrative}>
                <p className="text-base leading-relaxed text-muted-foreground">
                  {content.brandNarrative}
                </p>
              </ReportSection>

              <ReportSection label={sectionLabels.landingPage}>
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                  <p className="font-display text-xl font-medium text-foreground">
                    {content.landingPageCopy.heroHeadline}
                  </p>
                  <p className="text-base text-muted-foreground">
                    {content.landingPageCopy.heroSubheadline}
                  </p>
                  <p className="text-sm text-primary">{content.landingPageCopy.cta}</p>
                </div>
              </ReportSection>

              {content.productCopy.length > 0 && (
                <ReportSection label={sectionLabels.productCopy}>
                  <ul className="space-y-3">
                    {content.productCopy.map((product) => (
                      <li
                        key={product.productName}
                        className="rounded-xl border border-border bg-muted/20 p-4"
                      >
                        <p className="font-medium text-foreground">
                          {product.productName}
                        </p>
                        <p className="mt-1 text-base text-muted-foreground">
                          {product.shortDescription}
                        </p>
                      </li>
                    ))}
                  </ul>
                </ReportSection>
              )}

              <ReportSection label={sectionLabels.emailSequence}>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <span className="font-medium text-foreground">Teaser:</span>{" "}
                    {content.emailSequence.teaserEmail.slice(0, 120)}…
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Launch:</span>{" "}
                    {content.emailSequence.launchEmail.slice(0, 120)}…
                  </li>
                </ul>
              </ReportSection>

              {content.socialContent.instagramCaptions.length > 0 && (
                <ReportSection label={sectionLabels.instagramCaptions}>
                  <BulletList items={content.socialContent.instagramCaptions.slice(0, 6)} />
                </ReportSection>
              )}

              {content.socialContent.tiktokHooks.length > 0 && (
                <ReportSection label={sectionLabels.tiktokHooks}>
                  <BulletList items={content.socialContent.tiktokHooks.slice(0, 6)} />
                </ReportSection>
              )}

              <ReportSection label={sectionLabels.smsCampaign}>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>{content.smsCampaign.teaserSms}</li>
                  <li>{content.smsCampaign.launchSms}</li>
                </ul>
              </ReportSection>
            </>
          ) : isShopifyReport && shopify ? (
            <>
              <ReportSection label={sectionLabels.collectionName}>
                <p className="text-base font-medium text-foreground">
                  {shopify.collectionName}
                </p>
              </ReportSection>

              <ReportSection label={sectionLabels.collectionDescription}>
                <p className="text-base leading-relaxed text-muted-foreground">
                  {shopify.collectionDescription}
                </p>
              </ReportSection>

              <ReportSection label={sectionLabels.collectionSeo}>
                <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">
                    {shopify.collectionSeoTitle}
                  </p>
                  <p className="mt-2">{shopify.collectionSeoDescription}</p>
                </div>
              </ReportSection>

              {shopify.products.length > 0 && (
                <ReportSection label={sectionLabels.products}>
                  <ul className="space-y-3">
                    {shopify.products.map((product) => (
                      <li
                        key={product.productName}
                        className="rounded-xl border border-border bg-muted/20 p-4"
                      >
                        <p className="font-medium text-foreground">
                          {product.productName}{" "}
                          <span className="text-sm font-normal text-muted-foreground">
                            · {product.category} · {product.suggestedPrice}
                          </span>
                        </p>
                        <p className="mt-1 text-base text-muted-foreground">
                          {product.shortDescription}
                        </p>
                      </li>
                    ))}
                  </ul>
                </ReportSection>
              )}

              {shopify.collectionsToCreate.length > 0 && (
                <ReportSection label={sectionLabels.collectionsToCreate}>
                  <BulletList items={shopify.collectionsToCreate} />
                </ReportSection>
              )}

              {shopify.navigationRecommendations.length > 0 && (
                <ReportSection label={sectionLabels.navigationRecommendations}>
                  <BulletList items={shopify.navigationRecommendations} />
                </ReportSection>
              )}

              {shopify.homepageRecommendations.length > 0 && (
                <ReportSection label={sectionLabels.homepageRecommendations}>
                  <BulletList items={shopify.homepageRecommendations} />
                </ReportSection>
              )}

              {shopify.launchChecklist.length > 0 && (
                <ReportSection label={sectionLabels.launchChecklist}>
                  <BulletList items={shopify.launchChecklist} />
                </ReportSection>
              )}

              {shopify.storefrontWarnings.length > 0 && (
                <ReportSection label={sectionLabels.storefrontWarnings}>
                  <BulletList items={shopify.storefrontWarnings} />
                </ReportSection>
              )}
            </>
          ) : isMarketingReport && marketing ? (
            <>
              <ReportSection label={sectionLabels.launchStrategy}>
                <p className="text-base leading-relaxed text-muted-foreground">
                  {marketing.launchStrategy}
                </p>
              </ReportSection>

              {marketing.contentPillars.length > 0 && (
                <ReportSection label={sectionLabels.contentPillars}>
                  <BulletList items={marketing.contentPillars} />
                </ReportSection>
              )}

              {marketing.tiktokIdeas.length > 0 && (
                <ReportSection label={sectionLabels.tiktokIdeas}>
                  <BulletList items={marketing.tiktokIdeas.slice(0, 8)} />
                  {marketing.tiktokIdeas.length > 8 && (
                    <p className="text-sm text-muted-foreground">
                      +{marketing.tiktokIdeas.length - 8} weitere TikTok-Ideen
                    </p>
                  )}
                </ReportSection>
              )}

              {marketing.instagramIdeas.length > 0 && (
                <ReportSection label={sectionLabels.instagramIdeas}>
                  <BulletList items={marketing.instagramIdeas.slice(0, 8)} />
                  {marketing.instagramIdeas.length > 8 && (
                    <p className="text-sm text-muted-foreground">
                      +{marketing.instagramIdeas.length - 8} weitere Instagram-Ideen
                    </p>
                  )}
                </ReportSection>
              )}

              <ReportSection label={sectionLabels.influencerStrategy}>
                <p className="text-base leading-relaxed text-muted-foreground">
                  {marketing.influencerStrategy}
                </p>
              </ReportSection>

              {marketing.emailCampaignPlan.length > 0 && (
                <ReportSection label={sectionLabels.emailCampaignPlan}>
                  <ul className="space-y-3">
                    {marketing.emailCampaignPlan.map((phase) => (
                      <li
                        key={phase.phase}
                        className="rounded-xl border border-border bg-muted/20 p-4"
                      >
                        <p className="font-medium text-foreground">
                          {phase.phase} — {phase.subject}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {phase.content}
                        </p>
                      </li>
                    ))}
                  </ul>
                </ReportSection>
              )}

              <ReportSection label={sectionLabels.communityBuildingPlan}>
                <p className="text-base leading-relaxed text-muted-foreground">
                  {marketing.communityBuildingPlan}
                </p>
              </ReportSection>

              {marketing.contentCalendar30Day.length > 0 && (
                <ReportSection label={sectionLabels.contentCalendar}>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {marketing.contentCalendar30Day.slice(0, 8).map((entry) => (
                      <li
                        key={entry.day}
                        className="rounded-xl border border-border bg-muted/20 p-3 text-sm text-muted-foreground"
                      >
                        <span className="font-medium text-foreground">
                          Tag {entry.day}:
                        </span>{" "}
                        {entry.title} · {entry.channel}
                      </li>
                    ))}
                  </ul>
                </ReportSection>
              )}

              {marketing.launchKpis.length > 0 && (
                <ReportSection label={sectionLabels.launchKpis}>
                  <ul className="space-y-2">
                    {marketing.launchKpis.map((kpi) => (
                      <li
                        key={kpi.metric}
                        className="rounded-xl border border-border bg-muted/20 p-4 text-sm"
                      >
                        <span className="font-medium text-foreground">
                          {kpi.metric}
                        </span>
                        {" — "}
                        {kpi.target}
                      </li>
                    ))}
                  </ul>
                </ReportSection>
              )}

              {marketing.budgetAllocation.length > 0 && (
                <ReportSection label={sectionLabels.budgetAllocation}>
                  <ul className="space-y-2">
                    {marketing.budgetAllocation.map((item) => (
                      <li
                        key={item.category}
                        className="flex justify-between rounded-xl border border-border bg-muted/20 p-4 text-sm"
                      >
                        <span className="text-foreground">{item.category}</span>
                        <span className="text-primary">{item.allocation}</span>
                      </li>
                    ))}
                  </ul>
                </ReportSection>
              )}
            </>
          ) : isDesignReport && design ? (
            <>
              <ReportSection label={sectionLabels.collectionName}>
                <p className="text-base font-medium text-foreground">
                  {design.collectionName}
                </p>
              </ReportSection>

              <ReportSection label={sectionLabels.collectionStory}>
                <p className="text-base leading-relaxed text-muted-foreground">
                  {design.collectionStory}
                </p>
              </ReportSection>

              {design.colorPalette.length > 0 && (
                <ReportSection label={sectionLabels.colorPalette}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {design.colorPalette.map((color) => (
                      <div
                        key={`${color.name}-${color.role}`}
                        className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground"
                      >
                        <span className="font-medium text-foreground">
                          {color.name}
                        </span>
                        {" — "}
                        {color.role}
                        {color.hex ? ` (${color.hex})` : ""}
                      </div>
                    ))}
                  </div>
                </ReportSection>
              )}

              {design.silhouettes.length > 0 && (
                <ReportSection label={sectionLabels.silhouettes}>
                  <BulletList items={design.silhouettes} />
                </ReportSection>
              )}

              {design.productLineup.length > 0 && (
                <ReportSection label={sectionLabels.productLineup}>
                  <ul className="space-y-3">
                    {design.productLineup.map((product) => (
                      <li
                        key={product.name}
                        className="rounded-xl border border-border bg-muted/20 p-4"
                      >
                        <p className="font-medium text-foreground">
                          {product.name}{" "}
                          <span className="text-sm font-normal text-muted-foreground">
                            · {product.category}
                          </span>
                        </p>
                        <p className="mt-1 text-base text-muted-foreground">
                          {product.description}
                        </p>
                      </li>
                    ))}
                  </ul>
                </ReportSection>
              )}

              {design.heroProducts.length > 0 && (
                <ReportSection label={sectionLabels.heroProducts}>
                  <ul className="space-y-3">
                    {design.heroProducts.map((hero) => (
                      <li
                        key={hero.name}
                        className="rounded-xl border border-primary/20 bg-primary/5 p-4"
                      >
                        <p className="font-medium text-foreground">{hero.name}</p>
                        <p className="mt-1 text-base text-muted-foreground">
                          {hero.description}
                        </p>
                        <p className="mt-1 text-sm text-primary/80">
                          {hero.rationale}
                        </p>
                      </li>
                    ))}
                  </ul>
                </ReportSection>
              )}

              {design.materials.length > 0 && (
                <ReportSection label={sectionLabels.materials}>
                  <BulletList items={design.materials} />
                </ReportSection>
              )}

              <ReportSection label={sectionLabels.designDirection}>
                <p className="text-base leading-relaxed text-muted-foreground">
                  {design.designDirection}
                </p>
              </ReportSection>

              {design.launchRecommendations.length > 0 && (
                <ReportSection label={sectionLabels.launchRecommendations}>
                  <BulletList items={design.launchRecommendations} />
                </ReportSection>
              )}
            </>
          ) : (
            <>
              <ReportSection label={sectionLabels.executiveSummary}>
                <p className="text-base leading-relaxed text-muted-foreground">
                  {executiveSummary}
                </p>
              </ReportSection>

              {keyFindings.length > 0 && (
                <ReportSection
                  label={
                    isCeoReport
                      ? sectionLabels.keyInsights
                      : sectionLabels.keyFindings
                  }
                >
                  <BulletList items={keyFindings} />
                </ReportSection>
              )}
            </>
          )}

          {!isDesignReport &&
            !isMarketingReport &&
            !isShopifyReport &&
            !isContentReport &&
            !isImageReport &&
            opportunities.length > 0 && (
            <ReportSection label={sectionLabels.strategicOpportunities}>
              <BulletList items={opportunities} />
            </ReportSection>
          )}

          {!isDesignReport &&
            !isMarketingReport &&
            !isShopifyReport &&
            !isContentReport &&
            !isImageReport &&
            risks.length > 0 && (
            <ReportSection label={sectionLabels.risks}>
              <BulletList items={risks} />
            </ReportSection>
          )}

          {!isDesignReport &&
            !isMarketingReport &&
            !isShopifyReport &&
            !isContentReport &&
            !isImageReport &&
            nextSteps.length > 0 && (
            <ReportSection label={sectionLabels.nextSteps}>
              <ul className="space-y-3">
                {nextSteps.map((step) => (
                  <li
                    key={step.action}
                    className="rounded-xl border border-border bg-muted/20 p-5"
                  >
                    <div className="flex flex-wrap items-start gap-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 font-normal",
                          PRIORITY_STYLES[step.priority],
                        )}
                      >
                        {priorityLabels[step.priority]}
                      </Badge>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-base text-foreground">
                          {step.action}
                        </p>
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
            </ReportSection>
          )}

          {!isDesignReport &&
            !isMarketingReport &&
            !isShopifyReport &&
            !isContentReport &&
            !isImageReport &&
            recommendations.length > 0 && (
            <ReportSection label={sectionLabels.recommendations}>
              <BulletList items={recommendations} />
            </ReportSection>
          )}

          <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4 text-sm text-muted-foreground">
            <span>{agentName}</span>
            {report.drop && <span>{report.drop}</span>}
            <div className="ml-auto flex items-center gap-3">
              <span className="text-label text-primary/70">
                {sectionLabels.confidence}
              </span>
              <Progress value={report.confidence * 100} className="h-1 w-20" />
              <span className="tabular-nums">
                {Math.round(report.confidence * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportList({
  reports,
  categoryLabels,
  agentNames,
  getStatusLabel,
  emptyLabel,
  reportTypeLabels,
  ceoReportTypeLabel,
  designReportTypeLabel,
  marketingReportTypeLabel,
  shopifyReportTypeLabel,
  contentReportTypeLabel,
  imageReportTypeLabel,
  priorityLabels,
  sectionLabels,
}: {
  reports: ReportListItem[];
  categoryLabels: ReturnType<typeof getReportCategoryLabels>;
  agentNames: Record<string, string>;
  getStatusLabel: (status: ReportListItem["status"]) => string;
  emptyLabel: string;
  reportTypeLabels: Record<ResearchReportType, string>;
  ceoReportTypeLabel: string;
  designReportTypeLabel: string;
  marketingReportTypeLabel: string;
  shopifyReportTypeLabel: string;
  contentReportTypeLabel: string;
  imageReportTypeLabel: string;
  priorityLabels: Record<CeoStepPriority, string>;
  sectionLabels: {
    executiveSummary: string;
    keyFindings: string;
    keyInsights: string;
    recommendations: string;
    strategicOpportunities: string;
    risks: string;
    nextSteps: string;
    collectionName: string;
    collectionStory: string;
    colorPalette: string;
    silhouettes: string;
    productLineup: string;
    heroProducts: string;
    materials: string;
    designDirection: string;
    launchRecommendations: string;
    launchStrategy: string;
    contentPillars: string;
    tiktokIdeas: string;
    instagramIdeas: string;
    influencerStrategy: string;
    emailCampaignPlan: string;
    communityBuildingPlan: string;
    contentCalendar: string;
    launchKpis: string;
    budgetAllocation: string;
    collectionDescription: string;
    collectionSeo: string;
    products: string;
    collectionsToCreate: string;
    navigationRecommendations: string;
    homepageRecommendations: string;
    launchChecklist: string;
    storefrontWarnings: string;
    brandNarrative: string;
    landingPage: string;
    heroHeadline: string;
    productCopy: string;
    emailSequence: string;
    socialContent: string;
    instagramCaptions: string;
    tiktokHooks: string;
    storyIdeas: string;
    launchPosts: string;
    smsCampaign: string;
    confidence: string;
    projectName: string;
    visualDirection: string;
    moodboard: string;
    campaignConcept: string;
    assets: string;
    assetPrompt: string;
    assetType: string;
    assetPlatform: string;
    assetDimensions: string;
  };
}) {
  if (reports.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-20 text-center text-base text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {reports.map((report) => (
        <ReportCard
          key={report.id}
          report={report}
          categoryLabel={categoryLabels[report.category]}
          agentName={agentNames[report.agentId]}
          statusLabel={getStatusLabel(report.status)}
          reportTypeLabels={reportTypeLabels}
          ceoReportTypeLabel={ceoReportTypeLabel}
          designReportTypeLabel={designReportTypeLabel}
          marketingReportTypeLabel={marketingReportTypeLabel}
          shopifyReportTypeLabel={shopifyReportTypeLabel}
          contentReportTypeLabel={contentReportTypeLabel}
          imageReportTypeLabel={imageReportTypeLabel}
          priorityLabels={priorityLabels}
          sectionLabels={sectionLabels}
        />
      ))}
    </div>
  );
}

export function ReportHub() {
  const locale = useLocale();
  const t = useT();
  const workspace = useWorkspace();
  const { common, reports: reportsCopy } = useDictionary();
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categoryLabels = getReportCategoryLabels(locale);
  const reportTypeLabels = getResearchReportTypeLabels(locale);
  const ceoReportTypeLabel = getCeoReportTypeLabel(locale);
  const designReportTypeLabel = getDesignReportTypeLabel(locale);
  const marketingReportTypeLabel = getMarketingReportTypeLabel(locale);
  const shopifyReportTypeLabel = getShopifyReportTypeLabel(locale);
  const contentReportTypeLabel = getContentReportTypeLabel(locale);
  const imageReportTypeLabel = getImageReportTypeLabel(locale);
  const priorityLabels = getCeoPriorityLabels(locale);
  const agentCatalog = getAgentCatalog(locale);
  const agentNames = Object.fromEntries(
    Object.values(agentCatalog).map((a) => [a.id, a.name]),
  );
  const getStatusLabel = (status: ReportListItem["status"]) =>
    getReportStatusLabel(locale, status);
  const sectionLabels = reportsCopy.hub.sections;

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/reports");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? t("research.errors.unexpected"));
      }

      setReports(data.reports ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("research.errors.unexpected"),
      );
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadReports();
  }, [loadReports, workspace.slug]);

  const categories = [
    "all",
    "research",
    "design",
    "marketing",
    "commerce",
    "content",
    "image",
    "operations",
  ] as const;

  const counts: Record<(typeof categories)[number], number> = {
    all: reports.length,
    research: reports.filter((r) => r.category === "research").length,
    design: reports.filter((r) => r.category === "design").length,
    marketing: reports.filter((r) => r.category === "marketing").length,
    commerce: reports.filter((r) => r.category === "commerce").length,
    content: reports.filter((r) => r.category === "content").length,
    image: reports.filter((r) => r.category === "image").length,
    operations: reports.filter((r) => r.category === "operations").length,
  };

  return (
    <div className="space-y-10">
      <SectionHeading
        label={reportsCopy.hub.label}
        title={reportsCopy.hub.title}
        description={reportsCopy.hub.description}
        action={
          <p className="text-sm text-muted-foreground">
            {t("dashboard.command.activeWorkspace", {
              workspace: workspace.name,
            })}
          </p>
        }
      />

      {isLoading && (
        <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-base">{t("research.interface.running")}</span>
        </div>
      )}

      {error && !isLoading && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!isLoading && (
        <Tabs defaultValue="all" className="space-y-8">
          <TabsList className="h-12 bg-muted/30 p-1">
            {categories.map((cat) => (
              <TabsTrigger key={cat} value={cat} className="gap-2 px-5 text-base">
                {cat === "all" ? common.reportCategory.all : categoryLabels[cat]}
                <span className="text-sm text-muted-foreground">{counts[cat]}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((cat) => (
            <TabsContent key={cat} value={cat}>
              <ReportList
                reports={
                  cat === "all"
                    ? reports
                    : reports.filter((r) => r.category === cat)
                }
                categoryLabels={categoryLabels}
                agentNames={agentNames}
                getStatusLabel={getStatusLabel}
                emptyLabel={reportsCopy.hub.empty}
                reportTypeLabels={reportTypeLabels}
                ceoReportTypeLabel={ceoReportTypeLabel}
                designReportTypeLabel={designReportTypeLabel}
                marketingReportTypeLabel={marketingReportTypeLabel}
                shopifyReportTypeLabel={shopifyReportTypeLabel}
                contentReportTypeLabel={contentReportTypeLabel}
                imageReportTypeLabel={imageReportTypeLabel}
                priorityLabels={priorityLabels}
                sectionLabels={sectionLabels}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
