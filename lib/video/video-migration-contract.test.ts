import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const sql = readFileSync(
  "supabase/migrations/20260818003000_video_studio_foundation_v1.sql",
  "utf8",
);
const sourceRepository = readFileSync(
  "lib/video/approved-image-source.ts",
  "utf8",
);
test("Video migration is additive, private, and server-only", () => {
  assert.doesNotMatch(sql, /\b(drop|truncate|delete\s+from)\b/i);
  for (const table of [
    "video_production_projects",
    "video_generation_jobs",
    "video_production_assets",
  ])
    assert.match(
      sql,
      new RegExp(`create table if not exists public\\.${table}`),
    );
  assert.match(sql, /public\s*=\s*false/);
  assert.match(sql, /revoke all[\s\S]*from public,anon,authenticated/);
  assert.match(sql, /grant all[\s\S]*to service_role/);
  assert.match(sql, /claim_video_generation_job/);
  assert.match(sql, /confirmation_expires_at > p_now/);
});
test("one job has one source and one output integrity boundary", () => {
  assert.match(sql, /job_id uuid not null unique/);
  assert.match(
    sql,
    /source_image_asset_id uuid not null references public\.image_production_assets/,
  );
  assert.match(sql, /result_asset_id uuid/);
  assert.match(sql, /unique\(workspace_id,input_fingerprint\)/);
});
test("approved Image source resolves the applied composite checksum column", () => {
  assert.match(sourceRepository, /\.select\("checksum"\)/);
  assert.doesNotMatch(sourceRepository, /checksum_sha256/);
});
