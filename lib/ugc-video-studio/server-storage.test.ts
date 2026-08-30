import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { UGC_VIDEO_REFERENCE_TOTAL_MAX_BYTES } from "@/lib/ugc-video-studio/contracts";
import {
  prepareUgcVideoBucket,
  UGC_VIDEO_ASSET_BUCKET,
  UGC_VIDEO_BUCKET_FILE_SIZE_LIMIT_BYTES,
  UGC_VIDEO_BUCKET_OPTIONS,
  UGC_VIDEO_RESULT_MAX_BYTES,
  UgcVideoStorageSetupError,
} from "@/lib/ugc-video-studio/server-storage";

type Bucket = {
  id: string;
  public: boolean;
  file_size_limit: number | null;
  allowed_mime_types: string[] | null;
};

function compatibleBucket(overrides: Partial<Bucket> = {}): Bucket {
  return {
    id: UGC_VIDEO_ASSET_BUCKET,
    public: false,
    file_size_limit: UGC_VIDEO_BUCKET_FILE_SIZE_LIMIT_BYTES,
    allowed_mime_types: ["application/json", "video/mp4"],
    ...overrides,
  };
}

function storageFixture(input: {
  listed?: Bucket[];
  verified?: Bucket | null;
  createError?: string | null;
}) {
  const calls: Array<{ method: string; args?: unknown }> = [];
  let verified = input.verified ?? null;
  return {
    calls,
    client: {
      async listBuckets() {
        calls.push({ method: "listBuckets" });
        return { data: input.listed ?? [], error: null };
      },
      async createBucket(
        id: string,
        options: {
          public: boolean;
          fileSizeLimit: number;
          allowedMimeTypes: string[];
        },
      ) {
        calls.push({ method: "createBucket", args: { id, options } });
        if (!input.createError) verified = compatibleBucket();
        return {
          error: input.createError ? { message: input.createError } : null,
        };
      },
      async getBucket(id: string) {
        calls.push({ method: "getBucket", args: id });
        return {
          data: verified,
          error: verified ? null : { message: "not found" },
        };
      },
    },
  };
}

test("absent UGC bucket is created privately with exactly 50 MiB and then verified", async () => {
  const fixture = storageFixture({});
  const readiness = await prepareUgcVideoBucket(fixture.client);
  assert.deepEqual(fixture.calls, [
    { method: "listBuckets" },
    {
      method: "createBucket",
      args: {
        id: UGC_VIDEO_ASSET_BUCKET,
        options: {
          public: false,
          fileSizeLimit: 52_428_800,
          allowedMimeTypes: ["application/json", "video/mp4"],
        },
      },
    },
    { method: "getBucket", args: UGC_VIDEO_ASSET_BUCKET },
  ]);
  assert.deepEqual(readiness, {
    bucketId: UGC_VIDEO_ASSET_BUCKET,
    bucketFileSizeLimitBytes: 52_428_800,
    resultMaxBytes: 52_428_800,
    private: true,
    videoMp4Allowed: true,
  });
});

test("existing compatible UGC bucket is reused without create or update", async () => {
  const bucket = compatibleBucket();
  const fixture = storageFixture({ listed: [bucket], verified: bucket });
  await prepareUgcVideoBucket(fixture.client);
  assert.deepEqual(
    fixture.calls.map((call) => call.method),
    ["listBuckets", "getBucket"],
  );
});

test("existing incompatible UGC bucket fails truthfully without mutation", async () => {
  const bucket = compatibleBucket({
    public: true,
    file_size_limit: 10 * 1024 * 1024,
    allowed_mime_types: ["application/json"],
  });
  const fixture = storageFixture({ listed: [bucket], verified: bucket });
  await assert.rejects(
    prepareUgcVideoBucket(fixture.client),
    (error) =>
      error instanceof UgcVideoStorageSetupError &&
      error.code === "UGC_VIDEO_STORAGE_SETUP_FAILED" &&
      /bucket_is_public/.test(error.technicalDetails) &&
      /video_mp4_not_allowed/.test(error.technicalDetails) &&
      /bucket_limit_insufficient/.test(error.technicalDetails),
  );
  assert.equal(
    fixture.calls.some((call) => call.method === "createBucket"),
    false,
  );
});

test("unrelated historical 500 MiB bucket is never used as UGC authority", async () => {
  const fixture = storageFixture({
    listed: [
      {
        id: "video-production-assets",
        public: false,
        file_size_limit: 524_288_000,
        allowed_mime_types: ["video/mp4"],
      },
    ],
  });
  await prepareUgcVideoBucket(fixture.client);
  const create = fixture.calls.find((call) => call.method === "createBucket");
  assert.deepEqual(create?.args, {
    id: UGC_VIDEO_ASSET_BUCKET,
    options: {
      public: false,
      fileSizeLimit: 52_428_800,
      allowedMimeTypes: ["application/json", "video/mp4"],
    },
  });
});

test("bucket create limit failure has setup-specific semantics", async () => {
  const fixture = storageFixture({
    createError: "The object exceeded the maximum allowed size",
  });
  await assert.rejects(
    prepareUgcVideoBucket(fixture.client),
    (error) =>
      error instanceof UgcVideoStorageSetupError &&
      error.message === "Der private Videospeicher konnte nicht vorbereitet werden." &&
      /bucket_create_failed/.test(error.technicalDetails) &&
      /aktuelle Supabase-Speichergrenze/.test(error.technicalDetails),
  );
  assert.deepEqual(
    fixture.calls.map((call) => call.method),
    ["listBuckets", "createBucket"],
  );
});

test("UGC V1 result and bucket policies are separate and both exactly 50 MiB", () => {
  assert.equal(UGC_VIDEO_BUCKET_FILE_SIZE_LIMIT_BYTES, 52_428_800);
  assert.equal(UGC_VIDEO_RESULT_MAX_BYTES, 52_428_800);
  assert.equal(UGC_VIDEO_BUCKET_OPTIONS.fileSizeLimit, 52_428_800);
  assert.equal(UGC_VIDEO_BUCKET_OPTIONS.public, false);
  assert.deepEqual(UGC_VIDEO_BUCKET_OPTIONS.allowedMimeTypes, [
    "application/json",
    "video/mp4",
  ]);
});

test("reference input limit remains separate and unchanged at 20 MiB", () => {
  assert.equal(UGC_VIDEO_REFERENCE_TOTAL_MAX_BYTES, 20 * 1024 * 1024);
  assert.notEqual(
    UGC_VIDEO_REFERENCE_TOTAL_MAX_BYTES,
    UGC_VIDEO_RESULT_MAX_BYTES,
  );
});

test("unrelated Creative and existing Video storage limits remain unchanged", () => {
  const creative = readFileSync(
    "lib/creative-studio/server-storage.ts",
    "utf8",
  );
  const existingVideo = readFileSync(
    "supabase/migrations/20260818003000_video_studio_foundation_v1.sql",
    "utf8",
  );
  assert.match(creative, /fileSizeLimit: 50 \* 1024 \* 1024/);
  assert.match(existingVideo, /524288000/);
});
