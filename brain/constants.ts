import type { AgentId } from "@/lib/constants/agents";

export type BrainWriterId = AgentId | "human";

/** Default schema version for new Brain records. Bump on breaking content changes. */
export const BRAIN_SCHEMA_VERSION = "1.1.0";

/** Default embedding model for vector search (OpenAI). */
export const BRAIN_DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

/** Default embedding dimensions for text-embedding-3-small. */
export const BRAIN_DEFAULT_EMBEDDING_DIMENSIONS = 1536;

// Re-exports from registry
export {
  BRAIN_ALL_DOMAINS,
  BRAIN_CORE_DOMAINS,
  BRAIN_INDUSTRY_DOMAINS,
  BRAIN_DOMAIN_REGISTRY,
} from "./registry";

/** @deprecated Use BRAIN_ALL_DOMAINS from registry. */
export { BRAIN_ALL_DOMAINS as BRAIN_DOMAINS } from "./registry";

export type { BrainDomainDefinition } from "./registry";

/** @deprecated Use BrainDomainDefinition from registry. */
export interface BrainDomainMeta {
  id: import("./registry/tiers").BrainDomain;
  title: string;
  description: string;
  primaryReaders: AgentId[];
  primaryWriters: BrainWriterId[];
  vectorSearchEnabled: boolean;
}
