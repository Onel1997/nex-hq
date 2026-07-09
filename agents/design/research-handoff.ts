import type { DesignConcept } from "@/agents/research/types";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import {
  loadResearchDesignReport,
  type LoadedResearchDesignReport,
} from "./load-research-design";
import {
  buildIntelligenceHandoffContext,
  convertIntelligenceReportToStudioBrief,
  loadIntelligenceReportRecord,
} from "./report-preview-handoff";
import { convertResearchConceptToStudioBrief } from "./research-handoff-transform";
import type { IntelligenceHandoffContext, ResearchHandoffResult } from "./studio-brief";

export { convertResearchConceptToStudioBrief } from "./research-handoff-transform";

function toHandoffResult(
  report: LoadedResearchDesignReport,
  designs: DesignConcept[],
): ResearchHandoffResult {
  return {
    reportId: report.reportId,
    brainRecordId: report.brainRecordId,
    reportTitle: report.title,
    collectionName: report.collection?.name,
    briefs: designs.map(convertResearchConceptToStudioBrief),
  };
}

export class ResearchHandoffError extends Error {
  constructor(
    message: string,
    readonly code:
      | "report_not_found"
      | "no_design_payload"
      | "design_not_found"
      | "invalid_request",
  ) {
    super(message);
    this.name = "ResearchHandoffError";
  }
}

export interface ResearchHandoffInput {
  reportId: string;
  designId?: string;
  mode?: "all" | "report";
  workspaceId?: string;
}

function handoffFromIntelligenceReport(
  report: NonNullable<Awaited<ReturnType<typeof loadIntelligenceReportRecord>>>,
): ResearchHandoffResult {
  const intelligenceContext = buildIntelligenceHandoffContext(report.listItem);
  const brief = convertIntelligenceReportToStudioBrief(
    report.listItem,
    report.content,
  );
  return {
    reportId: report.reportId,
    brainRecordId: report.brainRecordId,
    reportTitle: intelligenceContext.reportTitle,
    collectionName: intelligenceContext.collectionName ?? extractCollectionLabel(brief, intelligenceContext),
    intelligenceContext,
    briefs: [brief],
  };
}

function extractCollectionLabel(
  brief: { title: string },
  context: IntelligenceHandoffContext,
): string | undefined {
  if (context.collectionName?.trim()) return context.collectionName;
  if (brief.title !== context.reportTitle) return brief.title;
  return undefined;
}

/** Load a research report and convert design concept(s) to Design Studio briefs. */
export async function handoffResearchToDesignStudio(
  input: ResearchHandoffInput,
): Promise<ResearchHandoffResult> {
  const workspaceId =
    input.workspaceId ?? (await ensureWorkspaceBrainSeeded()).workspace.id;

  const report = await loadResearchDesignReport(workspaceId, input.reportId);
  if (report) {
    if (input.mode === "all") {
      return toHandoffResult(report, report.designs);
    }

    if (input.designId?.trim()) {
      const design = report.designs.find(
        (entry) => entry.designId === input.designId,
      );
      if (!design) {
        throw new ResearchHandoffError(
          `Design concept not found in report: ${input.designId}`,
          "design_not_found",
        );
      }
      return toHandoffResult(report, [design]);
    }

    const hero =
      report.designs.find(
        (entry) => entry.designId === report.collection?.heroDesignId,
      ) ?? report.designs[0];
    return toHandoffResult(report, [hero]);
  }

  const previewReport = await loadIntelligenceReportRecord(
    workspaceId,
    input.reportId,
  );
  if (!previewReport) {
    throw new ResearchHandoffError(
      `Report not found: ${input.reportId}`,
      "report_not_found",
    );
  }

  if (input.designId?.trim()) {
    throw new ResearchHandoffError(
      `Design concept not found in report: ${input.designId}`,
      "design_not_found",
    );
  }

  return handoffFromIntelligenceReport(previewReport);
}
