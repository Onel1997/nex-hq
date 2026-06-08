import { BRAIN_SCHEMA_VERSION } from "@/brain/constants";
import type { BrainDomainContentMap } from "@/brain/domains";
import type {
  BrainRecordsInsert,
  BrainRecordsRow,
  Json,
} from "@/brain/schema";
import type {
  BrainActor,
  BrainDomain,
  BrainProvenance,
  BrainRecord,
  BrainRelation,
  BrainWriteInput,
} from "@/brain/types";

function parseProvenance(raw: Json): BrainProvenance {
  const p = raw as unknown as BrainProvenance;
  return {
    createdBy: p.createdBy,
    updatedBy: p.updatedBy ?? p.createdBy,
    sourceTaskId: p.sourceTaskId,
    sourceReportId: p.sourceReportId,
    sourceIntegration: p.sourceIntegration,
    confidence: p.confidence,
  };
}

function parseRelations(raw: Json): BrainRelation[] {
  if (!Array.isArray(raw)) return [];
  return raw as unknown as BrainRelation[];
}

export function rowToRecord<D extends BrainDomain>(
  row: BrainRecordsRow,
): BrainRecord<D> {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    domain: row.domain as D,
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? undefined,
    content: row.content as unknown as BrainDomainContentMap[D],
    status: row.status,
    tags: row.tags ?? [],
    provenance: parseProvenance(row.provenance),
    relations: parseRelations(row.relations),
    version: row.version,
    schemaVersion: row.schema_version,
    validFrom: row.valid_from ?? undefined,
    validUntil: row.valid_until ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function writeInputToInsert<D extends BrainDomain>(
  input: BrainWriteInput<D>,
  slug: string,
): BrainRecordsInsert {
  const createdBy = input.provenance.createdBy;
  const provenance: BrainProvenance = {
    createdBy,
    updatedBy: createdBy,
    sourceTaskId: input.provenance.sourceTaskId,
    sourceReportId: input.provenance.sourceReportId,
    sourceIntegration: input.provenance.sourceIntegration,
    confidence: input.provenance.confidence,
  };

  return {
    workspace_id: input.workspaceId,
    domain: input.domain,
    slug,
    title: input.title,
    summary: input.summary ?? null,
    content: input.content as unknown as Json,
    status: input.status ?? "approved",
    tags: input.tags ?? [],
    provenance: provenance as unknown as Json,
    relations: (input.relations ?? []) as unknown as Json,
    version: 1,
    schema_version: BRAIN_SCHEMA_VERSION,
    valid_from: input.validFrom ?? null,
    valid_until: input.validUntil ?? null,
  };
}

export function actorToEventFields(actor: BrainActor) {
  return {
    actor_type: actor.type,
    actor_id: actor.id,
  };
}
