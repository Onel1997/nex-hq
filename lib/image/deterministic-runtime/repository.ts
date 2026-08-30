import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type { ImageCostEstimate } from "@/lib/image/paid-generation/types";
import type { ImageGenerationInputSnapshotV2 } from "@/lib/image/paid-generation/types-v2";
import type { DeterministicImageJob } from "@/lib/image/deterministic-runtime/types";

export interface CreateDeterministicJob {
  snapshot: ImageGenerationInputSnapshotV2;
  fingerprint: string;
  artworkStoragePath: string;
  estimate: ImageCostEstimate;
  preparedAt: string;
  confirmationExpiresAt: string;
}

export interface DeterministicJobRepository {
  createOrGet(scope: WorkspaceScope & { actorId: string }, input: CreateDeterministicJob): Promise<DeterministicImageJob>;
  get(scope: WorkspaceScope, id: string): Promise<DeterministicImageJob | null>;
  list(scope: WorkspaceScope, filters?: { projectId?: string; limit?: number }): Promise<DeterministicImageJob[]>;
  confirm(scope: WorkspaceScope & { actorId: string }, id: string, fingerprint: string, token: string, now: string): Promise<DeterministicImageJob>;
  claimBase(scope: WorkspaceScope, id: string, fingerprint: string, now: string): Promise<DeterministicImageJob | null>;
  claimCompositeRetry(scope: WorkspaceScope, id: string, fingerprint: string, now: string): Promise<boolean>;
  markSucceeded(scope: WorkspaceScope, id: string, assetId: string, providerRequestId: string | null, now: string): Promise<DeterministicImageJob>;
  markFailed(scope: WorkspaceScope, id: string, input: { code: string; message: string; now: string }): Promise<DeterministicImageJob>;
  markUnknown(scope: WorkspaceScope, id: string, input: { providerRequestId: string | null; reason: string; now: string }): Promise<DeterministicImageJob>;
}
