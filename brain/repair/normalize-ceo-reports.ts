import { getBrainClient } from "@/brain/client";
import type { BrainReportContent } from "@/brain/domains/reports";
import { CEO_REPORT_TYPE } from "@/brain/domains/reports";
import type { BrainRecord } from "@/brain/types";

export const CEO_REPORT_TAGS = [
  "ceo-report",
  "ceo",
  "agent-generated",
  "strategic",
] as const;

export interface CeoReportDiagnostic {
  id: string;
  title: string;
  slug: string;
  status: BrainRecord["status"];
  tags: string[];
  reportType: string | undefined;
  agentId: string | undefined;
  kind: string | undefined;
  hasCeoSections: boolean;
  provenance: BrainRecord["provenance"];
  matchedAsCeo: boolean;
  fixesApplied: string[];
}

function getReportContent(
  record: BrainRecord,
): BrainReportContent | undefined {
  const content = record.content;
  if (!content || typeof content !== "object") return undefined;
  if ((content as BrainReportContent).kind !== "reports") return undefined;
  return content as BrainReportContent;
}

/** Detect CEO reports even when tags/reportType are incomplete. */
export function isLikelyCeoReport(record: BrainRecord): boolean {
  const content = getReportContent(record);
  if (!content) return false;

  const tags = (record.tags ?? []).map((t) => t.toLowerCase());
  if (tags.includes("ceo-report") || tags.includes("ceo")) return true;
  if (content.agentId === "ceo") return true;
  if (content.reportType === CEO_REPORT_TYPE) return true;
  if (Boolean(content.ceoSections)) return true;
  if ((record.slug ?? "").startsWith("ceo-")) return true;

  return false;
}

function mergeTags(existing: string[] | undefined): string[] {
  const merged = new Set([...(existing ?? []), ...CEO_REPORT_TAGS]);
  return [...merged];
}

/**
 * Scan workspace reports, log CEO structure, and normalize tags/reportType/agentId.
 */
export async function normalizeCeoReports(input: {
  workspaceId: string;
  dryRun?: boolean;
}): Promise<{
  diagnostics: CeoReportDiagnostic[];
  repairedCount: number;
}> {
  const brain = getBrainClient();
  const result = await brain.searchRecords({
    workspaceId: input.workspaceId,
    domains: ["reports"],
    limit: 200,
  });

  const diagnostics: CeoReportDiagnostic[] = [];
  let repairedCount = 0;

  for (const record of result.records) {
    if (!isLikelyCeoReport(record)) continue;

    const content = getReportContent(record);
    const fixesApplied: string[] = [];

    const needsReportType = content?.reportType !== CEO_REPORT_TYPE;
    const needsAgentId = content?.agentId !== "ceo";
    const needsKind = content?.kind !== "reports";
    const needsTags =
      !record.tags?.includes("ceo-report") || !record.tags?.includes("ceo");

    if (needsReportType) fixesApplied.push("reportType→ceo-report");
    if (needsAgentId) fixesApplied.push("agentId→ceo");
    if (needsKind) fixesApplied.push("kind→reports");
    if (needsTags) fixesApplied.push("tags→ceo-report,ceo");

    diagnostics.push({
      id: record.id,
      title: record.title,
      slug: record.slug,
      status: record.status,
      tags: record.tags ?? [],
      reportType: content?.reportType,
      agentId: content?.agentId,
      kind: content?.kind,
      hasCeoSections: Boolean(content?.ceoSections),
      provenance: record.provenance,
      matchedAsCeo: true,
      fixesApplied,
    });

    if (fixesApplied.length === 0 || input.dryRun || !content) continue;

    const patchedContent: BrainReportContent = {
      ...content,
      kind: "reports",
      agentId: "ceo",
      reportType: CEO_REPORT_TYPE,
    };

    await brain.updateRecord(
      "reports",
      record.id,
      {
        tags: mergeTags(record.tags),
        content: patchedContent,
      },
      { type: "system", id: "ceo-report-repair" },
    );

    repairedCount += 1;
  }

  console.info("[CEO Report Repair] Scan complete", {
    workspaceId: input.workspaceId,
    ceoReportCount: diagnostics.length,
    repairedCount,
    dryRun: Boolean(input.dryRun),
    diagnostics,
  });

  return { diagnostics, repairedCount };
}
