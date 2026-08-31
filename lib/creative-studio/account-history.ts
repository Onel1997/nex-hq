import { createAdminClient } from "@/lib/supabase/admin";
import {
  hasXerianoOwnerAuthority,
  type XerianoAccountContext,
} from "@/lib/xeriano/access-policy";
import { redactCreativeRunForCustomer } from "@/lib/xeriano/customer-generation";
import { creativeManifestToRun } from "@/lib/creative-studio/generation-service";
import {
  SupabaseCreativeJobStore,
  type CreativeJobScope,
} from "@/lib/creative-studio/server-storage";
import type {
  CreativeReferenceSnapshot,
  CreativeRun,
} from "@/lib/creative-studio/contracts";
import type { CreativeJobManifest } from "@/lib/creative-studio/server-contracts";

const MAX_ACCOUNT_HISTORY_RUNS = 60;

export type CreativeHistoryAuthority = {
  jobId: string;
  actorUserId: string;
  createdAt: string;
};

export interface CreativeHistoryAuthorityRepository {
  listAccountJobs(input: {
    accountId: string;
    limit: number;
  }): Promise<CreativeHistoryAuthority[]>;
  findAccountJob(input: {
    accountId: string;
    jobId: string;
  }): Promise<CreativeHistoryAuthority | null>;
}

export class SupabaseCreativeHistoryAuthorityRepository
  implements CreativeHistoryAuthorityRepository
{
  async listAccountJobs(input: {
    accountId: string;
    limit: number;
  }): Promise<CreativeHistoryAuthority[]> {
    const { data, error } = await createAdminClient()
      .from("xeriano_generation_authorities")
      .select("job_id,actor_user_id,created_at")
      .eq("account_id", input.accountId)
      .eq("studio", "CREATIVE_STUDIO")
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(input.limit, 1), MAX_ACCOUNT_HISTORY_RUNS));
    if (error) throw new Error(`Creative account history authority failed: ${error.message}`);
    return (data ?? []).map((row) => ({
      jobId: String(row.job_id),
      actorUserId: String(row.actor_user_id),
      createdAt: String(row.created_at),
    }));
  }

  async findAccountJob(input: {
    accountId: string;
    jobId: string;
  }): Promise<CreativeHistoryAuthority | null> {
    const { data, error } = await createAdminClient()
      .from("xeriano_generation_authorities")
      .select("job_id,actor_user_id,created_at")
      .eq("account_id", input.accountId)
      .eq("job_id", input.jobId)
      .eq("studio", "CREATIVE_STUDIO")
      .maybeSingle();
    if (error) throw new Error(`Creative account job authority failed: ${error.message}`);
    if (!data) return null;
    return {
      jobId: String(data.job_id),
      actorUserId: String(data.actor_user_id),
      createdAt: String(data.created_at),
    };
  }
}

type HistoryStore = {
  readManifest(scope: CreativeJobScope, jobId: string): Promise<CreativeJobManifest | null>;
  readReferenceSnapshot(
    scope: CreativeJobScope,
    jobId: string,
  ): Promise<CreativeReferenceSnapshot | null>;
};

export async function listCreativeAccountHistory(
  input: {
    context: XerianoAccountContext;
    limit?: number;
  },
  dependencies: {
    authority?: CreativeHistoryAuthorityRepository;
    store?: HistoryStore;
  } = {},
): Promise<CreativeRun[]> {
  const authority =
    dependencies.authority ?? new SupabaseCreativeHistoryAuthorityRepository();
  const store = dependencies.store ?? new SupabaseCreativeJobStore();
  const jobs = await authority.listAccountJobs({
    accountId: input.context.accountId,
    limit: Math.min(Math.max(input.limit ?? MAX_ACCOUNT_HISTORY_RUNS, 1), MAX_ACCOUNT_HISTORY_RUNS),
  });
  const runs = await Promise.all(
    jobs.map(async (job) => {
      const scope = {
        workspaceId: input.context.workspaceKey,
        actorId: job.actorUserId,
      };
      const manifest = await store.readManifest(scope, job.jobId);
      if (
        !manifest ||
        manifest.workspaceId !== input.context.workspaceKey ||
        manifest.actorId !== job.actorUserId
      ) return null;
      const snapshot = await store.readReferenceSnapshot(scope, job.jobId).catch(() => null);
      const run = creativeManifestToRun(manifest);
      return redactCreativeRunForCustomer({
        ...run,
        ...(snapshot ? { referenceSnapshot: snapshot } : {}),
      });
    }),
  );
  return runs
    .filter((run): run is CreativeRun => Boolean(run))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Resolve a private job path only through authenticated account authority. */
export async function resolveCreativeAccountJobScope(
  input: { context: XerianoAccountContext; jobId: string },
  authority: CreativeHistoryAuthorityRepository =
    new SupabaseCreativeHistoryAuthorityRepository(),
): Promise<CreativeJobScope | null> {
  if (hasXerianoOwnerAuthority(input.context)) {
    return {
      workspaceId: input.context.workspaceKey,
      actorId: input.context.userId,
    };
  }
  const job = await authority.findAccountJob({
    accountId: input.context.accountId,
    jobId: input.jobId,
  });
  return job
    ? { workspaceId: input.context.workspaceKey, actorId: job.actorUserId }
    : null;
}
