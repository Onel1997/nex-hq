/**
 * BrainClient — the single read/write contract for all Brain consumers.
 *
 * Agents, API routes, integrations, and LangGraph graphs must use this
 * interface. Direct Supabase table access is forbidden outside Brain impl.
 */

import type {
  BrainDomain,
  BrainReadOptions,
  BrainRecord,
  BrainSearchResult,
  BrainSemanticQuery,
  BrainUpdateInput,
  BrainWriteInput,
} from "../types";

export interface BrainReadResult<D extends BrainDomain = BrainDomain> {
  records: BrainRecord<D>[];
  total?: number;
  hasMore?: boolean;
}

export interface BrainWriteResult<D extends BrainDomain = BrainDomain> {
  record: BrainRecord<D>;
  /** Event ID for audit trail (maps to brain_events table). */
  eventId: string;
}

/**
 * Central Brain interface — implement once (Supabase + vector store),
 * consume everywhere (agents, integrations, workflows).
 */
export interface BrainClient {
  /** Read records with optional filters. */
  read(query?: BrainReadOptions): Promise<BrainReadResult>;

  /** Read records from a single domain with full type inference. */
  readDomain<D extends BrainDomain>(
    domain: D,
    query?: Omit<BrainReadOptions, "domains">,
  ): Promise<BrainReadResult<D>>;

  /** Fetch a single record by ID. */
  getById<D extends BrainDomain>(
    domain: D,
    id: string,
  ): Promise<BrainRecord<D> | null>;

  /** Fetch a single record by domain + slug. */
  getBySlug<D extends BrainDomain>(
    domain: D,
    slug: string,
  ): Promise<BrainRecord<D> | null>;

  /** Create a new Brain record. */
  write<D extends BrainDomain>(
    input: BrainWriteInput<D>,
  ): Promise<BrainWriteResult<D>>;

  /** Partial update with optimistic versioning. */
  update<D extends BrainDomain>(
    domain: D,
    id: string,
    patch: BrainUpdateInput<D>,
    updatedBy: import("../types").BrainActor,
  ): Promise<BrainWriteResult<D>>;

  /** Semantic search across embedded records. */
  search(query: BrainSemanticQuery): Promise<BrainSearchResult[]>;

  /** Archive a record (soft delete). */
  archive(
    domain: BrainDomain,
    id: string,
    archivedBy: import("../types").BrainActor,
  ): Promise<BrainWriteResult>;
}

/** Factory signature — implementations live outside this types-only layer. */
export type BrainClientFactory = () => BrainClient;
