import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  "supabase/migrations/20260817170000_deterministic_mockup_foundation_v1.sql",
  "utf8",
);

test("deterministic milestone migration is additive and tests never apply it", () => {
  assert.match(sql, /create table if not exists public\.product_profiles/i);
  assert.match(sql, /create table if not exists public\.image_production_stage_outputs/i);
  assert.match(sql, /add column if not exists production_mode/i);
  assert.doesNotMatch(sql, /\bdrop\s+(table|column|schema|database)\b/i);
  assert.doesNotMatch(sql, /\btruncate\b/i);
  assert.doesNotMatch(sql, /\bdelete\s+from\b/i);
  assert.doesNotMatch(sql, /\bupdate\s+public\./i);
  assert.match(sql, /validate_image_asset_stage_lineage/i);
  assert.match(sql, /stage\.generation_job_id = new\.generation_job_id/i);
});

test("legacy and deterministic executors query disjoint job contracts", () => {
  const legacy = readFileSync("lib/image/paid-generation/supabase-repository.ts", "utf8");
  const deterministic = readFileSync("lib/image/deterministic-runtime/supabase-job-repository.ts", "utf8");
  assert.match(legacy, /is\("input_contract_version", null\)/);
  assert.match(legacy, /is\("production_mode", null\)/);
  assert.match(deterministic, /eq\("input_contract_version", "image-generation-input-v2"\)/);
  assert.match(deterministic, /eq\("production_mode", "DETERMINISTIC_COMPOSITE"\)/);
});

test("new Product and stage persistence remains service-role only", () => {
  for (const table of ["product_profiles", "image_production_stage_outputs"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`, "i"));
  }
  assert.match(sql, /'product-profile-references'[\s\S]*false/i);
});
