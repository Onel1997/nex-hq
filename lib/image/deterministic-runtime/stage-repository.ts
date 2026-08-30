import type { WorkspaceScope } from "@/lib/persona/domain/types";
import type { ProductionStageOutput, SuccessfulBaseStage } from "@/lib/image/deterministic-production/two-stage-attempt";

export interface StageOutputRepository {
  insert(scope: WorkspaceScope, stage: ProductionStageOutput): Promise<ProductionStageOutput>;
  list(scope: WorkspaceScope, jobId: string): Promise<ProductionStageOutput[]>;
  listByJobs?(
    scope: WorkspaceScope,
    jobIds: readonly string[],
  ): Promise<Map<string, ProductionStageOutput[]>>;
  getSucceededBase(scope: WorkspaceScope, jobId: string): Promise<SuccessfulBaseStage | null>;
}
