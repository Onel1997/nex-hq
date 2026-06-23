import type {
  BrainReportContent,
  BrainResearchSections,
} from "@/brain/domains/reports";
import type { CompetitorIntelligenceContent } from "@/brain/domains/competitor-intelligence";
import type { DesignMemoryContent } from "@/brain/domains/design-memory";
import type { MarketingMemoryContent } from "@/brain/domains/marketing-memory";
import { getBrainClient } from "@/brain/client";
import { reportSourceTag } from "@/lib/reports/report-source";
import { slugify } from "@/brain/client/utils";
import type { BrainDomain } from "@/brain/types";
import { resolveReportTaskIds } from "@/lib/reports/task-link";
import {
  isDesignResearchOutput,
  type DesignResearchOutput,
  type ResearchOutput,
} from "./types";

export interface SaveResearchInput {
  workspaceId: string;
  workspaceName: string;
  request: string;
  output: ResearchOutput | DesignResearchOutput;
  originTaskId?: string;
  reportId?: string;
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

  if (output.designBrief) {
    sections.designBrief = {
      collectionIdea: output.designBrief.collectionIdea,
      productSuggestions: output.designBrief.productSuggestions,
      targetAudience: output.designBrief.targetAudience,
      colorPalette: output.designBrief.colorPalette,
      styleDirection: output.designBrief.styleDirection,
      silhouettes: output.designBrief.silhouettes,
      trendScore: output.designBrief.trendScore,
      socialScore: output.designBrief.socialScore,
      demandScore: output.designBrief.demandScore,
      competitorScore: output.designBrief.competitorScore,
      confidence: output.designBrief.confidence,
      connectorScores: output.designBrief.connectorScores,
      intelligenceMode: output.designBrief.intelligenceMode,
      rationale: output.designBrief.rationale,
      opportunityId: output.designBrief.opportunityId,
      generatedAt: output.designBrief.generatedAt ?? new Date().toISOString(),
    };
  }

  return sections;
}

function buildDesignResearchSections(
  output: DesignResearchOutput,
): BrainResearchSections {
  const summary =
    output.rationale ??
    `Design-Ideen für ${output.title}: ${output.designs.slice(0, 3).join(" · ")}`;

  const sections: BrainResearchSections = {
    executiveSummary: summary,
    keyFindings: output.designs,
    opportunities: output.designs,
    risks: [
      "Design-Umsetzung muss auf verfügbare Katalogvarianten und MarketPrint-Produktion abgestimmt bleiben.",
    ],
    recommendations: output.designs,
  };

  if (output.designBrief) {
    sections.designBrief = {
      collectionIdea: output.designBrief.collectionIdea,
      productSuggestions: output.designBrief.productSuggestions,
      targetAudience: output.designBrief.targetAudience,
      colorPalette: output.designBrief.colorPalette,
      styleDirection: output.designBrief.styleDirection,
      silhouettes: output.designBrief.silhouettes,
      trendScore: output.designBrief.trendScore,
      socialScore: output.designBrief.socialScore,
      demandScore: output.designBrief.demandScore,
      competitorScore: output.designBrief.competitorScore,
      confidence: output.designBrief.confidence,
      connectorScores: output.designBrief.connectorScores,
      intelligenceMode: output.designBrief.intelligenceMode,
      rationale: output.designBrief.rationale,
      opportunityId: output.designBrief.opportunityId,
      generatedAt: output.designBrief.generatedAt ?? new Date().toISOString(),
    };
  }

  return sections;
}

export async function saveResearchToBrain(
  input: SaveResearchInput,
): Promise<SaveResearchResult> {
  if (isDesignResearchOutput(input.output)) {
    return saveDesignResearchToBrain(input, input.output);
  }
  return saveClassicResearchToBrain(input, input.output);
}

async function saveDesignResearchToBrain(
  input: SaveResearchInput,
  output: DesignResearchOutput,
): Promise<SaveResearchResult> {
  const brain = getBrainClient();
  const reportId = input.reportId ?? crypto.randomUUID();
  const { taskId, originTaskId } = resolveReportTaskIds(
    input.originTaskId,
    reportId,
    "research",
  );
  const baseSlug = slugify(output.title).slice(0, 48) || "research";
  const slugSuffix = reportId.slice(0, 8);
  const researchSections = buildDesignResearchSections(output);
  const executiveSummary = researchSections.executiveSummary;
  const confidence = output.confidence ?? 0.75;
  const fullAnalysis = [
    `# ${output.title}`,
    "",
    "## Design-Ideen",
    ...output.designs.map((design) => `- ${design}`),
    "",
    output.products?.length
      ? `## Produkte\n${output.products.map((p) => `- ${p}`).join("\n")}`
      : "",
    output.colors?.length
      ? `## Farben\n${output.colors.map((c) => `- ${c}`).join("\n")}`
      : "",
    output.rationale ? `## Begründung\n${output.rationale}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const reportContent: BrainReportContent = {
    kind: "reports",
    reportId,
    taskId,
    ...(originTaskId ? { originTaskId } : {}),
    agentId: "research",
    status: "submitted",
    summary: executiveSummary,
    confidence,
    keyFindings: output.designs,
    reportType: "design",
    researchSections,
    notes: `Anfrage: ${input.request}`,
    artifacts: [
      {
        id: `${reportId}-analysis`,
        type: "markdown",
        label: "Design-Ideen",
        content: fullAnalysis,
      },
    ],
  };

  const reportWrite = await brain.createRecord({
    workspaceId: input.workspaceId,
    domain: "reports",
    slug: `report-${baseSlug}-${slugSuffix}`,
    title: output.title,
    summary: executiveSummary,
    content: reportContent,
    status: "pending_review",
    tags: [
      "research",
      "design",
      "agent-generated",
      reportSourceTag("live"),
      "design-brief-handoff",
      "design-ideas",
    ],
    provenance: {
      createdBy: { type: "agent", id: "research" },
      sourceTaskId: taskId,
      confidence,
    },
  });

  return {
    reportId,
    reportRecordId: reportWrite.record.id,
    savedDomains: ["reports"],
  };
}

async function saveClassicResearchToBrain(
  input: SaveResearchInput,
  output: ResearchOutput,
): Promise<SaveResearchResult> {
  const brain = getBrainClient();
  const reportId = input.reportId ?? crypto.randomUUID();
  const { taskId, originTaskId } = resolveReportTaskIds(
    input.originTaskId,
    reportId,
    "research",
  );
  const timestamp = new Date().toISOString();
  const baseSlug = slugify(output.title).slice(0, 48) || "research";
  const slugSuffix = reportId.slice(0, 8);
  const savedDomains: BrainDomain[] = [];
  const researchSections = buildResearchSections(output);

  const reportContent: BrainReportContent = {
    kind: "reports",
    reportId,
    taskId,
    ...(originTaskId ? { originTaskId } : {}),
    agentId: "research",
    status: "submitted",
    summary: output.executiveSummary,
    confidence: output.confidence,
    keyFindings: output.keyFindings,
    reportType: output.reportType,
    researchSections,
    notes: `Anfrage: ${input.request}`,
    artifacts: [
      {
        id: `${reportId}-analysis`,
        type: "markdown",
        label: "Vollständige Analyse",
        content: output.fullAnalysis,
      },
    ],
  };

  const reportWrite = await brain.createRecord({
    workspaceId: input.workspaceId,
    domain: "reports",
    slug: `report-${baseSlug}-${slugSuffix}`,
    title: output.title,
    summary: output.executiveSummary,
    content: reportContent,
    status: "pending_review",
    tags: [
      "research",
      output.reportType,
      "agent-generated",
      reportSourceTag("live"),
      "design-brief-handoff",
      output.reportType === "trend" ? "trend" : "",
      output.reportType === "competitor" ? "competitor" : "",
      output.reportType === "audience" ? "audience" : "",
    ].filter(Boolean),
    provenance: {
      createdBy: { type: "agent", id: "research" },
      sourceTaskId: taskId,
      confidence: output.confidence,
    },
  });

  savedDomains.push("reports");

  if (output.competitorIntelligence) {
    const ci = output.competitorIntelligence;
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
      analysisSummary: ci.analysisSummary ?? output.executiveSummary,
      recommendedActions:
        ci.recommendedActions ?? output.recommendations,
    };

    await brain.createRecord({
      workspaceId: input.workspaceId,
      domain: "competitor_intelligence",
      slug: `ci-${baseSlug}-${slugSuffix}`,
      title: `${output.title} — Wettbewerber`,
      summary: output.executiveSummary,
      content,
      status: "pending_review",
      tags: ["research", "competitor", "agent-generated"],
      provenance: {
        createdBy: { type: "agent", id: "research" },
        sourceReportId: reportId,
        confidence: output.confidence,
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

  if (output.marketingMemory) {
    const mm = output.marketingMemory;
    const content: MarketingMemoryContent = {
      kind: "marketing_memory",
      name: mm.name,
      status: "planned",
      objective: mm.objective,
      notes: mm.notes ?? output.executiveSummary,
      launchSequence: mm.launchSequence,
    };

    await brain.createRecord({
      workspaceId: input.workspaceId,
      domain: "marketing_memory",
      slug: `mm-${baseSlug}-${slugSuffix}`,
      title: mm.name,
      summary: output.executiveSummary,
      content,
      status: "pending_review",
      tags: ["research", "marketing", "agent-generated"],
      provenance: {
        createdBy: { type: "agent", id: "research" },
        sourceReportId: reportId,
        confidence: output.confidence,
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

  if (output.designMemory) {
    const dm = output.designMemory;
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
      title: `${output.title} — Design`,
      summary: output.executiveSummary,
      content,
      status: "pending_review",
      tags: ["research", "design", "agent-generated"],
      provenance: {
        createdBy: { type: "agent", id: "research" },
        sourceReportId: reportId,
        confidence: output.confidence,
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
