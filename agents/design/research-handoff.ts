import type { DesignConcept } from "@/agents/research/types";
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import {
  loadResearchDesignReport,
  type LoadedResearchDesignReport,
} from "./load-research-design";
import { convertResearchConceptToStudioBrief } from "./research-handoff-transform";
import type { ResearchHandoffResult } from "./studio-brief";

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
  mode?: "all";
  workspaceId?: string;
}

/** Load a research report and convert design concept(s) to Design Studio briefs. */
export async function handoffResearchToDesignStudio(
  input: ResearchHandoffInput,
): Promise<ResearchHandoffResult> {
  const workspaceId =
    input.workspaceId ?? (await ensureWorkspaceBrainSeeded()).workspace.id;

  const report = await loadResearchDesignReport(workspaceId, input.reportId);
  if (!report) {
    throw new ResearchHandoffError(
      `Research design report not found: ${input.reportId}`,
      "report_not_found",
    );
  }

  if (input.mode === "all") {
    return toHandoffResult(report, report.designs);
  }

  if (!input.designId?.trim()) {
    throw new ResearchHandoffError(
      "designId is required unless mode is \"all\"",
      "invalid_request",
    );
  }

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
