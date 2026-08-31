import { createAdminClient } from "@/lib/supabase/admin";
import type { XerianoAccountContext } from "@/lib/xeriano/access-policy";
import { publicDesignRun } from "@/lib/design-studio/public";
import { SupabaseDesignJobStore } from "@/lib/design-studio/server-storage";
import type { DesignRun } from "@/lib/design-studio/contracts";

export async function listDesignAccountHistory(context: XerianoAccountContext, limit = 40): Promise<DesignRun[]> {
  const bounded = Math.min(Math.max(limit, 1), 60);
  const admin = createAdminClient();
  const [authorities, creations, own] = await Promise.all([
    admin.from("xeriano_generation_authorities").select("job_id,actor_user_id,created_at")
      .eq("account_id", context.accountId).eq("studio", "DESIGN_STUDIO")
      .order("created_at", { ascending: false }).limit(bounded),
    admin.from("xeriano_creations").select("source_job_id,actor_user_id,created_at")
      .eq("account_id", context.accountId).eq("source_studio", "DESIGN_STUDIO")
      .order("created_at", { ascending: false }).limit(bounded),
    new SupabaseDesignJobStore().listManifests({ workspaceId: context.workspaceKey, actorId: context.userId }, bounded),
  ]);
  if (authorities.error) throw authorities.error;
  if (creations.error) throw creations.error;
  const keys = new Map<string, { jobId: string; actorId: string }>();
  for (const item of authorities.data ?? []) keys.set(item.job_id, { jobId: item.job_id, actorId: item.actor_user_id });
  for (const item of creations.data ?? []) keys.set(item.source_job_id, { jobId: item.source_job_id, actorId: item.actor_user_id });
  const store = new SupabaseDesignJobStore();
  const durable = await Promise.all([...keys.values()].slice(0, bounded).map((item) =>
    store.readManifest({ workspaceId: context.workspaceKey, actorId: item.actorId }, item.jobId),
  ));
  const byJob = new Map<string, ReturnType<typeof publicDesignRun>>();
  for (const manifest of [...own, ...durable.filter((item): item is NonNullable<typeof item> => item !== null)]) {
    const run = publicDesignRun(manifest);
    byJob.set(run.id, {
      ...run,
      results: run.results.map((result) => result.libraryAssetId ? {
        ...result,
        url: `/api/xeriano/library/${result.libraryAssetId}/content${result.mimeType === "image/svg+xml" ? "?preview=1" : ""}`,
        downloadUrl: `/api/xeriano/library/${result.libraryAssetId}/content?download=1`,
      } : result),
    });
  }
  return [...byJob.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, bounded);
}
