/**
 * Phase 2.2A.1 — Supabase persistence for persona_discovery_attempts + run ledger.
 * Live discovery must not keep attempts only in memory.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { PersonaDomainError } from "../../domain/errors";
import type { DiscoverySlot } from "@/lib/persona/identity-blueprints";
import type {
  DiscoveryAttemptRecord,
  DiscoveryAttemptRepository,
  DiscoveryRunLedger,
} from "./attempt-types";
import type { DiscoveryAttemptStatus, DiscoveryRunState } from "./run-states";

const ATTEMPTS = "persona_discovery_attempts";
const JOBS = "persona_generation_jobs";

function throwDb(error: { message: string } | null, msg: string) {
  if (error) throw new PersonaDomainError(msg, "VALIDATION", { message: error.message });
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : v == null ? fallback : String(v);
}
function nullableStr(v: unknown): string | null {
  if (v == null) return null;
  return str(v);
}
function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapAttempt(row: Record<string, unknown>): DiscoveryAttemptRecord {
  return {
    id: str(row.id),
    workspaceId: str(row.workspace_id),
    creationProjectId: str(row.creation_project_id),
    generationRunId: str(row.generation_run_id),
    slot: str(row.slot) as DiscoverySlot,
    attemptNumber: Number(row.attempt_number ?? 1),
    candidateId: nullableStr(row.candidate_id),
    replacedCandidateId: nullableStr(row.replaced_candidate_id),
    provider: str(row.provider),
    providerModel: str(row.provider_model),
    providerSeed: Number(row.provider_seed ?? 0),
    providerRequestId: nullableStr(row.provider_request_id),
    providerResultId: nullableStr(row.provider_result_id),
    identityFingerprint: str(row.identity_fingerprint),
    anatomyFingerprint: str(row.anatomy_fingerprint),
    promptFingerprint: str(row.prompt_fingerprint),
    samplingSeed: str(row.sampling_seed),
    diversityRegion: str(row.diversity_region),
    assetId: nullableStr(row.asset_id),
    noveltyDecision: nullableStr(row.novelty_decision),
    highestSimilarity: num(row.highest_similarity),
    matchedCandidateId: nullableStr(row.matched_candidate_id),
    status: str(row.status, "planned") as DiscoveryAttemptStatus,
    providerStartedAt: nullableStr(row.provider_started_at),
    providerCompletedAt: nullableStr(row.provider_completed_at),
    errorCode: nullableStr(row.error_code),
    errorMessage: nullableStr(row.error_message),
    estimatedCostEur: num(row.estimated_cost_eur),
    actualCostEur: num(row.actual_cost_eur),
    costStatus: (str(row.cost_status, "estimated") ||
      "estimated") as DiscoveryAttemptRecord["costStatus"],
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

function attemptRow(record: DiscoveryAttemptRecord): Record<string, unknown> {
  return {
    id: record.id,
    workspace_id: record.workspaceId,
    creation_project_id: record.creationProjectId,
    generation_run_id: record.generationRunId,
    slot: record.slot,
    attempt_number: record.attemptNumber,
    candidate_id: record.candidateId,
    replaced_candidate_id: record.replacedCandidateId,
    provider: record.provider,
    provider_model: record.providerModel,
    provider_seed: record.providerSeed,
    provider_request_id: record.providerRequestId,
    provider_result_id: record.providerResultId,
    identity_fingerprint: record.identityFingerprint,
    anatomy_fingerprint: record.anatomyFingerprint,
    prompt_fingerprint: record.promptFingerprint,
    sampling_seed: record.samplingSeed,
    diversity_region: record.diversityRegion,
    asset_id: record.assetId,
    novelty_decision: record.noveltyDecision,
    highest_similarity: record.highestSimilarity,
    matched_candidate_id: record.matchedCandidateId,
    status: record.status,
    provider_started_at: record.providerStartedAt,
    provider_completed_at: record.providerCompletedAt,
    error_code: record.errorCode,
    error_message: record.errorMessage,
    estimated_cost_eur: record.estimatedCostEur,
    actual_cost_eur: record.actualCostEur,
    cost_status: record.costStatus,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export class SupabaseDiscoveryAttemptRepository implements DiscoveryAttemptRepository {
  async upsertAttempt(record: DiscoveryAttemptRecord): Promise<DiscoveryAttemptRecord> {
    const client = createAdminClient();
    const { data: existing, error: findErr } = await client
      .from(ATTEMPTS)
      .select("*")
      .eq("creation_project_id", record.creationProjectId)
      .eq("generation_run_id", record.generationRunId)
      .eq("slot", record.slot)
      .eq("attempt_number", record.attemptNumber)
      .maybeSingle();
    throwDb(findErr, "Failed to lookup discovery attempt");

    if (existing) {
      const merged = {
        ...attemptRow(record),
        id: str((existing as Record<string, unknown>).id),
        created_at: str((existing as Record<string, unknown>).created_at),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await client
        .from(ATTEMPTS)
        .update(merged)
        .eq("id", merged.id)
        .select("*")
        .single();
      throwDb(error, "Failed to update discovery attempt");
      return mapAttempt(data as Record<string, unknown>);
    }

    const { data, error } = await client
      .from(ATTEMPTS)
      .insert(attemptRow(record))
      .select("*")
      .single();
    throwDb(error, "Failed to insert discovery attempt");
    return mapAttempt(data as Record<string, unknown>);
  }

  async listAttemptsForRun(
    generationRunId: string,
    workspaceId: string,
  ): Promise<DiscoveryAttemptRecord[]> {
    const client = createAdminClient();
    const { data, error } = await client
      .from(ATTEMPTS)
      .select("*")
      .eq("generation_run_id", generationRunId)
      .eq("workspace_id", workspaceId)
      .order("slot", { ascending: true })
      .order("attempt_number", { ascending: true });
    throwDb(error, "Failed to list discovery attempts");
    return (data ?? []).map((row) => mapAttempt(row as Record<string, unknown>));
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
    const client = createAdminClient();
    const { data, error } = await client
      .from(JOBS)
      .select("*")
      .eq("id", generationRunId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    throwDb(error, "Failed to load discovery run ledger");
    if (!data) return null;
    const row = data as Record<string, unknown>;
    if (row.discovery_run_state == null && row.authorized_max_cost_eur == null) {
      return null;
    }
    return {
      generationRunId: str(row.id),
      creationProjectId: str(row.creation_project_id),
      workspaceId: str(row.workspace_id),
      runState: str(row.discovery_run_state, "preparing") as DiscoveryRunState,
      provider: str(row.discovery_provider ?? row.provider),
      providerModel: str(row.discovery_provider_model),
      estimatedInitialCostEur: Number(row.estimated_initial_cost_eur ?? 0),
      authorizedMaxCostEur: Number(row.authorized_max_cost_eur ?? 0),
      actualProviderCostEur: Number(row.actual_provider_cost_eur ?? 0),
      maxAttemptsPerSlot: Number(row.max_attempts_per_slot ?? 3),
      attemptsUsed: Number(row.attempts_used ?? 0),
      remainingAuthorizedAttempts: Number(row.remaining_authorized_attempts ?? 0),
      costStatus: (str(row.discovery_cost_status, "estimated") ||
        "estimated") as DiscoveryRunLedger["costStatus"],
      updatedAt: str(row.updated_at),
    };
  }

  async upsertRunLedger(ledger: DiscoveryRunLedger): Promise<DiscoveryRunLedger> {
    const client = createAdminClient();
    const { data, error } = await client
      .from(JOBS)
      .update({
        discovery_run_state: ledger.runState,
        discovery_provider: ledger.provider,
        discovery_provider_model: ledger.providerModel,
        estimated_initial_cost_eur: ledger.estimatedInitialCostEur,
        authorized_max_cost_eur: ledger.authorizedMaxCostEur,
        actual_provider_cost_eur: ledger.actualProviderCostEur,
        max_attempts_per_slot: ledger.maxAttemptsPerSlot,
        attempts_used: ledger.attemptsUsed,
        remaining_authorized_attempts: ledger.remainingAuthorizedAttempts,
        discovery_cost_status: ledger.costStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ledger.generationRunId)
      .eq("workspace_id", ledger.workspaceId)
      .select("*")
      .single();
    throwDb(error, "Failed to upsert discovery run ledger");
    const row = data as Record<string, unknown>;
    return {
      ...ledger,
      updatedAt: str(row.updated_at, ledger.updatedAt),
    };
  }
}
