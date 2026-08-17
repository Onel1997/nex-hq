import { createAdminClient } from "@/lib/supabase/admin";
import { PersonaStoreError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import { normalizeRfc3339Timestamp } from "@/lib/datetime/rfc3339";
import { productionStageOutputSchema, type ProductionStageOutput, type SuccessfulBaseStage } from "@/lib/image/deterministic-production/two-stage-attempt";
import type { StageOutputRepository } from "@/lib/image/deterministic-runtime/stage-repository";

function map(row: Record<string, unknown>): ProductionStageOutput {
  return productionStageOutputSchema.parse({ stageOutputId: row.id, jobId: row.generation_job_id, stage: row.stage, stageAttempt: Number(row.stage_attempt), status: row.status, assetId: row.status === "SUCCEEDED" ? row.id : null, storagePath: row.storage_path, checksumSha256: row.checksum, providerRequestId: row.provider_request_id, provenance: row.provenance, failureCode: row.failure_code, failureMessage: row.failure_message, createdAt: normalizeRfc3339Timestamp(row.created_at) });
}

export class SupabaseStageOutputRepository implements StageOutputRepository {
  private async assertJob(scope: WorkspaceScope, jobId: string) {
    const { data, error } = await createAdminClient().from("image_generation_jobs").select("id").eq("workspace_id", scope.workspaceId).eq("id", jobId).eq("input_contract_version", "image-generation-input-v2").maybeSingle();
    if (error || !data) throw new PersonaStoreError(error?.message ?? "V2 job not found for stage persistence.");
  }
  async insert(scope: WorkspaceScope, stage: ProductionStageOutput) {
    const parsed=productionStageOutputSchema.parse(stage); await this.assertJob(scope,parsed.jobId);
    const { data,error }=await createAdminClient().from("image_production_stage_outputs").insert({id:parsed.stageOutputId,generation_job_id:parsed.jobId,stage:parsed.stage,stage_attempt:parsed.stageAttempt,status:parsed.status,storage_path:parsed.storagePath,checksum:parsed.checksumSha256,provider_request_id:parsed.providerRequestId,provenance:parsed.provenance,failure_code:parsed.failureCode,failure_message:parsed.failureMessage,created_at:parsed.createdAt}).select("*").single();
    if(error||!data){const rows=await this.list(scope,parsed.jobId);const replay=rows.find((row)=>row.stage===parsed.stage&&row.stageAttempt===parsed.stageAttempt);if(replay)return replay;throw new PersonaStoreError(error?.message??"Failed to persist stage output.");} return map(data as Record<string,unknown>);
  }
  async list(scope:WorkspaceScope,jobId:string){await this.assertJob(scope,jobId);const {data,error}=await createAdminClient().from("image_production_stage_outputs").select("*").eq("generation_job_id",jobId).order("created_at",{ascending:true});if(error)throw new PersonaStoreError(error.message);return(data??[]).map((row)=>map(row as Record<string,unknown>));}
  async getSucceededBase(scope:WorkspaceScope,jobId:string){const rows=await this.list(scope,jobId);return (rows.find((row)=>row.stage==="BASE_GENERATION"&&row.status==="SUCCEEDED") as SuccessfulBaseStage|undefined)??null;}
}
