import "server-only";

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

import { requireEnv } from "@/lib/config/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  readUgcVideoStorageObject,
  UGC_VIDEO_ASSET_BUCKET,
} from "@/lib/ugc-video-studio/server-storage";
import {
  VIDEO_EDITOR_MAX_OUTPUT_BYTES,
  videoEditorManifestSchema,
  type VideoEditorManifest,
} from "./contracts";
import type { VideoEditorScope } from "./scope";
export type { VideoEditorScope } from "./scope";

function safeSegment(value: string, label: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error(`VIDEO_EDITOR_INVALID_${label}`);
  return value;
}

export function videoEditorJobRootPath(scope: VideoEditorScope, jobId: string) {
  return [
    "video-editor",
    "workspace",
    safeSegment(scope.workspaceId, "WORKSPACE"),
    "actor",
    safeSegment(scope.actorId, "ACTOR"),
    "jobs",
    safeSegment(jobId, "JOB"),
  ].join("/");
}

export function videoEditorClaimPath(scope: VideoEditorScope, jobId: string) {
  return `${videoEditorJobRootPath(scope, jobId)}/claim.json`;
}

export function videoEditorManifestPath(scope: VideoEditorScope, jobId: string) {
  return `${videoEditorJobRootPath(scope, jobId)}/manifest.json`;
}

export function videoEditorResultPath(scope: VideoEditorScope, jobId: string, resultId: string) {
  return `${videoEditorJobRootPath(scope, jobId)}/results/${safeSegment(resultId, "RESULT")}.mp4`;
}

async function ensureBucket() {
  const found = await createAdminClient().storage.getBucket(UGC_VIDEO_ASSET_BUCKET);
  if (found.error || !found.data || found.data.public) {
    throw new Error("VIDEO_EDITOR_PRIVATE_STORAGE_UNAVAILABLE");
  }
  const allowed = (found.data.allowed_mime_types ?? []).map((value) => value.toLowerCase());
  if (!allowed.includes("application/json") || !allowed.includes("video/mp4")) {
    throw new Error("VIDEO_EDITOR_PRIVATE_STORAGE_INCOMPATIBLE");
  }
}

async function readObject(path: string) {
  await ensureBucket();
  return readUgcVideoStorageObject({
    storage: createAdminClient().storage.from(UGC_VIDEO_ASSET_BUCKET),
    path,
    configuredSupabaseUrl: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  });
}

export class SupabaseVideoEditorJobStore {
  async claim(input: { scope: VideoEditorScope; jobId: string; fingerprint: string }) {
    await ensureBucket();
    const upload = await createAdminClient().storage.from(UGC_VIDEO_ASSET_BUCKET).upload(
      videoEditorClaimPath(input.scope, input.jobId),
      Buffer.from(JSON.stringify({ fingerprint: input.fingerprint, createdAt: new Date().toISOString() })),
      { contentType: "application/json", upsert: false },
    );
    if (!upload.error) return "CREATED" as const;
    if (/already exists|duplicate/i.test(upload.error.message)) return "EXISTS" as const;
    throw new Error("VIDEO_EDITOR_CLAIM_FAILED");
  }

  async readManifest(scope: VideoEditorScope, jobId: string): Promise<VideoEditorManifest | null> {
    const bytes = await readObject(videoEditorManifestPath(scope, jobId));
    if (!bytes) return null;
    const parsed = videoEditorManifestSchema.safeParse(JSON.parse(bytes.toString("utf8")));
    if (
      !parsed.success ||
      parsed.data.jobId !== jobId ||
      parsed.data.workspaceId !== scope.workspaceId ||
      parsed.data.actorId !== scope.actorId
    ) {
      throw new Error("VIDEO_EDITOR_MANIFEST_INCONSISTENT");
    }
    return parsed.data;
  }

  async writeManifest(manifest: VideoEditorManifest) {
    await ensureBucket();
    const parsed = videoEditorManifestSchema.parse(manifest);
    const upload = await createAdminClient().storage.from(UGC_VIDEO_ASSET_BUCKET).upload(
      videoEditorManifestPath(
        { workspaceId: parsed.workspaceId, actorId: parsed.actorId },
        parsed.jobId,
      ),
      Buffer.from(JSON.stringify(parsed)),
      { contentType: "application/json", upsert: true },
    );
    if (upload.error) throw new Error("VIDEO_EDITOR_MANIFEST_WRITE_FAILED");
  }

  async persistResultFile(input: {
    scope: VideoEditorScope;
    jobId: string;
    resultId: string;
    filePath: string;
    sha256: string;
  }) {
    const file = await stat(input.filePath);
    if (!file.isFile() || file.size < 1 || file.size > VIDEO_EDITOR_MAX_OUTPUT_BYTES) throw new Error("VIDEO_EDITOR_RESULT_TOO_LARGE");
    await ensureBucket();
    const storagePath = videoEditorResultPath(input.scope, input.jobId, input.resultId);
    const upload = await createAdminClient().storage.from(UGC_VIDEO_ASSET_BUCKET).upload(
      storagePath,
      createReadStream(input.filePath),
      { contentType: "video/mp4", upsert: false, duplex: "half" },
    );
    if (upload.error && !/already exists|duplicate/i.test(upload.error.message)) {
      throw new Error("VIDEO_EDITOR_RESULT_WRITE_FAILED");
    }
    return {
      storagePath,
      byteLength: file.size,
      sha256: input.sha256,
    };
  }

  async resolveResult(scope: VideoEditorScope, jobId: string, accountId: string) {
    const manifest = await this.readManifest(scope, jobId);
    if (!manifest?.result || manifest.accountId !== accountId) return null;
    return {
      storageBucket: UGC_VIDEO_ASSET_BUCKET,
      storagePath: manifest.result.storagePath,
      byteLength: manifest.result.byteLength,
      mimeType: manifest.result.mimeType,
      resultId: manifest.result.id,
      title: manifest.setup.title,
    };
  }

  async createResultSignedUrl(scope: VideoEditorScope, jobId: string, accountId: string, download?: string) {
    const result = await this.resolveResult(scope, jobId, accountId);
    if (!result) return null;
    const signed = await createAdminClient().storage.from(result.storageBucket).createSignedUrl(
      result.storagePath,
      60,
      download ? { download } : undefined,
    );
    if (signed.error || !signed.data?.signedUrl) throw new Error("VIDEO_EDITOR_RESULT_READ_FAILED");
    return { ...result, signedUrl: signed.data.signedUrl };
  }
}

export function videoEditorFingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
