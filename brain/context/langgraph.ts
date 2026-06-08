/**
 * LangGraph state shapes — Brain integration for future agent orchestration.
 *
 * These types define how Brain context flows through LangGraph graphs
 * without implementing any graph logic.
 */

import type { AgentId } from "@/lib/constants/agents";
import type { BrainAgentContext } from "./assembly";
import type { BrainDomain, BrainReadOptions, BrainWriteInput } from "../types";

/** Audit entry for Brain queries issued during graph execution. */
export interface BrainQueryLogEntry {
  timestamp: string;
  agentId: AgentId;
  query: BrainReadOptions;
  recordCount: number;
}

/** Pending write queued during graph execution, flushed on completion. */
export interface BrainPendingWrite<D extends BrainDomain = BrainDomain> {
  input: BrainWriteInput<D>;
  queuedAt: string;
  nodeId?: string;
}

/**
 * Brain slice of LangGraph agent state.
 * Merge into specialist and CEO graph state definitions.
 */
export interface BrainGraphState {
  /** Context loaded at graph entry (read phase). */
  brainContext: BrainAgentContext;
  /** Writes queued during execution (write-back phase). */
  pendingWrites: BrainPendingWrite[];
  /** Audit log of reads performed during execution. */
  queryLog: BrainQueryLogEntry[];
}

/** Reducer-friendly partial update for LangGraph state channels. */
export type BrainGraphStateUpdate = Partial<BrainGraphState>;

/**
 * Configuration passed when compiling a LangGraph that uses the Brain.
 */
export interface BrainGraphConfig {
  agentId: AgentId;
  /** Domains this graph is authorized to read. */
  readDomains: BrainDomain[];
  /** Domains this graph is authorized to write. */
  writeDomains: BrainDomain[];
  /** Auto-flush pending writes on graph completion. */
  autoFlushWrites: boolean;
  /** Default status for agent-generated writes. */
  defaultWriteStatus: "draft" | "pending_review";
}
