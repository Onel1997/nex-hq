/**
 * Phase 2.2A — discovery attempt persistence types.
 */

import type { DiscoverySlot } from "@/lib/persona/identity-blueprints";
import type { DiscoveryProviderId } from "../provider/discovery-provider-config";
import type { DiscoveryAttemptStatus, DiscoveryRunState } from "./run-states";

export type DiscoveryAttemptRecord = {
  id: string;
  workspaceId: string;
  creationProjectId: string;
  generationRunId: string;
  slot: DiscoverySlot;
  attemptNumber: number;
  candidateId: string | null;
  replacedCandidateId: string | null;
  provider: DiscoveryProviderId | string;
  providerModel: string;
  providerSeed: number;
  providerRequestId: string | null;
  providerResultId: string | null;
  identityFingerprint: string;
  anatomyFingerprint: string;
  promptFingerprint: string;
  samplingSeed: string;
  diversityRegion: string;
  assetId: string | null;
  noveltyDecision: string | null;
  highestSimilarity: number | null;
  matchedCandidateId: string | null;
  /** Phase 2.2E — fresh embedding evaluation status for this attempt. */
  embeddingStatus: "created" | "reused" | "missing" | null;
  /** Phase 2.2E — closest prior Euclidean distance (biological evaluator). */
  euclideanDistance: number | null;
  /** Phase 2.2E — creation project of closest prior match. */
  matchedProjectId: string | null;
  /** Phase 2.2E — whether closest prior is same creation project. */
  matchedSameRun: boolean | null;
  status: DiscoveryAttemptStatus;
  providerStartedAt: string | null;
  providerCompletedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  estimatedCostEur: number | null;
  actualCostEur: number | null;
  costStatus: "estimated" | "provider_confirmed" | "unknown" | "allocated_estimate";
  createdAt: string;
  updatedAt: string;
};

export type DiscoveryRunLedger = {
  generationRunId: string;
  creationProjectId: string;
  workspaceId: string;
  runState: DiscoveryRunState;
  provider: DiscoveryProviderId | string;
  providerModel: string;
  estimatedInitialCostEur: number;
  authorizedMaxCostEur: number;
  actualProviderCostEur: number;
  maxAttemptsPerSlot: number;
  attemptsUsed: number;
  remainingAuthorizedAttempts: number;
  costStatus: "estimated" | "provider_confirmed" | "unknown" | "allocated_estimate";
  updatedAt: string;
};

export interface DiscoveryAttemptRepository {
  upsertAttempt(record: DiscoveryAttemptRecord): Promise<DiscoveryAttemptRecord>;
  listAttemptsForRun(
    generationRunId: string,
    workspaceId: string,
  ): Promise<DiscoveryAttemptRecord[]>;
  listAttemptsForSlot(input: {
    generationRunId: string;
    workspaceId: string;
    slot: DiscoverySlot;
  }): Promise<DiscoveryAttemptRecord[]>;
  getRunLedger(
    generationRunId: string,
    workspaceId: string,
  ): Promise<DiscoveryRunLedger | null>;
  upsertRunLedger(ledger: DiscoveryRunLedger): Promise<DiscoveryRunLedger>;
}
