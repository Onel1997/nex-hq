import { getBrainClient } from "@/brain/client";
import type { BrainSearchOptions } from "@/brain/client";
import { estimateTokens } from "@/brain/client/utils";
import type { BrainAgentContext, BrainContextSlice } from "@/brain/context";
import {
  CEO_CONTEXT_STATUSES,
  getBrainContextAssembler,
} from "@/brain/context/assembler-impl";
import { buildPromptContext } from "@/brain/context/prompt-builder";
import { formatAgentBusinessRules, loadBusinessProfile } from "@/lib/business";
import { formatResearchCommerceSignals } from "@/lib/commerce/department-signals";
import { formatResearchIntelligencePrompt } from "@/lib/research/intelligence-prompt";
import { formatProductIntelligencePrompt } from "@/services/productIntelligenceEngine";
import type { ProductIntelligenceCatalog } from "@/services/productIntelligenceEngine";
import { loadResearchIntelligence } from "@/services/researchEngine";
import type { ResearchIntelligenceBundle } from "@/services/researchEngine";
import type { BrainRecord } from "@/brain/types";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import {
  extractBriefingKeywords,
  sanitizeSearchTerm,
} from "@/agents/design/retrieve-context";

export const RESEARCH_CONTEXT_DOMAINS = [
  "company_profile",
  "brand_vision",
  "brand_rules",
  "competitor_intelligence",
  "design_memory",
  "product_memory",
] as const;

export const RESEARCH_INTELLIGENCE_TAGS = [
  "research",
  "trend",
  "competitor",
  "pricing",
  "audience",
  "design",
  "ceo-report",
] as const;

export interface ResearchKnowledgeContext {
  brainContext: BrainAgentContext & {
    productIntelligence: ProductIntelligenceCatalog;
  };
  intelligence: ResearchIntelligenceBundle;
  intelligenceReportCount: number;
  reportTitles: string[];
}

type ReportSearchBase = Pick<
  BrainSearchOptions,
  "workspaceId" | "domains" | "status" | "limit"
>;

function mergeRecordsIntoSlice(
  slices: BrainContextSlice[],
  domain: BrainContextSlice["domain"],
  records: BrainRecord[],
): BrainContextSlice[] {
  if (records.length === 0) return slices;

  const existing = slices.find((s) => s.domain === domain);
  const existingIds = new Set((existing?.records ?? []).map((r) => r.id));
  const newRecords = records.filter((r) => !existingIds.has(r.id));
  if (newRecords.length === 0) return slices;

  if (existing) {
    return slices.map((s) =>
      s.domain === domain
        ? { ...s, records: [...s.records, ...newRecords] }
        : s,
    );
  }

  return [...slices, { domain, records: newRecords, relevanceScore: 1 }];
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
    console.warn(`[Research Knowledge] Brain search failed (${context})`, error);
    return [];
  }
}

/** Load full research knowledge: live intelligence + Brain context + prior reports. */
export async function retrieveResearchKnowledge(input: {
  workspaceId: string;
  request: string;
  locale?: Locale;
}): Promise<ResearchKnowledgeContext> {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const assembler = getBrainContextAssembler();
  const brain = getBrainClient();
  const businessProfile = await loadBusinessProfile(input.workspaceId);

  const [intelligence, baseContext] = await Promise.all([
    loadResearchIntelligence(),
    assembler.assemble({
      workspaceId: input.workspaceId,
      agentId: "research",
      domains: [...RESEARCH_CONTEXT_DOMAINS],
      locale,
    }),
  ]);

  const searchBase: ReportSearchBase = {
    workspaceId: input.workspaceId,
    domains: ["reports"],
    status: [...CEO_CONTEXT_STATUSES],
    limit: 12,
  };

  const keywords = extractBriefingKeywords(input.request);
  const searchTerm = sanitizeSearchTerm(keywords.join(" "));

  const taggedReports = await safeSearchRecords(
    (opts) => brain.searchRecords(opts),
    { ...searchBase, tags: [...RESEARCH_INTELLIGENCE_TAGS] },
    "tagged-reports",
  );

  const keywordReports =
    searchTerm.length > 0
      ? await safeSearchRecords(
          (opts) => brain.searchRecords(opts),
          { ...searchBase, query: searchTerm },
          "keyword-reports",
        )
      : [];

  const reportRecords = [...taggedReports, ...keywordReports].filter(
    (record, index, arr) => arr.findIndex((r) => r.id === record.id) === index,
  );

  let slices = mergeRecordsIntoSlice(
    baseContext.slices,
    "reports",
    reportRecords,
  );

  const commercePrompt = intelligence.baseline
    ? formatResearchCommerceSignals(intelligence.baseline)
    : "";

  const livePrompt = formatResearchIntelligencePrompt(intelligence);

  const productPrompt = formatProductIntelligencePrompt(
    intelligence.productIntelligence,
  );

  const promptContext = [
    livePrompt,
    commercePrompt ? `\n\n${commercePrompt}` : "",
    `\n\n${productPrompt}`,
    "\n\n",
    formatAgentBusinessRules("research", businessProfile),
    "\n\n## Workspace-Kontext\n\n",
    buildPromptContext(slices),
  ].join("");

  const brainContext: ResearchKnowledgeContext["brainContext"] = {
    workspaceId: input.workspaceId,
    agentId: "research",
    assembledAt: new Date().toISOString(),
    slices,
    promptContext,
    productIntelligence: intelligence.productIntelligence,
    sourceRecordIds: [
      ...baseContext.sourceRecordIds,
      ...reportRecords.map((r) => r.id),
    ],
    tokenEstimate: estimateTokens(promptContext),
  };

  return {
    brainContext,
    intelligence,
    intelligenceReportCount: reportRecords.length,
    reportTitles: reportRecords.map((r) => r.title),
  };
}
