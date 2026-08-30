import { createHash } from "node:crypto";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  creativeJobManifestSchema,
  type CreativeJobManifest,
} from "@/lib/creative-studio/server-contracts";
import {
  creativeReferenceSnapshotSchema,
  type CreativeReferenceSnapshot,
} from "@/lib/creative-studio/contracts";

export const CREATIVE_STUDIO_ASSET_BUCKET = "creative-studio-assets" as const;

export type CreativeJobScope = {
  workspaceId: string;
  actorId: string;
};

export type CreativeStoredAsset = {
  bytes: Buffer;
  mimeType: string;
};

const creativeCreationReferenceRecordSchema = z
  .object({
    referenceId: z.string().min(1),
    order: z.number().int().nonnegative(),
    role: z.string().min(1).max(80),
    sourceKind: z.enum([
      "LIBRARY_REFERENCE",
      "GENERATED_RESULT_REFERENCE",
      "LOCAL_FILE_REFERENCE",
    ]),
    libraryAssetId: z.string().uuid().nullable(),
    sourceJobId: z.string().min(1).max(160).nullable(),
    sourceResultId: z.string().min(1).max(160).nullable(),
    filename: z.string().min(1).max(255),
    mimeType: z.string().min(1).max(120),
    byteLength: z.number().int().positive(),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
    storagePath: z.string().min(1).nullable(),
  })
  .strict();

export type CreativeCreationReferenceRecord = z.infer<
  typeof creativeCreationReferenceRecordSchema
>;

const creativeCreationReferenceManifestSchema = z
  .object({
    version: z.literal("xeriano-creative-creation-references-v1"),
    accountId: z.string().uuid(),
    jobId: z.string().uuid(),
    createdAt: z.string().datetime(),
    references: z.array(creativeCreationReferenceRecordSchema).max(14),
  })
  .strict();

export type CreativeCreationReferenceManifest = z.infer<
  typeof creativeCreationReferenceManifestSchema
>;

export interface CreativeJobStore {
  claim(input: {
    scope: CreativeJobScope;
    jobId: string;
    requestFingerprint: string;
  }): Promise<"CREATED" | "EXISTS">;
  readManifest(
    scope: CreativeJobScope,
    jobId: string,
  ): Promise<CreativeJobManifest | null>;
  writeManifest(manifest: CreativeJobManifest): Promise<void>;
  persistResult(input: {
    scope: CreativeJobScope;
    jobId: string;
    resultId: string;
    bytes: Buffer;
    mimeType: string;
  }): Promise<string>;
  readResult(input: {
    scope: CreativeJobScope;
    jobId: string;
    resultId: string;
  }): Promise<CreativeStoredAsset | null>;
}

function safeSegment(value: string, label: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error(`Invalid Creative Studio ${label}.`);
  }
  return value;
}

function jobRoot(scope: CreativeJobScope, jobId: string): string {
  return [
    "workspace",
    safeSegment(scope.workspaceId, "workspace"),
    "actor",
    safeSegment(scope.actorId, "actor"),
    "jobs",
    safeSegment(jobId, "job"),
  ].join("/");
}

export function creativeResultAssetPath(input: {
  scope: CreativeJobScope;
  jobId: string;
  resultId: string;
}): string {
  return `${jobRoot(input.scope, input.jobId)}/results/${safeSegment(
    input.resultId,
    "result",
  )}`;
}

export function creativeReferenceSnapshotPath(input: {
  scope: CreativeJobScope;
  jobId: string;
}): string {
  return `${jobRoot(input.scope, input.jobId)}/reference-snapshot.json`;
}

export function creativeCreationReferenceManifestPath(input: {
  scope: CreativeJobScope;
  jobId: string;
}): string {
  return `${jobRoot(input.scope, input.jobId)}/creation-references/manifest.json`;
}

export function creativeCreationReferenceAssetPath(input: {
  scope: CreativeJobScope;
  jobId: string;
  referenceId: string;
}): string {
  return `${jobRoot(input.scope, input.jobId)}/creation-references/${safeSegment(
    input.referenceId,
    "reference",
  )}.json`;
}

export function sha256Hex(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

let bucketReady: Promise<void> | null = null;

async function ensureCreativeBucket(): Promise<void> {
  if (bucketReady) return bucketReady;
  bucketReady = (async () => {
    const storage = createAdminClient().storage;
    const { data, error } = await storage.listBuckets();
    if (error) throw new Error(`Creative storage unavailable: ${error.message}`);
    if (data.some((bucket) => bucket.id === CREATIVE_STUDIO_ASSET_BUCKET)) return;
    const { error: createError } = await storage.createBucket(
      CREATIVE_STUDIO_ASSET_BUCKET,
      {
        public: false,
        fileSizeLimit: 50 * 1024 * 1024,
        allowedMimeTypes: [
          "application/json",
          "image/png",
          "image/jpeg",
          "image/webp",
        ],
      },
    );
    if (createError && !/already exists/i.test(createError.message)) {
      throw new Error(`Creative storage setup failed: ${createError.message}`);
    }
  })().catch((error) => {
    bucketReady = null;
    throw error;
  });
  return bucketReady;
}

async function download(path: string): Promise<Buffer | null> {
  await ensureCreativeBucket();
  const { data, error } = await createAdminClient()
    .storage.from(CREATIVE_STUDIO_ASSET_BUCKET)
    .download(path);
  if (error) {
    if (/not found|does not exist/i.test(error.message)) return null;
    throw new Error(`Creative storage read failed: ${error.message}`);
  }
  return Buffer.from(await data.arrayBuffer());
}

export class SupabaseCreativeJobStore implements CreativeJobStore {
  async persistCreationReference(input: {
    scope: CreativeJobScope;
    jobId: string;
    referenceId: string;
    bytes: Buffer;
    mimeType: string;
  }): Promise<string> {
    await ensureCreativeBucket();
    const path = creativeCreationReferenceAssetPath(input);
    // The private bucket already permits JSON. Wrapping exact bytes keeps AVIF
    // and future validated image formats durable without mutating the existing
    // provider bucket MIME policy at runtime.
    const envelope = Buffer.from(
      JSON.stringify({
        version: "xeriano-private-reference-bytes-v1",
        mimeType: input.mimeType,
        bytesBase64: input.bytes.toString("base64"),
      }),
    );
    const { error } = await createAdminClient()
      .storage.from(CREATIVE_STUDIO_ASSET_BUCKET)
      .upload(path, envelope, { contentType: "application/json", upsert: false });
    if (error && !/already exists|duplicate/i.test(error.message)) {
      throw new Error(`Creative creation reference write failed: ${error.message}`);
    }
    return path;
  }

  async readCreationReference(path: string): Promise<CreativeStoredAsset | null> {
    const bytes = await download(path);
    if (!bytes) return null;
    const parsed = z
      .object({
        version: z.literal("xeriano-private-reference-bytes-v1"),
        mimeType: z.string().min(1),
        bytesBase64: z.string().min(1),
      })
      .strict()
      .parse(JSON.parse(bytes.toString("utf8")));
    return { bytes: Buffer.from(parsed.bytesBase64, "base64"), mimeType: parsed.mimeType };
  }

  async writeCreationReferenceManifest(input: {
    scope: CreativeJobScope;
    manifest: CreativeCreationReferenceManifest;
  }): Promise<void> {
    await ensureCreativeBucket();
    const manifest = creativeCreationReferenceManifestSchema.parse(input.manifest);
    const { error } = await createAdminClient()
      .storage.from(CREATIVE_STUDIO_ASSET_BUCKET)
      .upload(
        creativeCreationReferenceManifestPath({
          scope: input.scope,
          jobId: manifest.jobId,
        }),
        Buffer.from(JSON.stringify(manifest)),
        { contentType: "application/json", upsert: true },
      );
    if (error) {
      throw new Error(`Creative creation reference manifest write failed: ${error.message}`);
    }
  }

  async readCreationReferenceManifest(
    scope: CreativeJobScope,
    jobId: string,
  ): Promise<CreativeCreationReferenceManifest | null> {
    const bytes = await download(
      creativeCreationReferenceManifestPath({ scope, jobId }),
    );
    if (!bytes) return null;
    return creativeCreationReferenceManifestSchema.parse(
      JSON.parse(bytes.toString("utf8")),
    );
  }

  async readReferenceSnapshot(
    scope: CreativeJobScope,
    jobId: string,
  ): Promise<CreativeReferenceSnapshot | null> {
    const bytes = await download(creativeReferenceSnapshotPath({ scope, jobId }));
    if (!bytes) return null;
    return creativeReferenceSnapshotSchema.parse(JSON.parse(bytes.toString("utf8")));
  }

  async writeReferenceSnapshot(input: {
    scope: CreativeJobScope;
    jobId: string;
    snapshot: CreativeReferenceSnapshot;
  }): Promise<void> {
    await ensureCreativeBucket();
    const snapshot = creativeReferenceSnapshotSchema.parse(input.snapshot);
    if (snapshot.jobId !== input.jobId) {
      throw new Error("Creative reference snapshot job mismatch.");
    }
    const { error } = await createAdminClient()
      .storage.from(CREATIVE_STUDIO_ASSET_BUCKET)
      .upload(
        creativeReferenceSnapshotPath({ scope: input.scope, jobId: input.jobId }),
        Buffer.from(JSON.stringify(snapshot)),
        { contentType: "application/json", upsert: true },
      );
    if (error) {
      throw new Error(`Creative reference snapshot write failed: ${error.message}`);
    }
  }

  async claim(input: {
    scope: CreativeJobScope;
    jobId: string;
    requestFingerprint: string;
  }): Promise<"CREATED" | "EXISTS"> {
    await ensureCreativeBucket();
    const path = `${jobRoot(input.scope, input.jobId)}/claim.json`;
    const bytes = Buffer.from(
      JSON.stringify({
        requestFingerprint: input.requestFingerprint,
        createdAt: new Date().toISOString(),
      }),
    );
    const { error } = await createAdminClient()
      .storage.from(CREATIVE_STUDIO_ASSET_BUCKET)
      .upload(path, bytes, {
        contentType: "application/json",
        upsert: false,
      });
    if (!error) return "CREATED";
    if (/already exists|duplicate/i.test(error.message)) return "EXISTS";
    throw new Error(`Creative request claim failed: ${error.message}`);
  }

  async readManifest(
    scope: CreativeJobScope,
    jobId: string,
  ): Promise<CreativeJobManifest | null> {
    const bytes = await download(`${jobRoot(scope, jobId)}/manifest.json`);
    if (!bytes) return null;
    return creativeJobManifestSchema.parse(JSON.parse(bytes.toString("utf8")));
  }

  async writeManifest(manifest: CreativeJobManifest): Promise<void> {
    await ensureCreativeBucket();
    const parsed = creativeJobManifestSchema.parse(manifest);
    const scope = {
      workspaceId: parsed.workspaceId,
      actorId: parsed.actorId,
    };
    const { error } = await createAdminClient()
      .storage.from(CREATIVE_STUDIO_ASSET_BUCKET)
      .upload(
        `${jobRoot(scope, parsed.jobId)}/manifest.json`,
        Buffer.from(JSON.stringify(parsed)),
        { contentType: "application/json", upsert: true },
      );
    if (error) throw new Error(`Creative manifest write failed: ${error.message}`);
  }

  async persistResult(input: {
    scope: CreativeJobScope;
    jobId: string;
    resultId: string;
    bytes: Buffer;
    mimeType: string;
  }): Promise<string> {
    await ensureCreativeBucket();
    const path = creativeResultAssetPath(input);
    const { error } = await createAdminClient()
      .storage.from(CREATIVE_STUDIO_ASSET_BUCKET)
      .upload(path, input.bytes, {
        contentType: input.mimeType,
        upsert: false,
      });
    if (error && !/already exists|duplicate/i.test(error.message)) {
      throw new Error(`Creative result storage failed: ${error.message}`);
    }
    return path;
  }

  async readResult(input: {
    scope: CreativeJobScope;
    jobId: string;
    resultId: string;
  }): Promise<CreativeStoredAsset | null> {
    const manifest = await this.readManifest(input.scope, input.jobId);
    const record = manifest?.results.find(
      (result) => result.publicView.id === input.resultId,
    );
    if (!record) return null;
    const bytes = await download(record.storagePath);
    if (!bytes || sha256Hex(bytes) !== record.sha256) return null;
    return { bytes, mimeType: record.publicView.mimeType };
  }
}
