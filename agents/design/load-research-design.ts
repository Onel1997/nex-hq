import "server-only";

import { getBrainClient } from "@/brain/client";
import type { BrainReportContent } from "@/brain/domains/reports";
import type { BrainRecord } from "@/brain/types";
import {
  designConceptSchema,
  researchCollectionSchema,
  type DesignConcept,
  type ResearchCollection,
} from "@/agents/research/types";
import { normalizeDesignConcepts } from "@/agents/research/design-concept";

export interface LoadedResearchDesignReport {
  reportId: string;
  brainRecordId: string;
  title: string;
  collection?: ResearchCollection;
  designs: DesignConcept[];
}

interface DesignResearchPayload {
  title?: string;
  collection?: unknown;
  designs?: unknown[];
}

function parseDesignPayload(raw: unknown): DesignConcept[] {
  if (!raw || typeof raw !== "object") return [];
  const designs = (raw as DesignResearchPayload).designs;
  if (!Array.isArray(designs) || designs.length === 0) return [];

  const parsed: DesignConcept[] = [];
  for (const entry of designs) {
    const result = designConceptSchema.safeParse(entry);
    if (result.success) {
      parsed.push(result.data);
      continue;
    }
    const normalized = normalizeDesignConcepts([entry], {});
    const first = normalized?.[0];
    if (first) {
      parsed.push(first);
    }
  }
  return parsed;
}

function extractJsonArtifactPayload(
  content: BrainReportContent,
): DesignResearchPayload | null {
  for (const artifact of content.artifacts) {
    if (artifact.type !== "json") continue;
    if (
      !artifact.id.endsWith("-design-payload") &&
      artifact.label !== "Design-Konzepte (structured)"
    ) {
      continue;
    }
    try {
      const parsed = JSON.parse(artifact.content) as DesignResearchPayload;
      if (Array.isArray(parsed.designs) && parsed.designs.length > 0) {
        return parsed;
      }
    } catch {
      // try next artifact
    }
  }
  return null;
}

function extractStructuredSectionPayload(
  content: BrainReportContent,
): DesignResearchPayload | null {
  const payload = content.researchSections?.designResearch;
  if (!payload?.designs?.length) return null;
  return payload;
}

function parseCollection(raw: unknown): ResearchCollection | undefined {
  if (!raw) return undefined;
  const result = researchCollectionSchema.safeParse(raw);
  return result.success ? result.data : undefined;
}

function extractDesignsFromContent(
  content: BrainReportContent,
  reportTitle: string,
): { designs: DesignConcept[]; collection?: ResearchCollection } {
  const sectionPayload = extractStructuredSectionPayload(content);
  const artifactPayload = sectionPayload
    ? null
    : extractJsonArtifactPayload(content);
  const payload = sectionPayload ?? artifactPayload;

  if (!payload) {
    return { designs: [] };
  }

  const designs = parseDesignPayload(payload);
  const collection = parseCollection(payload.collection);

  if (designs.length === 0) {
    return { designs: [], collection };
  }

  const context = {
    title: payload.title ?? reportTitle,
    products: designs.map((design) => design.product),
    colors: designs.map((design) => design.color),
    printAreas: designs.map((design) => design.printArea),
  };

  return {
    designs: normalizeDesignConcepts(designs, context) ?? designs,
    collection,
  };
}

function recordMatchesReportId(
  record: BrainRecord,
  reportId: string,
): boolean {
  if (record.domain !== "reports") return false;
  const content = record.content as BrainReportContent;
  return content.reportId === reportId || record.id === reportId;
}

function logDesignLoad(
  requestedReportId: string,
  record: BrainRecord | null,
  designCount: number,
): void {
  const content = record?.content as BrainReportContent | undefined;
  console.info("[DESIGN LOAD]", {
    requestedReportId,
    matchedRecordId: record?.id ?? null,
    matchedContentReportId: content?.reportId ?? null,
    designCount,
  });
}

async function findResearchReportRecord(
  brain: ReturnType<typeof getBrainClient>,
  workspaceId: string,
  reportId: string,
): Promise<BrainRecord | null> {
  const byRecordId = await brain.getRecord("reports", reportId);
  if (
    byRecordId?.workspaceId === workspaceId &&
    recordMatchesReportId(byRecordId, reportId)
  ) {
    return byRecordId;
  }

  const tagSets: Array<string[] | undefined> = [
    ["design-ideas"],
    ["design"],
    undefined,
  ];

  for (const tags of tagSets) {
    const result = await brain.searchRecords({
      workspaceId,
      domains: ["reports"],
      tags,
      limit: 200,
    });

    const match = result.records.find((entry) =>
      recordMatchesReportId(entry, reportId),
    );
    if (match) return match;
  }

  return null;
}

/** Load structured Research HQ design concepts from a saved report. */
export async function loadResearchDesignReport(
  workspaceId: string,
  reportId: string,
): Promise<LoadedResearchDesignReport | null> {
  const brain = getBrainClient();
  const record = await findResearchReportRecord(brain, workspaceId, reportId);

  if (!record) {
    logDesignLoad(reportId, null, 0);
    return null;
  }

  const content = record.content as BrainReportContent;
  if (content.agentId !== "research") {
    logDesignLoad(reportId, record, 0);
    return null;
  }
  if (content.reportType !== "design" && !record.tags?.includes("design-ideas")) {
    logDesignLoad(reportId, record, 0);
    return null;
  }

  const { designs, collection } = extractDesignsFromContent(
    content,
    record.title,
  );

  if (designs.length === 0) {
    logDesignLoad(reportId, record, 0);
    return null;
  }

  logDesignLoad(reportId, record, designs.length);

  return {
    reportId: content.reportId,
    brainRecordId: record.id,
    title: record.title,
    collection,
    designs,
  };
}
