import { getBrainClient } from "@/brain/client";
import type { BrainSearchOptions } from "@/brain/client";
import { estimateTokens } from "@/brain/client/utils";
import type { BrainAgentContext, BrainContextSlice } from "@/brain/context";
import {
  CEO_CONTEXT_STATUSES,
  getBrainContextAssembler,
} from "@/brain/context/assembler-impl";
import { buildPromptContext } from "@/brain/context/prompt-builder";
import { loadShopifyAgentContext } from "@/lib/shopify/agent-context";
import type { BrainRecord } from "@/brain/types";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import {
  extractBriefingKeywords,
  sanitizeSearchTerm,
} from "@/agents/design/retrieve-context";

/** Brand and commerce memory domains for storefront planning. */
export const SHOPIFY_CONTEXT_DOMAINS = [
  "company_profile",
  "brand_vision",
  "brand_rules",
  "product_memory",
  "storefront_memory",
] as const;

/** Intelligence report tags the Shopify Agent must consult. */
export const SHOPIFY_INTELLIGENCE_TAGS = [
  "design-report",
  "marketing-report",
  "ceo-report",
  "research",
] as const;

/** Primary sources — both must be present before running. */
export const SHOPIFY_PRIMARY_TAGS = [
  "design-report",
  "marketing-report",
] as const;

const RESEARCH_SUBTYPE_TAGS = [
  "competitor",
  "trend",
  "pricing",
  "audience",
] as const;

export class ShopifyKnowledgeError extends Error {
  readonly code = "NO_KNOWLEDGE" as const;

  constructor(message: string) {
    super(message);
    this.name = "ShopifyKnowledgeError";
  }
}

export interface ShopifyKnowledgeContext {
  brainContext: BrainAgentContext;
  intelligenceReportCount: number;
  designReportCount: number;
  marketingReportCount: number;
  reportTitles: string[];
  loadedTags: string[];
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

function hasTag(record: BrainRecord, tag: string): boolean {
  return (record.tags ?? []).includes(tag);
}

function isIntelligenceReport(record: BrainRecord): boolean {
  const tags = record.tags ?? [];
  if (SHOPIFY_INTELLIGENCE_TAGS.some((tag) => tags.includes(tag))) {
    return true;
  }
  return RESEARCH_SUBTYPE_TAGS.some((tag) => tags.includes(tag));
}

function countReportsByTag(
  slices: BrainContextSlice[],
  tag: string,
): number {
  const reportSlice = slices.find((s) => s.domain === "reports");
  if (!reportSlice) return 0;
  return reportSlice.records.filter((r) => hasTag(r, tag)).length;
}

async function safeSearchRecords(
  search: (options: BrainSearchOptions) => Promise<{ records: BrainRecord[] }>,
  options: BrainSearchOptions,
  context: string,
): Promise<BrainRecord[]> {
  try {
    const result = await search(options);
    return result.records;
  } catch (error) {
    console.warn(`[Shopify Knowledge] Brain search failed (${context})`, {
      error: error instanceof Error ? error.message : error,
      hadQuery: Boolean(options.query),
      tags: options.tags,
    });
    return [];
  }
}

async function searchReportsWithFallback(
  search: (options: BrainSearchOptions) => Promise<{ records: BrainRecord[] }>,
  base: Pick<
    BrainSearchOptions,
    "workspaceId" | "domains" | "status" | "tags" | "limit"
  >,
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
 * Load design, marketing, CEO and research reports plus brand/commerce context
 * before generating Shopify storefront drafts.
 */
export async function retrieveShopifyKnowledge(input: {
  workspaceId: string;
  brief: string;
  locale?: Locale;
}): Promise<ShopifyKnowledgeContext> {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const dict = getDictionary(locale);
  const assembler = getBrainContextAssembler();
  const brain = getBrainClient();
  const keywords = extractBriefingKeywords(input.brief);

  const baseContext = await assembler.assemble({
    workspaceId: input.workspaceId,
    agentId: "shopify",
    domains: [...SHOPIFY_CONTEXT_DOMAINS],
    locale,
  });

  let slices = [...baseContext.slices];
  const loadedTags: string[] = [];
  const search = brain.searchRecords.bind(brain);

  for (const tag of SHOPIFY_INTELLIGENCE_TAGS) {
    const records = await searchReportsWithFallback(
      search,
      {
        workspaceId: input.workspaceId,
        domains: ["reports"],
        status: [...CEO_CONTEXT_STATUSES],
        tags: [tag],
        limit: 8,
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
      limit: 12,
    },
    keywords,
    "relevance",
  );

  const intelligenceRecords = relevanceRecords.filter(isIntelligenceReport);
  slices = mergeRecordsIntoSlice(slices, "reports", intelligenceRecords);

  let reportSlice = slices.find((s) => s.domain === "reports");
  let intelligenceReportCount =
    reportSlice?.records.filter(isIntelligenceReport).length ?? 0;

  let designReportCount = countReportsByTag(slices, "design-report");
  let marketingReportCount = countReportsByTag(slices, "marketing-report");

  if (
    intelligenceReportCount === 0 ||
    designReportCount === 0 ||
    marketingReportCount === 0
  ) {
    console.warn(
      "[Shopify Knowledge] Missing primary reports — loading latest by tag",
      { keywords, designReportCount, marketingReportCount },
    );

    for (const tag of SHOPIFY_PRIMARY_TAGS) {
      const records = await safeSearchRecords(
        search,
        {
          workspaceId: input.workspaceId,
          domains: ["reports"],
          status: [...CEO_CONTEXT_STATUSES],
          tags: [tag],
          limit: 8,
        },
        `final-fallback:${tag}`,
      );

      if (records.length > 0) {
        if (!loadedTags.includes(tag)) loadedTags.push(tag);
        slices = mergeRecordsIntoSlice(slices, "reports", records);
      }
    }

    for (const tag of SHOPIFY_INTELLIGENCE_TAGS) {
      if (SHOPIFY_PRIMARY_TAGS.includes(tag as (typeof SHOPIFY_PRIMARY_TAGS)[number])) {
        continue;
      }

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
    designReportCount = countReportsByTag(slices, "design-report");
    marketingReportCount = countReportsByTag(slices, "marketing-report");
  }

  if (designReportCount === 0 || marketingReportCount === 0) {
    throw new ShopifyKnowledgeError(dict.shopify.errors.noKnowledge);
  }

  const sourceRecordIds = [
    ...new Set(slices.flatMap((s) => s.records.map((r) => r.id))),
  ];

  const { productKnowledge: shopifyKnowledge } = await loadShopifyAgentContext();
  const promptContext = buildPromptContext(slices, locale, shopifyKnowledge);
  const reportTitles = extractReportTitles(slices);

  const brainContext: BrainAgentContext = {
    ...baseContext,
    slices,
    promptContext,
    sourceRecordIds,
    tokenEstimate: estimateTokens(promptContext),
  };

  console.info("[Shopify Knowledge] Context retrieved", {
    workspaceId: input.workspaceId,
    briefPreview: input.brief.slice(0, 120),
    searchKeywords: keywords,
    recordCount: sourceRecordIds.length,
    intelligenceReportCount,
    designReportCount,
    marketingReportCount,
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
    designReportCount,
    marketingReportCount,
    reportTitles,
    loadedTags,
  };
}
