/**
 * Milaene Brain — shared knowledge layer types.
 * All agents read from and write to the Brain through a single interface.
 */

export type BrainEntryStatus = "draft" | "approved" | "archived";

export type BrainEntryType =
  | "brand_identity"
  | "product"
  | "drop"
  | "campaign"
  | "audience"
  | "trend"
  | "asset"
  | "template";

export interface BrainEntry<T = Record<string, unknown>> {
  id: string;
  type: BrainEntryType;
  status: BrainEntryStatus;
  title: string;
  content: T;
  sourceAgentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrainQuery {
  types?: BrainEntryType[];
  status?: BrainEntryStatus[];
  limit?: number;
}

export interface BrainWriteInput<T = Record<string, unknown>> {
  type: BrainEntryType;
  title: string;
  content: T;
  sourceAgentId?: string;
  status?: BrainEntryStatus;
}
