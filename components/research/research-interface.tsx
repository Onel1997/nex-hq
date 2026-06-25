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
import type { DesignConcept, ResearchCollection } from "@/agents/research/types";
import { COLLECTION_ARC, normalizeCommercialConfidence } from "@/agents/research/types";
import {
  coerceConceptField,
  formatColorBreakdown,
  normalizeDesignConcepts,
} from "@/agents/research/design-concept";
import { Progress } from "@/components/ui/progress";

function displayCollectionRole(
  design: DesignConcept,
  heroDesignId?: string,
): string {
  if (heroDesignId && design.designId === heroDesignId) {
    return "Hero Piece";
  }
  return design.collectionRole;
}

interface DesignBriefSummary {
  collectionIdea: string;
  productSuggestions?: string[];
  recommendedProducts?: string[];
  recommendedColors?: string[];
  recommendedMaterials?: string[];
  recommendedPrintAreas?: string[];
  targetAudience?: string;
  styleDirection?: string;
  designs?: unknown[];
  trendScore?: number;
  competitorScore?: number;
  confidence?: number;
}

interface DesignReportResult {
  outputKind: "design";
  reportId: string;
  title: string;
  designs?: DesignConcept[];
  collection?: ResearchCollection;
  products?: string[];
  colors?: string[];
  materials?: string[];
  printAreas?: string[];
  rationale?: string;
  confidence?: number;
  savedDomains: string[];
  designBrief?: DesignBriefSummary;
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

function buildDesignConceptContext(result: DesignReportResult) {
  const brief = result.designBrief;
  return {
    title: result.title,
    products:
      result.products ??
      brief?.recommendedProducts ??
      brief?.productSuggestions,
    colors: result.colors ?? brief?.recommendedColors,
    printAreas: result.printAreas ?? brief?.recommendedPrintAreas,
    styleDirection: brief?.styleDirection,
    targetAudience: brief?.targetAudience,
    collectionIdea: brief?.collectionIdea,
  };
}

function coerceFinalizedDesignConcepts(
  designs: unknown[] | undefined,
): DesignConcept[] {
  if (!Array.isArray(designs)) return [];

  return designs.filter(
    (entry): entry is DesignConcept =>
      Boolean(entry) &&
      typeof entry === "object" &&
      !Array.isArray(entry) &&
      typeof (entry as DesignConcept).designId === "string" &&
      typeof (entry as DesignConcept).title === "string" &&
      typeof (entry as DesignConcept).collectionRole === "string",
  );
}

function parseDesignConcepts(
  designs: unknown[] | undefined,
  result: DesignReportResult,
): DesignConcept[] {
  const finalized = coerceFinalizedDesignConcepts(designs);
  if (finalized.length > 0) {
    return finalized;
  }

  return (
    normalizeDesignConcepts(designs, buildDesignConceptContext(result)) ?? []
  );
}

function parseResearchApiResponse(data: Record<string, unknown>): ResearchResult {
  const outputKind =
    data.outputKind === "design" || data.kind === "design" ? "design" : "research";

  const base = {
    reportId: String(data.reportId ?? ""),
    title: coerceConceptField(data.title ?? "Research Report"),
    savedDomains: Array.isArray(data.savedDomains)
      ? data.savedDomains.map(String)
      : [],
    designBrief: data.designBrief as DesignBriefSummary | undefined,
    confidence:
      typeof data.confidence === "number" ? data.confidence : undefined,
  };

  if (outputKind === "design") {
    const designResult: DesignReportResult = {
      ...base,
      outputKind: "design",
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
      collection: data.collection as ResearchCollection | undefined,
      designs: [],
      savedDomains: base.savedDomains,
    };

    return {
      ...designResult,
      designs: parseDesignConcepts(
        Array.isArray(data.designs) ? data.designs : [],
        designResult,
      ),
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
  heroDesignId,
}: {
  concept: DesignConcept;
  index: number;
  heroDesignId?: string;
  labels: {
    creativeApproach: string;
    emotion: string;
    visualConcept: string;
    designDescription: string;
    message: string;
    typography: string;
    printTechnique: string;
    printSize: string;
    placementDimensions: string;
    productionDifficulty: string;
    garmentInspiration: string;
    brandInspiration: string;
    visualReferences: string;
    production: string;
    inspiration: string;
    artDirection: string;
    exactComposition: string;
    graphicElements: string;
    elementCount: string;
    layoutDescription: string;
    visualHierarchy: string;
    colorBreakdown: string;
    materialEffects: string;
    negativeSpaceUsage: string;
    designInstructions: string;
    mockupDescription: string;
    visualDna: string;
    geometry: string;
    dimensions: string;
    coordinates: string;
    rotation: string;
    spacing: string;
    strokeWidth: string;
    opacity: string;
    layerOrder: string;
    contrastLevel: string;
    textureIntensity: string;
    visualWeight: string;
    balance: string;
    alignment: string;
    focalPoint: string;
    edgeTreatment: string;
    milaeneDna: string;
    dnaScore: string;
    dnaMatches: string;
    dnaConflicts: string;
    whyFitsMilaene: string;
    collectionRole: string;
    repeatabilityScore: string;
    imagePromptCore: string;
    supportsDesignId: string;
    relationshipReason: string;
    emotionalNarrative: string;
    emotionalKeyword: string;
    storyPosition: string;
    commercialScore: string;
    campaignPotential: string;
    heroScore: string;
    product: string;
    color: string;
    printArea: string;
    targetAudience: string;
  };
}) {
  const displayRole = displayCollectionRole(concept, heroDesignId);
  const isHero = displayRole === "Hero Piece";
  const roleBadgeClass =
    displayRole === "Hero Piece"
      ? "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200"
      : displayRole === "Limited Piece"
        ? "border-violet-500/30 bg-violet-500/10 text-violet-800 dark:text-violet-200"
        : "";

  const narrativeFields = [
    { label: labels.emotion, value: concept.emotion },
    { label: labels.visualConcept, value: concept.visualConcept },
    { label: labels.designDescription, value: concept.designDescription },
    { label: labels.message, value: concept.message },
    { label: labels.typography, value: concept.typography },
  ].filter((field) => field.value);

  const productionFields = [
    { label: labels.printTechnique, value: concept.printTechnique },
    { label: labels.printSize, value: concept.printSize },
    { label: labels.placementDimensions, value: concept.placementDimensions },
    {
      label: labels.productionDifficulty,
      value: concept.productionDifficulty,
    },
  ].filter((field) => field.value);

  const inspirationFields = [
    { label: labels.garmentInspiration, value: concept.garmentInspiration },
    { label: labels.brandInspiration, value: concept.brandInspiration },
    { label: labels.visualReferences, value: concept.visualReferences },
  ].filter((field) => field.value);

  const artDirectionFields = [
    { label: labels.exactComposition, value: concept.exactComposition },
    { label: labels.elementCount, value: concept.elementCount },
    { label: labels.layoutDescription, value: concept.layoutDescription },
    { label: labels.visualHierarchy, value: concept.visualHierarchy },
    {
      label: labels.colorBreakdown,
      value:
        concept.colorBreakdown.length > 0
          ? formatColorBreakdown(concept.colorBreakdown)
          : "",
    },
    { label: labels.materialEffects, value: concept.materialEffects },
    { label: labels.negativeSpaceUsage, value: concept.negativeSpaceUsage },
    { label: labels.mockupDescription, value: concept.mockupDescription },
  ].filter((field) => field.value);

  const visualDnaFields = [
    { label: labels.geometry, value: concept.geometry },
    { label: labels.dimensions, value: concept.dimensions },
    { label: labels.coordinates, value: concept.coordinates },
    { label: labels.rotation, value: concept.rotation },
    { label: labels.spacing, value: concept.spacing },
    { label: labels.strokeWidth, value: concept.strokeWidth },
    { label: labels.opacity, value: concept.opacity },
    { label: labels.layerOrder, value: concept.layerOrder },
    { label: labels.contrastLevel, value: concept.contrastLevel },
    { label: labels.textureIntensity, value: concept.textureIntensity },
    { label: labels.visualWeight, value: concept.visualWeight },
    { label: labels.balance, value: concept.balance },
    { label: labels.alignment, value: concept.alignment },
    { label: labels.focalPoint, value: concept.focalPoint },
    { label: labels.edgeTreatment, value: concept.edgeTreatment },
  ].filter((field) => field.value);

  const productFields = [
    { label: labels.product, value: concept.product },
    { label: labels.color, value: concept.color },
    { label: labels.printArea, value: concept.printArea },
    { label: labels.targetAudience, value: concept.targetAudience },
  ].filter((field) => field.value);

  return (
    <article className="space-y-4 rounded-xl border border-border bg-muted/20 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-label text-primary/80">Konzept {index + 1}</p>
        <Badge variant="secondary" className="font-normal">
          {concept.creativeApproach}
        </Badge>
        {isHero ? (
          <Badge className="border-amber-500/40 bg-amber-500/15 font-normal text-amber-800 dark:text-amber-200">
            Hero Piece
          </Badge>
        ) : displayRole ? (
          <Badge variant="outline" className={cn("font-normal", roleBadgeClass)}>
            {displayRole}
          </Badge>
        ) : null}
        {concept.storyPosition ? (
          <Badge variant="outline" className="font-normal text-muted-foreground">
            {concept.storyPosition}
          </Badge>
        ) : null}
      </div>
      <h4 className="font-display text-xl font-medium leading-snug">
        {concept.title}
      </h4>
      {narrativeFields.length > 0 ? (
        <dl className="space-y-3">
          {narrativeFields.map((field) => (
            <div key={field.label} className="space-y-1">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {field.label}
              </dt>
              <dd className="text-sm leading-relaxed text-foreground">
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {productionFields.length > 0 ? (
        <div className="space-y-2 border-t border-border/70 pt-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {labels.production}
          </p>
          <dl className="grid gap-2 sm:grid-cols-2">
            {productionFields.map((field) => (
              <div key={field.label} className="space-y-0.5">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {field.label}
                </dt>
                <dd className="text-sm text-foreground">{field.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
      {inspirationFields.length > 0 ? (
        <div className="space-y-2 border-t border-border/70 pt-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {labels.inspiration}
          </p>
          <dl className="space-y-2">
            {inspirationFields.map((field) => (
              <div key={field.label} className="space-y-0.5">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {field.label}
                </dt>
                <dd className="text-sm leading-relaxed text-foreground">
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
      {concept.graphicElements.length > 0 ||
      concept.designInstructions.length > 0 ||
      artDirectionFields.length > 0 ? (
        <div className="space-y-3 border-t border-primary/20 bg-primary/5 p-4 pt-4">
          <p className="text-label text-primary">{labels.artDirection}</p>
          {concept.graphicElements.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {labels.graphicElements}
              </p>
              <ul className="space-y-1 text-sm leading-relaxed text-foreground">
                {concept.graphicElements.map((element) => (
                  <li key={element} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{element}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {artDirectionFields.length > 0 ? (
            <dl className="space-y-3">
              {artDirectionFields.map((field) => (
                <div key={field.label} className="space-y-1">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {field.label}
                  </dt>
                  <dd className="text-sm leading-relaxed text-foreground">
                    {field.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {concept.designInstructions.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {labels.designInstructions}
              </p>
              <ol className="space-y-2 text-sm leading-relaxed text-foreground">
                {concept.designInstructions.map((step, stepIndex) => (
                  <li key={`${stepIndex}-${step}`} className="flex gap-3">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {stepIndex + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}
      {visualDnaFields.length > 0 ? (
        <div className="space-y-3 border-t border-emerald-500/20 bg-emerald-500/5 p-4 pt-4">
          <p className="text-label text-emerald-700 dark:text-emerald-300">
            {labels.visualDna}
          </p>
          <dl className="grid gap-3 sm:grid-cols-2">
            {visualDnaFields.map((field) => (
              <div key={field.label} className="space-y-1">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {field.label}
                </dt>
                <dd className="text-sm leading-relaxed text-foreground">
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
      {concept.dnaScore > 0 ? (
        <div className="space-y-4 border-t border-violet-500/20 bg-violet-500/5 p-4 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-label text-violet-700 dark:text-violet-300">
              {labels.milaeneDna}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {labels.dnaScore}
              </span>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-semibold",
                  concept.dnaScore >= 80
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : concept.dnaScore >= 65
                      ? "bg-violet-500/15 text-violet-700 dark:text-violet-300"
                      : "bg-rose-500/15 text-rose-700 dark:text-rose-300",
                )}
              >
                {concept.dnaScore}%
              </span>
            </div>
          </div>
          {concept.dnaMatches.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {labels.dnaMatches}
              </p>
              <ul className="space-y-1 text-sm leading-relaxed text-foreground">
                {concept.dnaMatches.map((match) => (
                  <li key={match} className="flex gap-2">
                    <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                    <span>{match}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {concept.dnaConflicts.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {labels.dnaConflicts}
              </p>
              <ul className="space-y-1 text-sm leading-relaxed text-foreground">
                {concept.dnaConflicts.map((conflict) => (
                  <li key={conflict} className="flex gap-2">
                    <span className="text-amber-600 dark:text-amber-400">−</span>
                    <span>{conflict}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {concept.whyFitsMilaene.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {labels.whyFitsMilaene}
              </p>
              <ul className="space-y-1 text-sm leading-relaxed text-foreground">
                {concept.whyFitsMilaene.map((reason) => (
                  <li key={reason} className="flex gap-2">
                    <span className="text-violet-600 dark:text-violet-400">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {labels.collectionRole}
              </dt>
              <dd className="text-sm text-foreground">{displayRole}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {labels.repeatabilityScore}
              </dt>
              <dd className="text-sm text-foreground">
                {concept.repeatabilityScore}
              </dd>
            </div>
            {concept.supportsDesignId ? (
              <div className="space-y-1 sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {labels.supportsDesignId}
                </dt>
                <dd className="text-sm text-foreground">
                  {concept.title} → {concept.supportsDesignId}
                </dd>
              </div>
            ) : null}
            {concept.commercialScore !== undefined ? (
              <div className="space-y-1">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {labels.commercialScore}
                </dt>
                <dd className="text-sm font-medium text-foreground">
                  {concept.commercialScore}%
                </dd>
              </div>
            ) : null}
            {concept.campaignPotential ? (
              <div className="space-y-1">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {labels.campaignPotential}
                </dt>
                <dd className="text-sm capitalize text-foreground">
                  {concept.campaignPotential}
                </dd>
              </div>
            ) : null}
            {concept.heroScore !== undefined ? (
              <div className="space-y-1">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {labels.heroScore}
                </dt>
                <dd className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  {concept.heroScore}%
                </dd>
              </div>
            ) : null}
            {concept.relationshipReason ? (
              <div className="space-y-1 sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {labels.relationshipReason}
                </dt>
                <dd className="text-sm leading-relaxed text-foreground">
                  {concept.relationshipReason}
                </dd>
              </div>
            ) : null}
            {concept.emotionalKeyword ? (
              <div className="space-y-1">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {labels.emotionalKeyword}
                </dt>
                <dd className="text-sm font-medium text-foreground">
                  {concept.emotionalKeyword}
                </dd>
              </div>
            ) : null}
            {concept.emotionalNarrative ? (
              <div className="space-y-1 sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {labels.emotionalNarrative}
                </dt>
                <dd className="text-sm leading-relaxed text-foreground">
                  {concept.emotionalNarrative}
                </dd>
              </div>
            ) : null}
          </dl>
          {concept.imagePromptCore ? (
            <div className="space-y-1 rounded-lg border border-violet-500/15 bg-background/60 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {labels.imagePromptCore}
              </p>
              <p className="text-sm leading-relaxed text-foreground">
                {concept.imagePromptCore}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
      {productFields.length > 0 ? (
        <dl className="grid gap-2 border-t border-border/70 pt-4 sm:grid-cols-2">
          {productFields.map((field) => (
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

function HeroAnalysisPanel({
  collection,
  hero,
  t,
}: {
  collection: ResearchCollection;
  hero?: DesignConcept;
  t: ReturnType<typeof useT>;
}) {
  const analysis = collection.heroAnalysis;
  const launchApproval = collection.ceoAnalysis?.launchApproval;

  if (!hero || !analysis) return null;

  const campaignColor =
    analysis.campaignPotential === "high"
      ? "text-emerald-600 dark:text-emerald-400"
      : analysis.campaignPotential === "medium"
        ? "text-amber-600 dark:text-amber-400"
        : "text-rose-600 dark:text-rose-400";

  return (
    <div className="space-y-5 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/12 via-background to-background p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-label text-amber-700 dark:text-amber-300">
            {t("research.interface.heroAnalysis")}
          </p>
          <h3 className="font-display text-xl font-medium">{hero.title}</h3>
          <Badge className="border-amber-500/40 bg-amber-500/15 font-normal text-amber-800 dark:text-amber-200">
            {t("research.interface.collection.heroBadge")}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-4 text-right">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("research.interface.collection.heroScore")}
            </p>
            <p className="font-display text-2xl font-semibold text-amber-600 dark:text-amber-400">
              {analysis.heroScore}%
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("research.interface.collection.commercialScore")}
            </p>
            <p className="font-display text-2xl font-semibold">
              {analysis.commercialScore}%
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              DNA
            </p>
            <p className="font-display text-2xl font-semibold">
              {hero.dnaScore}%
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("research.interface.collection.campaignPotential")}
        </span>
        <Badge variant="outline" className={cn("font-normal capitalize", campaignColor)}>
          {analysis.campaignPotential}
        </Badge>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("research.interface.collection.whyHero")}
          </dt>
          <dd className="text-sm leading-relaxed">{analysis.whyHero}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("research.interface.collection.visualStrength")}
          </dt>
          <dd className="text-sm leading-relaxed">{analysis.visualStrength}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("research.interface.collection.emotionalStrength")}
          </dt>
          <dd className="text-sm leading-relaxed">{analysis.emotionalStrength}</dd>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("research.interface.collection.adPotential")}
          </dt>
          <dd className="text-sm leading-relaxed">{analysis.adPotential}</dd>
        </div>
      </dl>

      {launchApproval ? (
        <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("research.interface.collection.launchApproval")}
            </p>
            <Badge
              variant={launchApproval.approved ? "default" : "destructive"}
              className="font-normal"
            >
              {launchApproval.approved
                ? t("research.interface.collection.launchApproved")
                : t("research.interface.collection.launchRejected")}
            </Badge>
          </div>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Emotional impact</dt>
              <dd className="leading-relaxed">{launchApproval.emotionalImpact}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Commercial strength</dt>
              <dd className="leading-relaxed">{launchApproval.commercialStrength}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Ad expectations</dt>
              <dd className="leading-relaxed">
                {launchApproval.adPerformanceExpectations}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}

function HeroRegenerationPanel({
  collection,
  hero,
  t,
}: {
  collection: ResearchCollection;
  hero?: DesignConcept;
  t: ReturnType<typeof useT>;
}) {
  const regen = collection.heroRegeneration;
  const launchApproval = collection.ceoAnalysis?.launchApproval;

  if (!regen?.required) return null;

  return (
    <div className="space-y-5 rounded-xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-background to-background p-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-label text-sky-700 dark:text-sky-300">
          {t("research.interface.heroRegeneration")}
        </p>
        <Badge variant="outline" className="font-normal border-sky-500/30 text-sky-800 dark:text-sky-200">
          {t("research.interface.heroRegenerationPanel.regenerated")}
        </Badge>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("research.interface.heroRegenerationPanel.previousHero")}
          </dt>
          <dd className="text-sm font-medium text-foreground">
            {regen.previousHeroTitle}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("research.interface.heroRegenerationPanel.newHero")}
          </dt>
          <dd className="text-sm font-medium text-foreground">
            {hero?.title ?? regen.newHeroTitle}
          </dd>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("research.interface.heroRegenerationPanel.whyFailed")}
          </dt>
          <dd className="text-sm leading-relaxed text-foreground">{regen.reason}</dd>
        </div>
      </dl>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("research.interface.heroRegenerationPanel.improvements")}
        </p>
        <ul className="space-y-1 text-sm leading-relaxed text-foreground">
          {regen.improvements.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-sky-600 dark:text-sky-400">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {launchApproval ? (
        <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("research.interface.heroRegenerationPanel.ceoApproval")}
            </p>
            <Badge
              variant={launchApproval.approved ? "default" : "destructive"}
              className="font-normal"
            >
              {launchApproval.approved
                ? t("research.interface.collection.launchApproved")
                : t("research.interface.collection.launchRejected")}
            </Badge>
          </div>
          <p className="text-sm leading-relaxed text-foreground">
            {collection.ceoRecommendation}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function CollectionIntelligencePanel({
  collection,
  designs,
  t,
}: {
  collection: ResearchCollection;
  designs: DesignConcept[];
  t: ReturnType<typeof useT>;
}) {
  const arc = collection.collectionArc ?? [...COLLECTION_ARC];
  const ranked = [...designs].sort((a, b) => b.dnaScore - a.dnaScore);
  const hero = designs.find((d) => d.designId === collection.heroDesignId);
  const analysis = collection.ceoAnalysis;

  return (
    <div className="space-y-5 rounded-xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 via-background to-background p-5">
      <p className="text-label text-violet-700 dark:text-violet-300">
        {t("research.interface.collectionIntelligence")}
      </p>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("research.interface.collection.arc")}
        </p>
        <div className="flex flex-wrap gap-2">
          {arc.map((step, index) => {
            const assigned = designs.find((d) => d.storyPosition === step);
            return (
              <div
                key={step}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm",
                  assigned
                    ? "border-violet-500/30 bg-violet-500/10"
                    : "border-border/60 bg-muted/20 text-muted-foreground",
                )}
              >
                <span className="text-xs text-muted-foreground">{index + 1}.</span>{" "}
                {step}
                {assigned ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {assigned.title}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {collection.emotionalNarrative ? (
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("research.interface.collection.emotionalStory")}
          </p>
          <p className="text-sm leading-relaxed text-foreground">
            {collection.emotionalNarrative}
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("research.interface.collection.relationshipGraph")}
        </p>
        <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-4">
          {hero ? (
            <div className="flex items-center gap-2">
              <Badge className="border-amber-500/40 bg-amber-500/15 font-normal text-amber-800 dark:text-amber-200">
                {t("research.interface.collection.heroBadge")}
              </Badge>
              <span className="text-sm font-medium">{hero.title}</span>
            </div>
          ) : null}
          {designs
            .filter((d) => d.designId !== collection.heroDesignId)
            .map((design) => {
              const role = displayCollectionRole(design, collection.heroDesignId);
              return (
              <div
                key={design.designId}
                className="flex flex-wrap items-center gap-2 border-l-2 border-violet-500/30 pl-3"
              >
                <span className="text-xs text-muted-foreground">↳</span>
                <span className="text-sm">{design.title}</span>
                <Badge variant="outline" className="font-normal text-xs">
                  {role}
                </Badge>
                {design.supportsDesignId ? (
                  <span className="text-xs text-muted-foreground">
                    {t("research.interface.collection.supports")} {design.supportsDesignId}
                  </span>
                ) : null}
              </div>
            );
            })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("research.interface.collection.dnaRanking")}
        </p>
        <div className="space-y-2">
          {ranked.map((design, index) => {
            const role = displayCollectionRole(design, collection.heroDesignId);
            return (
            <div key={design.designId} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {index + 1}. {design.title}
                  <span className="ml-2 text-muted-foreground">
                    ({role})
                  </span>
                </span>
                <span
                  className={cn(
                    "tabular-nums font-medium",
                    design.dnaScore >= 85
                      ? "text-emerald-600 dark:text-emerald-400"
                      : design.dnaScore >= 70
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-rose-600 dark:text-rose-400",
                  )}
                >
                  {design.dnaScore}%
                </span>
              </div>
              <Progress value={design.dnaScore} className="h-1" />
            </div>
          );
          })}
        </div>
      </div>

      {analysis ? (
        <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("research.interface.collection.ceoAnalysis")}
          </p>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-xs text-muted-foreground">
                {t("research.interface.collection.strongestProduct")}
              </dt>
              <dd className="text-sm font-medium">{analysis.strongestProduct}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs text-muted-foreground">
                {t("research.interface.collection.weakestProduct")}
              </dt>
              <dd className="text-sm font-medium">{analysis.weakestProduct}</dd>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <dt className="text-xs text-muted-foreground">
                {t("research.interface.collection.launchOrder")}
              </dt>
              <dd className="text-sm">{analysis.recommendedLaunchOrder.join(" → ")}</dd>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <dt className="text-xs text-muted-foreground">
                {t("research.interface.collection.productionRisk")}
              </dt>
              <dd className="text-sm leading-relaxed">{analysis.productionRisk}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs text-muted-foreground">
                {t("research.interface.collection.commercialConfidence")}
              </dt>
              <dd className="text-sm font-medium">
                {normalizeCommercialConfidence(analysis.commercialConfidence)}
              </dd>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <dt className="text-xs text-muted-foreground">
                {t("research.interface.collection.adPotential")}
              </dt>
              <dd className="text-sm leading-relaxed">{analysis.adPotential}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}

function CollectionOverviewPanel({
  collection,
  heroDesign,
  t,
}: {
  collection: ResearchCollection;
  heroDesign?: DesignConcept;
  t: ReturnType<typeof useT>;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-background to-background p-5">
      <p className="text-label text-amber-700 dark:text-amber-300">
        {t("research.interface.collectionOverview")}
      </p>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("research.interface.collection.name")}
          </p>
          <h3 className="font-display text-2xl font-medium leading-tight">
            {collection.name}
          </h3>
          <Badge variant="secondary" className="mt-1 font-normal">
            {collection.type}
          </Badge>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("research.interface.collection.score")}
          </p>
          <p
            className={cn(
              "font-display text-3xl font-semibold",
              collection.collectionScore >= 85
                ? "text-emerald-600 dark:text-emerald-400"
                : collection.collectionScore >= 70
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-rose-600 dark:text-rose-400",
            )}
          >
            {collection.collectionScore}%
          </p>
        </div>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("research.interface.collection.mood")}
          </dt>
          <dd className="text-sm capitalize text-foreground">{collection.mood}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("research.interface.collection.hero")}
          </dt>
          <dd className="text-sm text-foreground">
            {heroDesign?.product ?? collection.heroProduct.product}
          </dd>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("research.interface.collection.story")}
          </dt>
          <dd className="text-sm leading-relaxed text-foreground">
            {collection.story}
          </dd>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("research.interface.collection.philosophy")}
          </dt>
          <dd className="text-sm leading-relaxed text-foreground">
            {collection.philosophy}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("research.interface.collection.campaignTheme")}
          </dt>
          <dd className="text-sm font-medium text-foreground">
            {collection.campaignTheme}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("research.interface.collection.recommendation")}
          </dt>
          <dd className="text-sm font-medium text-foreground">
            {collection.ceoRecommendation}
          </dd>
        </div>
      </dl>
      <div className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("research.interface.collection.heroProduct")}
          </p>
          <p className="text-sm font-medium">{collection.heroProduct.product}</p>
          <p className="text-sm text-muted-foreground">
            {t("research.interface.collection.retail")}:{" "}
            {collection.heroProduct.estimatedRetailPrice}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("research.interface.collection.production")}:{" "}
            {collection.heroProduct.productionComplexity}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("research.interface.collection.confidence")}:{" "}
            {normalizeCommercialConfidence(collection.heroProduct.commercialConfidence)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("research.interface.collection.dropStrategy")}
          </p>
          <p className="text-sm leading-relaxed text-foreground">
            {collection.dropStrategy}
          </p>
        </div>
      </div>
      {collection.colorDirection.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("research.interface.collection.colorDirection")}:{" "}
          {collection.colorDirection.join(" · ")}
        </p>
      ) : null}
      {collection.collectionImagePrompt ? (
        <div className="rounded-lg border border-amber-500/15 bg-background/60 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("research.interface.collection.imagePrompt")}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-foreground">
            {collection.collectionImagePrompt}
          </p>
        </div>
      ) : null}
    </div>
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
  const concepts =
    result.designs && result.designs.length > 0
      ? result.designs
      : parseDesignConcepts(
          Array.isArray(rawDesigns) ? rawDesigns : [],
          result,
        );
  const confidence = result.confidence ?? (result.designBrief?.confidence ?? 0) / 100;
  const collection = result.collection;
  const conceptLabels = {
    creativeApproach: t("research.interface.designConcept.creativeApproach"),
    emotion: t("research.interface.designConcept.emotion"),
    visualConcept: t("research.interface.designConcept.visualConcept"),
    designDescription: t("research.interface.designConcept.designDescription"),
    message: t("research.interface.designConcept.message"),
    typography: t("research.interface.designConcept.typography"),
    printTechnique: t("research.interface.designConcept.printTechnique"),
    printSize: t("research.interface.designConcept.printSize"),
    placementDimensions: t("research.interface.designConcept.placementDimensions"),
    productionDifficulty: t("research.interface.designConcept.productionDifficulty"),
    garmentInspiration: t("research.interface.designConcept.garmentInspiration"),
    brandInspiration: t("research.interface.designConcept.brandInspiration"),
    visualReferences: t("research.interface.designConcept.visualReferences"),
    production: t("research.interface.designConcept.production"),
    inspiration: t("research.interface.designConcept.inspiration"),
    artDirection: t("research.interface.designConcept.artDirection"),
    exactComposition: t("research.interface.designConcept.exactComposition"),
    graphicElements: t("research.interface.designConcept.graphicElements"),
    elementCount: t("research.interface.designConcept.elementCount"),
    layoutDescription: t("research.interface.designConcept.layoutDescription"),
    visualHierarchy: t("research.interface.designConcept.visualHierarchy"),
    colorBreakdown: t("research.interface.designConcept.colorBreakdown"),
    materialEffects: t("research.interface.designConcept.materialEffects"),
    negativeSpaceUsage: t("research.interface.designConcept.negativeSpaceUsage"),
    designInstructions: t("research.interface.designConcept.designInstructions"),
    mockupDescription: t("research.interface.designConcept.mockupDescription"),
    visualDna: t("research.interface.designConcept.visualDna"),
    geometry: t("research.interface.designConcept.geometry"),
    dimensions: t("research.interface.designConcept.dimensions"),
    coordinates: t("research.interface.designConcept.coordinates"),
    rotation: t("research.interface.designConcept.rotation"),
    spacing: t("research.interface.designConcept.spacing"),
    strokeWidth: t("research.interface.designConcept.strokeWidth"),
    opacity: t("research.interface.designConcept.opacity"),
    layerOrder: t("research.interface.designConcept.layerOrder"),
    contrastLevel: t("research.interface.designConcept.contrastLevel"),
    textureIntensity: t("research.interface.designConcept.textureIntensity"),
    visualWeight: t("research.interface.designConcept.visualWeight"),
    balance: t("research.interface.designConcept.balance"),
    alignment: t("research.interface.designConcept.alignment"),
    focalPoint: t("research.interface.designConcept.focalPoint"),
    edgeTreatment: t("research.interface.designConcept.edgeTreatment"),
    milaeneDna: t("research.interface.designConcept.milaeneDna"),
    dnaScore: t("research.interface.designConcept.dnaScore"),
    dnaMatches: t("research.interface.designConcept.dnaMatches"),
    dnaConflicts: t("research.interface.designConcept.dnaConflicts"),
    whyFitsMilaene: t("research.interface.designConcept.whyFitsMilaene"),
    collectionRole: t("research.interface.designConcept.collectionRole"),
    repeatabilityScore: t("research.interface.designConcept.repeatabilityScore"),
    imagePromptCore: t("research.interface.designConcept.imagePromptCore"),
    supportsDesignId: t("research.interface.designConcept.supportsDesignId"),
    emotionalNarrative: t("research.interface.designConcept.emotionalNarrative"),
    emotionalKeyword: t("research.interface.designConcept.emotionalKeyword"),
    storyPosition: t("research.interface.designConcept.storyPosition"),
    relationshipReason: t("research.interface.designConcept.relationshipReason"),
    commercialScore: t("research.interface.designConcept.commercialScore"),
    campaignPotential: t("research.interface.designConcept.campaignPotential"),
    heroScore: t("research.interface.designConcept.heroScore"),
    product: t("research.interface.designConcept.product"),
    color: t("research.interface.designConcept.color"),
    printArea: t("research.interface.designConcept.printArea"),
    targetAudience: t("research.interface.designConcept.targetAudience"),
  };

  const heroDesign = collection
    ? concepts.find((c) => c.designId === collection.heroDesignId)
    : undefined;

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

      {collection ? (
        <>
          <CollectionOverviewPanel
            collection={collection}
            heroDesign={heroDesign}
            t={t}
          />
          <HeroAnalysisPanel
            collection={collection}
            hero={heroDesign}
            t={t}
          />
          <HeroRegenerationPanel
            collection={collection}
            hero={heroDesign}
            t={t}
          />
          <CollectionIntelligencePanel
            collection={collection}
            designs={concepts}
            t={t}
          />
        </>
      ) : null}

      {concepts.length > 0 ? (
        <div className="space-y-3">
          <p className="text-label text-primary/80">
            {t("research.interface.designConcepts")}
          </p>
          <div className="grid gap-4">
            {concepts.map((concept, index) => (
              <DesignConceptCard
                key={`${concept.title}-${index}`}
                concept={concept}
                index={index}
                heroDesignId={collection?.heroDesignId}
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
                {coerceConceptField(result.title)}
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
