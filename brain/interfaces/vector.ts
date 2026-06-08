/**
 * Vector store contract — prepares Brain for pgvector + OpenAI embeddings.
 */

import type {
  BrainDomain,
  BrainEmbeddingMeta,
  BrainSearchResult,
  BrainSemanticQuery,
} from "../types";

export interface EmbedOptions {
  model?: string;
  dimensions?: number;
}

export interface EmbeddingInput {
  recordId: string;
  domain: BrainDomain;
  text: string;
  metadata?: Partial<BrainEmbeddingMeta>;
}

export interface VectorUpsertInput extends EmbeddingInput {
  embedding: number[];
}

/**
 * Vector store abstraction — backed by Supabase pgvector in production.
 * OpenAI generates embeddings; this interface handles storage and retrieval.
 */
export interface BrainVectorStore {
  /** Generate embedding vector from text (delegates to OpenAI). */
  embed(text: string, options?: EmbedOptions): Promise<number[]>;

  /** Index or re-index a record's embeddable text. */
  upsert(input: VectorUpsertInput): Promise<BrainEmbeddingMeta>;

  /** Remove embeddings for a record. */
  delete(recordId: string): Promise<void>;

  /** Semantic similarity search. */
  search(query: BrainSemanticQuery): Promise<BrainSearchResult[]>;

  /** Re-embed all records in a domain (batch maintenance). */
  reindexDomain?(domain: BrainDomain): Promise<{ indexed: number; failed: number }>;
}

export type BrainVectorStoreFactory = () => BrainVectorStore;
