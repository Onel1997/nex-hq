import { getBrainClient } from "@/brain/client";
import type { BrainSearchOptions } from "@/brain/client";
import { estimateTokens } from "@/brain/client/utils";
import type { BrainAgentContext, BrainContextSlice } from "@/brain/context";
import {
  CEO_CONTEXT_STATUSES,
  getBrainContextAssembler,
} from "@/brain/context/assembler-impl";
import { buildPromptContext } from "@/brain/context/prompt-builder";
import { loadBusinessProfile } from "@/lib/business/load-profile";
import { buildDesignStudioIntelligence } from "@/lib/design/studio-intelligence";
import { formatDesignStudioPrompt } from "@/lib/design/studio-prompt";
import { loadShopifyAgentContext } from "@/lib/shopify/agent-context";
import type { ProductKnowledge } from "@/lib/shopify/types";
import type { BrainRecord } from "@/brain/types";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

import {
  extractBriefingKeywords,
  sanitizeSearchTerm,
} from "@/brain/client/search-utils";

export { extractBriefingKeywords, sanitizeSearchTerm };

/** Brand and design memory domains loaded for collection concepts. */
export const DESIGN_CONTEXT_DOMAINS = [
  "company_profile",
  "brand_vision",
  "brand_rules",
  "design_memory",
] as const;

/** Intelligence report tags the Design Agent must consult. */
export const DESIGN_INTELLIGENCE_TAGS = [
  "trend",
  "competitor",
  "pricing",
  "ceo-report",
] as const;

export class DesignKnowledgeError extends Error {
  readonly code = "NO_KNOWLEDGE" as const;

  constructor(message: string) {
    super(message);
    this.name = "DesignKnowledgeError";
  }
}

export interface DesignKnowledgeContext {
  brainContext: BrainAgentContext;
  intelligenceReportCount: number;
  reportTitles: string[];
  loadedTags: string[];
  shopifyKnowledge: ProductKnowledge;
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

function isIntelligenceReport(record: BrainRecord): boolean {
  const tags = record.tags ?? [];
  return DESIGN_INTELLIGENCE_TAGS.some((tag) => tags.includes(tag));
}

type ReportSearchBase = Pick<
  BrainSearchOptions,
  "workspaceId" | "domains" | "status" | "tags" | "limit"
>;

async function safeSearchRecords(
  search: (options: BrainSearchOptions) => Promise<{ records: BrainRecord[] }>,
  options: BrainSearchOptions,
  context: string,
): Promise<BrainRecord[]> {
  try {
    const result = await search(options);
    return result.records;
  } catch (error) {
    console.warn(`[Design Knowledge] Brain search failed (${context})`, {
      error: error instanceof Error ? error.message : error,
      hadQuery: Boolean(options.query),
      tags: options.tags,
    });
    return [];
  }
}

async function searchReportsWithFallback(
  search: (options: BrainSearchOptions) => Promise<{ records: BrainRecord[] }>,
  base: ReportSearchBase,
  keywords: string[],
  context: string,
): Promise<BrainRecord[]> {
  const seen = new Set<string>();
  const merged: BrainRecord[] = [];

  const add = (records: BrainRecord[]) => {
    for (const record of records) {
      if (!seen.has(record.id)) {
        seen.add(record.id);
        merged.push(record);
      }
    }
  };

  for (const keyword of keywords) {
    const term = sanitizeSearchTerm(keyword);
    if (!term) continue;

    const records = await safeSearchRecords(
      search,
      { ...base, query: term },
      `${context}:keyword:${term}`,
    );
    add(records);

    if (merged.length >= (base.limit ?? 10)) {
      return merged.slice(0, base.limit);
    }
  }

  if (merged.length === 0) {
    const latest = await safeSearchRecords(
      search,
      base,
      `${context}:latest-fallback`,
    );
    add(latest);
  }

  return merged.slice(0, base.limit);
}

/**
 * Load trend, competitor, pricing and CEO reports plus brand context
 * before generating a design collection concept.
 */
export async function retrieveDesignKnowledge(input: {
  workspaceId: string;
  brief: string;
  locale?: Locale;
}): Promise<DesignKnowledgeContext> {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const dict = getDictionary(locale);
  const assembler = getBrainContextAssembler();
  const brain = getBrainClient();
  const keywords = extractBriefingKeywords(input.brief);

  const baseContext = await assembler.assemble({
    workspaceId: input.workspaceId,
    agentId: "designer",
    domains: [...DESIGN_CONTEXT_DOMAINS],
    locale,
  });

  let slices = [...baseContext.slices];
  const loadedTags: string[] = [];

  const search = brain.searchRecords.bind(brain);

  for (const tag of DESIGN_INTELLIGENCE_TAGS) {
    const records = await searchReportsWithFallback(
      search,
      {
        workspaceId: input.workspaceId,
        domains: ["reports"],
        status: [...CEO_CONTEXT_STATUSES],
        tags: [tag],
        limit: 6,
      },
      keywords,
      `tag:${tag}`,
    );

    if (records.length > 0) {
      loadedTags.push(tag);
      slices = mergeRecordsIntoSlice(slices, "reports", records);
    }
  }

  const relevanceRecords = await searchReportsWithFallback(
    search,
    {
      workspaceId: input.workspaceId,
      domains: ["reports"],
      status: [...CEO_CONTEXT_STATUSES],
      limit: 10,
    },
    keywords,
    "relevance",
  );

  const intelligenceRecords = relevanceRecords.filter(isIntelligenceReport);
  slices = mergeRecordsIntoSlice(slices, "reports", intelligenceRecords);

  let reportSlice = slices.find((s) => s.domain === "reports");
  let intelligenceReportCount =
    reportSlice?.records.filter(isIntelligenceReport).length ?? 0;

  if (intelligenceReportCount === 0) {
    console.warn(
      "[Design Knowledge] No intelligence reports from keyword search — loading latest by tag",
      { keywords },
    );

    for (const tag of DESIGN_INTELLIGENCE_TAGS) {
      const records = await safeSearchRecords(
        search,
        {
          workspaceId: input.workspaceId,
          domains: ["reports"],
          status: [...CEO_CONTEXT_STATUSES],
          tags: [tag],
          limit: 6,
        },
        `final-fallback:${tag}`,
      );

      if (records.length > 0) {
        if (!loadedTags.includes(tag)) loadedTags.push(tag);
        slices = mergeRecordsIntoSlice(slices, "reports", records);
      }
    }

    reportSlice = slices.find((s) => s.domain === "reports");
    intelligenceReportCount =
      reportSlice?.records.filter(isIntelligenceReport).length ?? 0;
  }

  if (intelligenceReportCount === 0) {
    throw new DesignKnowledgeError(dict.design.errors.noKnowledge);
  }

  const sourceRecordIds = [
    ...new Set(slices.flatMap((s) => s.records.map((r) => r.id))),
  ];

  const { knowledge, productKnowledge: shopifyKnowledge } =
    await loadShopifyAgentContext();
  const businessProfile = await loadBusinessProfile(input.workspaceId);
  const studio = buildDesignStudioIntelligence(knowledge);
  const promptContext =
    buildPromptContext(
      slices,
      locale,
      shopifyKnowledge,
      businessProfile,
    ) +
    "\n\n" +
    formatDesignStudioPrompt(studio);
  const reportTitles = extractReportTitles(slices);

  const brainContext: BrainAgentContext = {
    ...baseContext,
    slices,
    promptContext,
    sourceRecordIds,
    tokenEstimate: estimateTokens(promptContext),
  };

  console.info("[Design Knowledge] Context retrieved", {
    workspaceId: input.workspaceId,
    briefPreview: input.brief.slice(0, 120),
    searchKeywords: keywords,
    recordCount: sourceRecordIds.length,
    intelligenceReportCount,
    loadedTags,
    reportTitles,
    domains: slices.map((s) => ({
      domain: s.domain,
      count: s.records.length,
    })),
    tokenEstimate: brainContext.tokenEstimate,
  });

  return {
    brainContext,
    intelligenceReportCount,
    reportTitles,
    loadedTags,
    shopifyKnowledge,
  };
}
