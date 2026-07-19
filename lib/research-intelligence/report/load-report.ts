import "server-only";

import { DataSourceManager } from "@/lib/data-source-platform/manager";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { runBrandIntelligenceEngine } from "../brand-intelligence";
import { runCreativeBriefEngine } from "../creative-brief";
import { runResearchIntelligencePipeline } from "../fusion/pipeline";
import { runPatternIntelligenceEngine } from "../pattern-intelligence";
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
      locale: DEFAULT_LOCALE,
      generatedAt,
    },
  });

  const brandResult = await runBrandIntelligenceEngine({
    intelligence: pipeline.intelligence,
    reasoning: pipeline.reasoning,
    generatedAt,
  });

  const patternIntelligence = await runPatternIntelligenceEngine({
    generatedAt,
    userRequest: options.title,
  });

  const briefResult = runCreativeBriefEngine({
    intelligence: brandResult.intelligence,
    reasoning: pipeline.reasoning,
    brandIntelligence: brandResult.brandIntelligence,
    patternIntelligence,
    generatedAt,
    userRequest: options.title,
  });

  return buildResearchReport({
    intelligence: brandResult.intelligence,
    reasoning: pipeline.reasoning,
    brandIntelligence: brandResult.brandIntelligence,
    creativeBrief: briefResult.creativeBrief,
    patternIntelligence,
    title: options.title,
    userRequest: options.title,
  });
}

export { buildResearchReport } from "./build-report";
export type { BuildResearchReportInput } from "./build-report";
