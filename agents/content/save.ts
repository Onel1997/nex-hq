import type {
  BrainContentSections,
  BrainReportContent,
} from "@/brain/domains/reports";
import { getBrainClient } from "@/brain/client";
import { slugify } from "@/brain/client/utils";
import type { ContentOutput } from "./types";

export interface SaveContentInput {
  workspaceId: string;
  brief: string;
  output: ContentOutput;
}

export interface SaveContentResult {
  reportId: string;
  reportRecordId: string;
}

function buildContentSections(output: ContentOutput): BrainContentSections {
  return {
    brandNarrative: output.brandNarrative,
    landingPageCopy: output.landingPageCopy,
    productCopy: output.productCopy,
    emailSequence: output.emailSequence,
    socialContent: output.socialContent,
    smsCampaign: output.smsCampaign,
    sourceReportTitles: output.sourceReportTitles,
  };
}

export async function saveContentToBrain(
  input: SaveContentInput,
): Promise<SaveContentResult> {
  const brain = getBrainClient();
  const reportId = crypto.randomUUID();
  const taskId = `content-${reportId}`;
  const baseSlug = slugify(input.output.title).slice(0, 48) || "content";
  const slugSuffix = reportId.slice(0, 8);
  const contentSections = buildContentSections(input.output);

  const reportContent: BrainReportContent = {
    kind: "reports",
    reportId,
    taskId,
    agentId: "content",
    status: "submitted",
    summary: input.output.brandNarrative.slice(0, 500),
    confidence: input.output.confidence,
    reportType: "content-report",
    contentSections,
    notes: `Content-Briefing: ${input.brief}`,
    artifacts: [
      {
        id: `${reportId}-content`,
        type: "markdown",
        label: "Vollständiges Content-Paket",
        content: input.output.fullContent,
      },
    ],
  };

  const reportWrite = await brain.createRecord({
    workspaceId: input.workspaceId,
    domain: "reports",
    slug: `content-${baseSlug}-${slugSuffix}`,
    title: input.output.title,
    summary: input.output.brandNarrative.slice(0, 500),
    content: reportContent,
    status: "pending_review",
    tags: ["content-report", "content", "agent-generated", "copy"],
    provenance: {
      createdBy: { type: "agent", id: "content" },
      sourceTaskId: taskId,
      confidence: input.output.confidence,
    },
  });

  return {
    reportId,
    reportRecordId: reportWrite.record.id,
  };
}
