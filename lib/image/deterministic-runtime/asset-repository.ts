import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type { ProductProductionContext } from "@/lib/image/product-production-context";
import type { CompositingProvenance } from "@/lib/image/artwork-compositing/types";
import type { DeterministicAsset } from "@/lib/image/deterministic-runtime/types";
import type { DeterministicImageJob } from "@/lib/image/deterministic-runtime/types";
import type { DeterministicReviewRequest } from "@/lib/image/deterministic-runtime/review-types";

export interface RecordDeterministicAsset {
  id: string;
  job: DeterministicImageJob;
  productContext: ProductProductionContext;
  baseStageOutputId: string;
  baseProviderRequestId: string | null;
  compositeStageOutputId: string;
  storagePath: string;
  compositingProvenance: CompositingProvenance;
  generatedAt: string;
}

export interface DeterministicAssetRepository {
  record(scope: WorkspaceScope, input: RecordDeterministicAsset): Promise<DeterministicAsset>;
  getByJob(scope: WorkspaceScope, jobId: string): Promise<DeterministicAsset | null>;
  review(scope: WorkspaceScope & { actorId: string }, assetId: string, input: DeterministicReviewRequest, now: string): Promise<DeterministicAsset>;
}
