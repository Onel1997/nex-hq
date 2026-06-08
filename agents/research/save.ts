import type {
  BrainReportContent,
  BrainResearchSections,
} from "@/brain/domains/reports";
import type { CompetitorIntelligenceContent } from "@/brain/domains/competitor-intelligence";
import type { DesignMemoryContent } from "@/brain/domains/design-memory";
import type { MarketingMemoryContent } from "@/brain/domains/marketing-memory";
import { getBrainClient } from "@/brain/client";
import { slugify } from "@/brain/client/utils";
import type { BrainDomain } from "@/brain/types";
import type { ResearchOutput } from "./types";

export interface SaveResearchInput {
  workspaceId: string;
  workspaceName: string;
  request: string;
  output: ResearchOutput;
}

export interface SaveResearchResult {
  reportId: string;
  reportRecordId: string;
  savedDomains: BrainDomain[];
}

function buildResearchSections(
  output: ResearchOutput,
): BrainResearchSections {
  const sections: BrainResearchSections = {
    executiveSummary: output.executiveSummary,
    keyFindings: output.keyFindings,
    opportunities: output.opportunities,
    risks: output.risks,
    recommendations: output.recommendations,
  };

  if (output.competitorReport) {
    sections.competitorReport = {
      positioning: output.competitorReport.positioning,
      targetAudience: output.competitorReport.targetAudience,
      pricing: output.competitorReport.pricing,
      productCategories: output.competitorReport.productCategories,
      marketingStrategy: output.competitorReport.marketingStrategy,
      communityStrategy: output.competitorReport.communityStrategy,
      strengths: output.competitorReport.strengths,
      weaknesses: output.competitorReport.weaknesses,
      brandOpportunities: output.competitorReport.brandOpportunities,
    };
  }

  if (output.trendReport) {
    sections.trendReport = {
      trendDescription: output.trendReport.trendDescription,
      whyItMatters: output.trendReport.whyItMatters,
      adoptionLevel: output.trendReport.adoptionLevel,
      relevanceForBrand: output.trendReport.relevanceForBrand,
      designImplications: output.trendReport.designImplications,
      contentImplications: output.trendReport.contentImplications,
    };
  }

  return sections;
}

export async function saveResearchToBrain(
  input: SaveResearchInput,
): Promise<SaveResearchResult> {
  const brain = getBrainClient();
  const reportId = crypto.randomUUID();
  const taskId = `research-${reportId}`;
  const timestamp = new Date().toISOString();
  const baseSlug = slugify(input.output.title).slice(0, 48) || "research";
  const slugSuffix = reportId.slice(0, 8);
  const savedDomains: BrainDomain[] = [];
  const researchSections = buildResearchSections(input.output);

  const reportContent: BrainReportContent = {
    kind: "reports",
    reportId,
    taskId,
    agentId: "research",
    status: "submitted",
    summary: input.output.executiveSummary,
    confidence: input.output.confidence,
    keyFindings: input.output.keyFindings,
    reportType: input.output.reportType,
    researchSections,
    notes: `Anfrage: ${input.request}`,
    artifacts: [
      {
        id: `${reportId}-analysis`,
        type: "markdown",
        label: "Vollständige Analyse",
        content: input.output.fullAnalysis,
      },
    ],
  };

  const reportWrite = await brain.createRecord({
    workspaceId: input.workspaceId,
    domain: "reports",
    slug: `report-${baseSlug}-${slugSuffix}`,
    title: input.output.title,
    summary: input.output.executiveSummary,
    content: reportContent,
    status: "pending_review",
    tags: ["research", input.output.reportType, "agent-generated"],
    provenance: {
      createdBy: { type: "agent", id: "research" },
      sourceTaskId: taskId,
      confidence: input.output.confidence,
    },
  });

  savedDomains.push("reports");

  if (input.output.competitorIntelligence) {
    const ci = input.output.competitorIntelligence;
    const content: CompetitorIntelligenceContent = {
      kind: "competitor_intelligence",
      competitors: ci.competitors.map((c) => ({
        ...c,
        lastObservedAt: timestamp,
      })),
      competitiveEdge: ci.competitiveEdge,
      marketSignals: ci.marketSignals?.map((s) => ({
        signal: s.signal,
        relevance: s.relevance,
        observedAt: timestamp,
      })),
      analysisSummary: ci.analysisSummary ?? input.output.executiveSummary,
      recommendedActions:
        ci.recommendedActions ?? input.output.recommendations,
    };

    await brain.createRecord({
      workspaceId: input.workspaceId,
      domain: "competitor_intelligence",
      slug: `ci-${baseSlug}-${slugSuffix}`,
      title: `${input.output.title} — Wettbewerber`,
      summary: input.output.executiveSummary,
      content,
      status: "pending_review",
      tags: ["research", "competitor", "agent-generated"],
      provenance: {
        createdBy: { type: "agent", id: "research" },
        sourceReportId: reportId,
        confidence: input.output.confidence,
      },
      relations: [
        {
          targetDomain: "reports",
          targetRecordId: reportWrite.record.id,
          relationType: "derived_from",
        },
      ],
    });

    savedDomains.push("competitor_intelligence");
  }

  if (input.output.marketingMemory) {
    const mm = input.output.marketingMemory;
    const content: MarketingMemoryContent = {
      kind: "marketing_memory",
      name: mm.name,
      status: "planned",
      objective: mm.objective,
      notes: mm.notes ?? input.output.executiveSummary,
      launchSequence: mm.launchSequence,
    };

    await brain.createRecord({
      workspaceId: input.workspaceId,
      domain: "marketing_memory",
      slug: `mm-${baseSlug}-${slugSuffix}`,
      title: mm.name,
      summary: input.output.executiveSummary,
      content,
      status: "pending_review",
      tags: ["research", "marketing", "agent-generated"],
      provenance: {
        createdBy: { type: "agent", id: "research" },
        sourceReportId: reportId,
        confidence: input.output.confidence,
      },
      relations: [
        {
          targetDomain: "reports",
          targetRecordId: reportWrite.record.id,
          relationType: "derived_from",
        },
      ],
    });

    savedDomains.push("marketing_memory");
  }

  if (input.output.designMemory) {
    const dm = input.output.designMemory;
    const content: DesignMemoryContent = {
      kind: "design_memory",
      silhouettes: dm.silhouettes,
      moodKeywords: dm.moodKeywords,
      graphicTreatment: dm.graphicTreatment,
      dropVisualDirection: dm.dropVisualDirection,
    };

    await brain.createRecord({
      workspaceId: input.workspaceId,
      domain: "design_memory",
      slug: `dm-${baseSlug}-${slugSuffix}`,
      title: `${input.output.title} — Design`,
      summary: input.output.executiveSummary,
      content,
      status: "pending_review",
      tags: ["research", "design", "agent-generated"],
      provenance: {
        createdBy: { type: "agent", id: "research" },
        sourceReportId: reportId,
        confidence: input.output.confidence,
      },
      relations: [
        {
          targetDomain: "reports",
          targetRecordId: reportWrite.record.id,
          relationType: "derived_from",
        },
      ],
    });

    savedDomains.push("design_memory");
  }

  return {
    reportId,
    reportRecordId: reportWrite.record.id,
    savedDomains,
  };
}
