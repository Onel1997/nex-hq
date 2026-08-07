/**
 * Phase 2.2G — Explicit promotion of discovery faces into historical protection.
 *
 * Discovery candidate → user selects / approves / locks → protected identity.
 * Strengthens the same novelty record; never duplicates embeddings.
 */

import type { NoveltyRepository } from "./novelty-repository";
import type { FaceNoveltyRecord } from "./types";
import {
  normalizeHistoricalProtectionStatus,
  resolveStrongerProtectionStatus,
  type HistoricalBlockingProtectionStatus,
  type HistoricalProtectionPromotionReason,
} from "./historical-protection";
import { logPersonaAuditEvent } from "../audit/persona-events";

export type PromoteHistoricalProtectionInput = {
  workspaceId: string;
  candidateId: string;
  status: HistoricalBlockingProtectionStatus;
  reason: HistoricalProtectionPromotionReason;
  /** Auditable source, e.g. creation.update_candidate.selected */
  source: string;
  actorId?: string | null;
};

export type PromoteHistoricalProtectionResult = {
  record: FaceNoveltyRecord | null;
  promoted: boolean;
  previousStatus: string;
  nextStatus: string;
};

/**
 * Promote (or strengthen) historical biological protection on a novelty record.
 * No-op when no novelty row exists yet (selection before novelty is rare).
 */
export async function promoteToHistoricallyProtectedIdentity(
  repo: NoveltyRepository,
  input: PromoteHistoricalProtectionInput,
): Promise<PromoteHistoricalProtectionResult> {
  const record = await repo.findByCandidateId(
    input.candidateId,
    input.workspaceId,
  );
  if (!record) {
    return {
      record: null,
      promoted: false,
      previousStatus: "missing",
      nextStatus: input.status,
    };
  }

  const previousStatus = normalizeHistoricalProtectionStatus(
    record.historicalProtectionStatus,
  );
  const nextStatus = resolveStrongerProtectionStatus(
    previousStatus,
    input.status,
  );
  const changed = nextStatus !== previousStatus;

  if (!changed) {
    return {
      record,
      promoted: false,
      previousStatus,
      nextStatus,
    };
  }

  const promotedAt = new Date().toISOString();
  await repo.updateHistoricalProtection(record.id, input.workspaceId, {
    historicalProtectionStatus: nextStatus,
    historicalProtectionPromotedAt: promotedAt,
    historicalProtectionReason: input.reason,
    historicalProtectionSource: input.source,
  });

  const updated: FaceNoveltyRecord = {
    ...record,
    historicalProtectionStatus: nextStatus,
    historicalProtectionPromotedAt: promotedAt,
    historicalProtectionReason: input.reason,
    historicalProtectionSource: input.source,
  };

  await logPersonaAuditEvent({
    workspaceId: input.workspaceId,
    eventType: "face_novelty.historical_protection_promoted",
    recordId: record.candidateId,
    actorId: input.actorId,
    payload: {
      noveltyRecordId: record.id,
      previousStatus,
      nextStatus,
      reason: input.reason,
      source: input.source,
      assetId: record.assetId,
      creationProjectId: record.creationProjectId,
    },
  });

  return {
    record: updated,
    promoted: true,
    previousStatus,
    nextStatus,
  };
}
