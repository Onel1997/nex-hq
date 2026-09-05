import "server-only";

import type { XerianoAccountContext } from "@/lib/xeriano/auth";
import { VIDEO_EDITOR_STALE_JOB_MS, type VideoEditorManifest } from "./contracts";
import { SupabaseVideoEditorRenderLeaseStore, type VideoEditorRenderLeaseStore } from "./lease";
import { transitionVideoEditorManifest } from "./manifest";
import { SupabaseVideoEditorJobStore } from "./storage";

export async function reconcileStaleVideoEditorJob(input: {
  context: XerianoAccountContext;
  manifest: VideoEditorManifest;
  store?: SupabaseVideoEditorJobStore;
  leaseStore?: VideoEditorRenderLeaseStore;
  now?: number;
}) {
  if (!["PREPARING", "RENDERING"].includes(input.manifest.status)) return input.manifest;
  const started = Date.parse(input.manifest.renderStartedAt ?? input.manifest.createdAt);
  if ((input.now ?? Date.now()) - started <= VIDEO_EDITOR_STALE_JOB_MS) return input.manifest;
  const store = input.store ?? new SupabaseVideoEditorJobStore();
  const failed = transitionVideoEditorManifest(input.manifest, {
    status: "FAILED",
    completedAt: new Date(input.now ?? Date.now()).toISOString(),
    error: { code: "TIMED_OUT", message: "Der Export hat das Zeitlimit erreicht. Dein Projekt wurde nicht verändert." },
  });
  await store.writeManifest(failed);
  await (input.leaseStore ?? new SupabaseVideoEditorRenderLeaseStore())
    .release({ context: input.context, jobId: input.manifest.jobId })
    .catch(() => undefined);
  return failed;
}
