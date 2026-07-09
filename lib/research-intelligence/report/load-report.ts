import "server-only";

import { DataSourceManager } from "@/lib/data-source-platform/manager";
import { runResearchIntelligencePipeline } from "../fusion/pipeline";
import { buildResearchReport } from "./build-report";
import { syncResultsToEnvelopes } from "./envelopes";
import type { ResearchStudioReport } from "./types";

export interface LoadResearchStudioReportOptions {
  title?: string;
  force?: boolean;
  workspaceId?: string;
}

/**
 * Loads provider sync results, runs the fusion stack, and builds the Studio report.
 */
export async function loadResearchStudioReport(
  options: LoadResearchStudioReportOptions = {},
): Promise<ResearchStudioReport> {
  const { results } = await DataSourceManager.syncAll({ force: options.force });
  const envelopes = syncResultsToEnvelopes(results);
  const generatedAt = new Date().toISOString();

  const pipeline = runResearchIntelligencePipeline({
    envelopes,
    context: {
      workspaceId: options.workspaceId,
      generatedAt,
    },
  });

  return buildResearchReport({
    intelligence: pipeline.intelligence,
    reasoning: pipeline.reasoning,
    title: options.title,
  });
}

export { buildResearchReport } from "./build-report";
export type { BuildResearchReportInput } from "./build-report";
