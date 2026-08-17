import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const paid = readFileSync(
  "supabase/migrations/20260817013000_image_paid_generation_jobs.sql",
  "utf8",
);
const authority = readFileSync(
  "supabase/migrations/20260817030000_design_image_production_authority.sql",
  "utf8",
);

test("pending Image production migrations remain additive and server-only", () => {
  for (const sql of [paid, authority]) {
    assert.doesNotMatch(sql, /\bdrop\s+(?:table|schema)\b/i);
    assert.doesNotMatch(sql, /\btruncate\b/i);
    assert.doesNotMatch(sql, /\bdelete\s+from\b/i);
    assert.match(sql, /revoke all[\s\S]+from public, anon, authenticated/i);
  }
  assert.match(paid, /'image-generation-inputs'[\s\S]+false/i);
  assert.match(authority, /'design-master-artworks'[\s\S]+false/i);
  assert.match(authority, /'image-production-assets'[\s\S]+false/i);
  assert.match(authority, /confirmation_expires_at >= p_now/i);
  assert.match(authority, /security definer[\s\S]+set search_path = public/i);
  assert.match(authority, /grant execute[\s\S]+to service_role/i);
});
