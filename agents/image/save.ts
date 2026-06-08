import type {
  BrainImageSections,
  BrainReportContent,
} from "@/brain/domains/reports";
import { getBrainClient } from "@/brain/client";
import { slugify } from "@/brain/client/utils";
import type { ImageOutput } from "./types";

export interface SaveImageInput {
  workspaceId: string;
  brief: string;
  output: ImageOutput;
}

export interface SaveImageResult {
  reportId: string;
  reportRecordId: string;
}

function buildImageSections(output: ImageOutput): BrainImageSections {
  return {
    projectName: output.projectName,
    moodboard: output.moodboard,
    productMockups: output.productMockups,
    campaignVisuals: output.campaignVisuals,
    landingPageAssets: output.landingPageAssets,
    productionChecklist: output.productionChecklist,
    sourceReportTitles: output.sourceReportTitles,
  };
}

export async function saveImageToBrain(
  input: SaveImageInput,
): Promise<SaveImageResult> {
  const brain = getBrainClient();
  const reportId = crypto.randomUUID();
  const taskId = `image-${reportId}`;
  const baseSlug = slugify(input.output.projectName).slice(0, 48) || "image";
  const slugSuffix = reportId.slice(0, 8);
  const imageSections = buildImageSections(input.output);

  const reportContent: BrainReportContent = {
    kind: "reports",
    reportId,
    taskId,
    agentId: "image",
    status: "submitted",
    summary: input.output.moodboard.visualDirection.slice(0, 500),
    confidence: input.output.confidence,
    reportType: "image-project",
    imageSections,
    notes: `Visual Production Briefing: ${input.brief}`,
    artifacts: [
      {
        id: `${reportId}-image-project`,
        type: "markdown",
        label: "Vollständiges Visual Production Project",
        content: input.output.fullProject,
      },
    ],
  };

  const reportWrite = await brain.createRecord({
    workspaceId: input.workspaceId,
    domain: "reports",
    slug: `image-${baseSlug}-${slugSuffix}`,
    title: input.output.title,
    summary: input.output.moodboard.visualDirection.slice(0, 500),
    content: reportContent,
    status: "pending_review",
    tags: ["image-project", "image-agent", "agent-generated", "visual", "production"],
    provenance: {
      createdBy: { type: "agent", id: "image" },
      sourceTaskId: taskId,
      confidence: input.output.confidence,
    },
  });

  return {
    reportId,
    reportRecordId: reportWrite.record.id,
  };
}
