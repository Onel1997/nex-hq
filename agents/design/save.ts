import type {
  BrainDesignSections,
  BrainReportContent,
} from "@/brain/domains/reports";
import { getBrainClient } from "@/brain/client";
import { slugify } from "@/brain/client/utils";
import type { DesignOutput } from "./types";

export interface SaveDesignInput {
  workspaceId: string;
  brief: string;
  output: DesignOutput;
}

export interface SaveDesignResult {
  reportId: string;
  reportRecordId: string;
}

function buildDesignSections(output: DesignOutput): BrainDesignSections {
  return {
    collectionName: output.collectionName,
    collectionStory: output.collectionStory,
    colorPalette: output.colorPalette,
    silhouettes: output.silhouettes,
    productLineup: output.productLineup,
    heroProducts: output.heroProducts,
    materials: output.materials,
    designDirection: output.designDirection,
    launchRecommendations: output.launchRecommendations,
    sourceReportTitles: output.sourceReportTitles,
  };
}

export async function saveDesignToBrain(
  input: SaveDesignInput,
): Promise<SaveDesignResult> {
  const brain = getBrainClient();
  const reportId = crypto.randomUUID();
  const taskId = `design-${reportId}`;
  const baseSlug = slugify(input.output.title).slice(0, 48) || "design";
  const slugSuffix = reportId.slice(0, 8);
  const designSections = buildDesignSections(input.output);

  const reportContent: BrainReportContent = {
    kind: "reports",
    reportId,
    taskId,
    agentId: "designer",
    status: "submitted",
    summary: input.output.collectionStory,
    confidence: input.output.confidence,
    reportType: "design-report",
    designSections,
    notes: `Design-Briefing: ${input.brief}`,
    artifacts: [
      {
        id: `${reportId}-concept`,
        type: "markdown",
        label: "Vollständiges Kollektionskonzept",
        content: input.output.fullConcept,
      },
    ],
  };

  const reportWrite = await brain.createRecord({
    workspaceId: input.workspaceId,
    domain: "reports",
    slug: `design-${baseSlug}-${slugSuffix}`,
    title: input.output.title,
    summary: input.output.collectionStory,
    content: reportContent,
    status: "pending_review",
    tags: ["design-report", "designer", "agent-generated", "collection"],
    provenance: {
      createdBy: { type: "agent", id: "designer" },
      sourceTaskId: taskId,
      confidence: input.output.confidence,
    },
  });

  return {
    reportId,
    reportRecordId: reportWrite.record.id,
  };
}
