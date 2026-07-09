import "server-only";

import { getBrainClient } from "@/brain/client";
import type {
  BrainCompetitorReportSections,
  BrainReportContent,
  BrainResearchSections,
  BrainTrendReportSections,
} from "@/brain/domains/reports";
import type { BrainRecord } from "@/brain/types";
import type { ResearchCollection } from "@/agents/research/types";
import { loadResearchDesignReport } from "./load-research-design";

export interface ResearchDirectionContext {
  reportId: string;
  reportTitle: string;
  collectionName?: string;
  collection?: ResearchCollection;
  executiveSummary?: string;
  keyFindings: string[];
  opportunities: string[];
  risks: string[];
  recommendations: string[];
  trendReport?: BrainTrendReportSections;
  competitorReport?: BrainCompetitorReportSections;
  designBrief?: NonNullable<BrainResearchSections["designBrief"]>;
  fullAnalysis?: string;
  summary?: string;
}

function extractFullAnalysis(content: BrainReportContent): string | undefined {
  for (const artifact of content.artifacts) {
    if (artifact.type !== "markdown" && artifact.type !== "text") continue;
    if (artifact.content.length >= 400) {
      return artifact.content.slice(0, 6000);
    }
  }
  return undefined;
}

function recordMatchesReportId(record: BrainRecord, reportId: string): boolean {
  if (record.domain !== "reports") return false;
  const content = record.content as BrainReportContent;
  return content.reportId === reportId || record.id === reportId;
}

async function findReportRecord(
  workspaceId: string,
  reportId: string,
): Promise<BrainRecord | null> {
  const brain = getBrainClient();
  const byRecordId = await brain.getRecord("reports", reportId);
  if (
    byRecordId?.workspaceId === workspaceId &&
    recordMatchesReportId(byRecordId, reportId)
  ) {
    return byRecordId;
  }

  const result = await brain.searchRecords({
    workspaceId,
    domains: ["reports"],
    tags: ["design-ideas", "design"],
    limit: 200,
  });

  return result.records.find((entry) => recordMatchesReportId(entry, reportId)) ?? null;
}

function formatResearchContext(context: ResearchDirectionContext): string {
  const sections: string[] = [
    `# Research HQ — ${context.reportTitle}`,
  ];

  if (context.collectionName) {
    sections.push(`Collection: ${context.collectionName}`);
  }

  if (context.collection) {
    const c = context.collection;
    sections.push(
      "## Collection Theme",
      `Name: ${c.name}`,
      `Type: ${c.type}`,
      `Story: ${c.story}`,
      `Mood: ${c.mood}`,
      `Philosophy: ${c.philosophy}`,
      `Color Direction: ${c.colorDirection.join(", ")}`,
      `Target Audience: ${c.targetAudience}`,
      `Drop Strategy: ${c.dropStrategy}`,
      `Campaign Theme: ${c.campaignTheme}`,
    );
  }

  if (context.summary) {
    sections.push("## Summary", context.summary);
  }

  if (context.executiveSummary) {
    sections.push("## Executive Summary", context.executiveSummary);
  }

  if (context.keyFindings.length > 0) {
    sections.push("## Key Findings", ...context.keyFindings.map((f) => `- ${f}`));
  }

  if (context.opportunities.length > 0) {
    sections.push("## Sales Opportunities", ...context.opportunities.map((o) => `- ${o}`));
  }

  if (context.risks.length > 0) {
    sections.push("## Risks", ...context.risks.map((r) => `- ${r}`));
  }

  if (context.recommendations.length > 0) {
    sections.push("## Recommendations", ...context.recommendations.map((r) => `- ${r}`));
  }

  if (context.trendReport) {
    const t = context.trendReport;
    sections.push(
      "## Trend Research",
      `Trend: ${t.trendDescription}`,
      `Why It Matters: ${t.whyItMatters}`,
      `Adoption: ${t.adoptionLevel}`,
      `Brand Relevance: ${t.relevanceForBrand}`,
      "Design Implications:",
      ...t.designImplications.map((d) => `- ${d}`),
    );
  }

  if (context.competitorReport) {
    const c = context.competitorReport;
    sections.push(
      "## Competitor Analysis",
      `Positioning: ${c.positioning}`,
      `Target Audience: ${c.targetAudience}`,
      `Pricing: ${c.pricing}`,
      `Marketing: ${c.marketingStrategy}`,
      "Strengths:",
      ...c.strengths.map((s) => `- ${s}`),
      "Weaknesses:",
      ...c.weaknesses.map((w) => `- ${w}`),
      "Brand Opportunities:",
      ...c.brandOpportunities.map((o) => `- ${o}`),
    );
  }

  if (context.designBrief) {
    const b = context.designBrief;
    sections.push(
      "## Brand DNA & Design Brief",
      `Collection Idea: ${b.collectionIdea}`,
      `Style Direction: ${b.styleDirection}`,
      `Target Audience: ${b.targetAudience}`,
      `Trend Score: ${b.trendScore}%`,
      `Competitor Score: ${b.competitorScore}%`,
      `Confidence: ${b.confidence}%`,
      `Rationale: ${b.rationale}`,
      "Color Palette:",
      ...b.colorPalette.map((c) => `- ${c.name}${c.hex ? ` (${c.hex})` : ""}: ${c.role}`),
      "Silhouettes:",
      ...b.silhouettes.map((s) => `- ${s}`),
      "Product Suggestions:",
      ...b.productSuggestions.map((p) => `- ${p}`),
    );
  }

  if (context.fullAnalysis) {
    sections.push("## Full Analysis", context.fullAnalysis);
  }

  return sections.join("\n\n");
}

/** Load complete Research HQ context for AI design direction generation. */
export async function loadResearchDirectionContext(
  workspaceId: string,
  reportId: string,
): Promise<{ context: ResearchDirectionContext; formatted: string } | null> {
  const designReport = await loadResearchDesignReport(workspaceId, reportId);
  const record = await findReportRecord(workspaceId, reportId);

  if (!record && !designReport) return null;

  const content = record?.content as BrainReportContent | undefined;
  const sections = content?.researchSections;

  const context: ResearchDirectionContext = {
    reportId: designReport?.reportId ?? content?.reportId ?? reportId,
    reportTitle: designReport?.title ?? record?.title ?? "Research Report",
    collectionName: designReport?.collection?.name,
    collection: designReport?.collection,
    executiveSummary: sections?.executiveSummary,
    keyFindings: sections?.keyFindings ?? content?.keyFindings ?? [],
    opportunities: sections?.opportunities ?? [],
    risks: sections?.risks ?? [],
    recommendations: sections?.recommendations ?? [],
    trendReport: sections?.trendReport,
    competitorReport: sections?.competitorReport,
    designBrief: sections?.designBrief,
    fullAnalysis: content ? extractFullAnalysis(content) : undefined,
    summary: content?.summary,
  };

  return {
    context,
    formatted: formatResearchContext(context),
  };
}
