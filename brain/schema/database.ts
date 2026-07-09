/**
 * Supabase schema types — preparation for Postgres + pgvector storage.
 *
 * These types mirror the intended database schema. Migrations are deferred;
 * use these as the contract when implementing the Brain data layer.
 */

import type { HqIndustryId } from "../platform/industries";
import type { HqModuleId } from "../platform/modules";
import type { BrainDomain, BrainRecordStatus } from "../types";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ---------------------------------------------------------------------------
// brain_workspaces
// ---------------------------------------------------------------------------

export interface BrainWorkspacesRow {
  id: string;
  slug: string;
  name: string;
  industry_id: HqIndustryId;
  active_modules: HqModuleId[];
  enabled_domains: BrainDomain[];
  created_at: string;
  updated_at: string;
}

export interface BrainWorkspacesInsert {
  id?: string;
  slug: string;
  name: string;
  industry_id: HqIndustryId;
  active_modules: HqModuleId[];
  enabled_domains: BrainDomain[];
  created_at?: string;
  updated_at?: string;
}

export type BrainWorkspacesUpdate = Partial<BrainWorkspacesInsert>;

// ---------------------------------------------------------------------------
// brain_records
// ---------------------------------------------------------------------------

export interface BrainRecordsRow {
  id: string;
  workspace_id: string;
  domain: BrainDomain;
  slug: string;
  title: string;
  summary: string | null;
  content: Json;
  status: BrainRecordStatus;
  tags: string[];
  provenance: Json;
  relations: Json;
  version: number;
  schema_version: string;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrainRecordsInsert {
  id?: string;
  workspace_id: string;
  domain: BrainDomain;
  slug: string;
  title: string;
  summary?: string | null;
  content: Json;
  status?: BrainRecordStatus;
  tags?: string[];
  provenance: Json;
  relations?: Json;
  version?: number;
  schema_version?: string;
  valid_from?: string | null;
  valid_until?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type BrainRecordsUpdate = Partial<BrainRecordsInsert>;

// ---------------------------------------------------------------------------
// brain_embeddings (pgvector)
// ---------------------------------------------------------------------------

export interface BrainEmbeddingsRow {
  id: string;
  workspace_id: string;
  record_id: string;
  domain: BrainDomain;
  /** pgvector column — stored as number[] in application layer. */
  embedding: number[];
  model: string;
  dimensions: number;
  chunk_index: number | null;
  chunk_text: string | null;
  metadata: Json;
  created_at: string;
}

export interface BrainEmbeddingsInsert {
  id?: string;
  workspace_id: string;
  record_id: string;
  domain: BrainDomain;
  embedding: number[];
  model: string;
  dimensions: number;
  chunk_index?: number | null;
  chunk_text?: string | null;
  metadata?: Json;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// brain_events (audit log)
// ---------------------------------------------------------------------------

export interface BrainEventsRow {
  id: string;
  workspace_id: string;
  event_type: string;
  domain: BrainDomain | null;
  record_id: string | null;
  actor_type: string;
  actor_id: string;
  payload: Json;
  created_at: string;
}

export interface BrainEventsInsert {
  id?: string;
  workspace_id: string;
  event_type: string;
  domain?: BrainDomain | null;
  record_id?: string | null;
  actor_type: string;
  actor_id: string;
  payload: Json;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// Supabase Database type (for typed client)
// ---------------------------------------------------------------------------

export interface BrainDatabase {
  public: {
    Tables: {
      brain_workspaces: {
        Row: BrainWorkspacesRow;
        Insert: BrainWorkspacesInsert;
        Update: BrainWorkspacesUpdate;
        Relationships: [];
      };
      brain_records: {
        Row: BrainRecordsRow;
        Insert: BrainRecordsInsert;
        Update: BrainRecordsUpdate;
        Relationships: [];
      };
      brain_embeddings: {
        Row: BrainEmbeddingsRow;
        Insert: BrainEmbeddingsInsert;
        Update: Partial<BrainEmbeddingsInsert>;
        Relationships: [];
      };
      brain_events: {
        Row: BrainEventsRow;
        Insert: BrainEventsInsert;
        Update: Partial<BrainEventsInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_brain_embeddings: {
        Args: {
          query_embedding: number[];
          filter_workspace_id: string;
          match_threshold?: number;
          match_count?: number;
          filter_domain?: BrainDomain | null;
        };
        Returns: Array<{
          record_id: string;
          domain: BrainDomain;
          similarity: number;
          chunk_text: string | null;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

/**
 * Intended indexes and extensions (for migration authoring):
 *
 * - CREATE EXTENSION IF NOT EXISTS vector;
 * - brain_workspaces table: id, slug, industry_id, active_modules, enabled_domains
 * - UNIQUE (workspace_id, domain, slug) ON brain_records
 * - GIN (tags) ON brain_records
 * - HNSW (embedding vector_cosine_ops) ON brain_embeddings
 * - INDEX (domain, status) ON brain_records
 * - INDEX (record_id) ON brain_embeddings
 * - RLS enabled on all tables; policies per team role
 */
