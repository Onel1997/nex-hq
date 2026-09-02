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
  SupabaseUgcVideoJobStore,
  UgcVideoJobStateError,
  UgcVideoStorageError,
  UgcVideoStorageSetupError,
  isUgcVideoStorageObjectNotFound,
  readUgcVideoStorageObject,
  ugcVideoAuthenticatedObjectUrl,
  ugcVideoJobClaimPath,
  ugcVideoJobManifestPath,
  ugcVideoJobRootPath,
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

test("only explicit Supabase object absence becomes a missing UGC job", () => {
  assert.equal(
    isUgcVideoStorageObjectNotFound({
      status: 400,
      statusCode: "not_found",
      message: "Object not found",
    }),
    true,
  );
  assert.equal(
    isUgcVideoStorageObjectNotFound({
      status: 404,
      statusCode: "404",
      message: "Not Found",
    }),
    true,
  );
  assert.equal(
    isUgcVideoStorageObjectNotFound({
      status: 400,
      statusCode: "400",
      message: "Invalid storage request",
    }),
    false,
  );
  assert.equal(
    isUgcVideoStorageObjectNotFound({
      status: 503,
      statusCode: "service_unavailable",
      message: "Storage unavailable",
    }),
    false,
  );
});

const canonicalTestScope = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  actorId: "22222222-2222-4222-8222-222222222222",
};
const canonicalTestJobId = "33333333-3333-4333-8333-333333333333";

test("one canonical job path is shared by claim, manifest, and reads without encoding drift", () => {
  const root =
    "workspace/11111111-1111-4111-8111-111111111111/actor/22222222-2222-4222-8222-222222222222/jobs/33333333-3333-4333-8333-333333333333";
  assert.equal(
    ugcVideoJobRootPath(canonicalTestScope, canonicalTestJobId),
    root,
  );
  assert.equal(
    ugcVideoJobClaimPath(canonicalTestScope, canonicalTestJobId),
    `${root}/claim.json`,
  );
  assert.equal(
    ugcVideoJobManifestPath(canonicalTestScope, canonicalTestJobId),
    `${root}/manifest.json`,
  );
  assert.equal(
    ugcVideoAuthenticatedObjectUrl({
      configuredSupabaseUrl: "https://project.supabase.co",
      path: `${root}/manifest.json`,
    }).toString(),
    `https://project.supabase.co/storage/v1/object/authenticated/${UGC_VIDEO_ASSET_BUCKET}/${root}/manifest.json`,
  );
});

function privateObjectStorageFixture(input: {
  signedUrl?: string;
  signedError?: unknown;
}) {
  const signedPaths: string[] = [];
  return {
    signedPaths,
    storage: {
      async createSignedUrl(path: string) {
        signedPaths.push(path);
        return input.signedError
          ? { data: null, error: input.signedError }
          : {
              data: {
                signedUrl:
                  input.signedUrl ??
                  "https://project.supabase.co/storage/v1/object/sign/ugc-video-studio-assets/manifest.json?token=test",
              },
              error: null,
            };
      },
    },
  };
}

test("trusted private read uses authenticated Storage route and no-store", async () => {
  const fixture = privateObjectStorageFixture({});
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const bytes = await readUgcVideoStorageObject({
    storage: fixture.storage,
    path: ugcVideoJobManifestPath(
      canonicalTestScope,
      canonicalTestJobId,
    ),
    configuredSupabaseUrl: "https://project.supabase.co",
    serviceRoleKey: "server-secret-test-key",
    fetcher: (async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response("durable-manifest", { status: 200 });
    }) as typeof fetch,
  });
  assert.equal(bytes?.toString("utf8"), "durable-manifest");
  assert.equal(calls.length, 1);
  assert.match(calls[0]!.url, /\/object\/authenticated\/ugc-video-studio-assets\/workspace\//);
  assert.doesNotMatch(calls[0]!.url, /%252F|%2Fworkspace/);
  assert.equal(calls[0]!.init?.cache, "no-store");
  assert.equal(calls[0]!.init?.redirect, "error");
  assert.equal(fixture.signedPaths.length, 0);
});

test("a false direct 400 is recovered through a server-only signed confirmation", async () => {
  const path = ugcVideoJobManifestPath(
    canonicalTestScope,
    canonicalTestJobId,
  );
  const fixture = privateObjectStorageFixture({});
  const diagnostics: unknown[] = [];
  let calls = 0;
  const bytes = await readUgcVideoStorageObject({
    storage: fixture.storage,
    path,
    configuredSupabaseUrl: "https://project.supabase.co",
    serviceRoleKey: "server-secret-test-key",
    fetcher: (async () => {
      calls += 1;
      return calls === 1
        ? Response.json(
            { statusCode: "404", error: "not_found", message: "Object not found" },
            { status: 400 },
          )
        : new Response("existing-manifest", { status: 200 });
    }) as typeof fetch,
    onFallback: (diagnostic) => diagnostics.push(diagnostic),
  });
  assert.equal(bytes?.toString("utf8"), "existing-manifest");
  assert.deepEqual(fixture.signedPaths, [path]);
  assert.equal(calls, 2);
  assert.deepEqual(diagnostics, [
    { status: 400, code: "404", message: "Object not found" },
  ]);
});

test("only two independently explicit missing responses become object absence", async () => {
  const fixture = privateObjectStorageFixture({
    signedError: {
      status: 400,
      statusCode: "not_found",
      message: "Object not found",
    },
  });
  const result = await readUgcVideoStorageObject({
    storage: fixture.storage,
    path: "workspace/a/actor/b/jobs/c/manifest.json",
    configuredSupabaseUrl: "https://project.supabase.co",
    serviceRoleKey: "server-secret-test-key",
    fetcher: (async () =>
      Response.json(
        { statusCode: "not_found", message: "Object not found" },
        { status: 400 },
      )) as typeof fetch,
  });
  assert.equal(result, null);
});

test("a non-absence Storage 400 remains an inconsistent state", async () => {
  const fixture = privateObjectStorageFixture({
    signedError: {
      status: 400,
      statusCode: "invalid_request",
      message: "Invalid storage request",
    },
  });
  await assert.rejects(
    readUgcVideoStorageObject({
      storage: fixture.storage,
      path: "workspace/a/actor/b/jobs/c/manifest.json",
      configuredSupabaseUrl: "https://project.supabase.co",
      serviceRoleKey: "server-secret-test-key",
      fetcher: (async () =>
        Response.json(
          { statusCode: "400", message: "Invalid storage request" },
          { status: 400 },
        )) as typeof fetch,
    }),
    (error) =>
      error instanceof UgcVideoStorageError &&
      /signed_storage_read_failed:status=400;code=invalid_request/.test(
        error.technicalDetails,
      ),
  );
});

test("server-only signed fallback rejects an arbitrary host", async () => {
  const fixture = privateObjectStorageFixture({
    signedUrl: "https://malicious.example/manifest.json?token=secret",
  });
  await assert.rejects(
    readUgcVideoStorageObject({
      storage: fixture.storage,
      path: "workspace/a/actor/b/jobs/c/manifest.json",
      configuredSupabaseUrl: "https://project.supabase.co",
      serviceRoleKey: "server-secret-test-key",
      fetcher: (async () =>
        Response.json(
          { statusCode: "not_found", message: "Object not found" },
          { status: 400 },
        )) as typeof fetch,
    }),
    (error) =>
      error instanceof UgcVideoStorageError &&
      error.technicalDetails === "signed_storage_url_rejected",
  );
});

test("malformed and claim-only durable states never become missing jobs", async () => {
  const manifestPath = ugcVideoJobManifestPath(
    canonicalTestScope,
    canonicalTestJobId,
  );
  const malformed = new SupabaseUgcVideoJobStore(async (path) =>
    path === manifestPath ? Buffer.from("{not-json") : null,
  );
  await assert.rejects(
    malformed.readManifest(canonicalTestScope, canonicalTestJobId),
    (error) =>
      error instanceof UgcVideoJobStateError &&
      /manifest_invalid/.test(error.technicalDetails),
  );

  const claimOnly = new SupabaseUgcVideoJobStore(async (path) =>
    path.endsWith("/claim.json") ? Buffer.from("{}") : null,
  );
  await assert.rejects(
    claimOnly.readManifest(canonicalTestScope, canonicalTestJobId),
    (error) =>
      error instanceof UgcVideoJobStateError &&
      error.technicalDetails === "claim_exists_without_manifest",
  );
});

test("job GET authenticates ownership before the trusted private manifest read", () => {
  const route = readFileSync(
    "app/api/ugc-video-studio/jobs/[jobId]/route.ts",
    "utf8",
  );
  const storage = readFileSync(
    "lib/ugc-video-studio/server-storage.ts",
    "utf8",
  );
  assert.ok(
    route.indexOf("const access = await resolveXerianoAccess()") <
      route.indexOf("const run = await observeUgcVideoJob"),
  );
  assert.match(route, /workspaceId: access\.context\.workspaceKey/);
  assert.match(route, /actorId: access\.context\.userId/);
  assert.match(storage, /createAdminClient\(\)\.storage\.from/);
  assert.match(storage, /requireEnv\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  assert.doesNotMatch(route, /createSignedUrl|manifest\.json/);
});
