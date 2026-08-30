import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type { ImageGenerationJob, ImageGenerationInputSnapshot, ImageCostEstimate } from "./types";

export type CreateImageGenerationJob = {
  inputSnapshot: ImageGenerationInputSnapshot;
  inputFingerprint: string;
  artworkStoragePath: string;
  estimate: ImageCostEstimate;
  preparedAt: string;
  confirmationExpiresAt: string;
};

export interface ImageGenerationJobRepository {
  assertCanPrepare(
    scope: WorkspaceScope,
    reportRecordId: string,
    assetId: string,
  ): Promise<void>;
  createOrGet(scope: WorkspaceScope & { actorId: string }, input: CreateImageGenerationJob): Promise<ImageGenerationJob>;
  get(scope: WorkspaceScope, id: string): Promise<ImageGenerationJob | null>;
  list(
    scope: WorkspaceScope,
    filters?: { productionProjectId?: string; reportRecordId?: string; assetId?: string; limit?: number },
  ): Promise<ImageGenerationJob[]>;
  confirm(scope: WorkspaceScope & { actorId: string }, id: string, fingerprint: string, token: string, now: string): Promise<ImageGenerationJob>;
  cancel(scope: WorkspaceScope, id: string, fingerprint: string, now: string): Promise<ImageGenerationJob>;
  claim(scope: WorkspaceScope, id: string, fingerprint: string, retryKnownFailure: boolean, now: string): Promise<ImageGenerationJob | null>;
  markSucceeded(scope: WorkspaceScope, id: string, input: { providerRequestId: string | null; resultAssetIds: string[]; now: string }): Promise<ImageGenerationJob>;
  markFailed(scope: WorkspaceScope, id: string, input: { code: string; message: string; safeRetryAllowed: boolean; now: string }): Promise<ImageGenerationJob>;
  markUnknown(scope: WorkspaceScope, id: string, input: { providerRequestId: string | null; reason: string; now: string }): Promise<ImageGenerationJob>;
}
