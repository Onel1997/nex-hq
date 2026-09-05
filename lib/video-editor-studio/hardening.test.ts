import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("trusted-size preflight precedes lease, claim, binding and source streaming", async () => {
  const service = await read("lib/video-editor-studio/service.ts");
  const create = service.slice(service.indexOf("export async function createDurableVideoEditorJob"), service.indexOf("export async function analyzeOwnedVideoEditorSource"));
  assert.ok(create.indexOf("validateVideoEditorRequestSources") < create.indexOf("leaseStore.acquire"));
  assert.ok(create.indexOf("leaseStore.acquire") < create.indexOf("store.claim"));
  assert.ok(create.indexOf("store.writeManifest(manifest)") < create.indexOf("bindVideoEditorTempSources"));
  assert.doesNotMatch(create, /streamVideoEditorSourceToFile/);
});

test("render lifecycle streams sources sequentially, enforces actual durations and cleans temp files", async () => {
  const service = await read("lib/video-editor-studio/service.ts");
  assert.match(service, /for \(const \[index, locator\] of preflight\.clips\.entries\(\)\)/);
  assert.match(service, /await streamVideoEditorSourceToFile/);
  assert.match(service, /VIDEO_EDITOR_MAX_SOURCE_DURATION_SECONDS/);
  assert.match(service, /VIDEO_EDITOR_MAX_TOTAL_SOURCE_DURATION_SECONDS/);
  assert.match(service, /finally \{[\s\S]*rm\(directory, \{ recursive: true, force: true \}\)[\s\S]*leaseStore\.release/);
  assert.doesNotMatch(service, /\.arrayBuffer\(\)/);
});

test("lease authority is private, atomic per account actor and has no SECURITY DEFINER escape", async () => {
  const [migration, lease] = await Promise.all([
    read("supabase/migrations/20260904201254_xeriamo_video_editor_references_and_render_lease.sql"),
    read("lib/video-editor-studio/lease.ts"),
  ]);
  assert.match(migration, /primary key \(account_id, actor_user_id\)/);
  assert.match(migration, /revoke all[\s\S]*public, anon, authenticated/);
  assert.match(migration, /grant all[\s\S]*service_role/);
  assert.doesNotMatch(migration, /security definer/i);
  assert.match(lease, /\.lte\("expires_at"/);
  assert.match(lease, /VIDEO_EDITOR_RENDER_ACTIVE/);
});

test("GET only reconciles expired manifests and never renders or claims", async () => {
  const [route, recovery] = await Promise.all([
    read("app/api/video-editor-studio/jobs/[jobId]/route.ts"),
    read("lib/video-editor-studio/recovery.ts"),
  ]);
  assert.match(route, /reconcileStaleVideoEditorJob/);
  assert.doesNotMatch(route + recovery, /processVideoEditorJob|store\.claim|after\(|queue\.submit/);
  assert.match(recovery, /TIMED_OUT/);
  assert.match(recovery, /status: "FAILED"/);
});

test("render response contains job state only and result uploads stream from disk", async () => {
  const [route, storage, service] = await Promise.all([
    read("app/api/video-editor-studio/render/route.ts"),
    read("lib/video-editor-studio/storage.ts"),
    read("lib/video-editor-studio/service.ts"),
  ]);
  assert.doesNotMatch(route, /\.mp4|arrayBuffer|Buffer/);
  assert.match(storage + service, /createReadStream/);
  assert.match(storage + service, /duplex: "half"/);
});
