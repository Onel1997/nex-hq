"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { ResearchReportType } from "@/brain/domains/reports";
import { ResearchHeroStatus } from "@/components/research/research-hero-status";
import { ResearchIntelligenceBrain } from "@/components/research/research-intelligence-brain";
import { ResearchIntelligenceDashboard } from "@/components/research/research-intelligence-dashboard";
import { ResearchMicroIndicators } from "@/components/research/research-micro-indicators";
import { useResearchBrain } from "@/components/research/use-research-brain";
import { useWorkspaceContext } from "@/components/workspace/use-workspace-context";
import { getResearchReportTypeLabels } from "@/lib/i18n/data";
import { useLocale, useT, useWorkspace } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface DesignBriefSummary {
  collectionIdea: string;
  productSuggestions?: string[];
  recommendedProducts?: string[];
  recommendedColors?: string[];
  recommendedMaterials?: string[];
  recommendedPrintAreas?: string[];
  targetAudience?: string;
  styleDirection?: string;
  designs?: string[];
  trendScore?: number;
  competitorScore?: number;
  confidence?: number;
}

interface DesignConcept {
  product?: string;
  color?: string;
  printPosition?: string;
  styleDirection?: string;
  emotion?: string;
  targetAudience?: string;
  summary: string;
}

interface ResearchReportResult {
  outputKind: "research";
  reportId: string;
  title: string;
  executiveSummary?: string;
  keyFindings?: string[];
  opportunities?: string[];
  risks?: string[];
  recommendations?: string[];
  confidence?: number;
  reportType?: ResearchReportType;
  savedDomains: string[];
  designBrief?: DesignBriefSummary;
}

interface DesignReportResult {
  outputKind: "design";
  reportId: string;
  title: string;
  designs?: string[];
  products?: string[];
  colors?: string[];
  materials?: string[];
  printAreas?: string[];
  rationale?: string;
  confidence?: number;
  savedDomains: string[];
  designBrief?: DesignBriefSummary;
}

type ResearchResult = ResearchReportResult | DesignReportResult;

const REPORT_TYPE_STYLES: Record<ResearchReportType, string> = {
  competitor: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  trend: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  pricing: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  audience: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  design: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function pickAt<T>(values: T[] | undefined, index: number): T | undefined {
  if (!values || values.length === 0) return undefined;
  return values[index] ?? values[0];
}

function normalizeDesignConcept(
  entry: unknown,
  index: number,
  result: DesignReportResult,
): DesignConcept {
  const brief = result.designBrief;
  const fallbackProducts =
    result.products ??
    brief?.recommendedProducts ??
    brief?.productSuggestions ??
    [];
  const fallbackColors = result.colors ?? brief?.recommendedColors ?? [];
  const fallbackPrintAreas =
    result.printAreas ?? brief?.recommendedPrintAreas ?? [];
  const fallbackAudience = brief?.targetAudience;

  if (entry && typeof entry === "object" && !Array.isArray(entry)) {
    const concept = entry as Record<string, unknown>;
    return {
      product: asOptionalString(concept.product),
      color: asOptionalString(concept.color),
      printPosition: asOptionalString(
        concept.printPosition ?? concept.printArea ?? concept.printAreas,
      ),
      styleDirection: asOptionalString(
        concept.styleDirection ?? concept.style ?? concept.direction,
      ),
      emotion: asOptionalString(concept.emotion ?? concept.mood),
      targetAudience: asOptionalString(concept.targetAudience),
      summary:
        asOptionalString(
          concept.summary ?? concept.title ?? concept.description ?? concept.concept,
        ) ?? "",
    };
  }

  const summary = String(entry ?? "").trim();

  return {
    product: pickAt(fallbackProducts, index),
    color: pickAt(fallbackColors, index),
    printPosition: pickAt(fallbackPrintAreas, index),
    styleDirection: summary || brief?.styleDirection,
    targetAudience: fallbackAudience,
    summary: summary || brief?.collectionIdea || result.title,
  };
}

function parseResearchApiResponse(data: Record<string, unknown>): ResearchResult {
  const outputKind =
    data.outputKind === "design" || data.kind === "design" ? "design" : "research";

  const base = {
    reportId: String(data.reportId ?? ""),
    title: String(data.title ?? "Research Report"),
    savedDomains: Array.isArray(data.savedDomains)
      ? data.savedDomains.map(String)
      : [],
    designBrief: data.designBrief as DesignBriefSummary | undefined,
    confidence:
      typeof data.confidence === "number" ? data.confidence : undefined,
  };

  if (outputKind === "design") {
    return {
      ...base,
      outputKind: "design",
      designs: Array.isArray(data.designs) ? data.designs.map(String) : [],
      products: Array.isArray(data.products)
        ? data.products.map(String)
        : undefined,
      colors: Array.isArray(data.colors) ? data.colors.map(String) : undefined,
      materials: Array.isArray(data.materials)
        ? data.materials.map(String)
        : undefined,
      printAreas: Array.isArray(data.printAreas)
        ? data.printAreas.map(String)
        : undefined,
      rationale: asOptionalString(data.rationale),
    };
  }

  return {
    ...base,
    outputKind: "research",
    executiveSummary: asOptionalString(data.executiveSummary),
    keyFindings: Array.isArray(data.keyFindings)
      ? data.keyFindings.map(String)
      : [],
    opportunities: Array.isArray(data.opportunities)
      ? data.opportunities.map(String)
      : [],
    risks: Array.isArray(data.risks) ? data.risks.map(String) : [],
    recommendations: Array.isArray(data.recommendations)
      ? data.recommendations.map(String)
      : [],
    reportType: data.reportType as ResearchReportType | undefined,
  };
}

function DesignConceptCard({
  concept,
  index,
  labels,
}: {
  concept: DesignConcept;
  index: number;
  labels: {
    product: string;
    color: string;
    printPosition: string;
    styleDirection: string;
    emotion: string;
    targetAudience: string;
  };
}) {
  const fields = [
    { label: labels.product, value: concept.product },
    { label: labels.color, value: concept.color },
    { label: labels.printPosition, value: concept.printPosition },
    { label: labels.styleDirection, value: concept.styleDirection },
    { label: labels.emotion, value: concept.emotion },
    { label: labels.targetAudience, value: concept.targetAudience },
  ].filter((field) => field.value);

  return (
    <article className="space-y-3 rounded-xl border border-border bg-muted/20 p-5">
      <p className="text-label text-primary/80">Konzept {index + 1}</p>
      {concept.summary ? (
        <p className="font-display text-lg font-medium leading-snug">
          {concept.summary}
        </p>
      ) : null}
      {fields.length > 0 ? (
        <dl className="grid gap-2 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label} className="space-y-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {field.label}
              </dt>
              <dd className="text-sm text-foreground">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  );
}

function ResearchReportPanel({
  result,
  reportTypeLabels,
  t,
}: {
  result: ResearchReportResult;
  reportTypeLabels: Record<ResearchReportType, string>;
  t: ReturnType<typeof useT>;
}) {
  const keyFindings = result.keyFindings ?? [];
  const recommendations = result.recommendations ?? [];
  const confidence = result.confidence ?? 0;
  const reportType = result.reportType ?? "trend";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={cn("font-normal", REPORT_TYPE_STYLES[reportType])}
        >
          {reportTypeLabels[reportType]}
        </Badge>
      </div>

      {result.executiveSummary ? (
        <div className="space-y-2">
          <p className="text-label text-primary/80">
            {t("research.interface.executiveSummary")}
          </p>
          <p className="text-base leading-relaxed text-muted-foreground">
            {result.executiveSummary}
          </p>
        </div>
      ) : null}

      {keyFindings.length > 0 ? (
        <div className="space-y-2">
          <p className="text-label text-primary/80">
            {t("research.interface.keyFindings")}
          </p>
          <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-5">
            {keyFindings.map((finding, index) => (
              <li
                key={`${finding}-${index}`}
                className="flex gap-3 text-base text-muted-foreground"
              >
                <span className="research-bullet-dot mt-2.5 size-1.5 shrink-0 rounded-full" />
                {finding}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {recommendations.length > 0 ? (
        <div className="space-y-2">
          <p className="text-label text-primary/80">
            {t("research.interface.recommendations")}
          </p>
          <ul className="space-y-2 rounded-xl border border-border bg-muted/20 p-5">
            {recommendations.map((item, index) => (
              <li
                key={`${item}-${index}`}
                className="flex gap-3 text-base text-muted-foreground"
              >
                <span className="research-bullet-dot mt-2.5 size-1.5 shrink-0 rounded-full" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.designBrief ? (
        <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-5">
          <p className="text-label text-primary">
            {t("research.brain.aiRecommendation.label")}
          </p>
          <p className="font-display text-xl font-medium">
            {result.designBrief.collectionIdea}
          </p>
          {(result.designBrief.productSuggestions ?? []).length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {(result.designBrief.productSuggestions ?? []).join(" · ")}
            </p>
          ) : null}
          {result.designBrief.confidence != null ? (
            <p className="text-xs text-muted-foreground">
              {t("research.brain.aiRecommendation.fit")}:{" "}
              {result.designBrief.confidence}% · Trend:{" "}
              {result.designBrief.trendScore ?? "—"}% · Konkurrenz:{" "}
              {result.designBrief.competitorScore ?? "—"}%
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
        <p className="text-sm text-muted-foreground">
          {t("research.interface.savedDomains", {
            domains: (result.savedDomains ?? []).join(", "),
          })}
        </p>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {t("research.interface.confidence")}
          </span>
          <Progress value={confidence * 100} className="h-1 w-20" />
          <span className="tabular-nums text-sm">
            {Math.round(confidence * 100)}%
          </span>
        </div>
        <Link
          href="/facility/reports"
          className="inline-flex items-center gap-2 text-base text-primary hover:underline"
        >
          {t("research.interface.viewReports")}
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </>
  );
}

function DesignReportPanel({
  result,
  reportTypeLabels,
  t,
}: {
  result: DesignReportResult;
  reportTypeLabels: Record<ResearchReportType, string>;
  t: ReturnType<typeof useT>;
}) {
  const rawDesigns = result.designs ?? result.designBrief?.designs ?? [];
  const concepts = rawDesigns.map((entry, index) =>
    normalizeDesignConcept(entry, index, result),
  );
  const confidence = result.confidence ?? (result.designBrief?.confidence ?? 0) / 100;
  const conceptLabels = {
    product: t("research.interface.designConcept.product"),
    color: t("research.interface.designConcept.color"),
    printPosition: t("research.interface.designConcept.printPosition"),
    styleDirection: t("research.interface.designConcept.styleDirection"),
    emotion: t("research.interface.designConcept.emotion"),
    targetAudience: t("research.interface.designConcept.targetAudience"),
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={cn("font-normal", REPORT_TYPE_STYLES.design)}
        >
          {reportTypeLabels.design ?? t("research.interface.designReport")}
        </Badge>
      </div>

      {result.rationale ? (
        <div className="space-y-2">
          <p className="text-label text-primary/80">
            {t("research.interface.executiveSummary")}
          </p>
          <p className="text-base leading-relaxed text-muted-foreground">
            {result.rationale}
          </p>
        </div>
      ) : null}

      {result.designBrief ? (
        <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-5">
          <p className="text-label text-primary">
            {t("research.brain.aiRecommendation.label")}
          </p>
          <p className="font-display text-xl font-medium">
            {result.designBrief.collectionIdea}
          </p>
          {(result.designBrief.recommendedProducts ??
            result.designBrief.productSuggestions ??
            result.products ??
            []
          ).length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {(
                result.designBrief.recommendedProducts ??
                result.designBrief.productSuggestions ??
                result.products ??
                []
              ).join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {concepts.length > 0 ? (
        <div className="space-y-3">
          <p className="text-label text-primary/80">
            {t("research.interface.designConcepts")}
          </p>
          <div className="grid gap-4">
            {concepts.map((concept, index) => (
              <DesignConceptCard
                key={`${concept.summary}-${index}`}
                concept={concept}
                index={index}
                labels={conceptLabels}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
        <p className="text-sm text-muted-foreground">
          {t("research.interface.savedDomains", {
            domains: (result.savedDomains ?? []).join(", "),
          })}
        </p>
        {confidence > 0 ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {t("research.interface.confidence")}
            </span>
            <Progress
              value={confidence <= 1 ? confidence * 100 : confidence}
              className="h-1 w-20"
            />
            <span className="tabular-nums text-sm">
              {Math.round(confidence <= 1 ? confidence * 100 : confidence)}%
            </span>
          </div>
        ) : null}
        <Link
          href="/facility/reports"
          className="inline-flex items-center gap-2 text-base text-primary hover:underline"
        >
          {t("research.interface.viewReports")}
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </>
  );
}

export function ResearchInterface() {
  const t = useT();
  const locale = useLocale();
  const workspace = useWorkspace();
  const reportTypeLabels = getResearchReportTypeLabels(locale);
  const { data: contextData, loading: contextLoading } =
    useWorkspaceContext("research");
  const { snapshot: brainSnapshot, loading: brainLoading } = useResearchBrain();
  const [request, setRequest] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchResult | null>(null);

  const missions = [
    {
      label: t("research.missions.summerTrends"),
      action: t("research.missions.summerTrendsAction"),
    },
    {
      label: t("research.missions.competitors"),
      action: t("research.missions.competitorsAction"),
    },
    {
      label: t("research.missions.audience"),
      action: t("research.missions.audienceAction"),
    },
    {
      label: t("research.missions.streetwear"),
      action: t("research.missions.streetwearAction"),
    },
    {
      label: t("research.missions.productOpportunities"),
      action: t("research.missions.productOpportunitiesAction"),
    },
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

        setResult(parseResearchApiResponse(data));
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
    <section className="research-hq-bridge space-y-7">
      <ResearchMicroIndicators />

      <div className="command-interface research-hero-observatory overflow-hidden">
        <div className="research-hero-observatory-grid">
          <div className="research-hero-observatory-main">
            <div className="research-hero-observatory-meta">
              <p className="text-label text-primary/80">
                {t("research.interface.label")}
              </p>
              <span className="research-hero-observatory-divider" aria-hidden>
                ·
              </span>
              <p className="text-sm text-muted-foreground">
                {workspace.name}
              </p>
            </div>

            <h2 className="command-interface-headline research-hero-observatory-headline">
              {t("research.interface.headline")}
            </h2>

            <form onSubmit={handleSubmit} className="research-hero-observatory-form">
              <textarea
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                placeholder={t("research.interface.placeholder")}
                rows={2}
                disabled={isLoading}
                className={cn(
                  "research-hero-observatory-input w-full resize-none rounded-xl border border-border",
                  "bg-background/40 px-4 py-2.5 text-base text-foreground",
                  "placeholder:text-muted-foreground/60",
                  "focus:outline-none focus:ring-2 focus:ring-primary/25",
                  "disabled:opacity-60",
                )}
              />
              <div className="research-hero-observatory-actions">
                <button
                  type="submit"
                  disabled={isLoading || !request.trim()}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2",
                    "text-sm font-medium text-primary-foreground transition-opacity",
                    "disabled:opacity-40",
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )}
                  {isLoading
                    ? t("research.interface.running")
                    : t("research.interface.submit")}
                </button>
                <p className="text-xs text-muted-foreground">
                  {t("research.interface.poweredBy")}
                </p>
              </div>
            </form>

            {error && (
              <p className="research-hero-observatory-error rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}
          </div>

          <ResearchHeroStatus
            data={contextData}
            isLoading={contextLoading}
            integrated
          />
        </div>
      </div>

      <ResearchIntelligenceDashboard
        data={contextData}
        isLoading={contextLoading}
      />

      <ResearchIntelligenceBrain
        snapshot={brainSnapshot}
        loading={brainLoading}
      />

      <div className="space-y-3">
        <p className="text-label">{t("research.missions.label")}</p>
        <div className="flex flex-wrap gap-2">
          {missions.map(({ label, action }) => (
            <button
              key={label}
              type="button"
              onClick={() => runResearch(action)}
              disabled={isLoading}
              className="research-intelligence-mission research-intelligence-mission-compact"
            >
              <span className="research-intelligence-mission-dot" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      {result && (
        <div className="research-result-surface luxury-surface-elevated space-y-6 rounded-2xl p-8">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="mt-1 size-6 shrink-0 text-primary" />
            <div className="space-y-3">
              <p className="text-label text-primary">
                {t("research.interface.success")}
              </p>
              <h3 className="font-display text-3xl font-medium">
                {result.title}
              </h3>
            </div>
          </div>

          {result.outputKind === "design" ? (
            <DesignReportPanel
              result={result}
              reportTypeLabels={reportTypeLabels}
              t={t}
            />
          ) : (
            <ResearchReportPanel
              result={result}
              reportTypeLabels={reportTypeLabels}
              t={t}
            />
          )}
        </div>
      )}
    </section>
  );
}
