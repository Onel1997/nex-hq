import { getBrainClient } from "@/brain/client";
import { estimateTokens } from "@/brain/client/utils";
import type { BrainDomain, BrainRecordStatus } from "@/brain/types";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  BrainAgentContext,
  BrainContextAssembler,
  BrainContextRequest,
  BrainContextSlice,
} from "./assembly";
import { buildPromptContext } from "./prompt-builder";

/** Domains loaded for CEO Agent Phase 1 context. */
export const CEO_CONTEXT_DOMAINS: BrainDomain[] = [
  "company_profile",
  "brand_vision",
  "brand_rules",
  "decisions",
];

export class SupabaseBrainContextAssembler implements BrainContextAssembler {
  async assemble(request: BrainContextRequest): Promise<BrainAgentContext> {
    const brain = getBrainClient();
    const domains = request.domains ?? CEO_CONTEXT_DOMAINS;
    const limitPerDomain = request.limitPerDomain ?? 10;

    const statuses: BrainRecordStatus[] = request.approvedOnly
      ? ["approved"]
      : ["draft", "pending_review", "approved"];

    const slices: BrainContextSlice[] = [];

    for (const domain of domains) {
      const result = await brain.searchRecords({
        workspaceId: request.workspaceId,
        domains: [domain],
        status: statuses,
        limit: limitPerDomain,
      });

      if (result.records.length > 0) {
        slices.push({
          domain,
          records: result.records,
          relevanceScore: 1,
        });
      }
    }

    const promptContext = buildPromptContext(slices);
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

    await this.publishAssemblyEvent(request, context);

    return context;
  }

  private async publishAssemblyEvent(
    request: BrainContextRequest,
    context: BrainAgentContext,
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
