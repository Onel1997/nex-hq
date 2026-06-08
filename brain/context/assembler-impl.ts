import { getBrainClient } from "@/brain/client";
import { estimateTokens } from "@/brain/client/utils";
import type { BrainDomain, BrainRecord, BrainRecordStatus } from "@/brain/types";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  BrainAgentContext,
  BrainContextAssembler,
  BrainContextRequest,
  BrainContextSlice,
} from "./assembly";
import { buildPromptContext } from "./prompt-builder";

/** Domains loaded for CEO Agent context assembly. */
export const CEO_CONTEXT_DOMAINS: BrainDomain[] = [
  "company_profile",
  "brand_vision",
  "brand_rules",
  "decisions",
  "reports",
  "competitor_intelligence",
  "design_memory",
  "marketing_memory",
  "product_memory",
  "content_memory",
];

/** CEO context: approved first, then pending_review. */
export const CEO_CONTEXT_STATUSES: BrainRecordStatus[] = [
  "approved",
  "pending_review",
];

const STATUS_SORT_ORDER: Record<BrainRecordStatus, number> = {
  approved: 0,
  pending_review: 1,
  draft: 2,
  archived: 3,
  superseded: 4,
};

/** Per-domain record caps to keep prompt size reasonable. */
export const CEO_DOMAIN_LIMITS: Partial<Record<BrainDomain, number>> = {
  company_profile: 3,
  brand_vision: 3,
  brand_rules: 3,
  decisions: 5,
  reports: 8,
  competitor_intelligence: 6,
  design_memory: 4,
  marketing_memory: 4,
  product_memory: 4,
  content_memory: 4,
};

const DEFAULT_DOMAIN_LIMIT = 5;

/** Fetch buffer — pull extra rows so status-priority sorting still fills the cap. */
const FETCH_BUFFER = 3;

function getDomainLimit(domain: BrainDomain, override?: number): number {
  return override ?? CEO_DOMAIN_LIMITS[domain] ?? DEFAULT_DOMAIN_LIMIT;
}

function sortRecordsByStatusPriority(records: BrainRecord[]): BrainRecord[] {
  return [...records].sort((a, b) => {
    const statusDiff =
      STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function selectPrioritizedRecords(
  records: BrainRecord[],
  limit: number,
): BrainRecord[] {
  return sortRecordsByStatusPriority(records).slice(0, limit);
}

export class SupabaseBrainContextAssembler implements BrainContextAssembler {
  async assemble(request: BrainContextRequest): Promise<BrainAgentContext> {
    const brain = getBrainClient();
    const domains = request.domains ?? CEO_CONTEXT_DOMAINS;
    const limitPerDomain = request.limitPerDomain;
    const statuses: BrainRecordStatus[] = request.approvedOnly
      ? ["approved"]
      : CEO_CONTEXT_STATUSES;

    const slices: BrainContextSlice[] = [];
    const loadedRecordLog: Array<{
      domain: BrainDomain;
      id: string;
      slug: string;
      title: string;
      status: BrainRecordStatus;
    }> = [];

    for (const domain of domains) {
      const cap = getDomainLimit(domain, limitPerDomain);
      const fetchLimit = cap * FETCH_BUFFER;

      const result = await brain.searchRecords({
        workspaceId: request.workspaceId,
        domains: [domain],
        status: statuses,
        limit: fetchLimit,
      });

      const records = selectPrioritizedRecords(result.records, cap);

      if (records.length > 0) {
        slices.push({
          domain,
          records,
          relevanceScore: 1,
        });

        for (const record of records) {
          loadedRecordLog.push({
            domain,
            id: record.id,
            slug: record.slug,
            title: record.title,
            status: record.status,
          });
        }
      }
    }

    const promptContext = buildPromptContext(slices, request.locale);
    const sourceRecordIds = slices.flatMap((s) =>
      s.records.map((r) => r.id),
    );

    const context: BrainAgentContext = {
      workspaceId: request.workspaceId,
      agentId: request.agentId,
      taskId: request.taskId,
      assembledAt: new Date().toISOString(),
      slices,
      promptContext,
      tokenEstimate: estimateTokens(promptContext),
      sourceRecordIds,
    };

    console.info("[CEO Context] Records loaded", {
      workspaceId: request.workspaceId,
      agentId: request.agentId,
      domainCount: slices.length,
      recordCount: sourceRecordIds.length,
      tokenEstimate: context.tokenEstimate,
      records: loadedRecordLog,
      domains: slices.map((s) => ({
        domain: s.domain,
        count: s.records.length,
      })),
    });

    await this.publishAssemblyEvent(request, context, loadedRecordLog);

    return context;
  }

  private async publishAssemblyEvent(
    request: BrainContextRequest,
    context: BrainAgentContext,
    records: Array<{ domain: BrainDomain; id: string; title: string }>,
  ): Promise<void> {
    const db = createAdminClient();

    await db.from("brain_events").insert({
      workspace_id: request.workspaceId,
      event_type: "context.assembled",
      domain: null,
      record_id: null,
      actor_type: "agent",
      actor_id: request.agentId,
      payload: {
        taskId: request.taskId,
        recordIds: context.sourceRecordIds,
        tokenEstimate: context.tokenEstimate,
        domains: context.slices.map((s) => s.domain),
        records: records.map((r) => ({
          domain: r.domain,
          id: r.id,
          title: r.title,
        })),
      },
    });
  }
}

let assemblerInstance: SupabaseBrainContextAssembler | null = null;

export function getBrainContextAssembler(): SupabaseBrainContextAssembler {
  if (!assemblerInstance) {
    assemblerInstance = new SupabaseBrainContextAssembler();
  }
  return assemblerInstance;
}
