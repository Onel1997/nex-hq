import type { WorkspaceScope } from "@/lib/persona/domain/types";
import { productionStageOutputSchema, type ProductionStageOutput, type SuccessfulBaseStage } from "@/lib/image/deterministic-production/two-stage-attempt";
import type { StageOutputRepository } from "@/lib/image/deterministic-runtime/stage-repository";
export class MemoryStageOutputRepository implements StageOutputRepository {
  stages: ProductionStageOutput[]=[];
  async insert(_scope:WorkspaceScope,stage:ProductionStageOutput){const parsed=productionStageOutputSchema.parse(stage);const replay=this.stages.find((item)=>item.jobId===parsed.jobId&&item.stage===parsed.stage&&item.stageAttempt===parsed.stageAttempt);if(replay)return structuredClone(replay);this.stages.push(structuredClone(parsed));return structuredClone(parsed);}
  async list(_scope:WorkspaceScope,jobId:string){return this.stages.filter((stage)=>stage.jobId===jobId).map((stage)=>structuredClone(stage));}
  async listByJobs(_scope:WorkspaceScope,jobIds:readonly string[]){const result=new Map<string,ProductionStageOutput[]>();for(const id of jobIds)result.set(id,await this.list(_scope,id));return result;}
  async getSucceededBase(scope:WorkspaceScope,jobId:string){return ((await this.list(scope,jobId)).find((stage)=>stage.stage==="BASE_GENERATION"&&stage.status==="SUCCEEDED") as SuccessfulBaseStage|undefined)??null;}
}
