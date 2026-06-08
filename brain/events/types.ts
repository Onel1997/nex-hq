/**
 * Brain events — audit trail for every read and write.
 *
 * Events enable Realtime subscriptions, audit logs, and agent accountability.
 */

import type { BrainActor, BrainDomain, BrainReadOptions, BrainWriteInput } from "../types";

export type BrainEventType =
  | "record.created"
  | "record.updated"
  | "record.archived"
  | "record.superseded"
  | "record.embedded"
  | "context.assembled"
  | "search.performed"
  | "integration.synced";

export interface BrainEventBase {
  id: string;
  type: BrainEventType;
  timestamp: string;
  actor: BrainActor;
  domain?: BrainDomain;
  recordId?: string;
}

export interface BrainRecordCreatedEvent extends BrainEventBase {
  type: "record.created";
  domain: BrainDomain;
  recordId: string;
  payload: BrainWriteInput;
}

export interface BrainRecordUpdatedEvent extends BrainEventBase {
  type: "record.updated";
  domain: BrainDomain;
  recordId: string;
  changedFields: string[];
}

export interface BrainContextAssembledEvent extends BrainEventBase {
  type: "context.assembled";
  agentId: string;
  taskId?: string;
  recordIds: string[];
  tokenEstimate?: number;
}

export interface BrainSearchPerformedEvent extends BrainEventBase {
  type: "search.performed";
  query: string;
  domains?: BrainDomain[];
  resultCount: number;
}

export interface BrainIntegrationSyncedEvent extends BrainEventBase {
  type: "integration.synced";
  integrationId: string;
  direction: "inbound" | "outbound";
  recordIds: string[];
}

export type BrainEvent =
  | BrainRecordCreatedEvent
  | BrainRecordUpdatedEvent
  | BrainContextAssembledEvent
  | BrainSearchPerformedEvent
  | BrainIntegrationSyncedEvent
  | BrainEventBase;

/** Subscription filter for Supabase Realtime or internal event bus. */
export interface BrainEventFilter {
  types?: BrainEventType[];
  domains?: BrainDomain[];
  actorId?: string;
  since?: string;
}

export interface BrainEventBus {
  publish(event: BrainEvent): Promise<void>;
  subscribe(
    filter: BrainEventFilter,
    handler: (event: BrainEvent) => void | Promise<void>,
  ): () => void;
}
