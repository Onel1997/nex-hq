import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { DESIGN_STUDIO_BUCKET, ensureDesignStudioBucket, type DesignJobScope } from "@/lib/design-studio/server-storage";
import { printFileManifestSchema, type PrintFileManifest } from "@/lib/design-studio/print-file-contracts";

function safe(value: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error("INVALID_DESIGN_PRINT_SCOPE");
  return value;
}

function root(scope: DesignJobScope, jobId: string) {
  return `workspace/${safe(scope.workspaceId)}/actor/${safe(scope.actorId)}/print-file-jobs/${safe(jobId)}`;
}

export class SupabaseDesignPrintFileStore {
  async claim(input: { scope: DesignJobScope; jobId: string; fingerprint: string }) {
    await ensureDesignStudioBucket();
    const result = await createAdminClient().storage.from(DESIGN_STUDIO_BUCKET).upload(
      `${root(input.scope, input.jobId)}/claim.json`,
      JSON.stringify({ fingerprint: input.fingerprint, claimedAt: new Date().toISOString() }),
      { contentType: "application/json", upsert: false },
    );
    if (!result.error) return "CREATED" as const;
    if (/already exists|duplicate/i.test(result.error.message)) return "EXISTS" as const;
    throw result.error;
  }

  async write(manifest: PrintFileManifest) {
    await ensureDesignStudioBucket();
    const parsed = printFileManifestSchema.parse(manifest);
    const result = await createAdminClient().storage.from(DESIGN_STUDIO_BUCKET).upload(
      `${root({ workspaceId: parsed.workspaceId, actorId: parsed.actorId }, parsed.jobId)}/manifest.json`,
      JSON.stringify(parsed),
      { contentType: "application/json", upsert: true },
    );
    if (result.error) throw result.error;
  }

  async read(scope: DesignJobScope, jobId: string) {
    await ensureDesignStudioBucket();
    const result = await createAdminClient().storage.from(DESIGN_STUDIO_BUCKET)
      .download(`${root(scope, jobId)}/manifest.json`);
    if (result.error) {
      if (/not found|object not found/i.test(result.error.message)) return null;
      throw result.error;
    }
    return printFileManifestSchema.parse(JSON.parse(await result.data.text()));
  }
}
