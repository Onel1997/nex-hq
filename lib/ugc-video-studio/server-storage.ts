import { createHash } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  ugcVideoJobManifestSchema,
  type UgcVideoJobManifest,
} from "@/lib/ugc-video-studio/server-contracts";
import {
  UGC_VIDEO_BUCKET_FILE_SIZE_LIMIT_BYTES,
  UGC_VIDEO_RESULT_MAX_BYTES,
} from "@/lib/ugc-video-studio/storage-policy";

export {
  UGC_VIDEO_BUCKET_FILE_SIZE_LIMIT_BYTES,
  UGC_VIDEO_RESULT_MAX_BYTES,
  UGC_VIDEO_STORAGE_POLICY_V1,
} from "@/lib/ugc-video-studio/storage-policy";

export const UGC_VIDEO_ASSET_BUCKET = "ugc-video-studio-assets" as const;
export const UGC_VIDEO_BUCKET_OPTIONS = Object.freeze({
  public: false,
  fileSizeLimit: UGC_VIDEO_BUCKET_FILE_SIZE_LIMIT_BYTES,
  allowedMimeTypes: ["application/json", "video/mp4"] as const,
});

export class UgcVideoResultTooLargeError extends Error {
  readonly code = "UGC_VIDEO_RESULT_TOO_LARGE" as const;

  constructor(
    readonly byteLength: number,
    readonly maximumBytes: number = UGC_VIDEO_RESULT_MAX_BYTES,
  ) {
    super("Das erzeugte Video ist größer als das aktuell erlaubte Speicherlimit.");
    this.name = "UgcVideoResultTooLargeError";
  }
}

export class UgcVideoStorageSetupError extends Error {
  readonly code = "UGC_VIDEO_STORAGE_SETUP_FAILED" as const;

  constructor(readonly technicalDetails: string) {
    super("Der private Videospeicher konnte nicht vorbereitet werden.");
    this.name = "UgcVideoStorageSetupError";
  }
}

export class UgcVideoStorageError extends Error {
  readonly code = "UGC_VIDEO_STORAGE_FAILED" as const;

  constructor(message: string, readonly technicalDetails: string) {
    super(message);
    this.name = "UgcVideoStorageError";
  }
}

export class UgcVideoJobStateError extends Error {
  readonly code = "UGC_VIDEO_JOB_STATE_INCONSISTENT" as const;

  constructor(readonly technicalDetails: string) {
    super("Der gespeicherte Videoauftrag konnte nicht sicher gelesen werden.");
    this.name = "UgcVideoJobStateError";
  }
}

export type UgcVideoJobScope = {
  workspaceId: string;
  actorId: string;
};

export type UgcVideoStoredAsset = {
  bytes: Buffer;
  mimeType: string;
};

export type UgcVideoStorageRequirement = {
  requiredResultBytes: number;
};

export type UgcVideoStorageReadiness = {
  bucketId: typeof UGC_VIDEO_ASSET_BUCKET;
  bucketFileSizeLimitBytes: number;
  resultMaxBytes: number;
  private: true;
  videoMp4Allowed: true;
};

export interface UgcVideoJobStore {
  ensureReady(
    requirement?: UgcVideoStorageRequirement,
  ): Promise<UgcVideoStorageReadiness>;
  claim(input: {
    scope: UgcVideoJobScope;
    jobId: string;
    requestFingerprint: string;
  }): Promise<"CREATED" | "EXISTS">;
  readManifest(
    scope: UgcVideoJobScope,
    jobId: string,
  ): Promise<UgcVideoJobManifest | null>;
  writeManifest(manifest: UgcVideoJobManifest): Promise<void>;
  persistResult(input: {
    scope: UgcVideoJobScope;
    jobId: string;
    resultId: string;
    bytes: Buffer;
    mimeType: string;
  }): Promise<string>;
  readResult(input: {
    scope: UgcVideoJobScope;
    jobId: string;
    resultId: string;
  }): Promise<UgcVideoStoredAsset | null>;
}

function safeSegment(value: string, label: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error(`Invalid UGC Video Studio ${label}.`);
  }
  return value;
}

function jobRoot(scope: UgcVideoJobScope, jobId: string): string {
  return [
    "workspace",
    safeSegment(scope.workspaceId, "workspace"),
    "actor",
    safeSegment(scope.actorId, "actor"),
    "jobs",
    safeSegment(jobId, "job"),
  ].join("/");
}

export function ugcVideoResultAssetPath(input: {
  scope: UgcVideoJobScope;
  jobId: string;
  resultId: string;
}): string {
  return `${jobRoot(input.scope, input.jobId)}/results/${safeSegment(
    input.resultId,
    "result",
  )}`;
}

export function sha256UgcVideo(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

type UgcVideoBucketRecord = {
  id: string;
  public: boolean;
  file_size_limit?: number | null;
  allowed_mime_types?: string[] | null;
};

type UgcVideoBucketStorageClient = {
  listBuckets(): Promise<{
    data: UgcVideoBucketRecord[] | null;
    error: { message: string } | null;
  }>;
  getBucket(id: string): Promise<{
    data: UgcVideoBucketRecord | null;
    error: { message: string } | null;
  }>;
  createBucket(
    id: string,
    options: {
      public: boolean;
      fileSizeLimit: number;
      allowedMimeTypes: string[];
    },
  ): Promise<{ error: { message: string } | null }>;
};

function storageSetupDetails(stage: string, message: string): string {
  const limitExplanation = /maximum allowed size|too large|object exceeded/i.test(
    message,
  )
    ? " Die aktuelle Supabase-Speichergrenze erlaubt die angeforderte Bucket-Konfiguration nicht."
    : "";
  return `${stage}:${message}.${limitExplanation}`.slice(0, 4000);
}

function validateUgcVideoBucket(input: {
  bucket: UgcVideoBucketRecord;
  requiredResultBytes: number;
}): UgcVideoStorageReadiness {
  const mimeTypes = (input.bucket.allowed_mime_types ?? []).map((mimeType) =>
    mimeType.toLowerCase(),
  );
  const configuredLimit = input.bucket.file_size_limit;
  const reasons = [
    input.bucket.public ? "bucket_is_public" : null,
    !mimeTypes.includes("video/mp4") ? "video_mp4_not_allowed" : null,
    !mimeTypes.includes("application/json") ? "application_json_not_allowed" : null,
    typeof configuredLimit !== "number" ||
    configuredLimit < input.requiredResultBytes
      ? `bucket_limit_insufficient:configured=${configuredLimit ?? "unknown"};required=${input.requiredResultBytes}`
      : null,
  ].filter(Boolean);
  if (reasons.length) {
    throw new UgcVideoStorageSetupError(
      `bucket_configuration_incompatible:${reasons.join(",")}`,
    );
  }
  const safeConfiguredLimit =
    typeof configuredLimit === "number" ? configuredLimit : 0;
  return {
    bucketId: UGC_VIDEO_ASSET_BUCKET,
    bucketFileSizeLimitBytes: safeConfiguredLimit,
    resultMaxBytes: Math.min(
      safeConfiguredLimit,
      UGC_VIDEO_RESULT_MAX_BYTES,
    ),
    private: true,
    videoMp4Allowed: true,
  };
}

export async function prepareUgcVideoBucket(
  storage: UgcVideoBucketStorageClient,
  requirement: UgcVideoStorageRequirement = {
    requiredResultBytes: UGC_VIDEO_RESULT_MAX_BYTES,
  },
): Promise<UgcVideoStorageReadiness> {
  const listed = await storage.listBuckets();
  if (listed.error) {
    throw new UgcVideoStorageSetupError(
      storageSetupDetails("bucket_list_failed", listed.error.message),
    );
  }
  const exists = (listed.data ?? []).some(
    (bucket) => bucket.id === UGC_VIDEO_ASSET_BUCKET,
  );
  if (!exists) {
    const created = await storage.createBucket(UGC_VIDEO_ASSET_BUCKET, {
      public: UGC_VIDEO_BUCKET_OPTIONS.public,
      fileSizeLimit: UGC_VIDEO_BUCKET_OPTIONS.fileSizeLimit,
      allowedMimeTypes: [...UGC_VIDEO_BUCKET_OPTIONS.allowedMimeTypes],
    });
    if (created.error && !/already exists/i.test(created.error.message)) {
      throw new UgcVideoStorageSetupError(
        storageSetupDetails("bucket_create_failed", created.error.message),
      );
    }
  }

  // Always re-read the UGC bucket after the optional create. The returned
  // metadata, not another historical bucket, is the storage authority.
  const verified = await storage.getBucket(UGC_VIDEO_ASSET_BUCKET);
  if (verified.error || !verified.data) {
    throw new UgcVideoStorageSetupError(
      storageSetupDetails(
        "bucket_verify_failed",
        verified.error?.message ?? "bucket_not_returned",
      ),
    );
  }
  return validateUgcVideoBucket({
    bucket: verified.data,
    requiredResultBytes: requirement.requiredResultBytes,
  });
}

let bucketReady: Promise<UgcVideoStorageReadiness> | null = null;

async function ensureUgcVideoBucket(
  requirement: UgcVideoStorageRequirement = {
    requiredResultBytes: UGC_VIDEO_RESULT_MAX_BYTES,
  },
): Promise<UgcVideoStorageReadiness> {
  if (!bucketReady) {
    bucketReady = prepareUgcVideoBucket(
      createAdminClient().storage as UgcVideoBucketStorageClient,
      requirement,
    ).catch((error) => {
      bucketReady = null;
      throw error;
    });
  }
  const readiness = await bucketReady;
  if (readiness.bucketFileSizeLimitBytes < requirement.requiredResultBytes) {
    throw new UgcVideoStorageSetupError(
      `bucket_limit_insufficient:configured=${readiness.bucketFileSizeLimitBytes};required=${requirement.requiredResultBytes}`,
    );
  }
  return readiness;
}

type StorageReadError = {
  message?: unknown;
  status?: unknown;
  statusCode?: unknown;
  code?: unknown;
};

/**
 * Supabase Storage may represent a missing object as HTTP 400 with an explicit
 * Object-not-found code/message. Only that narrow case is absence; every other
 * 4xx/5xx response is a storage failure and must not become a fake job 404.
 */
export function isUgcVideoStorageObjectNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as StorageReadError;
  const status =
    typeof candidate.status === "number"
      ? candidate.status
      : Number.parseInt(String(candidate.status ?? ""), 10);
  const statusCode = String(
    candidate.statusCode ?? candidate.code ?? "",
  ).toLowerCase();
  const message =
    typeof candidate.message === "string"
      ? candidate.message.toLowerCase()
      : "";
  if (status === 404 || statusCode === "404") return true;
  if (
    ["not_found", "notfound", "no_such_key", "nosuchkey", "object_not_found"].includes(
      statusCode,
    )
  ) {
    return true;
  }
  return (
    status === 400 &&
    /(?:object|resource|file) (?:was )?not found|does not exist/.test(message)
  );
}

function safeStorageReadDetails(error: unknown): string {
  if (!error || typeof error !== "object") return "storage_read_failed";
  const candidate = error as StorageReadError;
  const status =
    typeof candidate.status === "number" ? candidate.status : null;
  const statusCode =
    typeof candidate.statusCode === "string"
      ? candidate.statusCode
      : typeof candidate.code === "string"
        ? candidate.code
        : null;
  return `storage_read_failed:status=${status ?? "unknown"};code=${statusCode ?? "unknown"}`;
}

async function download(path: string): Promise<Buffer | null> {
  await ensureUgcVideoBucket();
  const { data, error } = await createAdminClient()
    .storage.from(UGC_VIDEO_ASSET_BUCKET)
    .download(path);
  if (error) {
    if (isUgcVideoStorageObjectNotFound(error)) return null;
    throw new UgcVideoStorageError(
      "Der private Videospeicher konnte nicht gelesen werden.",
      safeStorageReadDetails(error),
    );
  }
  return Buffer.from(await data.arrayBuffer());
}

export class SupabaseUgcVideoJobStore implements UgcVideoJobStore {
  async ensureReady(
    requirement?: UgcVideoStorageRequirement,
  ): Promise<UgcVideoStorageReadiness> {
    return ensureUgcVideoBucket(requirement);
  }

  async claim(input: {
    scope: UgcVideoJobScope;
    jobId: string;
    requestFingerprint: string;
  }): Promise<"CREATED" | "EXISTS"> {
    await ensureUgcVideoBucket();
    const path = `${jobRoot(input.scope, input.jobId)}/claim.json`;
    const bytes = Buffer.from(
      JSON.stringify({
        requestFingerprint: input.requestFingerprint,
        createdAt: new Date().toISOString(),
      }),
    );
    const { error } = await createAdminClient()
      .storage.from(UGC_VIDEO_ASSET_BUCKET)
      .upload(path, bytes, { contentType: "application/json", upsert: false });
    if (!error) return "CREATED";
    if (/already exists|duplicate/i.test(error.message)) return "EXISTS";
    throw new Error(`UGC video request claim failed: ${error.message}`);
  }

  async readManifest(
    scope: UgcVideoJobScope,
    jobId: string,
  ): Promise<UgcVideoJobManifest | null> {
    const bytes = await download(`${jobRoot(scope, jobId)}/manifest.json`);
    if (!bytes) {
      const claim = await download(`${jobRoot(scope, jobId)}/claim.json`);
      if (claim) {
        throw new UgcVideoJobStateError("claim_exists_without_manifest");
      }
      return null;
    }
    try {
      return ugcVideoJobManifestSchema.parse(
        JSON.parse(bytes.toString("utf8")),
      );
    } catch (error) {
      throw new UgcVideoJobStateError(
        `manifest_invalid:${error instanceof Error ? error.name : "unknown"}`,
      );
    }
  }

  async writeManifest(manifest: UgcVideoJobManifest): Promise<void> {
    await ensureUgcVideoBucket();
    const parsed = ugcVideoJobManifestSchema.parse(manifest);
    const scope = {
      workspaceId: parsed.workspaceId,
      actorId: parsed.actorId,
    };
    const { error } = await createAdminClient()
      .storage.from(UGC_VIDEO_ASSET_BUCKET)
      .upload(
        `${jobRoot(scope, parsed.jobId)}/manifest.json`,
        Buffer.from(JSON.stringify(parsed)),
        { contentType: "application/json", upsert: true },
      );
    if (error) throw new Error(`UGC video manifest write failed: ${error.message}`);
  }

  async persistResult(input: {
    scope: UgcVideoJobScope;
    jobId: string;
    resultId: string;
    bytes: Buffer;
    mimeType: string;
  }): Promise<string> {
    if (input.bytes.byteLength > UGC_VIDEO_RESULT_MAX_BYTES) {
      throw new UgcVideoResultTooLargeError(input.bytes.byteLength);
    }
    await ensureUgcVideoBucket();
    const path = ugcVideoResultAssetPath(input);
    const { error } = await createAdminClient()
      .storage.from(UGC_VIDEO_ASSET_BUCKET)
      .upload(path, input.bytes, {
        contentType: input.mimeType,
        upsert: false,
      });
    if (error && !/already exists|duplicate/i.test(error.message)) {
      if (/maximum allowed size|too large|payload too large|object exceeded/i.test(error.message)) {
        throw new UgcVideoResultTooLargeError(input.bytes.byteLength);
      }
      throw new UgcVideoStorageError(
        "Das Video wurde erstellt, konnte aber nicht gespeichert werden.",
        `result_upload_failed:${error.message}`,
      );
    }
    return path;
  }

  async readResult(input: {
    scope: UgcVideoJobScope;
    jobId: string;
    resultId: string;
  }): Promise<UgcVideoStoredAsset | null> {
    const manifest = await this.readManifest(input.scope, input.jobId);
    const record =
      manifest?.result?.publicView.id === input.resultId
        ? manifest.result
        : null;
    if (!record) return null;
    const bytes = await download(record.storagePath);
    if (!bytes || sha256UgcVideo(bytes) !== record.sha256) return null;
    return { bytes, mimeType: record.publicView.mimeType };
  }
}
