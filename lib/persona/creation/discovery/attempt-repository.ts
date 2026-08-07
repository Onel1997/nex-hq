/**
 * Phase 2.2A — in-memory discovery attempt repository (tests + ephemeral).
 * Idempotent upsert on (project, run, slot, attemptNumber).
 */

import type { DiscoverySlot } from "@/lib/persona/identity-blueprints";
import type {
  DiscoveryAttemptRecord,
  DiscoveryAttemptRepository,
  DiscoveryRunLedger,
} from "./attempt-types";

function attemptKey(record: Pick<
  DiscoveryAttemptRecord,
  "creationProjectId" | "generationRunId" | "slot" | "attemptNumber"
>): string {
  return `${record.creationProjectId}:${record.generationRunId}:${record.slot}:${record.attemptNumber}`;
}

export class MemoryDiscoveryAttemptRepository implements DiscoveryAttemptRepository {
  private readonly attempts = new Map<string, DiscoveryAttemptRecord>();
  private readonly ledgers = new Map<string, DiscoveryRunLedger>();

  async upsertAttempt(record: DiscoveryAttemptRecord): Promise<DiscoveryAttemptRecord> {
    const key = attemptKey(record);
    const existing = this.attempts.get(key);
    const next: DiscoveryAttemptRecord = existing
      ? {
          ...existing,
          ...record,
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString(),
        }
      : { ...record, updatedAt: record.updatedAt || new Date().toISOString() };
    this.attempts.set(key, next);
    return { ...next };
  }

  async listAttemptsForRun(
    generationRunId: string,
    workspaceId: string,
  ): Promise<DiscoveryAttemptRecord[]> {
    return [...this.attempts.values()]
      .filter(
        (a) => a.generationRunId === generationRunId && a.workspaceId === workspaceId,
      )
      .map((a) => ({ ...a }))
      .sort((a, b) => a.slot.localeCompare(b.slot) || a.attemptNumber - b.attemptNumber);
  }

  async listAttemptsForSlot(input: {
    generationRunId: string;
    workspaceId: string;
    slot: DiscoverySlot;
  }): Promise<DiscoveryAttemptRecord[]> {
    const all = await this.listAttemptsForRun(input.generationRunId, input.workspaceId);
    return all.filter((a) => a.slot === input.slot);
  }

  async getRunLedger(
    generationRunId: string,
    workspaceId: string,
  ): Promise<DiscoveryRunLedger | null> {
    const key = `${workspaceId}:${generationRunId}`;
    const ledger = this.ledgers.get(key);
    return ledger ? { ...ledger } : null;
  }

  async upsertRunLedger(ledger: DiscoveryRunLedger): Promise<DiscoveryRunLedger> {
    const key = `${ledger.workspaceId}:${ledger.generationRunId}`;
    const next = { ...ledger, updatedAt: new Date().toISOString() };
    this.ledgers.set(key, next);
    return { ...next };
  }
}
