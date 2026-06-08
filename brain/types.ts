/**
 * Milaene Brain — core type system.
 *
 * The Brain is the permanent memory layer of Milaene HQ and HQ OS platforms.
 * Every agent, integration, and workflow reads from and writes back to the
 * Brain through typed interfaces — never to raw storage.
 */

import type {
  BrainDomain,
  CoreBrainDomain,
  DomainTier,
  IndustryBrainDomain,
} from "./registry/tiers";

// ---------------------------------------------------------------------------
// Domains
// ---------------------------------------------------------------------------

export type { BrainDomain, CoreBrainDomain, IndustryBrainDomain, DomainTier };

// ---------------------------------------------------------------------------
// Lifecycle & provenance
// ---------------------------------------------------------------------------

export type BrainRecordStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "archived"
  | "superseded";

export type BrainActorType = "human" | "agent" | "integration" | "system";

/** Who created or modified a Brain record. */
export interface BrainActor {
  type: BrainActorType;
  /** Agent ID, user ID, integration ID, or system identifier. */
  id: string;
}

/** Traceability for every Brain write — required for audit and agent accountability. */
export interface BrainProvenance {
  createdBy: BrainActor;
  updatedBy: BrainActor;
  sourceTaskId?: string;
  sourceReportId?: string;
  sourceIntegration?: string;
  /** Agent confidence score (0–1) when content is AI-generated. */
  confidence?: number;
}

// ---------------------------------------------------------------------------
// Relations & embeddings
// ---------------------------------------------------------------------------

export type BrainRelationType =
  | "references"
  | "derived_from"
  | "supersedes"
  | "related_to"
  | "blocks"
  | "fulfills";

/** Cross-domain links between Brain records. */
export interface BrainRelation {
  targetDomain: BrainDomain;
  targetRecordId: string;
  relationType: BrainRelationType;
  label?: string;
}

/** Metadata for vector-indexed records (embedding stored separately in Supabase). */
export interface BrainEmbeddingMeta {
  model: string;
  dimensions: number;
  embeddedAt: string;
  chunkIndex?: number;
  parentRecordId?: string;
}

// ---------------------------------------------------------------------------
// Core record
// ---------------------------------------------------------------------------

/**
 * Universal Brain record shape.
 * Domain-specific content is typed via BrainDomainContentMap.
 */
export interface BrainRecord<D extends BrainDomain = BrainDomain> {
  id: string;
  /** Workspace (tenant) this record belongs to — required for HQ OS multi-tenancy. */
  workspaceId: string;
  domain: D;
  /** URL-safe unique key within domain + workspace (e.g. "profile", "drop-summer-26"). */
  slug: string;
  title: string;
  summary?: string;
  content: import("./domains").BrainDomainContentMap[D];
  status: BrainRecordStatus;
  tags: string[];
  provenance: BrainProvenance;
  relations: BrainRelation[];
  embedding?: BrainEmbeddingMeta;
  version: number;
  schemaVersion: string;
  validFrom?: string;
  validUntil?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Read / write primitives
// ---------------------------------------------------------------------------

export interface BrainReadOptions {
  workspaceId: string;
  domains?: BrainDomain[];
  status?: BrainRecordStatus[];
  tags?: string[];
  slugs?: string[];
  /** Filter by creator or last updater. */
  actor?: BrainActor;
  limit?: number;
  offset?: number;
  includeArchived?: boolean;
  includeSuperseded?: boolean;
  /** ISO date — only records valid at this point in time. */
  asOf?: string;
}

export interface BrainWriteInput<D extends BrainDomain = BrainDomain> {
  workspaceId: string;
  domain: D;
  title: string;
  slug?: string;
  summary?: string;
  content: import("./domains").BrainDomainContentMap[D];
  status?: BrainRecordStatus;
  tags?: string[];
  provenance: Pick<BrainProvenance, "createdBy"> &
    Partial<Pick<BrainProvenance, "sourceTaskId" | "sourceReportId" | "sourceIntegration" | "confidence">>;
  relations?: BrainRelation[];
  validFrom?: string;
  validUntil?: string;
}

export interface BrainUpdateInput<D extends BrainDomain = BrainDomain> {
  title?: string;
  summary?: string;
  content?: Partial<import("./domains").BrainDomainContentMap[D]>;
  status?: BrainRecordStatus;
  tags?: string[];
  provenance?: Partial<Pick<BrainProvenance, "updatedBy" | "confidence">>;
  relations?: BrainRelation[];
  validFrom?: string;
  validUntil?: string;
}

// ---------------------------------------------------------------------------
// Semantic search
// ---------------------------------------------------------------------------

export interface BrainSemanticQuery {
  workspaceId: string;
  query: string;
  domains?: BrainDomain[];
  status?: BrainRecordStatus[];
  tags?: string[];
  limit?: number;
  minScore?: number;
  /** Hybrid search: combine vector similarity with keyword filters. */
  hybrid?: boolean;
}

export interface BrainSearchResult<D extends BrainDomain = BrainDomain> {
  record: BrainRecord<D>;
  score: number;
  matchedChunk?: string;
}

// ---------------------------------------------------------------------------
// Typed record helpers
// ---------------------------------------------------------------------------

export type BrainRecordForDomain<D extends BrainDomain> = BrainRecord<D>;

/** Narrow a domain ID to core tier. */
export type IsCoreDomain<D extends BrainDomain> = D extends CoreBrainDomain
  ? true
  : false;

/** Narrow a domain ID to industry tier. */
export type IsIndustryDomain<D extends BrainDomain> = D extends IndustryBrainDomain
  ? true
  : false;
