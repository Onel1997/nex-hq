import { getBrainClient } from "@/brain/client";
import type { BrainSearchOptions } from "@/brain/client";
import { estimateTokens } from "@/brain/client/utils";
import type { BrainAgentContext, BrainContextSlice } from "@/brain/context";
import {
  CEO_CONTEXT_STATUSES,
  getBrainContextAssembler,
} from "@/brain/context/assembler-impl";
import { buildPromptContext } from "@/brain/context/prompt-builder";
import type { BrainReportContent } from "@/brain/domains/reports";
import type { BrainRecord } from "@/brain/types";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import {
  extractBriefingKeywords,
  sanitizeSearchTerm,
} from "@/agents/design/retrieve-context";

/** Brand and content memory domains for copywriting. */
export const CONTENT_CONTEXT_DOMAINS = [
  "company_profile",
  "brand_vision",
  "brand_rules",
  "content_memory",
  "marketing_memory",
] as const;

/** Intelligence report tags the Content Agent must consult. */
export const CONTENT_INTELLIGENCE_TAGS = [
  "ceo-report",
  "design-report",
  "marketing-report",
  "shopify-report",
] as const;

/** All four primary sources must be present before running. */
export const CONTENT_PRIMARY_TAGS = [
  "ceo-report",
  "design-report",
  "marketing-report",
  "shopify-report",
] as const;

/** Canonical report type → accepted DB tags and content.reportType aliases. */
export const CONTENT_REPORT_TAG_ALIASES: Record<
  (typeof CONTENT_PRIMARY_TAGS)[number],
  readonly string[]
> = {
  "ceo-report": ["ceo-report", "ceo"],
  "design-report": ["design-report", "designer", "design"],
  "marketing-report": ["marketing-report", "marketing"],
  "shopify-report": ["shopify-report", "shopify"],
};

const REPORT_TYPE_NORMALIZE: Record<string, (typeof CONTENT_PRIMARY_TAGS)[number]> = {
  "ceo-report": "ceo-report",
  ceo: "ceo-report",
  ceo_report: "ceo-report",
  "design-report": "design-report",
  designer: "design-report",
  design: "design-report",
  design_report: "design-report",
  "marketing-report": "marketing-report",
  marketing: "marketing-report",
  marketing_report: "marketing-report",
  "shopify-report": "shopify-report",
  shopify: "shopify-report",
  shopify_report: "shopify-report",
};

export class ContentKnowledgeError extends Error {
  readonly code = "NO_KNOWLEDGE" as const;
  readonly missingReportTypes: (typeof CONTENT_PRIMARY_TAGS)[number][];
  readonly primaryReportCounts: Record<
    (typeof CONTENT_PRIMARY_TAGS)[number],
    number
  >;
  readonly workspaceId: string;

  constructor(
    message: string,
    details: {
      missingReportTypes: (typeof CONTENT_PRIMARY_TAGS)[number][];
      primaryReportCounts: Record<
        (typeof CONTENT_PRIMARY_TAGS)[number],
        number
      >;
      workspaceId: string;
    },
  ) {
    super(message);
    this.name = "ContentKnowledgeError";
    this.missingReportTypes = details.missingReportTypes;
    this.primaryReportCounts = details.primaryReportCounts;
    this.workspaceId = details.workspaceId;
  }
}

export interface ContentKnowledgeContext {
  brainContext: BrainAgentContext;
  intelligenceReportCount: number;
  primaryReportCounts: Record<(typeof CONTENT_PRIMARY_TAGS)[number], number>;
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

function normalizeReportTypeValue(
  value: string | undefined,
): (typeof CONTENT_PRIMARY_TAGS)[number] | undefined {
  if (!value) return undefined;
  const key = value.trim().toLowerCase().replace(/\s+/g, "_");
  return REPORT_TYPE_NORMALIZE[key];
}

function getRecordContent(
  record: BrainRecord,
): BrainReportContent | undefined {
  const content = record.content;
  if (!content || typeof content !== "object") return undefined;
  if ((content as BrainReportContent).kind !== "reports") return undefined;
  return content as BrainReportContent;
}

function matchesReportType(
  record: BrainRecord,
  canonicalType: (typeof CONTENT_PRIMARY_TAGS)[number],
): boolean {
  const aliases = CONTENT_REPORT_TAG_ALIASES[canonicalType];
  const tags = (record.tags ?? []).map((t) => t.toLowerCase());
  if (aliases.some((alias) => tags.includes(alias.toLowerCase()))) {
    return true;
  }

  const content = getRecordContent(record);
  const fromContent = normalizeReportTypeValue(content?.reportType);
  if (fromContent === canonicalType) return true;

  const fromAgent = normalizeReportTypeValue(content?.agentId);
  if (fromAgent === canonicalType) return true;

  return false;
}

function isIntelligenceReport(record: BrainRecord): boolean {
  return CONTENT_INTELLIGENCE_TAGS.some((tag) => matchesReportType(record, tag));
}

function countReportsByType(
  slices: BrainContextSlice[],
  canonicalType: (typeof CONTENT_PRIMARY_TAGS)[number],
): BrainRecord[] {
  const reportSlice = slices.find((s) => s.domain === "reports");
  if (!reportSlice) return [];
  return reportSlice.records.filter((r) => matchesReportType(r, canonicalType));
}

function searchTagsForType(
  canonicalType: (typeof CONTENT_PRIMARY_TAGS)[number],
): string[] {
  return [...CONTENT_REPORT_TAG_ALIASES[canonicalType]];
}

function getPrimaryReportCounts(
  slices: BrainContextSlice[],
): Record<(typeof CONTENT_PRIMARY_TAGS)[number], number> {
  return {
    "ceo-report": countReportsByType(slices, "ceo-report").length,
    "design-report": countReportsByType(slices, "design-report").length,
    "marketing-report": countReportsByType(slices, "marketing-report").length,
    "shopify-report": countReportsByType(slices, "shopify-report").length,
  };
}

type ContentPrimaryTag = (typeof CONTENT_PRIMARY_TAGS)[number];

function missingPrimaryTags(
  counts: Record<ContentPrimaryTag, number>,
): ContentPrimaryTag[] {
  return CONTENT_PRIMARY_TAGS.filter((tag) => counts[tag] === 0);
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
    console.warn(`[Content Knowledge] Brain search failed (${context})`, {
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
 * Load CEO, design, marketing and Shopify reports plus brand context
 * before generating publish-ready content.
 */
export async function retrieveContentKnowledge(input: {
  workspaceId: string;
  brief: string;
  locale?: Locale;
}): Promise<ContentKnowledgeContext> {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const dict = getDictionary(locale);
  const assembler = getBrainContextAssembler();
  const brain = getBrainClient();
  const keywords = extractBriefingKeywords(input.brief);

  const baseContext = await assembler.assemble({
    workspaceId: input.workspaceId,
    agentId: "content",
    domains: [...CONTENT_CONTEXT_DOMAINS],
    locale,
  });

  let slices = [...baseContext.slices];
  const loadedTags: string[] = [];
  const search = brain.searchRecords.bind(brain);

  for (const tag of CONTENT_INTELLIGENCE_TAGS) {
    const records = await searchReportsWithFallback(
      search,
      {
        workspaceId: input.workspaceId,
        domains: ["reports"],
        status: [...CEO_CONTEXT_STATUSES],
        tags: searchTagsForType(tag),
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

  let primaryReportCounts = getPrimaryReportCounts(slices);
  let missing = missingPrimaryTags(primaryReportCounts);

  if (missing.length > 0) {
    console.warn(
      "[Content Knowledge] Missing primary reports — loading latest by tag",
      { keywords, missing, primaryReportCounts },
    );

    for (const tag of missing) {
      const records = await safeSearchRecords(
        search,
        {
          workspaceId: input.workspaceId,
          domains: ["reports"],
          status: [...CEO_CONTEXT_STATUSES],
          tags: searchTagsForType(tag),
          limit: 8,
        },
        `final-fallback:${tag}`,
      );

      if (records.length > 0) {
        if (!loadedTags.includes(tag)) loadedTags.push(tag);
        slices = mergeRecordsIntoSlice(slices, "reports", records);
      }
    }

    primaryReportCounts = getPrimaryReportCounts(slices);
    missing = missingPrimaryTags(primaryReportCounts);
  }

  const ceoReports = countReportsByType(slices, "ceo-report");
  const designReports = countReportsByType(slices, "design-report");
  const marketingReports = countReportsByType(slices, "marketing-report");
  const shopifyReports = countReportsByType(slices, "shopify-report");

  console.log("CEO Reports", ceoReports.length);
  console.log("Design Reports", designReports.length);
  console.log("Marketing Reports", marketingReports.length);
  console.log("Shopify Reports", shopifyReports.length);

  if (missing.length > 0) {
    const diagnosticReports = await safeSearchRecords(
      search,
      {
        workspaceId: input.workspaceId,
        domains: ["reports"],
        status: [...CEO_CONTEXT_STATUSES],
        limit: 50,
      },
      "diagnostic:all-workspace-reports",
    );

    console.warn("[Content Knowledge] Missing primary report types", {
      workspaceId: input.workspaceId,
      missingReportTypes: missing,
      primaryReportCounts,
      loadedTags,
      diagnosticReportCount: diagnosticReports.length,
      diagnosticReports: diagnosticReports.map((record) => {
        const content = getRecordContent(record);
        return {
          id: record.id,
          title: record.title,
          status: record.status,
          tags: record.tags,
          reportType: content?.reportType,
          agentId: content?.agentId,
          matchedTypes: CONTENT_PRIMARY_TAGS.filter((type) =>
            matchesReportType(record, type),
          ),
        };
      }),
    });

    const missingLabels = missing
      .map((type: ContentPrimaryTag) => {
        const labels: Record<ContentPrimaryTag, string> = {
          "ceo-report": "CEO-Bericht (ceo-report)",
          "design-report": "Design-Bericht (design-report)",
          "marketing-report": "Marketing-Bericht (marketing-report)",
          "shopify-report": "Shopify-Bericht (shopify-report)",
        };
        return labels[type];
      })
      .join(", ");

    throw new ContentKnowledgeError(
      `${dict.content.errors.noKnowledge} Fehlend: ${missingLabels}.`,
      {
        missingReportTypes: missing,
        primaryReportCounts,
        workspaceId: input.workspaceId,
      },
    );
  }

  const reportSlice = slices.find((s) => s.domain === "reports");
  const intelligenceReportCount =
    reportSlice?.records.filter(isIntelligenceReport).length ?? 0;

  const sourceRecordIds = [
    ...new Set(slices.flatMap((s) => s.records.map((r) => r.id))),
  ];

  const promptContext = buildPromptContext(slices, locale);
  const reportTitles = extractReportTitles(slices);

  const brainContext: BrainAgentContext = {
    ...baseContext,
    slices,
    promptContext,
    sourceRecordIds,
    tokenEstimate: estimateTokens(promptContext),
  };

  console.info("[Content Knowledge] Context retrieved", {
    workspaceId: input.workspaceId,
    briefPreview: input.brief.slice(0, 120),
    searchKeywords: keywords,
    recordCount: sourceRecordIds.length,
    intelligenceReportCount,
    primaryReportCounts,
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
    primaryReportCounts,
    reportTitles,
    loadedTags,
  };
}
