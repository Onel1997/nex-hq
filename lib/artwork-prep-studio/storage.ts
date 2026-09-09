import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  DESIGN_STUDIO_BUCKET,
  ensureDesignStudioBucket,
  type DesignJobScope,
} from "@/lib/design-studio/server-storage";
import {
  designUtilityManifestSchema,
  type DesignUtilityManifest,
} from "@/lib/design-studio/utility-contracts";
import {
  printFileManifestSchema,
  type PrintFileManifest,
} from "@/lib/design-studio/print-file-contracts";
import { z } from "zod";

function safe(value: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error("INVALID_ARTWORK_PREP_SCOPE");
  return value;
}

function root(scope: DesignJobScope, kind: "utility" | "print" | "local", jobId: string) {
  return `workspace/${safe(scope.workspaceId)}/actor/${safe(scope.actorId)}/artwork-prep/${kind}-jobs/${safe(jobId)}`;
}

async function writeProject(scope: DesignJobScope, kind: "utility" | "print", jobId: string, projectId: string) {
  const result = await createAdminClient().storage.from(DESIGN_STUDIO_BUCKET).upload(
    `${root(scope, kind, jobId)}/project.json`,
    JSON.stringify({ projectId: safe(projectId), jobId }),
    { contentType: "application/json", upsert: true },
  );
  if (result.error) throw result.error;
}

async function assertProject(scope: DesignJobScope, kind: "utility" | "print", jobId: string, projectId: string) {
  const result = await createAdminClient().storage.from(DESIGN_STUDIO_BUCKET)
    .download(`${root(scope, kind, jobId)}/project.json`);
  if (result.error) throw result.error;
  const value = JSON.parse(await result.data.text()) as { projectId?: unknown };
  if (value.projectId !== projectId) throw new Error("ARTWORK_PREP_PROJECT_MISMATCH");
}

async function claim(scope: DesignJobScope, kind: "utility" | "print" | "local", jobId: string, fingerprint: string) {
  await ensureDesignStudioBucket();
  const result = await createAdminClient().storage.from(DESIGN_STUDIO_BUCKET).upload(
    `${root(scope, kind, jobId)}/claim.json`,
    JSON.stringify({ fingerprint, claimedAt: new Date().toISOString() }),
    { contentType: "application/json", upsert: false },
  );
  if (!result.error) return "CREATED" as const;
  if (/already exists|duplicate/i.test(result.error.message)) return "EXISTS" as const;
  throw result.error;
}

export class SupabaseArtworkPrepUtilityStore {
  constructor(private readonly projectId: string) {}
  claim(input: { scope: DesignJobScope; jobId: string; fingerprint: string }) {
    return claim(input.scope, "utility", input.jobId, input.fingerprint);
  }
  async write(manifest: DesignUtilityManifest) {
    await ensureDesignStudioBucket();
    const parsed = designUtilityManifestSchema.parse(manifest);
    await writeProject({ workspaceId: parsed.workspaceId, actorId: parsed.actorId }, "utility", parsed.jobId, this.projectId);
    const result = await createAdminClient().storage.from(DESIGN_STUDIO_BUCKET).upload(
      `${root({ workspaceId: parsed.workspaceId, actorId: parsed.actorId }, "utility", parsed.jobId)}/manifest.json`,
      JSON.stringify(parsed),
      { contentType: "application/json", upsert: true },
    );
    if (result.error) throw result.error;
  }
  async read(scope: DesignJobScope, jobId: string) {
    await ensureDesignStudioBucket();
    await assertProject(scope, "utility", jobId, this.projectId);
    const result = await createAdminClient().storage.from(DESIGN_STUDIO_BUCKET)
      .download(`${root(scope, "utility", jobId)}/manifest.json`);
    if (result.error) {
      if (/not found|object not found/i.test(result.error.message)) return null;
      throw result.error;
    }
    return designUtilityManifestSchema.parse(JSON.parse(await result.data.text()));
  }
}

export class SupabaseArtworkPrepPrintStore {
  constructor(private readonly projectId: string) {}
  claim(input: { scope: DesignJobScope; jobId: string; fingerprint: string }) {
    return claim(input.scope, "print", input.jobId, input.fingerprint);
  }
  async write(manifest: PrintFileManifest) {
    await ensureDesignStudioBucket();
    const parsed = printFileManifestSchema.parse(manifest);
    await writeProject({ workspaceId: parsed.workspaceId, actorId: parsed.actorId }, "print", parsed.jobId, this.projectId);
    const result = await createAdminClient().storage.from(DESIGN_STUDIO_BUCKET).upload(
      `${root({ workspaceId: parsed.workspaceId, actorId: parsed.actorId }, "print", parsed.jobId)}/manifest.json`,
      JSON.stringify(parsed),
      { contentType: "application/json", upsert: true },
    );
    if (result.error) throw result.error;
  }
  async read(scope: DesignJobScope, jobId: string) {
    await ensureDesignStudioBucket();
    await assertProject(scope, "print", jobId, this.projectId);
    const result = await createAdminClient().storage.from(DESIGN_STUDIO_BUCKET)
      .download(`${root(scope, "print", jobId)}/manifest.json`);
    if (result.error) {
      if (/not found|object not found/i.test(result.error.message)) return null;
      throw result.error;
    }
    return printFileManifestSchema.parse(JSON.parse(await result.data.text()));
  }
}

export const artworkPrepLocalManifestSchema = z.object({
  version: z.literal("xeriamo-artwork-prep-local-job-v1"),
  jobId: z.string().uuid(),
  projectId: z.string().uuid(),
  workspaceId: z.string().min(1),
  actorId: z.string().min(1),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  sourceAssetId: z.string().uuid(),
  operation: z.literal("BACKGROUND_COLOR"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  status: z.enum(["PREPARING", "SUCCEEDED", "FAILED"]),
  resultAssetId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();
export type ArtworkPrepLocalManifest = z.infer<typeof artworkPrepLocalManifestSchema>;

export class SupabaseArtworkPrepLocalStore {
  claim(input: { scope: DesignJobScope; jobId: string; fingerprint: string }) {
    return claim(input.scope, "local", input.jobId, input.fingerprint);
  }
  async write(manifest: ArtworkPrepLocalManifest) {
    await ensureDesignStudioBucket();
    const parsed = artworkPrepLocalManifestSchema.parse(manifest);
    const result = await createAdminClient().storage.from(DESIGN_STUDIO_BUCKET).upload(
      `${root({ workspaceId: parsed.workspaceId, actorId: parsed.actorId }, "local", parsed.jobId)}/manifest.json`,
      JSON.stringify(parsed),
      { contentType: "application/json", upsert: true },
    );
    if (result.error) throw result.error;
  }
  async read(scope: DesignJobScope, jobId: string) {
    await ensureDesignStudioBucket();
    const result = await createAdminClient().storage.from(DESIGN_STUDIO_BUCKET)
      .download(`${root(scope, "local", jobId)}/manifest.json`);
    if (result.error) {
      if (/not found|object not found/i.test(result.error.message)) return null;
      throw result.error;
    }
    return artworkPrepLocalManifestSchema.parse(JSON.parse(await result.data.text()));
  }
}
