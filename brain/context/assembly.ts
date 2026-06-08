/**
 * Context assembly — how agents receive Brain context before execution.
 *
 * The CEO Agent and specialists never assemble context manually.
 * They request a BrainAgentContext via the assembly contract.
 */

import type { AgentId } from "@/lib/constants/agents";
import type { Locale } from "@/lib/i18n/config";
import type { BrainDomain } from "../types";
import type { BrainRecord } from "../types";

export interface BrainContextRequest {
  workspaceId: string;
  agentId: AgentId;
  taskId?: string;
  /** UI locale for prompt label formatting. */
  locale?: Locale;
  /** Domains to include. Defaults to agent's primary read domains. */
  domains?: BrainDomain[];
  /** Max records per domain. */
  limitPerDomain?: number;
  /** Optional semantic focus for relevance ranking. */
  focusQuery?: string;
  /** Token budget hint for LLM prompt assembly. */
  maxTokens?: number;
  /** Only include approved records (default: include draft + approved). */
  approvedOnly?: boolean;
}

export interface BrainContextSlice<D extends BrainDomain = BrainDomain> {
  domain: D;
  records: BrainRecord<D>[];
  relevanceScore?: number;
}

/**
 * Pre-assembled context package injected into agent and LangGraph state.
 * Replaces the untyped `Record<string, unknown>` in AgentContext.
 */
export interface BrainAgentContext {
  workspaceId: string;
  agentId: AgentId;
  taskId?: string;
  assembledAt: string;
  slices: BrainContextSlice[];
  /** Flat text block for system prompt injection. */
  promptContext: string;
  /** Estimated token count for the assembled context. */
  tokenEstimate?: number;
  /** Record IDs included — for provenance on agent writes. */
  sourceRecordIds: string[];
}

/**
 * Context assembler contract — implementation reads Brain and ranks records.
 */
export interface BrainContextAssembler {
  assemble(request: BrainContextRequest): Promise<BrainAgentContext>;
}

export type BrainContextAssemblerFactory = () => BrainContextAssembler;
