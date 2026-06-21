import { getBrainClient } from "@/brain/client";
import type { BrainSearchOptions } from "@/brain/client";
import { extractBriefingKeywords, sanitizeSearchTerm } from "@/brain/client/search-utils";
import { estimateTokens } from "@/brain/client/utils";
import type { BrainAgentContext, BrainContextSlice } from "@/brain/context";
import {
  CEO_CONTEXT_STATUSES,
  getBrainContextAssembler,
} from "@/brain/context/assembler-impl";
import { buildPromptContext } from "@/brain/context/prompt-builder";
import type { BrainReportContent } from "@/brain/domains/reports";
import {
  extractImageInputsFromDesign,
  formatDesignCreativeBrief,
} from "@/lib/design/creative-brief";
import type { BrainRecord } from "@/brain/types";
import {
  type ImageCollectionIdentity,
  extractCollectionIdentity,
} from "./collection-identity";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

/** Brand and visual memory domains for image production. */
export const IMAGE_CONTEXT_DOMAINS = [
  "company_profile",
  "brand_vision",
  "brand_rules",
  "design_memory",
  "content_memory",
  "marketing_memory",
] as const;

/** Intelligence report tags the Image Agent must consult. */
export const IMAGE_INTELLIGENCE_TAGS = [
  "ceo-report",
  "design-report",
  "content-report",
  "marketing-report",
] as const;

/** Primary sources required before generating visual production projects. */
export const IMAGE_PRIMARY_TAGS = [
  "ceo-report",
  "design-report",
  "content-report",
  "marketing-report",
] as const;

export const IMAGE_REPORT_TAG_ALIASES: Record<
  (typeof IMAGE_PRIMARY_TAGS)[number],
  readonly string[]
> = {
  "ceo-report": ["ceo-report", "ceo"],
  "design-report": ["design-report", "designer", "design"],
  "content-report": ["content-report", "content"],
  "marketing-report": ["marketing-report", "marketing"],
};

const REPORT_TYPE_NORMALIZE: Record<string, (typeof IMAGE_PRIMARY_TAGS)[number]> = {
  "ceo-report": "ceo-report",
  ceo: "ceo-report",
  ceo_report: "ceo-report",
  "design-report": "design-report",
  designer: "design-report",
  design: "design-report",
  design_report: "design-report",
  "content-report": "content-report",
  content: "content-report",
  content_report: "content-report",
  "marketing-report": "marketing-report",
  marketing: "marketing-report",
  marketing_report: "marketing-report",
};

export class ImageKnowledgeError extends Error {
  readonly code = "NO_KNOWLEDGE" as const;
  readonly missingReportTypes: (typeof IMAGE_PRIMARY_TAGS)[number][];
  readonly primaryReportCounts: Record<
    (typeof IMAGE_PRIMARY_TAGS)[number],
    number
  >;
  readonly workspaceId: string;

  constructor(
    message: string,
    details: {
      missingReportTypes: (typeof IMAGE_PRIMARY_TAGS)[number][];
      primaryReportCounts: Record<
        (typeof IMAGE_PRIMARY_TAGS)[number],
        number
      >;
      workspaceId: string;
    },
  ) {
    super(message);
    this.name = "ImageKnowledgeError";
    this.missingReportTypes = details.missingReportTypes;
    this.primaryReportCounts = details.primaryReportCounts;
    this.workspaceId = details.workspaceId;
  }
}

export interface ImageKnowledgeContext {
  brainContext: BrainAgentContext;
  intelligenceReportCount: number;
  primaryReportCounts: Record<(typeof IMAGE_PRIMARY_TAGS)[number], number>;
  reportTitles: string[];
  loadedTags: string[];
  collectionIdentity: ImageCollectionIdentity;
  designCreativeBrief: string | null;
  designImageInputs: ReturnType<typeof extractImageInputsFromDesign> | null;
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

function extractLatestDesignContext(slices: BrainContextSlice[]): {
  brief: string | null;
  inputs: ReturnType<typeof extractImageInputsFromDesign> | null;
} {
  const reportSlice = slices.find((s) => s.domain === "reports");
  if (!reportSlice) return { brief: null, inputs: null };

  const designRecord = reportSlice.records
    .filter((record) => matchesReportType(record, "design-report"))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];

  if (!designRecord) return { brief: null, inputs: null };

  const content = getRecordContent(designRecord);
  if (!content?.designSections) return { brief: null, inputs: null };

  return {
    brief: formatDesignCreativeBrief(content.designSections),
    inputs: extractImageInputsFromDesign(content.designSections),
  };
}

function extractReportTitles(slices: BrainContextSlice[]): string[] {
  const reportSlice = slices.find((s) => s.domain === "reports");
  if (!reportSlice) return [];
  return reportSlice.records.map((r) => r.title);
}

function getRecordContent(
  record: BrainRecord,
): BrainReportContent | undefined {
  const content = record.content;
  if (!content || typeof content !== "object") return undefined;
  if ((content as BrainReportContent).kind !== "reports") return undefined;
  return content as BrainReportContent;
}

function normalizeReportTypeValue(
  value: string | undefined,
): (typeof IMAGE_PRIMARY_TAGS)[number] | undefined {
  if (!value) return undefined;
  const key = value.trim().toLowerCase().replace(/\s+/g, "_");
  return REPORT_TYPE_NORMALIZE[key];
}

function matchesReportType(
  record: BrainRecord,
  canonicalType: (typeof IMAGE_PRIMARY_TAGS)[number],
): boolean {
  const aliases = IMAGE_REPORT_TAG_ALIASES[canonicalType];
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
  return IMAGE_INTELLIGENCE_TAGS.some((tag) => matchesReportType(record, tag));
}

function countReportsByType(
  slices: BrainContextSlice[],
  canonicalType: (typeof IMAGE_PRIMARY_TAGS)[number],
): number {
  const reportSlice = slices.find((s) => s.domain === "reports");
  if (!reportSlice) return 0;
  return reportSlice.records.filter((r) =>
    matchesReportType(r, canonicalType),
  ).length;
}

function getPrimaryReportCounts(
  slices: BrainContextSlice[],
): Record<(typeof IMAGE_PRIMARY_TAGS)[number], number> {
  return {
    "ceo-report": countReportsByType(slices, "ceo-report"),
    "design-report": countReportsByType(slices, "design-report"),
    "content-report": countReportsByType(slices, "content-report"),
    "marketing-report": countReportsByType(slices, "marketing-report"),
  };
}

function searchTagsForType(
  canonicalType: (typeof IMAGE_PRIMARY_TAGS)[number],
): string[] {
  return [...IMAGE_REPORT_TAG_ALIASES[canonicalType]];
}

function missingPrimaryTags(
  counts: Record<(typeof IMAGE_PRIMARY_TAGS)[number], number>,
): (typeof IMAGE_PRIMARY_TAGS)[number][] {
  return IMAGE_PRIMARY_TAGS.filter((tag) => counts[tag] === 0);
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
    console.warn(`[Image Knowledge] Brain search failed (${context})`, {
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
 * Load CEO, design, content and marketing reports plus brand context
 * before generating visual production projects.
 */
export async function retrieveImageKnowledge(input: {
  workspaceId: string;
  brief: string;
  workspaceName?: string;
  locale?: Locale;
}): Promise<ImageKnowledgeContext> {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const dict = getDictionary(locale);
  const assembler = getBrainContextAssembler();
  const brain = getBrainClient();
  const keywords = extractBriefingKeywords(input.brief);

  const baseContext = await assembler.assemble({
    workspaceId: input.workspaceId,
    agentId: "image",
    domains: [...IMAGE_CONTEXT_DOMAINS],
    locale,
  });

  let slices = [...baseContext.slices];
  const loadedTags: string[] = [];
  const search = brain.searchRecords.bind(brain);

  for (const tag of IMAGE_INTELLIGENCE_TAGS) {
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
      "[Image Knowledge] Missing primary reports — loading latest by tag",
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

  if (missing.length > 0) {
    const missingLabels = missing
      .map((type) => {
        const labels: Record<(typeof IMAGE_PRIMARY_TAGS)[number], string> = {
          "ceo-report": "CEO-Bericht (ceo-report)",
          "design-report": "Design-Bericht (design-report)",
          "content-report": "Content-Bericht (content-report)",
          "marketing-report": "Marketing-Bericht (marketing-report)",
        };
        return labels[type];
      })
      .join(", ");

    throw new ImageKnowledgeError(
      `${dict.image.errors.noKnowledge} Fehlend: ${missingLabels}.`,
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
  const collectionIdentity = extractCollectionIdentity({
    slices,
    brief: input.brief,
    workspaceName: input.workspaceName,
  });
  const designContext = extractLatestDesignContext(slices);

  const brainContext: BrainAgentContext = {
    ...baseContext,
    slices,
    promptContext,
    sourceRecordIds,
    tokenEstimate: estimateTokens(promptContext),
  };

  console.info("[Image Knowledge] Context retrieved", {
    workspaceId: input.workspaceId,
    briefPreview: input.brief.slice(0, 120),
    searchKeywords: keywords,
    recordCount: sourceRecordIds.length,
    intelligenceReportCount,
    primaryReportCounts,
    loadedTags,
    reportTitles,
    collectionName: collectionIdentity.collectionName,
    campaignName: collectionIdentity.campaignName,
    projectName: collectionIdentity.projectName,
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
    collectionIdentity,
    designCreativeBrief: designContext.brief,
    designImageInputs: designContext.inputs,
  };
}
