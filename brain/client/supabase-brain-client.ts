import { BRAIN_SCHEMA_VERSION } from "@/brain/constants";
import type { BrainDomainContentMap } from "@/brain/domains";
import type { BrainReadResult, BrainWriteResult } from "@/brain/interfaces/client";
import type { BrainRecordsRow, Json } from "@/brain/schema";
import type {
  BrainActor,
  BrainDomain,
  BrainProvenance,
  BrainReadOptions,
  BrainRecord,
  BrainRecordStatus,
  BrainUpdateInput,
  BrainWriteInput,
} from "@/brain/types";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  actorToEventFields,
  rowToRecord,
  writeInputToInsert,
} from "./mappers";
import { sanitizeSearchTerm } from "./search-utils";
import { slugify } from "./utils";

export interface BrainSearchOptions extends BrainReadOptions {
  /** Keyword search across title and summary (vector search deferred). */
  query?: string;
}

/**
 * Supabase-backed Brain persistence client.
 * All Brain reads and writes go through this class.
 */
export class SupabaseBrainClient {
  private get db() {
    return createAdminClient();
  }

  async createRecord<D extends BrainDomain>(
    input: BrainWriteInput<D>,
  ): Promise<BrainWriteResult<D>> {
    const slug = input.slug ?? slugify(input.title);

    const { data, error } = await this.db
      .from("brain_records")
      .insert(writeInputToInsert(input, slug))
      .select()
      .single();

    if (error) {
      throw new Error(`Brain createRecord failed: ${error.message}`);
    }

    const record = rowToRecord<D>(data as BrainRecordsRow);

    const eventId = await this.publishEvent({
      workspaceId: input.workspaceId,
      eventType: "record.created",
      domain: input.domain,
      recordId: record.id,
      actor: input.provenance.createdBy,
      payload: { title: input.title, slug, domain: input.domain },
    });

    return { record, eventId };
  }

  async updateRecord<D extends BrainDomain>(
    domain: D,
    id: string,
    patch: BrainUpdateInput<D>,
    updatedBy: BrainActor,
    expectedVersion?: number,
  ): Promise<BrainWriteResult<D>> {
    const existing = await this.getRecord<D>(domain, id);
    if (!existing) {
      throw new Error(`Brain record not found: ${domain}/${id}`);
    }

    if (expectedVersion !== undefined && existing.version !== expectedVersion) {
      throw new Error(
        `Version conflict: expected ${expectedVersion}, got ${existing.version}`,
      );
    }

    const mergedProvenance: BrainProvenance = {
      ...existing.provenance,
      updatedBy,
      ...(patch.provenance?.confidence !== undefined
        ? { confidence: patch.provenance.confidence }
        : {}),
    };

    const mergedContent = patch.content
      ? ({ ...existing.content, ...patch.content } as BrainDomainContentMap[D])
      : existing.content;

    const updatePayload: Record<string, unknown> = {
      title: patch.title ?? existing.title,
      summary: patch.summary !== undefined ? patch.summary : existing.summary ?? null,
      content: mergedContent as unknown as Json,
      status: patch.status ?? existing.status,
      tags: patch.tags ?? existing.tags,
      provenance: mergedProvenance as unknown as Json,
      relations: (patch.relations ?? existing.relations) as unknown as Json,
      version: existing.version + 1,
      schema_version: BRAIN_SCHEMA_VERSION,
      valid_from: patch.validFrom ?? existing.validFrom ?? null,
      valid_until: patch.validUntil ?? existing.validUntil ?? null,
    };

    const { data, error } = await this.db
      .from("brain_records")
      .update(updatePayload)
      .eq("id", id)
      .eq("workspace_id", existing.workspaceId)
      .select()
      .single();

    if (error) {
      throw new Error(`Brain updateRecord failed: ${error.message}`);
    }

    const record = rowToRecord<D>(data as BrainRecordsRow);
    const changedFields = Object.keys(patch).filter((k) => k !== "provenance");

    const eventId = await this.publishEvent({
      workspaceId: existing.workspaceId,
      eventType: "record.updated",
      domain,
      recordId: id,
      actor: updatedBy,
      payload: { changedFields, version: record.version },
    });

    return { record, eventId };
  }

  async getRecord<D extends BrainDomain>(
    domain: D,
    id: string,
  ): Promise<BrainRecord<D> | null> {
    const { data, error } = await this.db
      .from("brain_records")
      .select()
      .eq("id", id)
      .eq("domain", domain)
      .maybeSingle();

    if (error) {
      throw new Error(`Brain getRecord failed: ${error.message}`);
    }

    return data ? rowToRecord<D>(data) : null;
  }

  async getRecordBySlug<D extends BrainDomain>(
    workspaceId: string,
    domain: D,
    slug: string,
  ): Promise<BrainRecord<D> | null> {
    const { data, error } = await this.db
      .from("brain_records")
      .select()
      .eq("workspace_id", workspaceId)
      .eq("domain", domain)
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      throw new Error(`Brain getRecordBySlug failed: ${error.message}`);
    }

    return data ? rowToRecord<D>(data) : null;
  }

  async searchRecords(
    options: BrainSearchOptions,
  ): Promise<BrainReadResult> {
    let query = this.db
      .from("brain_records")
      .select("*", { count: "exact" })
      .eq("workspace_id", options.workspaceId);

    if (options.domains?.length) {
      query = query.in("domain", options.domains);
    }

    const statuses = this.resolveStatuses(options);
    if (statuses.length) {
      query = query.in("status", statuses);
    }

    if (options.tags?.length) {
      query = query.overlaps("tags", options.tags);
    }

    if (options.slugs?.length) {
      query = query.in("slug", options.slugs);
    }

    const searchTerm = sanitizeSearchTerm(options.query ?? "");
    if (searchTerm) {
      const term = `%${searchTerm}%`;
      query = query.or(`title.ilike.${term},summary.ilike.${term}`);
    }

    if (options.limit) {
      const offset = options.offset ?? 0;
      query = query.range(offset, offset + options.limit - 1);
    }

    query = query.order("updated_at", { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Brain searchRecords failed: ${error.message}`);
    }

    const records = (data ?? []).map((row) =>
      rowToRecord(row as BrainRecordsRow),
    );

    return {
      records,
      total: count ?? records.length,
      hasMore: options.limit
        ? (count ?? 0) > (options.offset ?? 0) + records.length
        : false,
    };
  }

  async archiveRecord(
    domain: BrainDomain,
    id: string,
    archivedBy: BrainActor,
  ): Promise<BrainWriteResult> {
    return this.updateRecord(
      domain,
      id,
      { status: "archived", provenance: { updatedBy: archivedBy } },
      archivedBy,
    );
  }

  // ---------------------------------------------------------------------------
  // BrainClient interface compatibility
  // ---------------------------------------------------------------------------

  async read(query: BrainReadOptions): Promise<BrainReadResult> {
    return this.searchRecords(query);
  }

  async readDomain<D extends BrainDomain>(
    domain: D,
    query?: Omit<BrainReadOptions, "domains">,
  ): Promise<BrainReadResult<D>> {
    const result = await this.searchRecords({
      ...query,
      workspaceId: query?.workspaceId ?? "",
      domains: [domain],
    });
    return result as BrainReadResult<D>;
  }

  async getById<D extends BrainDomain>(
    domain: D,
    id: string,
  ): Promise<BrainRecord<D> | null> {
    return this.getRecord(domain, id);
  }

  async getBySlug<D extends BrainDomain>(
    domain: D,
    slug: string,
    workspaceId: string,
  ): Promise<BrainRecord<D> | null> {
    return this.getRecordBySlug(workspaceId, domain, slug);
  }

  async write<D extends BrainDomain>(
    input: BrainWriteInput<D>,
  ): Promise<BrainWriteResult<D>> {
    return this.createRecord(input);
  }

  async update<D extends BrainDomain>(
    domain: D,
    id: string,
    patch: BrainUpdateInput<D>,
    updatedBy: BrainActor,
  ): Promise<BrainWriteResult<D>> {
    return this.updateRecord(domain, id, patch, updatedBy);
  }

  async archive(
    domain: BrainDomain,
    id: string,
    archivedBy: BrainActor,
  ): Promise<BrainWriteResult> {
    return this.archiveRecord(domain, id, archivedBy);
  }

  /** Audit trail entry for human report review actions. */
  async logReportReviewEvent(params: {
    workspaceId: string;
    recordId: string;
    actor: BrainActor;
    eventType: "report.approved" | "report.rejected" | "report.revision_requested";
    payload: Record<string, unknown>;
  }): Promise<string> {
    return this.publishEvent({
      workspaceId: params.workspaceId,
      eventType: params.eventType,
      domain: "reports",
      recordId: params.recordId,
      actor: params.actor,
      payload: params.payload,
    });
  }

  /** Audit trail entry for CEO final report synthesis. */
  async logCeoFinalReportEvent(params: {
    workspaceId: string;
    recordId?: string;
    actor: BrainActor;
    eventType:
      | "ceo.final_report.started"
      | "ceo.final_report.generated"
      | "ceo.final_report.completed";
    payload: Record<string, unknown>;
  }): Promise<string> {
    return this.publishEvent({
      workspaceId: params.workspaceId,
      eventType: params.eventType,
      domain: "reports",
      recordId: params.recordId,
      actor: params.actor,
      payload: params.payload,
    });
  }

  /** Audit trail entry for task lifecycle actions. */
  async logTaskEvent(params: {
    workspaceId: string;
    recordId: string;
    actor: BrainActor;
    eventType:
      | "task.created"
      | "task.updated"
      | "task.assigned"
      | "task.status_changed"
      | "task.completed"
      | "task.deleted"
      | "task.execution.started"
      | "task.execution.completed"
      | "task.execution.failed"
      | "task.review.completed";
    payload: Record<string, unknown>;
  }): Promise<string> {
    return this.publishEvent({
      workspaceId: params.workspaceId,
      eventType: params.eventType,
      domain: "tasks",
      recordId: params.recordId,
      actor: params.actor,
      payload: params.payload,
    });
  }

  async search(): Promise<never> {
    throw new Error(
      "Vector semantic search is not implemented yet. Use searchRecords() for keyword search.",
    );
  }

  // ---------------------------------------------------------------------------
  // Audit events
  // ---------------------------------------------------------------------------

  private async publishEvent(params: {
    workspaceId: string;
    eventType: string;
    domain?: BrainDomain;
    recordId?: string;
    actor: BrainActor;
    payload: Record<string, unknown>;
  }): Promise<string> {
    const { actor_type, actor_id } = actorToEventFields(params.actor);

    const { data, error } = await this.db
      .from("brain_events")
      .insert({
        workspace_id: params.workspaceId,
        event_type: params.eventType,
        domain: params.domain ?? null,
        record_id: params.recordId ?? null,
        actor_type,
        actor_id,
        payload: params.payload as Json,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(`Brain event publish failed: ${error.message}`);
    }

    return data.id;
  }

  private resolveStatuses(options: BrainReadOptions): BrainRecordStatus[] {
    if (options.status?.length) {
      return options.status;
    }

    const statuses: BrainRecordStatus[] = [
      "draft",
      "pending_review",
      "approved",
      "rejected",
      "revision_requested",
    ];

    if (options.includeArchived) statuses.push("archived");
    if (options.includeSuperseded) statuses.push("superseded");

    return statuses;
  }
}

let clientInstance: SupabaseBrainClient | null = null;

export function getBrainClient(): SupabaseBrainClient {
  if (!clientInstance) {
    clientInstance = new SupabaseBrainClient();
  }
  return clientInstance;
}
