import { getBrainClient } from "@/brain/client";
import type { BrainAgentContext, BrainContextSlice } from "@/brain/context";
import {
  CEO_CONTEXT_DOMAINS,
  CEO_CONTEXT_STATUSES,
  getBrainContextAssembler,
} from "@/brain/context/assembler-impl";
import { buildPromptContext } from "@/brain/context/prompt-builder";
import { estimateTokens } from "@/brain/client/utils";
import type { BrainRecord } from "@/brain/types";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export class CeoKnowledgeError extends Error {
  readonly code = "NO_KNOWLEDGE" as const;

  constructor(message: string) {
    super(message);
    this.name = "CeoKnowledgeError";
  }
}

export interface CeoKnowledgeContext {
  brainContext: BrainAgentContext;
  reportSearchCount: number;
  reportTitles: string[];
}

function mergeRecordsIntoSlice(
  slices: BrainContextSlice[],
  domain: BrainContextSlice["domain"],
  records: BrainRecord[],
): BrainContextSlice[] {
  if (records.length === 0) return slices;

  const existing = slices.find((s) => s.domain === domain);
  const existingIds = new Set(
    (existing?.records ?? []).map((r) => r.id),
  );

  const newRecords = records.filter((r) => !existingIds.has(r.id));
  if (newRecords.length === 0) return slices;

  if (existing) {
    return slices.map((s) =>
      s.domain === domain
        ? { ...s, records: [...s.records, ...newRecords] }
        : s,
    );
  }

  return [
    ...slices,
    { domain, records: newRecords, relevanceScore: 1 },
  ];
}

function extractReportTitles(slices: BrainContextSlice[]): string[] {
  const reportSlice = slices.find((s) => s.domain === "reports");
  if (!reportSlice) return [];
  return reportSlice.records.map((r) => r.title);
}

/**
 * Load workspace knowledge before CEO reasoning.
 * Assembles Brain context and performs keyword search across reports.
 */
export async function retrieveCeoKnowledge(input: {
  workspaceId: string;
  question: string;
  locale?: Locale;
}): Promise<CeoKnowledgeContext> {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const dict = getDictionary(locale);
  const assembler = getBrainContextAssembler();
  const brain = getBrainClient();

  const baseContext = await assembler.assemble({
    workspaceId: input.workspaceId,
    agentId: "ceo",
    domains: [...CEO_CONTEXT_DOMAINS],
    locale,
  });

  const reportSearch = await brain.searchRecords({
    workspaceId: input.workspaceId,
    domains: ["reports"],
    status: [...CEO_CONTEXT_STATUSES],
    query: input.question,
    limit: 12,
  });

  let slices = mergeRecordsIntoSlice(
    baseContext.slices,
    "reports",
    reportSearch.records,
  );

  const competitorSearch = await brain.searchRecords({
    workspaceId: input.workspaceId,
    domains: ["competitor_intelligence"],
    status: [...CEO_CONTEXT_STATUSES],
    query: input.question,
    limit: 6,
  });

  slices = mergeRecordsIntoSlice(
    slices,
    "competitor_intelligence",
    competitorSearch.records,
  );

  const sourceRecordIds = [
    ...new Set(slices.flatMap((s) => s.records.map((r) => r.id))),
  ];

  if (sourceRecordIds.length === 0) {
    throw new CeoKnowledgeError(dict.ceo.errors.noKnowledge);
  }

  const promptContext = buildPromptContext(slices, locale);
  const reportTitles = extractReportTitles(slices);

  const brainContext: BrainAgentContext = {
    ...baseContext,
    slices,
    promptContext,
    sourceRecordIds,
    tokenEstimate: estimateTokens(promptContext),
  };

  console.info("[CEO Knowledge] Context retrieved", {
    workspaceId: input.workspaceId,
    questionPreview: input.question.slice(0, 120),
    recordCount: sourceRecordIds.length,
    reportSearchHits: reportSearch.records.length,
    reportTitles,
    domains: slices.map((s) => ({
      domain: s.domain,
      count: s.records.length,
    })),
    tokenEstimate: brainContext.tokenEstimate,
  });

  return {
    brainContext,
    reportSearchCount: reportSearch.records.length,
    reportTitles,
  };
}
