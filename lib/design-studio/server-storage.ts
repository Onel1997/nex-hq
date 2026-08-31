import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { designJobManifestSchema, type DesignJobManifest } from "@/lib/design-studio/server-contracts";

export const DESIGN_STUDIO_BUCKET = "design-studio-assets" as const;
export type DesignJobScope = { workspaceId: string; actorId: string };
export type DesignStoredAsset = { bytes: Buffer; mimeType: string };

function safe(value: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error("INVALID_DESIGN_STORAGE_SCOPE");
  return value;
}
function root(scope: DesignJobScope) {
  return `workspace/${safe(scope.workspaceId)}/actor/${safe(scope.actorId)}/jobs`;
}
function jobRoot(scope: DesignJobScope, jobId: string) { return `${root(scope)}/${safe(jobId)}`; }
function manifestPath(scope: DesignJobScope, jobId: string) { return `${jobRoot(scope, jobId)}/manifest.json`; }
function claimPath(scope: DesignJobScope, jobId: string) { return `${jobRoot(scope, jobId)}/claim.json`; }
export function designResultPath(scope: DesignJobScope, jobId: string, resultId: string, mimeType: string) {
  const ext = mimeType === "image/svg+xml" ? "svg" : mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png";
  return `${jobRoot(scope, jobId)}/results/${safe(resultId)}.${ext}`;
}
function referencePath(scope: DesignJobScope, jobId: string, mimeType: string) {
  const ext = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png";
  return `${jobRoot(scope, jobId)}/reference/original.${ext}`;
}
export function sha256(bytes: Buffer | string) { return createHash("sha256").update(bytes).digest("hex"); }

let ready: Promise<void> | null = null;
export async function ensureDesignStudioBucket() {
  if (ready) return ready;
  ready = (async () => {
    const storage = createAdminClient().storage;
    const listed = await storage.listBuckets();
    if (listed.error) throw listed.error;
    if (listed.data.some((bucket) => bucket.id === DESIGN_STUDIO_BUCKET)) return;
    const created = await storage.createBucket(DESIGN_STUDIO_BUCKET, {
      public: false,
      fileSizeLimit: 50 * 1024 * 1024,
      allowedMimeTypes: ["application/json", "image/png", "image/jpeg", "image/webp", "image/svg+xml"],
    });
    if (created.error && !/already exists/i.test(created.error.message)) throw created.error;
  })();
  return ready;
}

export class SupabaseDesignJobStore {
  async claim(input: { scope: DesignJobScope; jobId: string; fingerprint: string }) {
    await ensureDesignStudioBucket();
    const result = await createAdminClient().storage.from(DESIGN_STUDIO_BUCKET).upload(
      claimPath(input.scope, input.jobId),
      JSON.stringify({ fingerprint: input.fingerprint, claimedAt: new Date().toISOString() }),
      { contentType: "application/json", upsert: false },
    );
    if (!result.error) return "CREATED" as const;
    if (/already exists|duplicate/i.test(result.error.message)) return "EXISTS" as const;
    throw result.error;
  }

  async writeManifest(manifest: DesignJobManifest) {
    await ensureDesignStudioBucket();
    const parsed = designJobManifestSchema.parse(manifest);
    const result = await createAdminClient().storage.from(DESIGN_STUDIO_BUCKET).upload(
      manifestPath({ workspaceId: parsed.workspaceId, actorId: parsed.actorId }, parsed.jobId),
      JSON.stringify(parsed),
      { contentType: "application/json", upsert: true },
    );
    if (result.error) throw result.error;
  }

  async readManifest(scope: DesignJobScope, jobId: string): Promise<DesignJobManifest | null> {
    await ensureDesignStudioBucket();
    const result = await createAdminClient().storage.from(DESIGN_STUDIO_BUCKET).download(manifestPath(scope, jobId));
    if (result.error) {
      if (/not found|object not found/i.test(result.error.message)) return null;
      throw result.error;
    }
    return designJobManifestSchema.parse(JSON.parse(await result.data.text()));
  }

  async listManifests(scope: DesignJobScope, limit = 40): Promise<DesignJobManifest[]> {
    await ensureDesignStudioBucket();
    const listed = await createAdminClient().storage.from(DESIGN_STUDIO_BUCKET).list(root(scope), {
      limit: Math.min(Math.max(limit, 1), 60),
      sortBy: { column: "created_at", order: "desc" },
    });
    if (listed.error) throw listed.error;
    const manifests = await Promise.all(listed.data
      .filter((item) => /^[0-9a-f-]{36}$/i.test(item.name))
      .slice(0, limit)
      .map((item) => this.readManifest(scope, item.name)));
    return manifests.filter((item): item is DesignJobManifest => item !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async persistResult(input: { scope: DesignJobScope; jobId: string; resultId: string; bytes: Buffer; mimeType: string }) {
    await ensureDesignStudioBucket();
    const path = designResultPath(input.scope, input.jobId, input.resultId, input.mimeType);
    const stored = await createAdminClient().storage.from(DESIGN_STUDIO_BUCKET).upload(path, input.bytes, {
      contentType: input.mimeType,
      upsert: false,
    });
    if (stored.error && !/already exists|duplicate/i.test(stored.error.message)) throw stored.error;
    return path;
  }

  async persistReference(input: { scope: DesignJobScope; jobId: string; bytes: Buffer; mimeType: string }) {
    await ensureDesignStudioBucket();
    const path = referencePath(input.scope, input.jobId, input.mimeType);
    const stored = await createAdminClient().storage.from(DESIGN_STUDIO_BUCKET).upload(path, input.bytes, {
      contentType: input.mimeType, upsert: false,
    });
    if (stored.error && !/already exists|duplicate/i.test(stored.error.message)) throw stored.error;
    return path;
  }

  async readResult(input: { scope: DesignJobScope; jobId: string; storagePath: string }): Promise<DesignStoredAsset | null> {
    if (!input.storagePath.startsWith(`${jobRoot(input.scope, input.jobId)}/results/`)) return null;
    const result = await createAdminClient().storage.from(DESIGN_STUDIO_BUCKET).download(input.storagePath);
    if (result.error) return null;
    return { bytes: Buffer.from(await result.data.arrayBuffer()), mimeType: result.data.type || "application/octet-stream" };
  }
}
